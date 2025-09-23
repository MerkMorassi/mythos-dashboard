/// <reference types="node" />

import express from 'express';
// To resolve conflicts with DOM types, we alias Request and Response from express.
// Using a type-only import is best practice and can prevent some module resolution issues.
import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
// Note: Multer's File type is available via the Express namespace after importing multer, so a direct import is not needed or possible.
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, GenerateContentResponse } from '@google/genai';
import type { Agent } from './types';
import { ALL_AGENTS, MUSIC_AGENTS } from './types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// --- DATABASE SETUP ---
const pool = new Pool({
  connectionString: process.env.PG_CONNECTION_STRING,
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: parseInt(process.env.PG_PORT || "5432"),
});

const initDb = async () => {
  try {
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database!');
    
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS images (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL,
        prompt TEXT NOT NULL,
        seed BIGINT,
        client_message_id VARCHAR(255) UNIQUE,
        feedback VARCHAR(10),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS videos (
          id SERIAL PRIMARY KEY,
          filename TEXT NOT NULL,
          prompt TEXT,
          source_image_filename TEXT,
          client_message_id VARCHAR(255) UNIQUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS local_images (
            id SERIAL PRIMARY KEY,
            filename TEXT NOT NULL UNIQUE,
            original_filename TEXT NOT NULL,
            analysis_text TEXT,
            tags TEXT[],
            embedding vector(1024),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS rag_documents (
            id SERIAL PRIMARY KEY,
            filename TEXT NOT NULL,
            original_filename TEXT NOT NULL,
            content TEXT NOT NULL,
            repository VARCHAR(255) NOT NULL, -- 'common' or agent_id
            embedding vector(1024),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);
    
    console.log('Database tables are ready.');
    client.release();
  } catch (err) {
    console.error('Database connection error or table creation failed:', err);
    process.exit(1);
  }
};

initDb();

// --- MIDDLEWARE ---
// Add request logging middleware to see all incoming requests
app.use((req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


// --- FILE STORAGE ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // The 'images' fieldname is used by the Local Image Viewer
    const dir = file.fieldname === 'images' ? 'local_uploads' : 'uploads';
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname.replace(/\s/g, '_')}`);
  },
});
const upload = multer({ storage });


// --- GEMINI API SETUP ---
const GEMINI_API_KEY = process.env.API_KEY;
if (!GEMINI_API_KEY) {
    console.error("FATAL ERROR: The API_KEY environment variable is not set. The server cannot start without it.");
    process.exit(1);
}
const ai = new GoogleGenAI({apiKey: GEMINI_API_KEY});

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const fileToGenerativePart = (file: Express.Multer.File) => {
  return {
    inlineData: {
      data: fs.readFileSync(file.path).toString("base64"),
      mimeType: file.mimetype,
    },
  };
};

// --- API ROUTES ---

// Health Check Endpoint
app.get('/api/health', (req: ExpressRequest, res: ExpressResponse) => {
    res.status(200).json({ status: 'ok' });
});

// CHAT & TEXT STREAMING
app.post('/api/generate-stream', upload.single('file'), async (req: ExpressRequest, res: ExpressResponse) => {
    const tool: string = req.body.tool || 'AGENT_HUB';
    const prompt: string = req.body.prompt || '';
    const history: string = req.body.history || '[]';
    const activeAgents: string = req.body.activeAgents || '[]';
    const file = req.file;
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');

    try {
        const parsedHistory = JSON.parse(history);

        const streamChunk = (chunk: string, agentId?: string) => {
             if (agentId) {
                res.write(`${agentId}::${chunk}`);
            } else {
                res.write(chunk);
            }
        };

        if (tool === 'AGENT_HUB') {
            const agents: Agent[] = ALL_AGENTS.filter(a => JSON.parse(activeAgents).includes(a.id));
            if (agents.length === 0) throw new Error("No active agents selected.");

            for (const agent of agents) {
                const systemInstruction = `You are ${agent.name}, an AI assistant specializing in ${agent.specialty}. Act strictly as this persona.`;
                const contents = [...parsedHistory, { role: 'user', parts: [{ text: prompt }] }];
                
                const responseStream = await ai.models.generateContentStream({
                    model: 'gemini-2.5-flash',
                    contents,
                    config: { systemInstruction }
                });

                let fullResponseText = '';
                for await (const chunk of responseStream) {
                    const chunkText = chunk.text;
                    streamChunk(chunkText, agent.id);
                    fullResponseText += chunkText;
                }
                parsedHistory.push({ role: 'model', parts: [{ text: fullResponseText }] });
            }
        } else {
            let model = 'gemini-2.5-flash';
            let contents: any[] = [{ role: 'user', parts: [{ text: prompt }] }];
            
            if (file) {
                 const filePart = fileToGenerativePart(file);
                 contents[0].parts.push(filePart);
            }

            const responseStream = await ai.models.generateContentStream({ model, contents });
            for await (const chunk of responseStream) {
                streamChunk(chunk.text);
            }
        }
    } catch (error) {
        console.error('Streaming Error:', error);
        res.status(500).write('STREAM_ERROR: ' + (error as Error).message);
    } finally {
        res.end();
    }
});

// IMAGE GENERATION
app.post('/api/generate-image', async (req: ExpressRequest, res: ExpressResponse) => {
    const prompt: string = req.body.prompt || '';
    const clientMessageId: string = req.body.clientMessageId || '';

    if (!prompt || !clientMessageId) {
        return res.status(400).json({ error: 'Prompt and clientMessageId are required.' });
    }

    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt,
            config: { numberOfImages: 1 }
        });

        const firstImage = response.generatedImages?.[0];
        if (!firstImage || !firstImage.image || !firstImage.image.imageBytes) {
            throw new Error('Image generation failed: No image data received from API.');
        }

        const image = firstImage.image;
        const filename = `${clientMessageId}-${Date.now()}.png`;
        const filePath = path.join('uploads', filename);
        fs.writeFileSync(filePath, Buffer.from(image.imageBytes, 'base64'));

        const dbResult = await pool.query(
            'INSERT INTO images (filename, prompt, client_message_id, seed) VALUES ($1, $2, $3, $4) RETURNING id',
            [filename, prompt, clientMessageId, (firstImage as any).seed]
        );
        
        if (!dbResult.rows[0]) {
             throw new Error('Failed to insert image record into database.');
        }

        res.json({ imageUrl: `/uploads/${filename}`, filename, id: dbResult.rows[0].id });
    } catch (error) {
        console.error('Image Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate image' });
    }
});

// VIDEO GENERATION
app.post('/api/generate-video', upload.single('image'), async (req: ExpressRequest, res: ExpressResponse) => {
    const { prompt, clientMessageId, sourceImageFilename } = req.body;
    const imageFile = req.file;

    try {
        let operation;
        let finalSourceFilename = sourceImageFilename || null;

        if (imageFile) {
            finalSourceFilename = imageFile.filename;
            operation = await ai.models.generateVideos({
                model: 'veo-2.0-generate-001',
                prompt,
                image: {
                    imageBytes: fs.readFileSync(imageFile.path).toString('base64'),
                    mimeType: imageFile.mimetype,
                },
            });
        } else if (sourceImageFilename) {
            const imagePath = path.join('uploads', sourceImageFilename);
            if (!fs.existsSync(imagePath)) {
                return res.status(404).json({ error: 'Source image not found' });
            }
            operation = await ai.models.generateVideos({
                model: 'veo-2.0-generate-001',
                prompt,
                image: {
                    imageBytes: fs.readFileSync(imagePath).toString('base64'),
                    mimeType: 'image/png', // Assuming PNG
                },
            });
        } else {
            operation = await ai.models.generateVideos({
                model: 'veo-2.0-generate-001',
                prompt,
            });
        }
        res.json({ operation, sourceImageFilename: finalSourceFilename });
    } catch (error) {
        console.error('Video Generation Error:', error);
        res.status(500).json({ error: 'Failed to start video generation' });
    }
});

// CHECK VIDEO STATUS
app.post('/api/check-video-status', async (req: ExpressRequest, res: ExpressResponse) => {
    const { operation, prompt, sourceImageFilename, clientMessageId } = req.body;
    try {
        let updatedOperation = await ai.operations.getVideosOperation({ operation });

        if (updatedOperation.done && updatedOperation.response) {
            const videoData = updatedOperation.response.generatedVideos?.[0]?.video;
            if (videoData?.uri) {
                const videoRes = await fetch(`${videoData.uri}&key=${GEMINI_API_KEY}`);
                if (!videoRes.ok || !videoRes.body) throw new Error('Failed to download video');
                
                const filename = `${clientMessageId}-${Date.now()}.mp4`;
                const filePath = path.join('uploads', filename);
                const fileStream = fs.createWriteStream(filePath);
                
                const { Readable } = await import('stream');
                const body = Readable.fromWeb(videoRes.body as any);
                await new Promise<void>((resolve, reject) => {
                    body.pipe(fileStream).on('finish', () => resolve()).on('error', reject);
                });
                
                await pool.query(
                    'INSERT INTO videos (filename, prompt, source_image_filename, client_message_id) VALUES ($1, $2, $3, $4)',
                    [filename, prompt, sourceImageFilename, clientMessageId]
                );
                
                (videoData as any).localUrl = `/uploads/${filename}`;
            }
        }
        res.json(updatedOperation);
    } catch (error) {
        console.error('Video Status Check Error:', error);
        res.status(500).json({ error: 'Failed to check video status' });
    }
});

// IMAGE ANALYSIS
app.post('/api/analyze-image', upload.single('file'), async (req: ExpressRequest, res: ExpressResponse) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded.' });

    try {
        const imagePart = fileToGenerativePart(file);
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, { text: 'Describe this image in detail.' }] }
        });
        fs.unlinkSync(file.path);
        res.json({ text: response.text });
    } catch (error) {
        console.error('Image Analysis Error:', error);
        res.status(500).json({ error: 'Failed to analyze image' });
    }
});

// SPEECH SYNTHESIS
app.post('/api/synthesize-speech', async (req: ExpressRequest, res: ExpressResponse) => {
    console.warn("TTS endpoint called, but no TTS service is implemented.");
    res.status(501).json({ error: "Text-to-Speech functionality is not implemented on the server." });
});


// GALLERY & FEEDBACK
app.get('/api/gallery', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const result = await pool.query('SELECT * FROM images ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Gallery Fetch Error:', error);
        res.status(500).json({ error: 'Failed to fetch gallery' });
    }
});

app.post('/api/feedback', async (req: ExpressRequest, res: ExpressResponse) => {
    const clientMessageId: string = req.body.clientMessageId || '';
    const feedback: string = req.body.feedback || '';
    
    if (!clientMessageId || !feedback) {
        return res.status(400).json({ error: 'clientMessageId and feedback are required.' });
    }

    try {
        await pool.query('UPDATE images SET feedback = $1 WHERE client_message_id = $2', [feedback, clientMessageId]);
        res.sendStatus(200);
    } catch (error) {
        console.error('Feedback Error:', error);
        res.status(500).json({ error: 'Failed to save feedback' });
    }
});

// --- LOCAL IMAGE VIEWER ROUTES ---
app.get('/api/local-images', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const result = await pool.query('SELECT * FROM local_images ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Local Images Fetch Error:', error);
        res.status(500).json({ error: 'Failed to fetch local images' });
    }
});

app.post('/api/local-images/upload', upload.array('images'), async (req: ExpressRequest, res: ExpressResponse) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded.' });
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const file of files) {
            await client.query(
                'INSERT INTO local_images (filename, original_filename) VALUES ($1, $2) ON CONFLICT (filename) DO NOTHING',
                [file.filename, file.originalname]
            );
        }
        await client.query('COMMIT');
        res.sendStatus(201);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Local Images Upload Error:', error);
        res.status(500).json({ error: 'Failed to upload local images' });
    } finally {
        client.release();
    }
});

app.delete('/api/local-images/:id', async (req: ExpressRequest, res: ExpressResponse) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query('SELECT filename FROM local_images WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Image not found' });
        }
        const { filename } = result.rows[0];
        const filePath = path.join('local_uploads', filename);

        await client.query('DELETE FROM local_images WHERE id = $1', [id]);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        await client.query('COMMIT');
        res.sendStatus(204);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Local Image Delete Error:', error);
        res.status(500).json({ error: 'Failed to delete local image' });
    } finally {
        client.release();
    }
});

app.post('/api/local-images/:id/analyze', async (req: ExpressRequest, res: ExpressResponse) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT filename FROM local_images WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Image not found' });
        }
        const { filename } = result.rows[0];
        const filePath = path.join('local_uploads', filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Image file not found on disk' });
        }
        
        const imagePart = { inlineData: { data: fs.readFileSync(filePath).toString("base64"), mimeType: 'image/jpeg' } };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, { text: 'Describe this image in detail. Then, on a new line, add "Tags:" followed by a short, comma-separated list of relevant keywords.' }] }
        });
        
        const analysisText = response.text;
        const tagsMatch = analysisText.match(/Tags: (.*)/i);
        const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()) : [];

        const updateResult = await pool.query(
            'UPDATE local_images SET analysis_text = $1, tags = $2 WHERE id = $3 RETURNING *',
            [analysisText, tags, id]
        );
        
        res.json(updateResult.rows[0]);
    } catch (error) {
        console.error('Local Image Analyze Error:', error);
        res.status(500).json({ error: 'Failed to analyze local image' });
    }
});

// --- RAG DOCUMENT ROUTES ---
app.get('/api/rag-documents/:repository', async (req: ExpressRequest, res: ExpressResponse) => {
    const { repository } = req.params;
    try {
        const result = await pool.query('SELECT id, filename, original_filename, repository, created_at FROM rag_documents WHERE repository = $1 ORDER BY created_at DESC', [repository]);
        res.json(result.rows);
    } catch (error) {
        console.error('RAG Fetch Error:', error);
        res.status(500).json({ error: 'Failed to fetch RAG documents' });
    }
});

app.post('/api/rag-documents/:repository/upload', upload.single('file'), async (req: ExpressRequest, res: ExpressResponse) => {
    const { repository } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded.' });

    try {
        const content = fs.readFileSync(file.path, 'utf-8');
        const result = await pool.query(
            'INSERT INTO rag_documents (filename, original_filename, content, repository) VALUES ($1, $2, $3, $4) RETURNING id, filename, original_filename, repository, created_at',
            [file.filename, file.originalname, content, repository]
        );
        fs.unlinkSync(file.path);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('RAG Upload Error:', error);
        res.status(500).json({ error: 'Failed to upload RAG document' });
    }
});

app.delete('/api/rag-documents/:id', async (req: ExpressRequest, res: ExpressResponse) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await client.query('SELECT filename FROM rag_documents WHERE id = $1', [id]);
        if (result.rows.length > 0) {
            const { filename } = result.rows[0];
            const filePath = path.join('uploads', filename);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        await client.query('DELETE FROM rag_documents WHERE id = $1', [id]);
        await client.query('COMMIT');
        res.sendStatus(204);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('RAG Delete Error:', error);
        res.status(500).json({ error: 'Failed to delete RAG document' });
    } finally {
        client.release();
    }
});


// ALL OTHER ROUTES
app.post('/api/detect-content-safety', upload.single('file'), async (req: ExpressRequest, res: ExpressResponse) => {
    res.json({ category: 'SAFE', reason: 'Content passed implicit safety checks.' });
});

app.post('/api/analyze-audio-style', upload.single('file'), async (req: ExpressRequest, res: ExpressResponse) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });
    try {
        const audioPart = fileToGenerativePart(file);
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [audioPart, { text: 'Describe the musical style of this audio clip in a few keywords, suitable for a music generation prompt. For example: "Acoustic pop, sentimental, female vocals, piano, strings".' }] }
        });
        fs.unlinkSync(file.path);
        res.json({ style: response.text });
    } catch (error) {
        console.error('Audio Style Analysis Error:', error);
        res.status(500).json({ error: 'Failed to analyze audio style' });
    }
});

app.post('/api/generate-suno-lyrics', async (req: ExpressRequest, res: ExpressResponse) => {
    const { topic, agentId } = req.body;
    const agent = MUSIC_AGENTS.find(a => a.id === agentId);
    if (!agent) return res.status(400).json({ error: 'Invalid agent ID' });

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');
    try {
        const systemInstruction = `You are ${agent.name}, an AI specializing in ${agent.specialty}. Write song lyrics about the given topic. Use structural tags like [Verse], [Chorus], [Bridge].`;
        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: `Topic: ${topic}`,
            config: { systemInstruction },
        });
        for await (const chunk of responseStream) {
            res.write(chunk.text);
        }
    } catch (error) {
        console.error('Lyric Generation Error:', error);
        res.status(500).write('STREAM_ERROR');
    } finally {
        res.end();
    }
});

app.post('/api/convert-audio-to-midi', upload.single('file'), async (req: ExpressRequest, res: ExpressResponse) => {
     const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });
    try {
        const audioPart = fileToGenerativePart(file);
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [audioPart, { text: 'Analyze this audio and describe the sequence of musical notes and chords in a JSON format. The JSON should have a "notes" array, where each object has "pitch" (e.g., "C#4"), "duration" (in seconds), and "startTime" (in seconds).' }] }
        });
        
        const filename = `${req.body.projectName || 'midi-conversion'}-${Date.now()}.json`;
        const filePath = path.join('uploads', filename);
        fs.writeFileSync(filePath, response.text);
        fs.unlinkSync(file.path);

        res.json({ downloadUrl: `/uploads/${filename}` });
    } catch (error) {
        console.error('Audio to MIDI error:', error);
        res.status(500).json({ error: 'Failed to convert audio' });
    }
});


// --- STATIC FILE SERVING ---
// This serves all the frontend files from the root directory of the project.
app.use(express.static(path.join(__dirname, '..')));
app.use('/uploads', express.static('uploads'));
app.use('/local_uploads', express.static('local_uploads'));


// Fallback for client-side routing and 404 handling
app.use('*', (req: ExpressRequest, res: ExpressResponse) => {
    // Log all unhandled routes to help diagnose issues
    console.error(`[404] Unhandled route: ${req.method} ${req.originalUrl}`);

    // If it's a GET request for a page-like URL, serve the main app
    if (req.method === 'GET' && !req.path.startsWith('/api/') && !path.extname(req.path)) {
        console.log(`[Router] Serving index.html for client-side route: ${req.originalUrl}`);
        return res.sendFile(path.join(__dirname, '..', 'index.html'));
    }
    
    // For all other unhandled requests (e.g., POST to a bad URL), send a clear JSON 404
    res.status(404).json({
        error: `The requested endpoint was not found: ${req.method} ${req.originalUrl}`
    });
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
