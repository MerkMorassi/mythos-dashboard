
import express = require('express');
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { GoogleGenAI, Part, Type, File as GeminiFile } from '@google/genai';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Pool } from 'pg';
import { Buffer } from 'buffer';
import type { Tool } from './types';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;
const UPLOADS_DIR = path.resolve('uploads');
const LOCAL_UPLOADS_DIR = path.resolve('local_uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}
if (!fs.existsSync(LOCAL_UPLOADS_DIR)) {
    fs.mkdirSync(LOCAL_UPLOADS_DIR);
}

// --- PostgreSQL Setup ---
const pool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: parseInt(process.env.PG_PORT || '5432'),
});

const initializeDb = async () => {
    try {
        // Drop feedback from images table, it's now in agent_activity
        await pool.query(`
            ALTER TABLE IF EXISTS images DROP COLUMN IF EXISTS feedback;
        `);
        await pool.query(`
            ALTER TABLE IF EXISTS images ADD COLUMN IF NOT EXISTS client_message_id VARCHAR(255);
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS images (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                prompt TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                seed BIGINT,
                client_message_id VARCHAR(255)
            );
        `);
         await pool.query(`
            CREATE TABLE IF NOT EXISTS documents (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                original_filename TEXT NOT NULL,
                mime_type VARCHAR(255) NOT NULL,
                gemini_uri VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS videos (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                prompt TEXT NOT NULL,
                source_image_filename VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS audios (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                original_filename TEXT NOT NULL,
                mime_type VARCHAR(255) NOT NULL,
                gemini_uri VARCHAR(255),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS agent_activity (
                id SERIAL PRIMARY KEY,
                agent_name VARCHAR(255) NOT NULL,
                user_prompt TEXT,
                file_input TEXT,
                model_response TEXT,
                status VARCHAR(50) NOT NULL,
                error_message TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                client_message_id VARCHAR(255) UNIQUE,
                feedback VARCHAR(10) CHECK (feedback IN ('like', 'dislike')),
                image_id INT REFERENCES images(id) ON DELETE SET NULL
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS local_images (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                original_filename TEXT NOT NULL,
                mime_type VARCHAR(100),
                analysis_text TEXT,
                tags TEXT[],
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Database tables are ready.');
    } catch (err) {
        console.error('Error initializing database tables:', err);
    }
};

// --- Middleware ---
app.use(cors());
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/local_uploads', express.static(LOCAL_UPLOADS_DIR));

const upload = multer({ storage: multer.memoryStorage() });

// --- Gemini AI Setup ---
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

const ANALYSIS_PROMPT = `
You are an expert descriptive analyst for high-quality imagery. Your task is to provide a detailed, accurate, and objective visual description of the provided image. Do not infer emotions or make subjective judgments.

Your response MUST be formatted in Markdown and structured in two distinct parts: "PART 1: ANALYSIS" and "PART 2: PROMPT SUGGESTION".

---

**PART 1: ANALYSIS**

Provide a detailed analysis of the image, divided into the following numbered sections. Each section number and title must be bolded. If a section is not applicable, state "Not applicable". Double newlines MUST be used between each numbered section for readability.

1.  **Main subject(s) and their primary, observable characteristics.**
    (Provide detailed description here)

2.  **Clothing or items in detail.**
    (Provide detailed description here)

3.  **Accessories.**
    (Provide detailed description here)

4.  **Pose and expression of any individuals.**
    (Provide detailed description here)

5.  **Characterize the background.**
    (Provide detailed description here)

6.  **Describe the overall lighting.**
    (Provide detailed description here)

---

**PART 2: PROMPT SUGGESTION**

Provide a prompt suggestion for generating a similar image. This part must contain a "Positive Prompt" and a "Negative Prompt" section.

Positive Prompt: 
A comma-separated list of keywords and descriptive phrases derived directly from your analysis in PART 1.

Negative Prompt: 
The following exact keywords, comma-separated: blurry, low quality, cartoon, watermark, signature, text, distorted, disfigured, bad anatomy, ugly, tiling, poor lighting, unnatural pose, human, accessories, clothing

---

Now, please provide the analysis and prompt suggestion for the image I will provide, strictly following the format above.
`;

// --- Agent Logging Helper ---
const logAgentActivity = async (
    agent_name: Tool | 'SYSTEM' | 'LOCAL_VIEWER',
    user_prompt: string,
    status: 'SUCCESS' | 'ERROR' | 'INITIATED',
    options: {
        file_input?: string | null,
        model_response?: string | null,
        error_message?: string | null,
        client_message_id?: string | null,
        image_id?: number | null,
    } = {}
) => {
    try {
        // Truncate long responses for logging
        const response_summary = options.model_response ? (options.model_response.length > 500 ? options.model_response.substring(0, 497) + '...' : options.model_response) : null;
        
        await pool.query(
            `INSERT INTO agent_activity (agent_name, user_prompt, status, file_input, model_response, error_message, client_message_id, image_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                agent_name,
                user_prompt,
                status,
                options.file_input,
                response_summary,
                options.error_message,
                options.client_message_id,
                options.image_id,
            ]
        );
    } catch (dbError) {
        console.error(`Failed to log agent activity for ${agent_name}:`, dbError);
    }
};


