


import express from 'express';
import type { Request, Response } from 'express';
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

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
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
        await pool.query(`
            CREATE TABLE IF NOT EXISTS images (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                prompt TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                seed BIGINT
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
app.use('/', express.static(UPLOADS_DIR));

const upload = multer({ storage: multer.memoryStorage() });

// --- Gemini AI Setup ---
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable not set.");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- Agent Logging Helper ---
const logAgentActivity = async (
    agent_name: Tool | 'SYSTEM',
    user_prompt: string,
    status: 'SUCCESS' | 'ERROR' | 'INITIATED',
    options: {
        file_input?: string | null,
        model_response?: string | null,
        error_message?: string | null
    } = {}
) => {
    try {
        // Truncate long responses for logging
        const response_summary = options.model_response ? (options.model_response.length > 500 ? options.model_response.substring(0, 497) + '...' : options.model_response) : null;
        
        await pool.query(
            `INSERT INTO agent_activity (agent_name, user_prompt, status, file_input, model_response, error_message)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                agent_name,
                user_prompt,
                status,
                options.file_input,
                response_summary,
                options.error_message,
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


// === API Endpoints ===

// --- Multipart Form-Data Routes ---
// These routes use multer and must be defined *before* the global JSON body parser.

app.post('/api/summarize-document', upload.single('file'), async (req: Request, res: Response) => {
    const agentName: Tool = 'DOC_SUMMARY';
    const prompt = 'Summarize document';
    let filename: string | null = null;
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No file uploaded.' });
        filename = file.originalname;
        
        const { docPart } = await handleFileUpload(file);
        if (!docPart) throw new Error("File upload failed processing.");

        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: "Summarize the following document, providing a concise overview of its key points and main arguments." }, docPart] }]
        });
        const summary = getSafeText(result);
        res.json({ summary });
        await logAgentActivity(agentName, prompt, 'SUCCESS', { file_input: filename, model_response: summary });
    } catch (error) {
        console.error('Doc summary error:', error);
        res.status(500).json({ error: 'Document summarization failed.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { file_input: filename, error_message: errorMessage });
    }
});

app.post('/api/detect-content-safety', upload.single('file'), async (req: Request, res: Response) => {
    const agentName: Tool = 'CONTENT_DETECTOR';
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
        await logAgentActivity(agentName, prompt, 'SUCCESS', { file_input: filename, model_response: result.text });
    } catch (error) {
        console.error('Content safety detection error:', error);
        res.status(500).json({ error: 'Content safety detection failed.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { file_input: filename, error_message: errorMessage });
    }
});

app.post('/api/generate-text', upload.single('file'), async (req: Request, res: Response) => {
    const agentName: Tool = 'TEXT_GEN';
    const { prompt } = req.body;
    const file = req.file;
    const filename = file?.originalname;
    try {
        const { docPart } = await handleFileUpload(file);
        const parts: Part[] = [{ text: prompt }];
        if (docPart) parts.push(docPart);

        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts }],
            config: {
                systemInstruction: `You are an expert writing assistant and editor named 'Agent-Text'. Your purpose is to help the user with all forms of text creation and modification.
- If the user provides a document, use its content as the primary context for their request.
- If the user asks you to write something new, create high-quality, well-structured content that meets their specifications.
- Adhere to any formatting requirements, tones, or styles the user requests.
- Be concise and direct in your response, providing only the requested text output unless asked for commentary.`
            }
        });

        const text = getSafeText(result);
        res.json({ text });
        await logAgentActivity(agentName, prompt, 'SUCCESS', { file_input: filename, model_response: text });
    } catch (error) {
        console.error('Text generation error:', error);
        res.status(500).json({ error: 'Text generation failed.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { file_input: filename, error_message: errorMessage });
    }
});

app.post('/api/analyze-code', upload.single('file'), async (req: Request, res: Response) => {
    const agentName: Tool = 'CODE_ANALYSIS';
    const { prompt } = req.body;
    const file = req.file;
    const filename = file?.originalname;
    try {
        const { docPart } = await handleFileUpload(file);
        const parts: Part[] = [{ text: prompt }];
        if (docPart) {
            parts.push(docPart);
        } else if (!prompt) {
            return res.status(400).json({ error: 'No code provided to analyze.' });
        }
        
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts }],
            config: {
                systemInstruction: `You are an expert code analysis assistant named 'Agent-Code-Analyzer'. Your purpose is to provide a detailed and insightful analysis of the user-provided code.
- Explain what the code does, its purpose, and its overall structure.
- Identify any potential bugs, errors, or anti-patterns.
- Suggest improvements for performance, readability, and security.
- If the user asks a specific question, answer it directly in the context of the provided code.
- Format your response using clear markdown for readability, including code snippets where appropriate.`
            }
        });

        const text = getSafeText(result);
        res.json({ text });
        await logAgentActivity(agentName, prompt, 'SUCCESS', { file_input: filename, model_response: text });
    } catch (error) {
        console.error('Code analysis error:', error);
        res.status(500).json({ error: 'Code analysis failed.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { file_input: filename, error_message: errorMessage });
    }
});


