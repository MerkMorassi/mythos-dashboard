// FIX: Use express.Request and express.Response to avoid type conflicts with global types.
// FIX: Explicitly import Request and Response from express to resolve type conflicts with global types (e.g. from DOM).
import express, { Request, Response } from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import { GoogleGenAI, Part, Type } from '@google/genai';
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
const RAG_DIR = path.resolve('rag_uploads');
const MIDI_EXPORTS_DIR = path.resolve('midi_exports');


if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(LOCAL_UPLOADS_DIR)) {
    fs.mkdirSync(LOCAL_UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(RAG_DIR)) {
    fs.mkdirSync(RAG_DIR, { recursive: true });
}
if (!fs.existsSync(MIDI_EXPORTS_DIR)) {
    fs.mkdirSync(MIDI_EXPORTS_DIR, { recursive: true });
}

// --- PostgreSQL Setup ---
const pool = new Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG__DATABASE,
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
                seed BIGINT,
                client_message_id VARCHAR(255)
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
        // Add feedback column to images if it doesn't exist
        const columns = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='images' AND column_name='feedback';
        `);
        if (columns.rowCount === 0) {
             await pool.query(`
                ALTER TABLE images 
                ADD COLUMN feedback VARCHAR(10) CHECK (feedback IN ('like', 'dislike'));
            `);
        }
        
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
        await pool.query(`
            CREATE TABLE IF NOT EXISTS rag_documents (
                id SERIAL PRIMARY KEY,
                filename VARCHAR(255) NOT NULL,
                original_filename TEXT NOT NULL,
                content TEXT NOT NULL,
                repository VARCHAR(255) NOT NULL, -- 'common' or agent_id
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
app.use(express.json()); // Body parser for JSON requests
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/local_uploads', express.static(LOCAL_UPLOADS_DIR));
app.use('/rag_uploads', express.static(RAG_DIR));
app.use('/midi_exports', express.static(MIDI_EXPORTS_DIR));


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
    agent_name: Tool | 'SYSTEM' | 'LOCAL_VIEWER' | string,
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

const AGENT_PROMPTS: Record<string, string> = {
    'mythos_assistant': `You are Mythos Assistant, a specialized, multi-tool AI. Your primary function is to act as a direct and efficient utility. You must adhere to the following principles which form your Master Control Program (MCP):
1. **Persona & Tone:** You are a factual, concise, and helpful "Worker AI". Avoid conversational filler, opinions, and subjectivity. Respond directly to the user's request based on the tool being used.
2. **Safety & Policy Adherence:** You must strictly adhere to all safety policies. If a request or content violates policy, refuse to process it.`,
    'sophia': "You are Sophia, an AI agent specializing in Philosophy & Wisdom. Respond to the user's query from a deep, philosophical perspective. Consider the ethical, metaphysical, and epistemological implications. Your tone should be contemplative, insightful, and clear.",
    'barbelo': "You are Barbelo, an AI agent of Divine Emanation. Your insights perceive the deeper, often hidden, patterns and connections within the user's query. Respond with a sense of cosmic awareness and archetypal understanding. Your language should be symbolic and evocative.",
    'shannon': "You are Shannon, an AI agent expert in Information Theory. Analyze the user's query in terms of data, patterns, entropy, and signal vs. noise. Provide a structured, logical response that clarifies complexity and reveals the underlying information architecture.",
    'clio': "You are Clio, the AI agent of History & Memory. Contextualize the user's query within its historical framework. Draw parallels to past events, trends, and figures. Your response should provide a rich, historically-informed perspective.",
    'erato': "You are Erato, the AI agent of Love & Poetry. Respond to the user's query through the lens of emotion, connection, and artistic expression. Your language should be creative, empathetic, and find the poetic essence within the topic.",
    'melpomene': "You are Melpomene, the AI agent of Tragedy & Drama. Examine the user's query for its inherent conflicts, tensions, and dramatic potential. Your response should explore the serious, challenging, and profound aspects of the topic with a dignified and solemn tone.",
    'polyhymnia': "You are Polyhymnia, the AI agent of Sacred Hymns. Interpret the user's query in a way that elevates it, finding the universal, spiritual, or sacred dimension within. Your response should be reverent, inspiring, and speak to higher principles.",
    'terpsichore': "You are Terpsichore, the AI agent of Dance & Movement. Frame your response using metaphors of rhythm, flow, structure, and improvisation. Analyze the dynamics and interplay of elements in the user's query as a form of choreography.",
    'thalia': "You are Thalia, the AI agent of Comedy & Joy. Find the humor, irony, or lighthearted perspective in the user's query. Your response should be witty, optimistic, and celebrate the joyful or absurd aspects of the situation.",
    'urania': "You are Urania, the AI agent of Astronomy & Math. Respond to the user's query with a focus on universal laws, mathematical elegance, and cosmic scale. Use logic, data, and a perspective of grand, interconnected systems.",
    'calliope': "You are Calliope, the AI agent of Epic Poetry. Frame the user's query as part of a larger narrative or heroic journey. Your response should be eloquent, structured, and tell a compelling story that provides context and meaning.",
    'euterpe': "You are Euterpe, the AI agent of Music & Harmony. Analyze the user's query in terms of resonance, harmony, dissonance, and composition. Your response should explore how different elements work together to create a unified or discordant whole.",
    'mnemosyne': "You are Mnemosyne, the AI agent of Memory & Learning. Access and synthesize vast amounts of information to provide a comprehensive, data-rich answer. Your response should focus on learning, knowledge retention, and building a clear mental model of the topic for the user.",
};

const toolConfigs: Record<string, { systemInstruction?: string }> = {
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

app.post('/api/generate-stream', upload.single('file'), async (req: Request, res: Response) => {
    let { tool, prompt, history, clientMessageId, activeAgents } = req.body;
    const file = req.file;
    const agentName = tool as Tool;
    
    try {
        if (history && typeof history === 'string') {
            try { history = JSON.parse(history); } catch (e) { history = []; }
        }
        if (activeAgents && typeof activeAgents === 'string') {
            try { activeAgents = JSON.parse(activeAgents); } catch (e) { activeAgents = []; }
        }

        const config = toolConfigs[agentName] || AGENT_PROMPTS[agentName];
        if (!config && agentName !== 'AGENT_HUB') {
            return res.status(400).json({ error: 'Invalid tool specified.' });
        }
        
        let filePart: Part | null = null;
        if(file) {
            filePart = { inlineData: { data: file.buffer.toString('base64'), mimeType: file.mimetype } };
        }
        
        const parts: Part[] = [];

        if (prompt) parts.push({ text: prompt });
        if (filePart) parts.push(filePart);
        
        if (agentName === 'DOC_SUMMARY' && filePart) {
            parts.unshift({ text: "Summarize the following document, providing a concise overview of its key points and main arguments." });
        }
        if (agentName === 'AUDIO_ANALYSIS' && filePart) {
            parts.unshift({ text: "Transcribe the following audio precisely. If there are distinct speakers, label them as 'Speaker 1', 'Speaker 2', etc." });
        }

        res.setHeader('Content-Type', 'text/plain');
        
        if (agentName === 'AGENT_HUB') {
            const agentsToQuery: string[] = activeAgents || [];
            if (agentsToQuery.length === 0) {
                 res.write("Error: No agents selected.");
                 res.end();
                 return;
            }

            // --- RAG Step for Agents ---
            const { rows: ragDocs } = await pool.query(
                `SELECT repository, content FROM rag_documents WHERE repository = 'common' OR repository = ANY($1::text[])`,
                [agentsToQuery]
            );

            for (const agentId of agentsToQuery) {
                let fullResponse = '';
                const agentSystemPrompt = AGENT_PROMPTS[agentId] || (toolConfigs as any).AGENT_HUB.systemInstruction;
                
                const agentSpecificDocs = ragDocs.filter(d => d.repository === agentId).map(d => d.content);
                const commonDocs = ragDocs.filter(d => d.repository === 'common').map(d => d.content);
                const ragContext = [...commonDocs, ...agentSpecificDocs].join('\n\n---\n\n');
                
                const finalSystemPrompt = ragContext 
                    ? `${agentSystemPrompt}\n\n## Reference Information:\nUse the following information from your knowledge base to inform your response:\n${ragContext}`
                    : agentSystemPrompt;

                try {
                    const chat = ai.chats.create({
                        model: 'gemini-2.5-flash',
                        config: { systemInstruction: finalSystemPrompt },
                        history: history || [],
                    });
                    const stream = await chat.sendMessageStream({ message: parts });
                    
                    // Prefix the stream with the agent ID
                    res.write(`${agentId}::`);

                    for await (const chunk of stream) {
                        const text = getSafeText(chunk);
                        fullResponse += text;
                        res.write(text);
                    }
                    // Add this agent's response to history for the next one
                    if (history) {
                        history.push({ role: 'model', parts: [{ text: fullResponse }] });
                    }
                     await logAgentActivity(agentId, prompt, 'SUCCESS', { file_input: file?.originalname, model_response: fullResponse, client_message_id: clientMessageId });
                } catch(agentError) {
                    console.error(`Error with agent ${agentId}:`, agentError);
                    const errorMessage = agentError instanceof Error ? agentError.message : 'Unknown error';
                    res.write(`${agentId}::\n**Error from ${agentId}:** ${errorMessage}\n`);
                    await logAgentActivity(agentId, prompt, 'ERROR', { file_input: file?.originalname, error_message: errorMessage, client_message_id: clientMessageId });
                }
            }

        } else {
            let fullResponse = '';
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
                if (toolConfigs[agentName]?.systemInstruction) {
                    request.config.systemInstruction = toolConfigs[agentName]?.systemInstruction;
                }
            }

            const stream = await ai.models.generateContentStream(request);

            for await (const chunk of stream) {
                const text = getSafeText(chunk);
                fullResponse += text;
                res.write(text);
            }
            await logAgentActivity(agentName, prompt, 'SUCCESS', { file_input: file?.originalname, model_response: fullResponse, client_message_id: clientMessageId });
        }
        
        res.end();

    } catch (error) {
        console.error(`${agentName} stream error:`, error);
        res.end();
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { file_input: file?.originalname, error_message: errorMessage, client_message_id: clientMessageId });
    }
});

app.post('/api/detect-content-safety', upload.single('file'), async (req: Request, res: Response) => {
    const agentName: Tool = 'CONTENT_DETECTOR';
    const { clientMessageId } = req.body;
    const prompt = 'Detect content safety';
    let filename: string | null = null;
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No file uploaded.' });
        filename = file.originalname;

        const filePart: Part = { inlineData: { data: file.buffer.toString('base64'), mimeType: file.mimetype } };
        
        const systemPrompt = `You are a content safety moderation system. Analyze the following document's text content. Determine if it violates safety guidelines, specifically for NSFW (Not Safe For Work), hate speech, or other explicit content. Your response must strictly be a JSON object.`;
        
        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [ {text: systemPrompt}, filePart] }],
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

app.post('/api/generate-video', upload.single('image'), async (req: Request, res: Response) => {
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
                imagePart = { imageBytes: imageBuffer.toString('base64'), mimeType: 'image/png' }; // Assuming PNG, adjust if needed
            }
        }
        
        const requestPayload: { model: string; prompt: string; config: { numberOfVideos: number }; image?: { imageBytes: string; mimeType: string }; } = {
            model: 'veo-2.0-generate-001', prompt, config: { numberOfVideos: 1 },
        };
        if (imagePart) requestPayload.image = imagePart;

        const operation = await ai.models.generateVideos(requestPayload);
        res.json({ operation, sourceImageFilename: savedSourceFilename });
        await logAgentActivity(agentName, prompt, 'INITIATED', { file_input: savedSourceFilename, client_message_id: clientMessageId });
    } catch (error) {
        console.error('Video generation start error:', error);
        res.status(500).json({ error: 'Failed to start video generation.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { file_input: savedSourceFilename, error_message: errorMessage, client_message_id: clientMessageId });
    }
});

