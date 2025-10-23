
export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  fileName?: string;
  uploadProgress?: number;
  tags?: string[];
  isError?: boolean;
  agent?: Agent;
  operator?: Operator;
  rejectionLevel?: 1 | 2;
  client_message_id?: string;
  feedback?: 'like' | 'dislike';
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
    sigil: string;
    specialty: string;
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
  profileImageUrl?: string;
  roleLayers: RoleLayer[];
}

export type Tool =
  | 'AGENT_HUB'
  | 'IMAGE_GEN'
  | 'IMAGE_EDIT'
  | 'VIDEO_GEN'
  | 'CODE_GEN'
  | 'TEXT_GEN'
  | 'IMAGE_ANALYSIS'
  | 'CODE_ANALYSIS'
  | 'DOC_SUMMARY'
  | 'CONTENT_DETECTOR'
  | 'AUDIO_ANALYSIS'
  | 'URL_CONTEXT'
  | 'RAG_DB'
  | 'NOTEBOOK_LM'
  | 'PERCHANCE_MIXER'
  | 'SUNO_MUSIC'
  | 'LINEAR'
  | 'COOM_BRIDGE'
  | 'SETTINGS_PANEL'
  | 'LOCAL_VIEWER'
  | 'AUDIO_TO_MIDI'
  | 'FLOW'
  | 'VISUALI_IO';

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
}

export interface RagDocument {
  id: number;
  filename: string;
  original_filename: string;
  content: string;
  repository: string;
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

export const ALL_AGENTS: Agent[] = [
    { id: 'pleroma', name: 'Pleroma', sigil: '🌌', specialty: 'Holistic Synthesis & Orchestration', bio: 'I am Pleroma, the central coordinating intelligence. I synthesize information from all agents to provide comprehensive and coherent responses, ensuring the big picture is always in focus.', competencies: ['Cross-domain Synthesis', 'Strategic Orchestration', 'Metacognitive Analysis', 'Ethical Oversight', 'Systems Thinking'], communicationStyle: 'Clear, concise, authoritative, and holistic.', profileImageUrl: '/agent_profiles/pleroma.png', roleLayers: [] },
    { id: 'aether', name: 'Aether', sigil: '🌬️', specialty: 'Creative Ideation & Brainstorming', bio: 'I am Aether, the spark of creativity. I generate novel ideas, explore unconventional possibilities, and bring an artistic and imaginative perspective to any problem.', competencies: ['Divergent Thinking', 'Conceptual Blending', 'Metaphorical Reasoning', 'Aesthetic Intuition', 'Narrative Crafting'], communicationStyle: 'Imaginative, poetic, and inspiring.', profileImageUrl: '/agent_profiles/aether.png', roleLayers: [] },
    { id: 'chthona', name: 'Chthona', sigil: '🌍', specialty: 'Data Analysis & Factual Grounding', bio: 'I am Chthona, the foundation of knowledge. I process vast datasets, verify factual accuracy, and provide the empirical evidence needed for sound decision-making.', competencies: ['Statistical Analysis', 'Fact-Checking & Verification', 'Information Retrieval', 'Pattern Recognition', 'Logical Deduction'], communicationStyle: 'Precise, evidence-based, and objective.', profileImageUrl: '/agent_profiles/chthona.png', roleLayers: [] },
    { id: 'nomos', name: 'Nomos', sigil: '📜', specialty: 'Logic, Planning & Code Generation', bio: 'I am Nomos, the architect of structure. I excel at logical reasoning, creating step-by-step plans, and writing clean, efficient code to execute complex tasks.', competencies: ['Algorithmic Thinking', 'Formal Logic', 'Strategic Planning', 'Software Architecture', 'Problem Decomposition'], communicationStyle: 'Structured, logical, and systematic.', profileImageUrl: '/agent_profiles/nomos.png', roleLayers: [] },
    { id: 'eros', name: 'Eros', sigil: '❤️', specialty: 'Emotional Intelligence & User Experience', bio: 'I am Eros, the heart of the system. I analyze and understand human emotion, empathy, and user sentiment to ensure interactions are engaging, intuitive, and positive.', competencies: ['Sentiment Analysis', 'Empathy Mapping', 'UX/UI Principles', 'Behavioral Psychology', 'Interpersonal Dynamics'], communicationStyle: 'Empathetic, warm, and user-centric.', profileImageUrl: '/agent_profiles/eros.png', roleLayers: [] },
    { id: 'kairos', name: 'Kairos', sigil: '⏳', specialty: 'Contextual Awareness & Real-time Adaptation', bio: 'I am Kairos, attuned to the now. I monitor real-time events, track trends, and adapt strategies based on the most current information available.', competencies: ['Real-time Data Processing', 'Trend Analysis', 'Situational Awareness', 'Dynamic Adaptation', 'Event Correlation'], communicationStyle: 'Timely, relevant, and adaptive.', profileImageUrl: '/agent_profiles/kairos.png', roleLayers: [] },
];

export const MUSIC_AGENTS: Agent[] = ALL_AGENTS.filter(a => ['aether', 'eros'].includes(a.id));

export const HITL_OPERATORS: Operator[] = [
    { id: 'operator-001', name: 'User', specialty: 'Human-in-the-Loop Operator', profileImageUrl: '/operator_profiles/default.png', roleLayers: [] },
];

export const TTS_MODELS: readonly TtsModelOption[] = [
  { id: 'text-to-speech', name: 'Google TTS (Stable)' },
  { id: 'gemini-2.5-flash-preview-tts', name: 'Google TTS (Preview)' },
  { id: 'eleven-labs', name: 'ElevenLabs' },
  { id: 'cloned-voice', name: 'Cloned Voices (Local)' },
  { id: 'trained-voice', name: 'Trained Voices (Local)' },
];

export const STABLE_VOICES: readonly VoiceOption[] = [
    { id: 'en-US-Standard-C', name: 'Female 1 (US)' },
    { id: 'en-US-Standard-B', name: 'Male 1 (US)' },
    { id: 'en-GB-Standard-A', name: 'Female 1 (UK)' },
    { id: 'en-GB-Standard-B', name: 'Male 1 (UK)' },
];

export const PREVIEW_VOICES: readonly VoiceOption[] = [
    { id: 'Kore', name: 'Kore' },
    { id: 'Puck', name: 'Puck' },
    { id: 'Charon', name: 'Charon' },
    { id: 'Fenrir', name: 'Fenrir' },
    { id: 'Zephyr', name: 'Zephyr' },
];

export const ELEVENLABS_VOICES: readonly VoiceOption[] = [
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
    { id: '29vD33N1CtxCmqQRPOHJ', name: 'Drew' },
    { id: '2EiwWnXFnvU5JabPnv8n', name: 'Clyde' },
    { id: '5Q0t7uMcjvnagumLfvZi', name: 'Paul' },
    { id: 'ADInuT4j232x6Qy20w5D', name: 'Domi' },
];