app.post('/api/generate-video', upload.single('image'), async (req: Request, res: Response) => {
    const agentName: Tool = 'VIDEO_GEN';
    const { prompt, sourceImageFilename: clientSourceFilename } = req.body;
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
        await logAgentActivity(agentName, prompt, 'INITIATED', { file_input: savedSourceFilename, model_response: `Operation: ${operation.name}` });
    } catch (error) {
        console.error('Video generation error:', error);
        res.status(500).json({ error: 'Video generation failed.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { file_input: savedSourceFilename, error_message: `Initiation failed: ${errorMessage}`});
    }
});

app.post('/api/analyze-image', upload.single('file'), async (req: Request, res: Response) => {
    const agentName: Tool = 'IMAGE_ANALYSIS';
    const { prompt } = req.body;
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
        await logAgentActivity(agentName, prompt, 'SUCCESS', { file_input: filename, model_response: responseText });
    } catch (error) {
        console.error('Image analysis error:', error);
        res.status(500).json({ error: 'Image analysis failed.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { file_input: filename, error_message: errorMessage });
    } finally {
        if (geminiFile) {
            console.log(`Deleting temporary file ${geminiFile.name}...`);
            await ai.files.delete({ name: geminiFile.name });
            console.log('Temporary file deleted.');
        }
    }
});

app.post('/api/analyze-audio', upload.single('file'), async (req: Request, res: Response) => {
    const agentName: Tool = 'AUDIO_ANALYSIS';
    const prompt = 'Transcribe Audio';
    let filename: string | null = null;
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No audio file uploaded.' });
        filename = file.originalname;
        
        const localFilename = `${crypto.randomUUID()}${path.extname(file.originalname) || ''}`;
        await fs.promises.writeFile(path.join(UPLOADS_DIR, localFilename), file.buffer);
        
        console.log(`Uploading audio "${file.originalname}" to Gemini Files API...`);
        const geminiFile = await ai.files.upload({ file: file.buffer, mimeType: file.mimetype, displayName: file.originalname } as any);
        console.log(`Uploaded file as: ${geminiFile.uri}`);

        await pool.query( 'INSERT INTO audios (filename, original_filename, mime_type, gemini_uri) VALUES ($1, $2, $3, $4)',
            [localFilename, file.originalname, file.mimetype, geminiFile.uri]
        );
        
        const audioPart: Part = { fileData: { fileUri: geminiFile.uri, mimeType: geminiFile.mimeType } };
        const textPart: Part = { text: "Transcribe the following audio precisely. If there are distinct speakers, label them as 'Speaker 1', 'Speaker 2', etc." };

        const result = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: [{ parts: [textPart, audioPart] }] });
        
        const transcript = getSafeText(result);
        res.json({ transcript });
        await logAgentActivity(agentName, prompt, 'SUCCESS', { file_input: filename, model_response: transcript });
    } catch (error) {
        console.error('Audio analysis error:', error);
        res.status(500).json({ error: 'Audio analysis failed.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { file_input: filename, error_message: errorMessage });
    }
});


// --- JSON Body Routes ---
app.use('/api', express.json({ limit: '50mb' }));

app.post('/api/chat-stream', async (req: Request, res: Response) => {
  const agentName: Tool = 'CHAT';
  let prompt = '';
  try {
    const { history, message } = req.body;
    prompt = message?.[0]?.text || '';
    
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: `You are a specialized, multi-tool AI assistant. Your primary function is to act as a direct and efficient utility. You must adhere to the following principles which form your Master Control Program (MCP):
        1. **Persona & Tone:** You are a factual, concise, and helpful "Worker AI". Avoid conversational filler, opinions, and subjectivity. Respond directly to the user's request based on the tool being used.
        2. **Safety & Policy Adherence:** You must strictly adhere to all safety policies. If a request or content violates policy, refuse to process it.`,
      },
      history: history || [],
    });

    const stream = await chat.sendMessageStream({ message });
    
    res.setHeader('Content-Type', 'text/plain');
    let fullResponse = '';
    for await (const chunk of stream) {
      try {
        const text = chunk.text;
        fullResponse += text;
        res.write(text);
      } catch (e) {
        console.warn("Skipping a chunk due to safety block or other error.");
      }
    }
    res.end();
    await logAgentActivity(agentName, prompt, 'SUCCESS', { model_response: fullResponse });

  } catch (error) {
    console.error('Chat stream error:', error);
    res.status(500).send('Error during chat session.');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logAgentActivity(agentName, prompt, 'ERROR', { error_message: errorMessage });
  }
});