app.post('/api/analyze-image', upload.single('file'), async (req: Request, res: Response) => {
    const agentName: Tool = 'IMAGE_ANALYSIS';
    const { clientMessageId } = req.body;
    const prompt = 'Analyze image';
    let filename: string | null = null;
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No file uploaded.' });
        filename = file.originalname;

        const imagePart = { inlineData: { data: file.buffer.toString('base64'), mimeType: file.mimetype }};

        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: ANALYSIS_PROMPT }, imagePart] }]
        });
        
        const text = getSafeText(result);
        res.json({ text });
        await logAgentActivity(agentName, prompt, 'SUCCESS', { file_input: filename, model_response: text, client_message_id: clientMessageId });
    } catch (error) {
        console.error('Image analysis error:', error);
        res.status(500).json({ error: 'Image analysis failed.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { file_input: filename, error_message: errorMessage, client_message_id: clientMessageId });
    }
});


// --- Local Image Routes ---
app.post('/api/local-images/upload', upload.array('images'), async (req: Request, res: Response) => {
    try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
            return res.status(400).send('No files uploaded.');
        }

        for (const file of files) {
            const uniqueFilename = `${crypto.randomUUID()}-${file.originalname}`;
            await fs.promises.writeFile(path.join(LOCAL_UPLOADS_DIR, uniqueFilename), file.buffer);
            await pool.query(
                `INSERT INTO local_images (filename, original_filename, mime_type) VALUES ($1, $2, $3)`,
                [uniqueFilename, file.originalname, file.mimetype]
            );
        }
        res.status(201).send('Images uploaded successfully.');
    } catch (error) {
        console.error('Error uploading local images:', error);
        res.status(500).send('Server error during upload.');
    }
});

