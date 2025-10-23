
import express, { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import type { Agent, SavedChat } from './types';
import { ALL_AGENTS } from './types';

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

    await client.query(`
      INSERT INTO rag_repositories (name, description) 
      VALUES ('common', 'A shared knowledge base for all agents.') 
      ON CONFLICT (name) DO NOTHING;
    `);

    console.log('Database tables are ready.');
    client.release();
    dbReady = true;
  } catch (err) {
    console.error('Database connection error or table creation failed:', err);
    throw err;
  }
};

// --- MIDDLEWARE ---
app.use((req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api', (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
    if (req.path === '/health') return next();
    if (!dbReady) return res.status(503).json({ error: 'Database is not connected.' });
    next();
});

// --- FILE STORAGE ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = file.fieldname === 'images' ? 'local_uploads' : 'uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
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
    console.error("FATAL ERROR: The API_KEY environment variable is not set.");
    process.exit(1);
}
const ai = new GoogleGenAI({apiKey: GEMINI_API_KEY});
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const fileToGenerativePart = (file: Express.Multer.File) => ({
  inlineData: {
    data: fs.readFileSync(file.path).toString("base64"),
    mimeType: file.mimetype,
  },
});

const formatChatMessages = (chat: SavedChat): string => {
    let content = `Chat Session: ${chat.name}\nTimestamp: ${new Date(chat.timestamp).toISOString()}\n`;
    if (chat.summary) content += `Summary: ${chat.summary}\n`;
    if (chat.tags?.length) content += `Tags: ${chat.tags.join(', ')}\n`;
    content += '========================================\n\n';
    chat.messages.forEach(msg => {
        if (msg.isError || (msg.role === 'model' && msg.content === '...')) return;
        const author = msg.agent?.name || msg.operator?.name || msg.role;
        content += `[${author.toUpperCase()}]\n${msg.content || ''}\n`;
        if (msg.imageUrl) content += `[Image Attached: ${msg.imageUrl}]\n`;
        if (msg.fileName) content += `[File Attached: ${msg.fileName}]\n`;
        content += '\n---\n\n';
    });
    return content;
};

// --- API ROUTES ---

app.get('/api/health', (req: ExpressRequest, res: ExpressResponse) => {
    res.status(200).json({ status: 'ok', db: dbReady });
});

app.post('/api/generate-stream', upload.single('file'), async (req: ExpressRequest, res: ExpressResponse) => {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Transfer-Encoding', 'chunked');
    try {
        const { prompt = '', history = '[]', activeAgents = '[]' } = req.body;
        const file = req.file;
        const parsedHistory = JSON.parse(history);
        const agents: Agent[] = ALL_AGENTS.filter(a => JSON.parse(activeAgents).includes(a.id));
        if (agents.length === 0) throw new Error("No active agents selected.");

        for (const agent of agents) {
            const systemInstruction = `You are ${agent.name}, an AI specializing in ${agent.specialty}. Act strictly as this persona.`;
            const contents = [...parsedHistory, { role: 'user', parts: [{ text: prompt }] }];
            if (file) contents[contents.length-1].parts.push(fileToGenerativePart(file));
            
            const responseStream = await ai.models.generateContentStream({ model: 'gemini-2.5-flash', contents, config: { systemInstruction } });
            
            let fullResponseText = '';
            for await (const chunk of responseStream) {
                const chunkText = chunk.text;
                res.write(`${agent.id}::${chunkText}`);
                fullResponseText += chunkText;
            }
            parsedHistory.push({ role: 'model', parts: [{ text: fullResponseText }] });
        }
    } catch (error) {
        console.error('Streaming Error:', error);
        res.status(500).write('STREAM_ERROR: ' + (error as Error).message);
    } finally {
        res.end();
    }
});

app.post('/api/generate-image', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const { prompt, clientMessageId } = req.body;
        if (!prompt || !clientMessageId) return res.status(400).json({ error: 'Prompt and clientMessageId are required.' });

        const response = await ai.models.generateImages({ model: 'imagen-4.0-generate-001', prompt, config: { numberOfImages: 1 } });
        const img = response.generatedImages?.[0];
        if (!img?.image?.imageBytes) throw new Error('No image data received.');

        const filename = `${clientMessageId}-${Date.now()}.png`;
        fs.writeFileSync(path.join('uploads', filename), Buffer.from(img.image.imageBytes, 'base64'));
        const dbRes = await pool.query('INSERT INTO images (filename, prompt, client_message_id, seed) VALUES ($1, $2, $3, $4) RETURNING id', [filename, prompt, clientMessageId, (img as any).seed]);
        
        res.json({ imageUrl: `/uploads/${filename}`, filename, id: dbRes.rows[0].id });
    } catch (error) {
        console.error('Image Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate image' });
    }
});