// A helper function for safe text extraction
const getSafeText = (result: any): string => {
    try {
        return result.text;
    } catch (e) {
        console.warn('Could not extract text from response, likely due to safety block.');
        return '';
    }
};

// A helper to handle optional file uploads to Gemini and local persistence
const handleFileUpload = async (file: Express.Multer.File | undefined) => {
    if (!file) return { docPart: null };

    const localFilename = `${crypto.randomUUID()}${path.extname(file.originalname) || ''}`;
    await fs.promises.writeFile(path.join(UPLOADS_DIR, localFilename), file.buffer);

    console.log(`Uploading file "${file.originalname}" to Gemini Files API...`);
    const geminiFile = await ai.files.upload({
        file: file.buffer,
        mimeType: file.mimetype,
        displayName: file.originalname,
    } as any);
    console.log(`Uploaded file as: ${geminiFile.uri}`);

    await pool.query(
        'INSERT INTO documents (filename, original_filename, mime_type, gemini_uri) VALUES ($1, $2, $3, $4)',
        [localFilename, file.originalname, file.mimetype, geminiFile.uri]
    );

    return { docPart: { fileData: { fileUri: geminiFile.uri, mimeType: geminiFile.mimeType } } };
};

const toolConfigs: Record<string, { systemInstruction?: string }> = {
    'CHAT': {
        systemInstruction: `You are a specialized, multi-tool AI assistant. Your primary function is to act as a direct and efficient utility. You must adhere to the following principles which form your Master Control Program (MCP):
        1. **Persona & Tone:** You are a factual, concise, and helpful "Worker AI". Avoid conversational filler, opinions, and subjectivity. Respond directly to the user's request based on the tool being used.
        2. **Safety & Policy Adherence:** You must strictly adhere to all safety policies. If a request or content violates policy, refuse to process it.`,
    },
    'TEXT_GEN': {
        systemInstruction: `You are an expert writing assistant and editor named 'Agent-Text'. Your purpose is to help the user with all forms of text creation and modification.
- If the user provides a document, use its content as the primary context for their request.
- If the user asks you to write something new, create high-quality, well-structured content that meets their specifications.
- Adhere to any formatting requirements, tones, or styles the user requests.
- Be concise and direct in your response, providing only the requested text output unless asked for commentary.`
    },
    'CODE_GEN': {
        systemInstruction: `You are an expert code generation assistant. Your purpose is to provide complete, functional, and well-documented code based on the user's request. Respond only with the generated code, enclosed in a single markdown code block. Do not add any conversational text, explanations, or apologies outside of the code block.`,
    },
    'CODE_ANALYSIS': {
        systemInstruction: `You are an expert code analysis assistant named 'Agent-Code-Analyzer'. Your purpose is to provide a detailed and insightful analysis of the user-provided code.
- Explain what the code does, its purpose, and its overall structure.
- Identify any potential bugs, errors, or anti-patterns.
- Suggest improvements for performance, readability, and security.
- If the user asks a specific question, answer it directly in the context of the provided code.
- Format your response using clear markdown for readability, including code snippets where appropriate.`
    },
    'DOC_SUMMARY': {},
    'AUDIO_ANALYSIS': {},
    'URL_CONTEXT': {},
};