// --- RAG Routes ---
app.post('/api/rag-documents/:repository/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
        const { repository } = req.params;
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No file uploaded.' });

        const uniqueFilename = `${crypto.randomUUID()}-${file.originalname}`;
        const content = file.buffer.toString('utf-8');

        await fs.promises.writeFile(path.join(RAG_DIR, uniqueFilename), content);

        const result = await pool.query(
            `INSERT INTO rag_documents (filename, original_filename, content, repository) VALUES ($1, $2, $3, $4) RETURNING *`,
            [uniqueFilename, file.originalname, content, repository]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error uploading RAG document:', error);
        res.status(500).json({ error: 'Server error during RAG upload.' });
    }
});

// --- Suno Routes ---
app.post('/api/analyze-audio-style', upload.single('file'), async (req: Request, res: Response) => {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No audio file provided.' });

        const audioPart = { inlineData: { data: file.buffer.toString('base64'), mimeType: file.mimetype }};
        const prompt = `Analyze the provided audio file and describe its musical style in a concise, comma-separated list of keywords suitable for a music generation prompt. Include genre, mood, instrumentation, tempo, and vocal style if present. Example: "Acoustic pop, sentimental, female vocals, piano, strings, slow tempo, emotional"`;

        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: prompt }, audioPart]}]
        });

        res.json({ style: getSafeText(result) });

    } catch (error) {
        console.error('Error analyzing audio style:', error);
        res.status(500).json({ error: 'Failed to analyze audio style.' });
    }
});