app.post('/api/generate-video', upload.single('image'), async (req: ExpressRequest, res: ExpressResponse) => {/* Placeholder */ res.status(501).json({ error: 'Not implemented' });});
app.post('/api/check-video-status', async (req: ExpressRequest, res: ExpressResponse) => {/* Placeholder */ res.status(501).json({ error: 'Not implemented' });});
app.post('/api/feedback', async (req: ExpressRequest, res: ExpressResponse) => {/* Placeholder */ res.status(501).json({ error: 'Not implemented' });});
app.get('/api/gallery', async (req: ExpressRequest, res: ExpressResponse) => {/* Placeholder */ res.status(501).json({ error: 'Not implemented' });});
app.post('/api/synthesize-speech', async (req: ExpressRequest, res: ExpressResponse) => {/* Placeholder */ res.status(501).json({ error: 'Not implemented' });});
app.post('/api/analyze-audio-style', upload.single('file'), async (req: ExpressRequest, res: ExpressResponse) => {/* Placeholder */ res.status(501).json({ error: 'Not implemented' });});
app.post('/api/generate-suno-lyrics', async (req: ExpressRequest, res: ExpressResponse) => {/* Placeholder */ res.status(501).json({ error: 'Not implemented' });});
app.post('/api/convert-audio-to-midi', upload.single('file'), async (req: ExpressRequest, res: ExpressResponse) => {/* Placeholder */ res.status(501).json({ error: 'Not implemented' });});


app.post('/api/analyze-image', upload.single('file'), async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
        const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [fileToGenerativePart(req.file), { text: 'Describe this image in detail. Then, on a new line, add "Tags:" followed by a short, comma-separated list of relevant keywords.' }] } });
        const tagsMatch = response.text.match(/Tags: (.*)/i);
        const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()) : [];
        const analysisText = tagsMatch ? response.text.split(/Tags: .*/i)[0].trim() : response.text.trim();
        res.json({ analysis_text: analysisText, tags });
    } catch (error) {
        console.error('Image Analysis Error:', error);
        res.status(500).json({ error: 'Failed to analyze image' });
    }
});

// --- LOCAL IMAGE ROUTES ---
app.get('/api/local-images', async (req: ExpressRequest, res: ExpressResponse) => { try { const r = await pool.query('SELECT * FROM local_images ORDER BY created_at DESC'); res.json(r.rows); } catch (e) { res.status(500).json({e})}});
app.post('/api/local-images/upload', upload.array('images'), async (req: ExpressRequest, res: ExpressResponse) => { try { if (!req.files) return res.status(400).send('No files uploaded.'); for (const f of req.files as Express.Multer.File[]) { await pool.query('INSERT INTO local_images (filename, original_filename) VALUES ($1, $2)', [f.filename, f.originalname]); } res.status(201).json({ message: 'Images uploaded successfully' }); } catch(e){res.status(500).json({e})}});
app.delete('/api/local-images/:id', async (req: ExpressRequest, res: ExpressResponse) => { try { const f = await pool.query('SELECT filename FROM local_images WHERE id = $1', [req.params.id]); await pool.query('DELETE FROM local_images WHERE id = $1', [req.params.id]); if (f.rows[0]) fs.unlink(path.join('local_uploads', f.rows[0].filename), ()=>{}); res.status(204).send(); } catch(e){res.status(500).json({e})}});
app.post('/api/local-images/:id/analyze', async (req: ExpressRequest, res: ExpressResponse) => { try { const r = await pool.query('SELECT * FROM local_images WHERE id = $1', [req.params.id]); if(r.rows.length===0) return res.status(404).json({error: 'Image not found'}); const f = r.rows[0]; const p = path.join('local_uploads', f.filename); const anRes = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts: [{ inlineData: { data: fs.readFileSync(p).toString("base64"), mimeType: 'image/jpeg' } }, { text: 'Describe image detail. Then, new line, add "Tags:" comma-separated list of keywords.' }] } }); const tags = anRes.text.match(/Tags: (.*)/i)? anRes.text.match(/Tags: (.*)/i)![1].split(',').map(t => t.trim()) : []; const analysisText = anRes.text.match(/Tags: .*/i) ? anRes.text.split(/Tags: .*/i)[0].trim() : anRes.text.trim(); const u = await pool.query('UPDATE local_images SET analysis_text = $1, tags = $2 WHERE id = $3 RETURNING *', [analysisText, tags, req.params.id]); res.json(u.rows[0]); } catch(e){res.status(500).json({error: (e as Error).message})}});

