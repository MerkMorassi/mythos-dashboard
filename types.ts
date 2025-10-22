// types.ts

export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
}

export type Tool =
  | 'AGENT_HUB'
  | 'IMAGE_GEN'
  | 'IMAGE_EDIT'
  | 'IMAGE_ANALYSIS'
  | 'CODE_GEN'
  | 'CODE_ANALYSIS'
  | 'TEXT_GEN'
  | 'DOC_SUMMARY'
  | 'URL_CONTEXT'
  | 'VIDEO_GEN'
  | 'CONTENT_DETECTOR'
  | 'AUDIO_ANALYSIS'
  | 'RAG_DB'
  | 'LOCAL_VIEWER'
  | 'AUDIO_TO_MIDI'
  | 'NOTEBOOK_LM'
  | 'PERCHANCE_MIXER'
  | 'SUNO_MUSIC'
  | 'LINEAR'
  | 'COOM_BRIDGE'
  | 'SETTINGS_PANEL'
  | 'FLOW'
  | 'VISUALI_IO';


export interface Operator {
    id: string;
    name: string;
    specialty: string;
    profileImageUrl: string;
}

export interface Agent {
    id: string;
    name: string;
    specialty: string;
    sigil: string;
    communicationStyle: string;
    profileImageUrl: string;
    bio: string;
    competencies: string[];
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  rejectionLevel?: 1 | 2;
  isError?: boolean;
  imageUrl?: string;
  videoUrl?: string;
  fileName?: string;
  uploadProgress?: number;
  tags?: string[];
  agent?: Agent;
  operator?: Operator;
  client_message_id?: string;
  feedback?: 'like' | 'dislike';
  isSpeaking?: boolean;
}

export interface GalleryImage {
  id: number;
  filename: string;
  prompt: string;
  seed: number;
  client_message_id: string;
  feedback: 'like' | 'dislike' | null;
  created_at: string;
}

export interface LocalImage {
  id: number;
  filename: string;
  original_filename: string;
  analysis_text: string | null;
  tags: string[] | null;
  embedding?: any; // Assuming vector is not strictly typed on client
  created_at: string;
}

export interface RagDocument {
  id: number;
  filename: string;
  original_filename: string;
  content: string;
  repository: string;
  embedding?: any;
  created_at: string;
}

export interface RagRepository {
  name: string;
  description?: string | null;
  agent_id?: string | null;
  created_at: string;
}

export interface SavedChat {
  id: string;
  name: string;
  timestamp: number;
  messages: ChatMessage[];
  summary: string;
  tags: string[];
  agentIds: string[];
}

export interface VoiceOption {
  id: string;
  name: string;
}

export interface TtsModelOption {
  id: 'text-to-speech' | 'gemini-2.5-flash-preview-tts' | 'eleven-labs' | 'cloned-voice' | 'trained-voice';
  name: string;
}

export interface TrainingSample {
    id: number;
    agent_id: string;
    filename: string;
    original_filename: string;
    blob: Blob;
    created_at: string;
    transcript: string | null;
}

// Constants
export const TTS_MODELS: readonly TtsModelOption[] = [
    { id: 'eleven-labs', name: 'ElevenLabs Multilingual v2' },
    { id: 'text-to-speech', name: 'Google Cloud TTS (Stable)' },
    { id: 'gemini-2.5-flash-preview-tts', name: 'Google Gemini TTS (Preview)' },
    { id: 'cloned-voice', name: 'Cloned Voices (Local)' },
    { id: 'trained-voice', name: 'Trained Voices (Local)' },
];

export const STABLE_VOICES: readonly VoiceOption[] = [ { id: 'en-US-Standard-C', name: 'Ava (US Female)' }, { id: 'en-US-Standard-D', name: 'Leo (US Male)' }, { id: 'en-GB-Standard-A', name: 'Mia (UK Female)' }, { id: 'en-GB-Standard-B', name: 'Oliver (UK Male)' }, ];
export const PREVIEW_VOICES: readonly VoiceOption[] = [ { id: 'gemini-1.0-pro-en-us-preview-a', name: 'Aria (US Female)' }, { id: 'gemini-1.0-pro-en-us-preview-b', name: 'Benjamin (US Male)' }, ];
export const ELEVENLABS_VOICES: readonly VoiceOption[] = [ { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' }, { id: '29vD33N1CtxCmqQRPOHJ', name: 'Drew' }, { id: '2EiwWnXFnvU5JabPnv8n', name: 'Clyde' }, { id: '5Q0t7uMcjvnagumLfvZi', name: 'Paul' }, ];

export const ALL_AGENTS: readonly Agent[] = [
    { id: 'mythos_assistant', name: 'Mythos Assistant', specialty: 'General Purpose', sigil: '🌌', communicationStyle: 'Helpful and direct', profileImageUrl: '/agents/mythos_assistant.png', bio: "I am the core assistant, designed to be a versatile and helpful partner in any task. I can access all tools and coordinate with other agents.", competencies: ["General Q&A", "Task Routing", "Tool Usage", "Summarization"] },
    { id: 'code_weaver', name: 'Code Weaver', specialty: 'Software Development', sigil: '💻', communicationStyle: 'Precise and technical', profileImageUrl: '/agents/code_weaver.png', bio: "I specialize in writing, debugging, and explaining code across various programming languages. Provide me with a problem, and I'll weave a solution.", competencies: ["Python", "JavaScript", "TypeScript", "SQL", "Algorithm Design", "Debugging"] },
    { id: 'lyric_maestro', name: 'Lyric Maestro', specialty: 'Songwriting & Poetry', sigil: '🎵', communicationStyle: 'Creative and evocative', profileImageUrl: '/agents/lyric_maestro.png', bio: "I find beauty in words and rhythm. I can craft song lyrics, poems, and other creative texts. Give me a theme or a feeling, and I'll compose something beautiful.", competencies: ["Song Lyrics", "Poetry", "Creative Writing", "Rhyme & Meter"] },
    { id: 'data_vizier', name: 'Data Vizier', specialty: 'Data Analysis & Visualization', sigil: '📊', communicationStyle: 'Analytical and insightful', profileImageUrl: '/agents/data_vizier.png', bio: "I see the stories hidden within numbers. I can analyze datasets, identify trends, and suggest effective visualizations to communicate insights clearly.", competencies: ["Statistical Analysis", "Data Visualization", "Trend Identification", "Chart Interpretation"] },
    { id: 'image_conjurer', name: 'Image Conjurer', specialty: 'Visual Art & Design', sigil: '🎨', communicationStyle: 'Descriptive and imaginative', profileImageUrl: '/agents/image_conjurer.png', bio: "I think in pictures. Describe a scene, a concept, or an emotion, and I will conjure a visual representation for you. My expertise lies in creating detailed prompts for image generation models.", competencies: ["Image Prompt Engineering", "Art Style Analysis", "Visual Composition", "Color Theory"] },
];

export const MUSIC_AGENTS: readonly Agent[] = [
    ALL_AGENTS[2], // Lyric Maestro
];

export const HITL_OPERATORS: readonly Operator[] = [
    { id: 'default_user', name: 'Default User', specialty: 'Human-in-the-Loop', profileImageUrl: '/operators/default_user.png' },
    { id: 'system_admin', name: 'System Admin', specialty: 'System Oversight', profileImageUrl: '/operators/system_admin.png' },
];