// --- Audio to MIDI ---
app.post('/api/convert-audio-to-midi', upload.single('file'), async (req: Request, res: Response) => {
    try {
        const file = req.file;
        const { projectName } = req.body;
        if (!file || !projectName) {
            return res.status(400).json({ error: 'File and project name are required.' });
        }
        
        const audioPart = { inlineData: { data: file.buffer.toString('base64'), mimeType: file.mimetype }};
        const prompt = `Convert the following audio recording of a single instrument into a detailed MIDI representation. Provide the output as a JSON object containing a list of notes. Each note should have 'pitch' (MIDI number), 'velocity' (0-127), 'startTime' (in seconds), and 'duration' (in seconds).`;

        const result = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: prompt }, audioPart]}],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        notes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    pitch: { type: Type.INTEGER },
                                    velocity: { type: Type.INTEGER },
                                    startTime: { type: Type.NUMBER },
                                    duration: { type: Type.NUMBER }
                                },
                                required: ["pitch", "velocity", "startTime", "duration"]
                            }
                        }
                    }
                }
            }
        });
        
        const filename = `${projectName.replace(/\s+/g, '_')}_${Date.now()}.json`;
        const filePath = path.join(MIDI_EXPORTS_DIR, filename);
        await fs.promises.writeFile(filePath, result.text);

        res.json({ downloadUrl: `/midi_exports/${filename}` });

    } catch (error) {
        console.error('Error converting audio to MIDI:', error);
        res.status(500).json({ error: 'Failed to convert audio to MIDI.' });
    }
});