// --- RAG DOCUMENT & REPOSITORY ROUTES ---
app.get('/api/rag-documents/:repository', async (req: ExpressRequest, res: ExpressResponse) => { try {const r = await pool.query('SELECT * FROM rag_documents WHERE repository = $1 ORDER BY created_at DESC', [req.params.repository]); res.json(r.rows);} catch(e){res.status(500).json({error:(e as Error).message})}});
app.post('/api/rag-documents/:repository/upload', upload.single('file'), async (req: ExpressRequest, res: ExpressResponse) => { try { if (!req.file) return res.status(400).json({ error: 'No file uploaded.' }); const c = fs.readFileSync(req.file.path, 'utf-8'); const r = await pool.query('INSERT INTO rag_documents (filename, original_filename, content, repository) VALUES ($1, $2, $3, $4) RETURNING *', [req.file.filename, req.file.originalname, c, req.params.repository]); res.status(201).json(r.rows[0]); } catch(e){res.status(500).json({error:(e as Error).message})}});
app.delete('/api/rag-documents/:id', async (req: ExpressRequest, res: ExpressResponse) => { try { const f = await pool.query('SELECT filename FROM rag_documents WHERE id = $1', [req.params.id]); await pool.query('DELETE FROM rag_documents WHERE id = $1', [req.params.id]); if (f.rows[0]) fs.unlink(path.join('uploads', f.rows[0].filename), ()=>{}); res.status(204).send(); } catch(e){res.status(500).json({e})}});
app.post('/api/rag-documents/save-chat', async (req: ExpressRequest, res: ExpressResponse) => { try { const { chat, repository } = req.body; const c = formatChatMessages(chat); const f = `chat_${chat.id}.txt`; const r = await pool.query('INSERT INTO rag_documents (filename, original_filename, content, repository) VALUES ($1, $2, $3, $4) RETURNING *', [f, f, c, repository]); res.status(201).json(r.rows[0]); } catch(e){res.status(500).json({error:(e as Error).message})}});

app.get('/api/rag-repositories', async (req: ExpressRequest, res: ExpressResponse) => { try { const r = await pool.query('SELECT * FROM rag_repositories ORDER BY name'); res.json(r.rows); } catch (e) { res.status(500).json({ error: 'Failed to fetch repositories' }); } });
app.post('/api/rag-repositories', async (req: ExpressRequest, res: ExpressResponse) => { try { const { name, agentId } = req.body; if (!name || !/^[a-zA-Z0-9_:-]+$/.test(name)) return res.status(400).json({ error: 'Valid name required.' }); const r = await pool.query('INSERT INTO rag_repositories (name, agent_id) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET agent_id = $2 RETURNING *', [name, agentId || null]); res.status(201).json(r.rows[0]); } catch (e) { res.status(500).json({ error: 'Failed to create repository' }); } });
app.delete('/api/rag-repositories/:name', async (req: ExpressRequest, res: ExpressResponse) => { try { const { name } = req.params; if (name === 'common' || ALL_AGENTS.some(a=>a.id===name)) return res.status(400).json({ error: 'Cannot delete system/agent repositories.' }); const c = await pool.connect(); try { await c.query('BEGIN'); await c.query('DELETE FROM rag_documents WHERE repository = $1', [name]); await c.query('DELETE FROM rag_repositories WHERE name = $1', [name]); await c.query('COMMIT'); res.status(204).send(); } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); } } catch (e) { res.status(500).json({ error: 'Failed to delete repository' }); } });

// --- STATIC FILE SERVING & SERVER START ---
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/local_uploads', express.static(path.join(__dirname, '..', 'local_uploads')));

// In this environment, the frontend is served automatically. We only need to run the API server.
const startServer = async () => {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

startServer();
