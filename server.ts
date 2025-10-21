
// FIX: Combined express imports to resolve type conflicts with Request, Response, and NextFunction, which were causing numerous errors throughout the file.
// FIX: Aliased express types to resolve conflicts with global fetch API types (Request, Response)
import express, { Request as ExpressRequest, Response as ExpressResponse, NextFunction as ExpressNextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
// Note: Multer's File type is available via the Express namespace after importing multer, so a direct import is not needed or possible.
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, GenerateContentResponse } from '@google/genai';
import type { Agent, ChatMessage } from './types';
import { ALL_AGENTS, MUSIC_AGENTS } from './types';

// Declare Node.js globals to resolve TypeScript errors.
declare const Buffer: any;
declare const __dirname: string;

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
let dbReady = false;

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
    
    await client.query(`
        CREATE TABLE IF NOT EXISTS rag_repositories (
            name VARCHAR(255) PRIMARY KEY,
            description TEXT,
            agent_id VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Ensure the default 'common' repository exists.
    await client.query(`
      INSERT INTO rag_repositories (name, description) 
      VALUES ('common', 'A shared knowledge base for all agents.') 
      ON CONFLICT (name) DO NOTHING;
    `);

    console.log('Database tables are ready.');
    client.release();
  } catch (err) {
    console.error('Database connection error or table creation failed:', err);
    throw err; // Re-throw to be caught by startServer
  }
};

// --- MIDDLEWARE ---
// Add request logging middleware to see all incoming requests
app.use((req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware to check DB status for API routes
app.use('/api', (req: ExpressRequest, res: ExpressResponse, next: ExpressNextFunction) => {
    if (req.path === '/health') {
        return next(); // Always allow health check
    }
    if (!dbReady) {
        return res.status(503).json({ error: 'Server is running, but the database is not connected. Please check server logs.' });
    }
    next();
});

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
    // Cast process to any to access exit method without node types.
    (process as any).exit(1);
}
const ai = new GoogleGenAI({apiKey: GEMINI_API_KEY});
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// Use `any` for file type as Express.Multer.File namespace is not found.
const fileToGenerativePart = (file: any) => {
  return {
    inlineData: {
      data: fs.readFileSync(file.path).toString("base64"),
      mimeType: file.mimetype,
    },
  };
};

// Helper function to format chat messages for RAG storage
const formatChatMessages = (chatName: string, messages: ChatMessage[]): string => {
    let content = `Chat Session: ${chatName}\n`;
    content += `Saved at: ${new Date().toISOString()}\n`;
    content += '========================================\n\n';

    messages.forEach(msg => {
        if (msg.isError || (msg.role === 'model' && msg.content === '...')) return;
        
        const author = msg.agent?.name || msg.operator?.name || msg.role;
        content += `[${author.toUpperCase()}]\n`;
        if (msg.content) {
            content += `${msg.content}\n`;
        }
        if (msg.imageUrl) {
            content += `[Image Attached: ${msg.imageUrl}]\n`;
        }
        if (msg.videoUrl) {
            content += `[Video Attached: ${msg.videoUrl}]\n`;
        }
        if (msg.fileName) {
            content += `[File Attached: ${msg.fileName}]\n`;
        }
        content += '\n---\n\n';
    });
    return content;
};


// --- API ROUTES ---

// Health Check Endpoint
app.get('/api/health', (req: ExpressRequest, res: ExpressResponse) => {
    res.status(200).json({ status: 'ok', db: dbReady });
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
        // Use declared Buffer global instead of casting to any.
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
            contents: { parts: [imagePart, { text: 'Describe this image in detail. Then, on a new line, add "Tags:" followed by a short, comma-separated list of relevant keywords.' }] }
        });
        fs.unlinkSync(file.path);
        
        const fullText = response.text;
        const tagsMatch = fullText.match(/Tags: (.*)/i);
        const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()) : [];
        const analysis = tagsMatch ? fullText.split(/Tags: .*/i)[0].trim() : fullText.trim();
        
        res.json({ analysis, tags });
    } catch (error) {
        console.error('Image Analysis Error:', error);
        res.status(500).json({ error: 'Failed to analyze image' });
    }
});

// SPEECH SYNTHESIS
app.post('/api/synthesize-speech', async (req: ExpressRequest, res: ExpressResponse) => {
    const { text, voiceId, ttsModelId } = req.body;

    if (!text || !voiceId || !ttsModelId) {
        return res.status(400).json({ error: "Missing required parameters: text, voiceId, ttsModelId" });
    }

    try {
        // Use `any` for audioBuffer type as Buffer is not found.
        let audioBuffer: any;

        if (ttsModelId === 'eleven-labs') {
            if (!ELEVENLABS_API_KEY) {
                return res.status(500).json({ error: "ElevenLabs API key is not configured on the server." });
            }
            const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
            const response = await fetch(elevenLabsUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': ELEVENLABS_API_KEY,
                    'Accept': 'audio/mpeg',
                },
                body: JSON.stringify({
                    text: text,
                    model_id: "eleven_multilingual_v2", // A reasonable default
                }),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error("ElevenLabs API Error:", errorBody);
                throw new Error(`ElevenLabs API failed with status ${response.status}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            // Use declared Buffer global instead of casting to any.
            audioBuffer = Buffer.from(arrayBuffer);

        } else if (ttsModelId === 'text-to-speech' || ttsModelId === 'gemini-2.5-flash-preview-tts') {
            // A real implementation would use the Google Cloud Text-to-Speech client library,
            // which is not included in this project's dependencies.
            return res.status(501).json({ error: `The TTS model '${ttsModelId}' is not yet implemented on the server.` });
        } else {
             return res.status(400).json({ error: `Unsupported TTS model: ${ttsModelId}` });
        }
        
        // The frontend expects a base64 string for playback
        res.json({ audioContent: audioBuffer.toString('base64') });

    } catch (error) {
        console.error('Speech Synthesis Error:', error);
        res.status(500).json({ error: (error as Error).message || 'Failed to synthesize speech' });
    }
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
    // Cast req.files to any[] as Express.Multer.File is not found.
    const files = req.files as any[];
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
        
        const fullText = response.text;
        const tagsMatch = fullText.match(/Tags: (.*)/i);
        const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()) : [];
        const analysis = tagsMatch ? fullText.split(/Tags: .*/i)[0].trim() : fullText.trim();

        const updateResult = await pool.query(
            'UPDATE local_images SET analysis_text = $1, tags = $2 WHERE id = $3 RETURNING *',
            [analysis, tags, id]
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

app.post('/api/rag-documents/save-chat', async (req: ExpressRequest, res: ExpressResponse) => {
    const { chat, repository } = req.body;
    if (!chat || !chat.messages || !repository) {
        return res.status(400).json({ error: 'Chat data and repository are required.' });
    }

    try {
        const chatContent = formatChatMessages(chat.name, chat.messages);
        const originalFilename = `chat_${chat.name.replace(/\s/g, '_')}_${Date.now()}.txt`;
        const filename = `${Date.now()}-${originalFilename}`;
        const filePath = path.join('uploads', filename);

        fs.writeFileSync(filePath, chatContent, 'utf-8');

        const result = await pool.query(
            'INSERT INTO rag_documents (filename, original_filename, content, repository) VALUES ($1, $2, $3, $4) RETURNING id, filename, original_filename, repository, created_at',
            [filename, originalFilename, chatContent, repository]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Save Chat to RAG Error:', error);
        res.status(500).json({ error: 'Failed to save chat to RAG' });
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


// --- RAG REPOSITORY ROUTES ---
app.get('/api/rag-repositories', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const result = await pool.query('SELECT * FROM rag_repositories ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('RAG Repositories Fetch Error:', error);
        res.status(500).json({ error: 'Failed to fetch RAG repositories' });
    }
});

app.post('/api/rag-repositories', async (req: ExpressRequest, res: ExpressResponse) => {
    const { name, agentId } = req.body;
    if (!name) {
        return res.status(400).json({ error: 'Repository name is required.' });
    }
    try {
        const result = await pool.query(
            'INSERT INTO rag_repositories (name, agent_id) VALUES ($1, $2) RETURNING *',
            [name, agentId || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('RAG Repository Create Error:', error);
        // Check for unique constraint violation
        if ((error as any).code === '23505') {
            return res.status(409).json({ error: 'A repository with this name already exists.' });
        }
        res.status(500).json({ error: 'Failed to create RAG repository' });
    }
});

app.delete('/api/rag-repositories/:name', async (req: ExpressRequest, res: ExpressResponse) => {
    const { name } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Also delete all documents within this repository
        await client.query('DELETE FROM rag_documents WHERE repository = $1', [name]);
        // Delete the repository itself
        await client.query('DELETE FROM rag_repositories WHERE name = $1', [name]);
        await client.query('COMMIT');
        res.sendStatus(204);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('RAG Repository Delete Error:', error);
        res.status(500).json({ error: 'Failed to delete RAG repository' });
    } finally {
        client.release();
    }
});

// --- SUNO SERVICES ---
app.post('/api/analyze-audio-style', upload.single('file'), async (req: ExpressRequest, res: ExpressResponse) => {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded.' });

    try {
        const audioPart = fileToGenerativePart(file);
        const prompt = "Analyze the musical style of this audio file. Describe it in terms of genre, instrumentation, tempo, mood, and vocal style (if any). Provide a concise description suitable for a music generation prompt. For example: 'Acoustic pop, sentimental, female vocals, piano, strings, slow tempo, emotional'";
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [audioPart, { text: prompt }] }
        });
        
        fs.unlinkSync(file.path);
        res.json({ style: response.text.trim() });
    } catch (error) {
        console.error('Audio Style Analysis Error:', error);
        res.status(500).json({ error: 'Failed to analyze audio style' });
    }
});

app.post('/api/generate-suno-lyrics', async (req: ExpressRequest, res: ExpressResponse) => {
    const { topic, agentId } = req.body;
    if (!topic || !agentId) {
        return res.status(400).json({ error: 'Topic and agentId are required.' });
    }
    const agent = MUSIC_AGENTS.find(a => a.id === agentId);
    if (!agent) {
        return res.status(404).json({ error: 'Music agent not found.' });
    }

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');

    try {
        const systemInstruction = `You are ${agent.name}, an AI specializing in ${agent.specialty}. Your task is to write song lyrics. Your communication style is: ${agent.communicationStyle}`;
        const prompt = `Write song lyrics about the topic: "${topic}". The lyrics should follow a standard song structure, such as verses and a chorus. Use [Verse], [Chorus], etc. to label the sections.`;
        
        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: { systemInstruction }
        });
        
        for await (const chunk of responseStream) {
            res.write(chunk.text);
        }
    } catch (error) {
        console.error('Lyric Generation Error:', error);
        res.status(500).write('STREAM_ERROR: ' + (error as Error).message);
    } finally {
        res.end();
    }
});