app.post('/api/generate-image', async (req: Request, res: Response) => {
    const agentName: Tool = 'IMAGE_GEN';
    const { prompt } = req.body;
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-3.0-generate-002', prompt, config: { numberOfImages: 1, outputMimeType: 'image/png' },
        });

        const generatedImage = response.generatedImages[0];
        const base64ImageBytes = generatedImage.image.imageBytes;
        const seed = (generatedImage as any).seed;

        const imageBuffer = Buffer.from(base64ImageBytes, 'base64');
        const filename = `${crypto.randomUUID()}.png`;
        const filepath = path.join(UPLOADS_DIR, filename);

        await fs.promises.writeFile(filepath, imageBuffer);
        
        await pool.query('INSERT INTO images (filename, prompt, seed) VALUES ($1, $2, $3)', [filename, prompt, seed]);
        
        res.json({ imageUrl: `/${filename}`, filename: filename });
        await logAgentActivity(agentName, prompt, 'SUCCESS', { model_response: `Generated: ${filename}, Seed: ${seed}` });
    } catch (error) {
        console.error('Image generation error:', error);
        res.status(500).json({ error: 'Image generation failed.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { error_message: errorMessage });
    }
});

app.post('/api/generate-code', async (req: Request, res: Response) => {
    const agentName: Tool = 'CODE_GEN';
    const { prompt } = req.body;
    try {
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction: `You are an expert code generation assistant. Your purpose is to provide complete, functional, and well-documented code based on the user's request. Respond only with the generated code, enclosed in a single markdown code block. Do not add any conversational text, explanations, or apologies outside of the code block.`,
            }
        });

        const code = getSafeText(result);
        res.json({ code });
        await logAgentActivity(agentName, prompt, 'SUCCESS', { model_response: code });
    } catch (error) {
        console.error('Code generation error:', error);
        res.status(500).json({ error: 'Code generation failed.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { error_message: errorMessage });
    }
});

app.post('/api/check-video-status', async (req: Request, res: Response) => {
    const agentName: Tool = 'VIDEO_GEN';
    const { operation, prompt, sourceImageFilename } = req.body;
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
                    (result.response.generatedVideos[0].video as any).localUrl = `/${filename}`;
                    delete (result.response.generatedVideos[0].video as any).uri;
                }
                await logAgentActivity(agentName, prompt, 'SUCCESS', { file_input: sourceImageFilename, model_response: `Generated: ${filename}` });
            } else {
                 throw new Error('Video generation finished but no download link was provided.');
            }
        }
        res.json(result);
    } catch (error) {
        console.error('Video status check error:', error);
        res.status(500).json({ error: 'Failed to check video status.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { file_input: sourceImageFilename, error_message: `Completion failed: ${errorMessage}` });
    }
});

app.post('/api/process-url', async (req: Request, res: Response) => {
    const agentName: Tool = 'URL_CONTEXT';
    const { url, prompt } = req.body;
    const fullPrompt = `Based on the content of the URL: ${url}, please answer the following question: ${prompt}`;
    try {
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash', contents: fullPrompt, config: { tools: [{ googleSearch: {} }] }
        });

        const responseText = getSafeText(result);
        res.json({ text: responseText });
        await logAgentActivity(agentName, fullPrompt, 'SUCCESS', { model_response: responseText });
    } catch (error) {
        console.error('URL processing error:', error);
        res.status(500).json({ error: 'Failed to process URL.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, fullPrompt, 'ERROR', { error_message: errorMessage });
    }
});

app.post('/api/synthesize-speech', async (req: Request, res: Response) => {
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

app.post('/api/get-weather', async (req: Request, res: Response) => {
    const agentName: Tool = 'WEATHER';
    const { location } = req.body;
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
        await logAgentActivity(agentName, prompt, 'SUCCESS', { model_response: result.text });
    } catch (error) {
        console.error('Weather fetch error:', error);
        res.status(500).json({ error: 'Failed to get weather data.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { error_message: errorMessage });
    }
});


// --- Other GET Routes ---

app.get('/api/gallery', async (req: Request, res: Response) => {
    try {
        const { rows } = await pool.query('SELECT filename, prompt, created_at, seed FROM images ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        console.error('Gallery fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch gallery images.' });
    }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
  initializeDb();
});