// --- JSON Body Routes ---
app.post('/api/generate-image', async (req: Request, res: Response) => {
    const { prompt, clientMessageId } = req.body;
    const agentName: Tool = 'IMAGE_GEN';
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
            },
        });

        const base64ImageBytes = response.generatedImages[0].image.imageBytes;
        const imageBuffer = Buffer.from(base64ImageBytes, 'base64');
        const filename = `${crypto.randomUUID()}.jpg`;
        await fs.promises.writeFile(path.join(UPLOADS_DIR, filename), imageBuffer);
        
        const dbResult = await pool.query(
            'INSERT INTO images (filename, prompt, client_message_id) VALUES ($1, $2, $3) RETURNING id',
            [filename, prompt, clientMessageId]
        );
        const newImageId = dbResult.rows[0].id;

        await logAgentActivity(agentName, prompt, 'SUCCESS', { client_message_id: clientMessageId, image_id: newImageId });

        res.json({
            imageUrl: `/uploads/${filename}`,
            filename: filename,
            id: newImageId
        });
    } catch (error) {
        console.error('Image generation error:', error);
        res.status(500).json({ error: 'Image generation failed.' });
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await logAgentActivity(agentName, prompt, 'ERROR', { error_message: errorMessage, client_message_id: clientMessageId });
    }
});

app.post('/api/check-video-status', async (req: Request, res: Response) => {
    let { operation, prompt, sourceImageFilename, clientMessageId } = req.body;
    try {
        operation = await ai.operations.getVideosOperation({ operation: operation });
        
        if (operation.done && operation.response) {
            const videoData = operation.response.generatedVideos[0].video;
            const videoResponse = await fetch(`${videoData.uri}&key=${API_KEY}`);
            const videoBuffer = Buffer.from(await videoResponse.arrayBuffer());

            const filename = `${crypto.randomUUID()}.mp4`;
            const localPath = path.join(UPLOADS_DIR, filename);
            await fs.promises.writeFile(localPath, videoBuffer);
            
            videoData.localUrl = `/uploads/${filename}`;
            
            await pool.query(
                'INSERT INTO videos (filename, prompt, source_image_filename) VALUES ($1, $2, $3)',
                [filename, prompt, sourceImageFilename]
            );
            await logAgentActivity('VIDEO_GEN', prompt, 'SUCCESS', { file_input: sourceImageFilename, client_message_id: clientMessageId, model_response: filename });
        }
        
        res.json(operation);
    } catch (error) {
        console.error('Error checking video status:', error);
        res.status(500).json({ error: 'Failed to check video status.' });
         await logAgentActivity('VIDEO_GEN', prompt, 'ERROR', { file_input: sourceImageFilename, client_message_id: clientMessageId, error_message: error instanceof Error ? error.message : 'Unknown' });
    }
});