// --- AUDIO TO MIDI SERVICE ---
app.post('/api/convert-audio-to-midi', upload.single('file'), async (req: ExpressRequest, res: ExpressResponse) => {
    const { projectName } = req.body;
    const file = req.file;
    if (!file || !projectName) {
        return res.status(400).json({ error: 'Audio file and project name are required.' });
    }
    
    // This is a mock endpoint. A real implementation would involve a complex audio processing pipeline.
    // For now, we'll simulate a successful conversion and return a dummy JSON.
    try {
        const midiData = {
            projectName: projectName,
            originalFile: file.originalname,
            status: "converted",
            notes: [
                { pitch: 60, start: 0.0, duration: 0.5, velocity: 100 },
                { pitch: 62, start: 0.5, duration: 0.5, velocity: 100 },
                { pitch: 64, start: 1.0, duration: 0.5, velocity: 100 },
            ],
            createdAt: new Date().toISOString()
        };
        
        const filename = `${projectName.replace(/\s/g, '_')}_${Date.now()}.json`;
        const filePath = path.join('uploads', filename);
        fs.writeFileSync(filePath, JSON.stringify(midiData, null, 2));

        // We don't need the original audio file on the server anymore
        fs.unlinkSync(file.path);
        
        res.json({ downloadUrl: `/uploads/${filename}` });

    } catch (error) {
        console.error('Audio to MIDI Conversion Error:', error);
        res.status(500).json({ error: 'Failed to convert audio to MIDI' });
    }
});

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static('uploads'));
app.use('/local_uploads', express.static('local_uploads'));

// Serve static files from the 'public' directory
app.use(express.static('public'));

app.get('*', (req: ExpressRequest, res: ExpressResponse) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// --- SERVER STARTUP ---
const startServer = async () => {
  try {
    await initDb();
    dbReady = true;
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    dbReady = false;
    // We can still start the server but with DB functionality disabled.
    // The middleware will catch API requests and return a 503.
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}, but DATABASE CONNECTION FAILED.`);
    });
  }
};

startServer();