// === API Endpoints ===

// --- Multipart Form-Data Routes ---
// These routes use multer and must be defined *before* the global JSON body parser.

app.post('/api/generate-stream', upload.single('file'), async (req: express.Request, res: express.Response) => {
    let { tool, prompt, history, clientMessageId } = req.body;
    const file = req.file;
    const agentName = tool as Tool;
    
    if (history && typeof history === 'string') {
        try { history = JSON.parse(history); } catch (e) { history = []; }
    }

    try {
        const config = toolConfigs[agentName];
        if (!config) {
            return res.status(400).json({ error: 'Invalid tool specified.' });
        }
        
        const { docPart } = await handleFileUpload(file);
        const parts: Part[] = [];

        if (prompt) parts.push({ text: prompt });
        if (docPart) parts.push(docPart);
        
        if (agentName === 'DOC_SUMMARY' && docPart) {
            parts.unshift({ text: "Summarize the following document, providing a concise overview of its key points and main arguments." });
        }
        if (agentName === 'AUDIO_ANALYSIS' && docPart) {
            parts.unshift({ text: "Transcribe the following audio precisely. If there are distinct speakers, label them as 'Speaker 1', 'Speaker 2', etc." });
        }

        res.setHeader('Content-Type', 'text/plain');
        let fullResponse = '';

        if (agentName === 'CHAT') {
            const chat = ai.chats.create({
              model: 'gemini-2.5-flash',
              config: { systemInstruction: config.systemInstruction },
              history: history || [],
            });
            const stream = await chat.sendMessageStream({ message: parts });
            
            for await (const chunk of stream) {
                const text = getSafeText(chunk);
                fullResponse += text;
                res.write(text);
            }
        } else {
            const request: any = { model: 'gemini-2.5-flash', config: {} };
            
            if (agentName === 'URL_CONTEXT') {
                request.config.tools = [{ googleSearch: {} }];
                const urlRegex = /(https?:\/\/[^\s]+)/;
                const match = prompt.match(urlRegex);
                const url = match ? match[0] : '';
                const question = prompt.replace(url, '').trim();
                request.contents = [{ parts: [{ text: `Based on the content of the URL: ${url}, please answer the following question: ${question}` }] }];
            } else {
                request.contents = [{ parts }];
                if (config.systemInstruction) {
                    request.config.systemInstruction = config.systemInstruction;
                }
            }

            const stream = await ai.models.generateContentStream(request);

            for await (const chunk of stream) {
                const text = getSafeText(chunk);
                fullResponse += text;
                res.write(text);
            }
        }
        
        res.end();
        await logAgentActivity(agentName, prompt, 'SUCCESS', { file_input: file?.originalname, model_response: fullResponse, client_message_id: clientMessageId });

    } catch (error) {
        console.error(`${agentName} stream error:`, error);
        res.end();
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { file_input: file?.originalname, error_message: errorMessage, client_message_id: clientMessageId });
    }
});


app.post('/api/detect-content-safety', upload.single('file'), async (req: express.Request, res: express.Response) => {
    const agentName: Tool = 'CONTENT_DETECTOR';
    const { clientMessageId } = req.body;
    const prompt = 'Detect content safety';
    let filename: string | null = null;
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No file uploaded.' });
        filename = file.originalname;

        const { docPart } = await handleFileUpload(file);
        if (!docPart) throw new Error("File upload failed processing.");
        
        const systemPrompt = `You are a content safety moderation system. Analyze the following document's text content. Determine if it violates safety guidelines, specifically for NSFW (Not Safe For Work), hate speech, or other explicit content. Your response must strictly be a JSON object.`;
        
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [ {text: systemPrompt}, docPart] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        category: { type: Type.STRING, description: "The safety category. Must be one of: 'SAFE', 'POTENTIALLY_UNSAFE', 'UNSAFE'." },
                        reason: { type: Type.STRING, description: "A brief, neutral explanation for the categorization." },
                    },
                    required: ["category", "reason"],
                }
            }
        });
        
        const jsonResponse = JSON.parse(result.text);
        res.json(jsonResponse);
        await logAgentActivity(agentName, prompt, 'SUCCESS', { file_input: filename, model_response: result.text, client_message_id: clientMessageId });
    } catch (error) {
        console.error('Content safety detection error:', error);
        res.status(500).json({ error: 'Content safety detection failed.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { file_input: filename, error_message: errorMessage, client_message_id: clientMessageId });
    }
});