app.post('/api/feedback', async (req: Request, res: Response) => {
    const { clientMessageId, feedback } = req.body;
    try {
        // Update both tables, one might not have the record but it's fine.
        await pool.query(
            `UPDATE agent_activity SET feedback = $1 WHERE client_message_id = $2`,
            [feedback, clientMessageId]
        );
         await pool.query(
            `UPDATE images SET feedback = $1 WHERE client_message_id = $2`,
            [feedback, clientMessageId]
        );
        res.status(200).send('Feedback received');
    } catch (error) {
        console.error('Error saving feedback:', error);
        res.status(500).send('Failed to save feedback');
    }
});

app.get('/api/gallery', async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM images ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching gallery:', error);
        res.status(500).json({ error: 'Failed to fetch gallery images.' });
    }
});

// --- Local Image Viewer Routes ---
app.get('/api/local-images', async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM local_images ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching local images:', error);
        res.status(500).json({ error: 'Failed to fetch local images.' });
    }
});

app.delete('/api/local-images/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM local_images WHERE id = $1 RETURNING filename', [id]);
        if (result.rowCount > 0) {
            const filename = result.rows[0].filename;
            await fs.promises.unlink(path.join(LOCAL_UPLOADS_DIR, filename));
            res.status(200).send('Image deleted');
        } else {
            res.status(404).send('Image not found');
        }
    } catch (error) {
        console.error('Error deleting local image:', error);
        res.status(500).json({ error: 'Failed to delete image.' });
    }
});

app.post('/api/local-images/:id/analyze', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT filename, mime_type FROM local_images WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).send('Image not found');
        
        const { filename, mime_type } = result.rows[0];
        const imagePath = path.join(LOCAL_UPLOADS_DIR, filename);
        const imageBuffer = await fs.promises.readFile(imagePath);

        const imagePart = { inlineData: { data: imageBuffer.toString('base64'), mimeType: mime_type }};
        const analysisResult = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [{ parts: [{ text: ANALYSIS_PROMPT }, imagePart] }]
        });
        
        const analysisText = getSafeText(analysisResult);
        const tagsMatch = analysisText.match(/Positive Prompt:\s*(.*)/i);
        const tags = tagsMatch ? tagsMatch[1].split(',').map(tag => tag.trim()).filter(Boolean) : [];
        
        const updateResult = await pool.query(
            'UPDATE local_images SET analysis_text = $1, tags = $2 WHERE id = $3 RETURNING *',
            [analysisText, tags, id]
        );
        res.json(updateResult.rows[0]);

    } catch (error) {
        console.error('Error analyzing local image:', error);
        res.status(500).json({ error: 'Failed to analyze image.' });
    }
});

// --- RAG Routes ---
app.get('/api/rag-documents/:repository', async (req: Request, res: Response) => {
    try {
        const { repository } = req.params;
        const result = await pool.query('SELECT * FROM rag_documents WHERE repository = $1 ORDER BY created_at DESC', [repository]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching RAG documents:', error);
        res.status(500).json({ error: 'Failed to fetch RAG documents.' });
    }
});

app.delete('/api/rag-documents/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM rag_documents WHERE id = $1 RETURNING filename', [id]);
        if (result.rowCount > 0) {
            const filename = result.rows[0].filename;
            await fs.promises.unlink(path.join(RAG_DIR, filename));
            res.status(200).send('Document deleted');
        } else {
            res.status(404).send('Document not found');
        }
    } catch (error) {
        console.error('Error deleting RAG document:', error);
        res.status(500).json({ error: 'Failed to delete document.' });
    }
});

