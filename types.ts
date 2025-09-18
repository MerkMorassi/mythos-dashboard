

export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
}

export const TOOLS = [
    'AGENT_HUB', 
    'TEXT_GEN',
    'IMAGE_GEN',
    'PERCHANCE_MIXER',
    'CODE_GEN',
    'VIDEO_GEN', 
    'SUNO_MUSIC',
    'TTS_PANEL',
    'IMAGE_ANALYSIS',
    'CODE_ANALYSIS',
    'DOC_SUMMARY', 
    'CONTENT_DETECTOR', 
    'AUDIO_ANALYSIS', 
    'URL_CONTEXT', 
    'LOCAL_VIEWER',
    'NOTEBOOK_LM',
    'LINEAR',
    'RAG_DB',
    'OPERATOR_PANEL',
    'COOM_BRIDGE',
    'AUDIO_TO_MIDI',
    'SETTINGS_PANEL'
] as const;
export type Tool = typeof TOOLS[number];

export interface Agent {
    id: string;
    name: string;
    specialty: string;
    sigil: string;
}

export interface Operator {
    id: string;
    name: string;
    specialty: string;
}

export const HITL_OPERATORS: readonly Operator[] = [
    { id: 'patrikios', name: 'Patrikios', specialty: 'mSpace (Material)' },
    { id: 'merk', name: 'Captain Merk', specialty: 'mSpace (Material)' },
    { id: 'merkos', name: 'Merkos', specialty: 'mSpace (Material)' },
];

export const DEFAULT_AGENT: Agent = { id: 'mythos_assistant', name: 'Mythos Assistant', specialty: 'General Purpose', sigil: '⚙️' };

const NINE_MUSES: readonly Agent[] = [
    { id: 'clio', name: 'Clio', specialty: 'History & Memory', sigil: '📜' },
    { id: 'euterpe', name: 'Euterpe', specialty: 'Music & Harmony', sigil: '🎶' },
    { id: 'thalia', name: 'Thalia', specialty: 'Comedy & Joy', sigil: '😄' },
    { id: 'melpomene', name: 'Melpomene', specialty: 'Tragedy & Drama', sigil: '🎭' },
    { id: 'terpsichore', name: 'Terpsichore', specialty: 'Dance & Movement', sigil: '💃' },
    { id: 'erato', name: 'Erato', specialty: 'Love & Poetry', sigil: '💜' },
    { id: 'polyhymnia', name: 'Polyhymnia', specialty: 'Sacred Hymns', sigil: '🎵' },
    { id: 'urania', name: 'Urania', specialty: 'Astronomy & Math', sigil: '🌟' },
    { id: 'calliope', name: 'Calliope', specialty: 'Epic Poetry', sigil: '📖' },
];

export const MYTHOS_LIAS: readonly Agent[] = [
    ...NINE_MUSES,
    { id: 'domantheia', name: 'Domantheia', specialty: 'Architecture & Structure', sigil: '🏛️' },
    { id: 'sophia', name: 'Sophia', specialty: 'Philosophy & Wisdom', sigil: 'Θ' },
    { id: 'noesis', name: 'Noesis', specialty: 'Intellect & Insight', sigil: '👁️' },
    { id: 'barbelo', name: 'Barbelo', specialty: 'Divine Emanation', sigil: '✨' },
];

export const ALL_AGENTS: readonly Agent[] = [DEFAULT_AGENT, ...MYTHOS_LIAS];

export const MUSIC_AGENTS: readonly Agent[] = MYTHOS_LIAS.filter(agent => 
    ['erato', 'melpomene', 'polyhymnia', 'thalia', 'calliope', 'euterpe'].includes(agent.id)
);


export const TTS_MODELS = [
    { id: 'text-to-speech', name: 'TTS Stable' },
    { id: 'gemini-2.5-flash-preview-tts', name: 'TTS Preview' },
    { id: 'eleven-labs', name: 'ElevenLabs' },
    { id: 'cloned-voice', name: 'Cloned Voices' },
    { id: 'trained-voice', name: 'Trained Voices' },
] as const;

export type TtsModelOption = typeof TTS_MODELS[number];

export const STABLE_VOICES = [
  { id: 'en-US-Standard-F', name: 'Standard F (Female)' },
  { id: 'en-US-Wavenet-A', name: 'Wavenet A (Male)' },
  { id: 'en-US-Wavenet-E', name: 'Wavenet E (Female)' },
  { id: 'en-GB-Wavenet-B', name: 'Wavenet UK (Male)' },
] as const;

export const PREVIEW_VOICES = [
    { id: 'echo', name: 'Echo' },
    { id: 'onyx', name: 'Onyx' },
    { id: 'aurora', name: 'Aurora' },
] as const;

export const ELEVENLABS_VOICES = [
    { id: 'Rachel', name: 'Rachel (Calm)' },
    { id: 'Drew', name: 'Drew (Conversational)' },
    { id: 'Clyde', name: 'Clyde (Crisp)' },
    { id: 'Paul', name: 'Paul (Authoritative)' },
    { id: 'Domi', name: 'Domi (Youthful)' },
] as const;

export type VoiceOption = typeof STABLE_VOICES[number] | typeof PREVIEW_VOICES[number] | typeof ELEVENLABS_VOICES[number] | { id: string; name: string; };

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  fileName?: string;
  isError?: boolean;
  rejectionLevel?: 0 | 1 | 2;
  imageId?: number;
  client_message_id?: string;
  feedback?: 'like' | 'dislike' | null;
  agent?: Agent;
  operator?: Operator;
}

export interface GalleryImage {
  id: number;
  filename: string;
  prompt: string;
  created_at: string;
  seed?: number;
  client_message_id: string;
  feedback: 'like' | 'dislike' | null;
}

export interface LocalImage {
  id: number;
  filename: string;
  original_filename: string;
  analysis_text: string | null;
  tags: string[] | null;
  created_at: string;
}

export interface RagDocument {
    id: number;
    filename: string;
    original_filename: string;
    content: string;
    repository: string; // 'common' or agent_id
    created_at: string;
}

export interface TrainingSample {
    id: number;
    agent_id: string;
    filename: string;
    original_filename: string;
    created_at: string;
    blob: Blob;
    transcript: string | null;
}


// Add type definitions for the Web Speech API to resolve TypeScript errors.
// This is not a full definition but covers what is used in the app.
declare global {
  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: (event: {
      resultIndex: number;
      results: {
        length: number;
        [index: number]: {
          [index: number]: {
            transcript: string;
          };
        };
      };
    }) => void;
    onerror: (event: { error: string }) => void;
    onend: () => void;
  }

  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}