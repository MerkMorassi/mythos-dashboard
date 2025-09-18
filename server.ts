import express from 'express';
// FIX: Import Express request and response types with aliases to avoid global type conflicts.
import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
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
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


// --- FILE STORAGE ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
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
const ai = new GoogleGenAI({apiKey: process.env.API_KEY || ''});

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

// --- STATIC FILE SERVING ---
// This serves all the frontend files from the root directory of the project.
app.use(express.static(path.join(__dirname, '..')));
app.use('/uploads', express.static('uploads'));
app.use('/local_uploads', express.static('local_uploads'));


// --- API ROUTES ---
const apiRouter = express.Router();

// FIX: Use aliased types for request and response objects.
apiRouter.post('/generate-stream', upload.single('file'), async (req: ExpressRequest, res: ExpressResponse) => {
    const { tool, prompt, clientMessageId, history, activeAgents } = req.body;
    const file = req.file;
    
    res.setHeader('Content-Type', 'text/plain');

    try {
        const agents: Agent[] = activeAgents ? ALL_AGENTS.filter(a => JSON.parse(activeAgents).includes(a.id)) : [];
        const parsedHistory = history ? JSON.parse(history) : [];

        const streamChunk = (chunk: string, agentId?: string) => {
            if (agentId) {
                res.write(`${agentId}::${chunk}`);
            } else {
                res.write(chunk);
            }
        };

        if (tool === 'AGENT_HUB' && agents.length > 0) {
            for (const agent of agents) {
                const systemInstruction = `You are ${agent.name}, an AI assistant specializing in ${agent.specialty}. Act strictly as this persona.`;
                const contents = [...parsedHistory, { role: 'user', parts: [{ text: prompt }] }];
                
                const response = await ai.models.generateContentStream({
                    model: 'gemini-2.5-flash',
                    contents,
                    config: { systemInstruction }
                });

                for await (const chunk of response) {
                    streamChunk(chunk.text, agent.id);
                }
                 res.write(`\n`); // Delimiter
            }
        } else {
            // Default or single-tool generation
            let model = 'gemini-2.5-flash';
            let contents: any = [{ role: 'user', parts: [{ text: prompt }] }];
            
            if (file) {
                 const filePart = fileToGenerativePart(file);
                 contents[0].parts.push(filePart);
            }

            const response = await ai.models.generateContentStream({ model, contents });
            for await (const chunk of response) {
                streamChunk(chunk.text);
            }
        }
    } catch (error) {
        console.error('Streaming Error:', error);
        res.status(500).write('STREAM_ERROR');
    } finally {
        res.end();
    }
});


// FIX: Use aliased types for request and response objects.
apiRouter.post('/generate-image', async (req: ExpressRequest, res: ExpressResponse) => {
    const { prompt, clientMessageId } = req.body;
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt,
        });

        const image = response.generatedImages[0].image;
        const filename = `${clientMessageId}-${Date.now()}.png`;
        fs.writeFileSync(`uploads/${filename}`, Buffer.from(image.imageBytes, 'base64'));

        const dbResult = await pool.query(
            'INSERT INTO images (filename, prompt, client_message_id) VALUES ($1, $2, $3) RETURNING id',
            [filename, prompt, clientMessageId]
        );

        res.json({ imageUrl: `/uploads/${filename}`, filename, id: dbResult.rows[0].id });
    } catch (error) {
        console.error('Image Generation Error:', error);
        res.status(500).json({ error: 'Failed to generate image' });
    }
});

// All other API routes... (gallery, feedback, video, etc.)
// ... I will add the rest of the endpoints here based on the full application logic.

// FIX: Use aliased types for request and response objects.
apiRouter.get('/gallery', async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const result = await pool.query('SELECT * FROM images ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Gallery Fetch Error:', error);
        res.status(500).json({ error: 'Failed to fetch gallery' });
    }
});

// FIX: Use aliased types for request and response objects.
apiRouter.post('/feedback', async (req: ExpressRequest, res: ExpressResponse) => {
    const { clientMessageId, feedback } = req.body;
    try {
        await pool.query('UPDATE images SET feedback = $1 WHERE client_message_id = $2', [feedback, clientMessageId]);
        res.sendStatus(200);
    } catch (error) {
        console.error('Feedback Error:', error);
        res.status(500).json({ error: 'Failed to save feedback' });
    }
});

app.use('/api', apiRouter);

// Fallback for client-side routing
// FIX: Use aliased types for request and response objects.
app.get('*', (req: ExpressRequest, res: ExpressResponse) => {
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, '..', 'index.html'));
    } else {
        res.status(404).send('API endpoint not found');
    }
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
