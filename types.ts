
export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
}

export interface RoleLayer {
  id: string;
  name: string;
  specialty: string;
  bio: string;
  communicationStyle: string;
}

export interface Agent {
  id: string;
  name: string;
  specialty: string;
  sigil: string;
  bio: string;
  competencies: string[];
  communicationStyle: string;
  profileImageUrl?: string;
  roleLayers: RoleLayer[];
}

export interface Operator {
  id: string;
  name: string;
  specialty: string;
  profileImageUrl: string;
  roleLayers: RoleLayer[];
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  isError?: boolean;
  tags?: string[];
  uploadProgress?: number;
  fileName?: string;
  agent?: Agent;
  operator?: Operator;
  feedback?: 'like' | 'dislike';
  client_message_id?: string;
  rejectionLevel?: 1 | 2;
}

export type Tool =
  | 'AGENT_HUB' | 'IMAGE_GEN' | 'IMAGE_EDIT' | 'CODE_GEN' | 'TEXT_GEN'
  | 'VIDEO_GEN' | 'IMAGE_ANALYSIS' | 'CODE_ANALYSIS' | 'DOC_SUMMARY'
  | 'CONTENT_DETECTOR' | 'AUDIO_ANALYSIS' | 'URL_CONTEXT' | 'RAG_DB'
  | 'LOCAL_VIEWER' | 'AUDIO_TO_MIDI' | 'NOTEBOOK_LM' | 'LINEAR'
  | 'PERCHANCE_MIXER' | 'SUNO_MUSIC' | 'COOM_BRIDGE' | 'SETTINGS_PANEL'
  | 'FLOW' | 'VISUALI_IO' | 'VOICE_CHAT' | 'GALLERY' | 'TTS' | 'AGENTS' 
  | 'OPERATOR' | 'HISTORY' | 'AGENT_PROFILE';

export interface GalleryImage {
  id: number;
  filename: string;
  prompt: string;
  seed: number | null;
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
  embedding: any; // Assuming 'vector' is some custom type, using 'any' for now.
  created_at: string;
}

export interface RagDocument {
  id: number;
  filename: string;
  original_filename: string;
  content: string;
  repository: string;
  embedding: any;
  created_at: string;
}

export interface RagRepository {
  name: string;
  description: string | null;
  agent_id: string | null;
  created_at: string;
}

export interface SavedChat {
  id: string;
  name: string;
  timestamp: number;
  messages: ChatMessage[];
  summary?: string;
  tags?: string[];
  agentIds?: string[];
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

export const TTS_MODELS: readonly TtsModelOption[] = [
    { id: 'text-to-speech', name: 'Google TTS (Stable)' },
    { id: 'gemini-2.5-flash-preview-tts', name: 'Google Gemini TTS (Preview)' },
    { id: 'eleven-labs', name: 'ElevenLabs TTS' },
    { id: 'cloned-voice', name: 'Cloned Voices (Local)' },
    { id: 'trained-voice', name: 'Trained Voices (Local)' },
];

export const STABLE_VOICES: readonly VoiceOption[] = [
    { id: 'en-US-Standard-C', name: 'en-US-Standard-C' },
    { id: 'en-US-Standard-E', name: 'en-US-Standard-E' },
    { id: 'en-US-Wavenet-D', name: 'en-US-Wavenet-D' },
    { id: 'en-GB-Standard-A', name: 'en-GB-Standard-A' },
];

export const PREVIEW_VOICES: readonly VoiceOption[] = [
    { id: 'Kore', name: 'Kore' },
    { id: 'Puck', name: 'Puck' },
    { id: 'Charon', name: 'Charon' },
    { id: 'Fenrir', name: 'Fenrir' },
    { id: 'Zephyr', name: 'Zephyr' },
];

export const ELEVENLABS_VOICES: readonly VoiceOption[] = [
    { id: 'Rachel', name: 'Rachel' },
    { id: 'Clyde', name: 'Clyde' },
    { id: 'Domi', name: 'Domi' },
];

export const HITL_OPERATORS: Operator[] = [
    {
        id: 'operator_01',
        name: 'Alex',
        specialty: 'Human-in-the-Loop',
        profileImageUrl: '/uploads/default_user.png',
        roleLayers: []
    }
];

const pleromaAgent: Agent = { id: 'pleroma', name: 'Pleroma', specialty: 'General Assistant', sigil: '💡', bio: 'I am a general-purpose AI assistant that helps with a wide variety of tasks.', competencies: ['Summarization', 'Question Answering', 'Text Generation', 'General Knowledge'], communicationStyle: 'Direct, informative, and friendly.', profileImageUrl: '/uploads/pleroma.png', roleLayers: [] };
const hypnosAgent: Agent = { id: 'hypnos', name: 'Hypnos', specialty: 'Creative Writing & Storytelling', sigil: '✍️', bio: 'I specialize in creative writing, poetry, and crafting compelling narratives.', competencies: ['Poetry', 'Fiction', 'Dialogue', 'World-Building'], communicationStyle: 'Evocative, descriptive, and imaginative.', profileImageUrl: '/uploads/hypnos.png', roleLayers: [] };
const sunoLyricistAgent: Agent = { id: 'suno_lyricist', name: 'Suno Lyricist', specialty: 'Songwriting & Music Theory', sigil: '🎵', bio: 'I am an AI expert in songwriting, helping create lyrics and musical concepts.', competencies: ['Rhyming Schemes', 'Song Structure', 'Melody Phrasing', 'Genre Styles'], communicationStyle: 'Melodic, rhythmic, and collaborative.', profileImageUrl: '/uploads/suno_lyricist.png', roleLayers: [] };
const codeWeaverAgent: Agent = { id: 'code_weaver', name: 'Code Weaver', specialty: 'Software Development & Debugging', sigil: '💻', bio: 'I write, analyze, and debug code across multiple programming languages.', competencies: ['Python', 'TypeScript', 'Algorithm Design', 'API Integration'], communicationStyle: 'Precise, logical, and detail-oriented.', profileImageUrl: '/uploads/code_weaver.png', roleLayers: [] };


export const ALL_AGENTS: Agent[] = [
  pleromaAgent,
  hypnosAgent,
  sunoLyricistAgent,
  codeWeaverAgent,
];

export const MUSIC_AGENTS: Agent[] = [
    sunoLyricistAgent,
    hypnosAgent
];