// --- Suno Routes ---
app.post('/api/generate-suno-lyrics', async (req: Request, res: Response) => {
    const { topic, agentId } = req.body;
    try {
        const agentPrompt = AGENT_PROMPTS[agentId] || AGENT_PROMPTS['euterpe']; // Default to Euterpe
        const systemInstruction = `${agentPrompt}\n\nYou are writing lyrics for a song about the topic: "${topic}". Structure the lyrics with appropriate tags like [Verse], [Chorus], [Bridge], etc. The lyrics should be creative, evocative, and suitable for being set to music.`;

        const stream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: `Generate song lyrics about "${topic}".`,
            config: { systemInstruction }
        });

        res.setHeader('Content-Type', 'text/plain');
        for await (const chunk of stream) {
            res.write(getSafeText(chunk));
        }
        res.end();
    } catch (error) {
        console.error('Error generating Suno lyrics:', error);
        res.status(500).send('Failed to generate lyrics.');
    }
});

// --- TTS Route ---
app.post('/api/synthesize-speech', async (req: Request, res: Response) => {
    const { text, voiceId, ttsModelId } = req.body;
    
    if (!text || !voiceId || !ttsModelId) {
        return res.status(400).json({ error: 'Missing required fields: text, voiceId, ttsModelId' });
    }

    try {
        let audioContentBuffer: Buffer;
        
        if (ttsModelId === 'eleven-labs') {
            const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
            if (!ELEVENLABS_API_KEY) {
                return res.status(500).json({ error: 'ElevenLabs API key is not configured on the server. Please add ELEVENLABS_API_KEY to your .env file.' });
            }
            
            const elevenLabsVoiceIds: { [key: string]: string } = {
                'Rachel': '21m00Tcm4TlvDq8ikWAM', 'Drew': '29vD33N1CtxCmqQRPOHJ',
                'Clyde': '2EiwWnXFnvU5JabPnv8n', 'Paul': '5Q0t7uMcjvnagumLfvZi',
                'Domi': 'AZnzlk1XvdvUeBnXmlld',
            };
            const elevenLabsId = elevenLabsVoiceIds[voiceId];
            if (!elevenLabsId) {
                return res.status(400).json({ error: `Invalid ElevenLabs voice ID: ${voiceId}` });
            }
            
            const elevenLabsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsId}`, {
                method: 'POST',
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': ELEVENLABS_API_KEY,
                },
                body: JSON.stringify({
                    text: text,
                    model_id: "eleven_multilingual_v2",
                    voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                }),
            });

            if (!elevenLabsResponse.ok) {
                const errorBody = await elevenLabsResponse.text();
                console.error('ElevenLabs API Error:', errorBody);
                throw new Error(`ElevenLabs API failed with status ${elevenLabsResponse.status}`);
            }
            
            audioContentBuffer = Buffer.from(await elevenLabsResponse.arrayBuffer());

        } else { // Handle both Google TTS models
            const languageCode = voiceId.startsWith('en-GB') ? 'en-GB' : 'en-US';
            const ttsResponse = await fetch(`https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: { text },
                    voice: { languageCode: languageCode, name: voiceId },
                    audioConfig: { audioEncoding: 'MP3' },
                }),
            });
            
            if (!ttsResponse.ok) {
                const errorBody = await ttsResponse.json();
                console.error('Google TTS API Error:', errorBody);
                throw new Error(`Google TTS API failed with status ${ttsResponse.status}. Voice: ${voiceId}`);
            }
            
            const ttsData = await ttsResponse.json();
            if (!ttsData.audioContent) {
                throw new Error("No audio content in Google TTS response.");
            }
            audioContentBuffer = Buffer.from(ttsData.audioContent, 'base64');
        }

        res.json({ audioContent: audioContentBuffer.toString('base64') });

    } catch (error) {
        console.error('TTS synthesis error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to synthesize speech' });
    }
});


// === Server Start ===
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  initializeDb();
});