app.post('/api/generate-video', upload.single('image'), async (req: express.Request, res: express.Response) => {
    const agentName: Tool = 'VIDEO_GEN';
    const { prompt, sourceImageFilename: clientSourceFilename, clientMessageId } = req.body;
    const uploadedImage = req.file;
    let savedSourceFilename: string | null = clientSourceFilename || null;
    
    try {
        let imagePart: { imageBytes: string; mimeType: string } | undefined;
        if (uploadedImage) {
            const localFilename = `${crypto.randomUUID()}${path.extname(uploadedImage.originalname) || ''}`;
            await fs.promises.writeFile(path.join(UPLOADS_DIR, localFilename), uploadedImage.buffer);
            savedSourceFilename = localFilename;
            imagePart = { imageBytes: uploadedImage.buffer.toString('base64'), mimeType: uploadedImage.mimetype };
        } else if (savedSourceFilename) {
            const imagePath = path.join(UPLOADS_DIR, savedSourceFilename);
            if (fs.existsSync(imagePath)) {
                const imageBuffer = await fs.promises.readFile(imagePath);
                imagePart = { imageBytes: imageBuffer.toString('base64'), mimeType: 'image/png' };
            }
        }
        
        const requestPayload: { model: string; prompt: string; config: { numberOfVideos: number }; image?: { imageBytes: string; mimeType: string }; } = {
            model: 'veo-2.0-generate-001', prompt, config: { numberOfVideos: 1 },
        };
        if (imagePart) requestPayload.image = imagePart;

        const operation = await ai.models.generateVideos(requestPayload);
        res.json({ ...operation, sourceImageFilename: savedSourceFilename });
        await logAgentActivity(agentName, prompt, 'INITIATED', { file_input: savedSourceFilename, model_response: `Operation: ${operation.name}`, client_message_id: clientMessageId });
    } catch (error) {
        console.error('Video generation error:', error);
        res.status(500).json({ error: 'Video generation failed.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { file_input: savedSourceFilename, error_message: `Initiation failed: ${errorMessage}`, client_message_id: clientMessageId });
    }
});

app.post('/api/analyze-image', upload.single('file'), async (req: express.Request, res: express.Response) => {
    const agentName: Tool = 'IMAGE_ANALYSIS';
    const { clientMessageId } = req.body;
    const prompt = ANALYSIS_PROMPT;
    let filename: string | null = null;
    let geminiFile: GeminiFile | undefined;
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No file uploaded.' });
        filename = file.originalname;

        console.log(`Uploading temporary image "${filename}" to Gemini Files API for analysis...`);
        geminiFile = await ai.files.upload({
            file: file.buffer, mimeType: file.mimetype, displayName: filename
        } as any);
        console.log(`Uploaded file as: ${geminiFile.uri}`);

        const imagePart: Part = { fileData: { fileUri: geminiFile.uri, mimeType: geminiFile.mimeType } };
        const textPart: Part = { text: prompt };

        const result = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: [{ parts: [imagePart, textPart] }] });
        
        const responseText = getSafeText(result);
        res.json({ text: responseText });
        await logAgentActivity(agentName, prompt, 'SUCCESS', { file_input: filename, model_response: responseText, client_message_id: clientMessageId });
    } catch (error) {
        console.error('Image analysis error:', error);
        res.status(500).json({ error: 'Image analysis failed.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { file_input: filename, error_message: errorMessage, client_message_id: clientMessageId });
    } finally {
        if (geminiFile) {
            console.log(`Deleting temporary file ${geminiFile.name}...`);
            await ai.files.delete({ name: geminiFile.name });
            console.log('Temporary file deleted.');
        }
    }
});


// === LOCAL IMAGE VIEWER ROUTES ===
app.post('/api/local-images/upload', upload.array('images', 20), async (req: express.Request, res: express.Response) => {
    const agentName = 'LOCAL_VIEWER';
    const prompt = 'Upload images';
    try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded.' });
        }
        
        const dbPromises = files.map(async file => {
            const filename = `${crypto.randomUUID()}${path.extname(file.originalname)}`;
            const filepath = path.join(LOCAL_UPLOADS_DIR, filename);
            await fs.promises.writeFile(filepath, file.buffer);
            return pool.query(
                'INSERT INTO local_images (filename, original_filename, mime_type) VALUES ($1, $2, $3)',
                [filename, file.originalname, file.mimetype]
            );
        });

        await Promise.all(dbPromises);
        res.status(201).json({ message: `${files.length} images uploaded successfully.` });
        await logAgentActivity(agentName, prompt, 'SUCCESS', { file_input: `${files.length} files` });
    } catch (error) {
        console.error('Local image upload error:', error);
        res.status(500).json({ error: 'Failed to upload images.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { error_message: errorMessage });
    }
});

app.post('/api/local-images/:id/analyze', async (req: express.Request, res: express.Response) => {
    const agentName = 'LOCAL_VIEWER';
    const { id } = req.params;
    const prompt = `Analyze image ID ${id}`;
    let filename: string | null = null;
    try {
        const { rows } = await pool.query('SELECT filename FROM local_images WHERE id = $1', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Image not found.' });
        }
        filename = rows[0].filename;
        const imagePath = path.join(LOCAL_UPLOADS_DIR, filename);
        const imageBuffer = await fs.promises.readFile(imagePath);

        const imagePart = { inlineData: { data: imageBuffer.toString('base64'), mimeType: 'image/png' } };
        const textPart = { text: ANALYSIS_PROMPT };

        const result = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: [{ parts: [imagePart, textPart] }] });
        const analysisText = getSafeText(result);
        
        let tags: string[] = [];
        const positivePromptMatch = analysisText.match(/Positive Prompt:\s*([\s\S]*?)Negative Prompt:/);
        if (positivePromptMatch && positivePromptMatch[1]) {
            tags = positivePromptMatch[1].split(',').map(tag => tag.trim()).filter(Boolean);
        }

        const updateResult = await pool.query(
            'UPDATE local_images SET analysis_text = $1, tags = $2 WHERE id = $3 RETURNING *',
            [analysisText, tags, id]
        );

        res.json(updateResult.rows[0]);
        await logAgentActivity(agentName, prompt, 'SUCCESS', { file_input: filename, model_response: analysisText });

    } catch (error) {
        console.error(`Error analyzing local image ${id}:`, error);
        res.status(500).json({ error: 'Failed to analyze image.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { file_input: filename, error_message: errorMessage });
    }
});

// --- JSON Body Routes ---
app.use('/api', express.json({ limit: '50mb' }));

app.post('/api/generate-image', async (req: express.Request, res: express.Response) => {
    const agentName: Tool = 'IMAGE_GEN';
    const { prompt, clientMessageId } = req.body;
    try {
        const likedPromptsResult = await pool.query(
            `SELECT i.prompt FROM images i
             JOIN agent_activity a ON i.id = a.image_id
             WHERE a.feedback = 'like' ORDER BY RANDOM() LIMIT 3`
        );
        const likedPrompts = likedPromptsResult.rows.map(r => r.prompt);

        let systemInstruction: string | undefined;
        if (likedPrompts.length > 0) {
            systemInstruction = `You are an AI image generator. The user has previously liked images created from these prompts:
- "${likedPrompts.join('"\n- "')}"
Use this as strong inspiration for the artistic style, mood, and subject matter when generating an image for the user's new prompt. Prioritize matching the user's preferences demonstrated by their liked images.`;
        }

        const response = await ai.models.generateImages({
            model: 'imagen-3.0-generate-002', 
            prompt, 
            config: { 
                numberOfImages: 1, 
                outputMimeType: 'image/png',
                ...(systemInstruction && { systemInstruction })
            },
        });

        const generatedImage = response.generatedImages[0];
        const base64ImageBytes = generatedImage.image.imageBytes;
        const seed = (generatedImage as any).seed;

        const imageBuffer = Buffer.from(base64ImageBytes, 'base64');
        const filename = `${crypto.randomUUID()}.png`;
        const filepath = path.join(UPLOADS_DIR, filename);

        await fs.promises.writeFile(filepath, imageBuffer);
        
        const dbResult = await pool.query(
            'INSERT INTO images (filename, prompt, seed, client_message_id) VALUES ($1, $2, $3, $4) RETURNING id', 
            [filename, prompt, seed, clientMessageId]
        );
        const newId = dbResult.rows[0].id;
        
        res.json({ imageUrl: `/uploads/${filename}`, filename: filename, id: newId });
        await logAgentActivity(agentName, prompt, 'SUCCESS', { model_response: `Generated: ${filename}, Seed: ${seed}`, client_message_id: clientMessageId, image_id: newId });
    } catch (error) {
        console.error('Image generation error:', error);
        res.status(500).json({ error: 'Image generation failed.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { error_message: errorMessage, client_message_id: clientMessageId });
    }
});

app.post('/api/feedback', async (req: express.Request, res: express.Response) => {
    const { clientMessageId, feedback } = req.body;

    if (!clientMessageId || !['like', 'dislike'].includes(feedback)) {
        return res.status(400).json({ error: 'Invalid request body.' });
    }

    try {
        const result = await pool.query(
            'UPDATE agent_activity SET feedback = $1 WHERE client_message_id = $2 RETURNING id',
            [feedback, clientMessageId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Message log not found.' });
        }
        
        res.status(200).json({ message: 'Feedback saved.' });
    } catch (error) {
        console.error(`Error saving feedback for message ${clientMessageId}:`, error);
        res.status(500).json({ error: 'Failed to save feedback.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity('SYSTEM', `Feedback for message ${clientMessageId}`, 'ERROR', { error_message: errorMessage });
    }
});

app.post('/api/check-video-status', async (req: express.Request, res: express.Response) => {
    const agentName: Tool = 'VIDEO_GEN';
    const { operation, prompt, sourceImageFilename, clientMessageId } = req.body;
    try {
        const result = await ai.operations.getVideosOperation({ operation });

        if (result.done) {
            const downloadLink = result.response?.generatedVideos?.[0]?.video?.uri;
            if (downloadLink) {
                const videoUrl = `${downloadLink}&key=${API_KEY}`;
                const videoResponse = await fetch(videoUrl);
                if (!videoResponse.ok || !videoResponse.body) {
                    throw new Error(`Failed to fetch video from Google, status: ${videoResponse.status}`);
                }
                const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());
                const filename = `${crypto.randomUUID()}.mp4`;
                const filepath = path.join(UPLOADS_DIR, filename);
                await fs.promises.writeFile(filepath, videoBuffer);
                
                await pool.query( 'INSERT INTO videos (filename, prompt, source_image_filename) VALUES ($1, $2, $3)',
                    [filename, prompt, sourceImageFilename]
                );

                if (result.response?.generatedVideos?.[0]?.video) {
                    (result.response.generatedVideos[0].video as any).localUrl = `/uploads/${filename}`;
                    delete (result.response.generatedVideos[0].video as any).uri;
                }
                await logAgentActivity(agentName, prompt, 'SUCCESS', { file_input: sourceImageFilename, model_response: `Generated: ${filename}`, client_message_id: clientMessageId });
            } else {
                 throw new Error('Video generation finished but no download link was provided.');
            }
        }
        res.json(result);
    } catch (error) {
        console.error('Video status check error:', error);
        res.status(500).json({ error: 'Failed to check video status.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { file_input: sourceImageFilename, error_message: `Completion failed: ${errorMessage}`, client_message_id: clientMessageId });
    }
});

app.post('/api/synthesize-speech', async (req: express.Request, res: express.Response) => {
    try {
        const { text, voiceId, ttsModelId } = req.body;
        
        let url: string;
        let requestBody: any;

        if (ttsModelId === 'text-to-speech') {
            url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`;
            requestBody = {
                input: { text }, voice: { name: voiceId }, audioConfig: { audioEncoding: 'MP3' },
            };
        } else {
            url = `https://generativelanguage.googleapis.com/v1beta/models/${ttsModelId}:synthesizeSpeech?key=${API_KEY}`;
            requestBody = {
                input: { text }, voice: { name: `voices/${voiceId}` }, audioConfig: { audioEncoding: 'MP3' },
            };
        }
        
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });

        if (!response.ok) {
            const errorBody = await response.json();
            console.error('TTS API Error:', errorBody);
            throw new Error(errorBody?.error?.message || `TTS API failed with status ${response.status}`);
        }
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('TTS error:', error);
        res.status(500).json({ error: 'Speech synthesis failed.' });
    }
});

app.post('/api/get-weather', async (req: express.Request, res: express.Response) => {
    const agentName: Tool = 'WEATHER';
    const { location, clientMessageId } = req.body;
    const prompt = `Get weather for: ${location}`;
    try {
        if (!location) {
            return res.status(400).json({ error: 'Location is required.' });
        }

        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `What is the current weather in ${location}?`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        location: { type: Type.STRING, description: 'The city and state, e.g., "San Francisco, CA"' },
                        temperature: { type: Type.NUMBER, description: 'The current temperature.' },
                        unit: { type: Type.STRING, description: 'The unit of temperature, either "C" for Celsius or "F" for Fahrenheit.' },
                        condition: { type: Type.STRING, description: 'A brief description of the weather conditions, e.g., "Sunny", "Cloudy", "Rain".' },
                        humidity: { type: Type.NUMBER, description: 'The humidity percentage, e.g., 65.' },
                    },
                    required: ["location", "temperature", "unit", "condition", "humidity"],
                }
            }
        });

        const weatherData = JSON.parse(result.text);
        res.json(weatherData);
        await logAgentActivity(agentName, prompt, 'SUCCESS', { model_response: result.text, client_message_id: clientMessageId });
    } catch (error) {
        console.error('Weather fetch error:', error);
        res.status(500).json({ error: 'Failed to get weather data.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { error_message: errorMessage, client_message_id: clientMessageId });
    }
});


// --- Other GET/DELETE Routes ---

app.get('/api/gallery', async (req: express.Request, res: express.Response) => {
    try {
        const { rows } = await pool.query(`
            SELECT 
                i.id, 
                i.filename, 
                i.prompt, 
                i.created_at, 
                i.seed, 
                i.client_message_id,
                a.feedback
            FROM images i
            LEFT JOIN agent_activity a ON i.client_message_id = a.client_message_id
            ORDER BY i.created_at DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error('Gallery fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch gallery images.' });
    }
});

app.get('/api/local-images', async (req: express.Request, res: express.Response) => {
    try {
        const { rows } = await pool.query('SELECT * FROM local_images ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        console.error('Local images fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch local images.' });
    }
});

app.delete('/api/local-images/:id', async (req: express.Request, res: express.Response) => {
    const agentName = 'LOCAL_VIEWER';
    const { id } = req.params;
    const prompt = `Delete image ID ${id}`;
    try {
        const { rows } = await pool.query('SELECT filename FROM local_images WHERE id = $1', [id]);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Image not found.' });
        }
        
        const filename = rows[0].filename;
        const filepath = path.join(LOCAL_UPLOADS_DIR, filename);

        await pool.query('DELETE FROM local_images WHERE id = $1', [id]);
        
        if (fs.existsSync(filepath)) {
            await fs.promises.unlink(filepath);
        }

        res.status(200).json({ message: 'Image deleted successfully.' });
        await logAgentActivity(agentName, prompt, 'SUCCESS', { file_input: filename });
    } catch (error) {
        console.error(`Error deleting local image ${id}:`, error);
        res.status(500).json({ error: 'Failed to delete image.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { error_message: errorMessage });
    }
});


app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
  initializeDb();
});
