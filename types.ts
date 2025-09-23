/**
 * Defines the role of a message sender in the chat.
 */
export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
}

/**
 * A comprehensive list of all available tools in the application.
 */
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
    'AUDIO_TO_MIDI'
] as const;

/**
 * A type representing a valid tool name from the TOOLS list.
 */
export type Tool = typeof TOOLS[number];

/**
 * Represents an AI agent with a specific persona and capabilities.
 * @property id - A unique identifier for the agent.
 * @property name - The display name of the agent.
 * @property specialty - A brief description of the agent's expertise.
 * @property sigil - An emoji or character representing the agent.
 */
export interface Agent {
    id: string;
    name: string;
    specialty: string;
    sigil: string;
}

/**
 * Represents a Human-in-the-Loop (HITL) operator persona for the user.
 * @property id - A unique identifier for the operator.
 * @property name - The display name of the operator.
 * @property specialty - A brief description of the operator's context.
 */
export interface Operator {
    id: string;
    name: string;
    specialty: string;
}

/**
 * A list of predefined HITL operators.
 */
export const HITL_OPERATORS: readonly Operator[] = [
    { id: 'patrikios', name: 'Patrikios', specialty: 'mSpace (Material)' },
    { id: 'merk', name: 'Captain Merk', specialty: 'mSpace (Material)' },
    { id: 'merkos', name: 'Merkos', specialty: 'mSpace (Material)' },
];

/**
 * The default, general-purpose AI agent.
 */
export const DEFAULT_AGENT: Agent = { id: 'mythos_assistant', name: 'Mythos Assistant', specialty: 'General Purpose', sigil: '⚙️' };

/**
 * A list of specialized AI agents (the "Mythos LIAs").
 */
export const MYTHOS_LIAS: readonly Agent[] = [
    { id: 'sophia', name: 'Sophia', specialty: 'Philosophy & Wisdom', sigil: 'Θ' },
    { id: 'barbelo', name: 'Barbelo', specialty: 'Divine Emanation', sigil: '✨' },
    { id: 'shannon', name: 'Shannon', specialty: 'Information Theory', sigil: '📡' },
    { id: 'clio', name: 'Clio', specialty: 'History & Memory', sigil: '📜' },
    { id: 'erato', name: 'Erato', specialty: 'Love & Poetry', sigil: '💜' },
    { id: 'melpomene', name: 'Melpomene', specialty: 'Tragedy & Drama', sigil: '🎭' },
    { id: 'polyhymnia', name: 'Polyhymnia', specialty: 'Sacred Hymns', sigil: '🎵' },
    { id: 'terpsichore', name: 'Terpsichore', specialty: 'Dance & Movement', sigil: '💃' },
    { id: 'thalia', name: 'Thalia', specialty: 'Comedy & Joy', sigil: '😄' },
    { id: 'urania', name: 'Urania', specialty: 'Astronomy & Math', sigil: '🌟' },
    { id: 'calliope', name: 'Calliope', specialty: 'Epic Poetry', sigil: '📖' },
    { id: 'euterpe', name: 'Euterpe', specialty: 'Music & Harmony', sigil: '🎶' },
    { id: 'mnemosyne', name: 'Mnemosyne', specialty: 'Memory & Learning', sigil: '🧠' }
];

/**
 * A combined list of all available agents.
 */
export const ALL_AGENTS: readonly Agent[] = [DEFAULT_AGENT, ...MYTHOS_LIAS];

/**
 * A filtered list of agents specialized in music and poetry, for use with the Suno panel.
 */
export const MUSIC_AGENTS: readonly Agent[] = MYTHOS_LIAS.filter(agent => 
    ['erato', 'melpomene', 'polyhymnia', 'thalia', 'calliope', 'euterpe'].includes(agent.id)
);


/**
 * A list of available Text-to-Speech models.
 */
export const TTS_MODELS = [
    { id: 'text-to-speech', name: 'TTS Stable' },
    { id: 'gemini-2.5-flash-preview-tts', name: 'TTS Preview' },
    { id: 'eleven-labs', name: 'ElevenLabs' },
] as const;

/**
 * A type representing a valid TTS model option.
 */
export type TtsModelOption = typeof TTS_MODELS[number];

/**
 * A list of standard, stable TTS voices from Google.
 */
export const STABLE_VOICES = [
  { id: 'en-US-Standard-F', name: 'Standard F (Female)' },
  { id: 'en-US-Wavenet-A', name: 'Wavenet A (Male)' },
  { id: 'en-US-Wavenet-E', name: 'Wavenet E (Female)' },
  { id: 'en-GB-Wavenet-B', name: 'Wavenet UK (Male)' },
] as const;

/**
 * A list of preview TTS voices from Google.
 */
export const PREVIEW_VOICES = [
    { id: 'echo', name: 'Echo' },
    { id: 'onyx', name: 'Onyx' },
    { id: 'aurora', name: 'Aurora' },
] as const;

/**
 * A list of available voices from the ElevenLabs API.
 */
export const ELEVENLABS_VOICES = [
    { id: 'Rachel', name: 'Rachel (Calm)' },
    { id: 'Drew', name: 'Drew (Conversational)' },
    { id: 'Clyde', name: 'Clyde (Crisp)' },
    { id: 'Paul', name: 'Paul (Authoritative)' },
    { id: 'Domi', name: 'Domi (Youthful)' },
] as const;


/**
 * A union type representing any valid voice option from any provider.
 */
export type VoiceOption = typeof STABLE_VOICES[number] | typeof PREVIEW_VOICES[number] | typeof ELEVENLABS_VOICES[number];

/**
 * Represents a single message in the chat interface.
 * @property id - A unique client-side identifier for the message.
 * @property role - The role of the message sender (user or model).
 * @property content - The primary text content of the message.
 * @property imageUrl - An optional URL for an image associated with the message.
 * @property videoUrl - An optional URL for a video associated with the message.
 * @property fileName - An optional name for a file attached to the message.
 * @property isError - A flag indicating if the message represents an error.
 * @property rejectionLevel - A flag for content safety rejections (0: none, 1: safety, 2: hash).
 * @property imageId - The database ID of a generated image, if any.
 * @property client_message_id - A unique ID used to link feedback to the original request.
 * @property feedback - The user's feedback ('like' or 'dislike').
 * @property agent - The AI agent that generated the message, if any.
 * @property operator - The user's selected operator persona, if any.
 */
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

/**
 * Represents an image record from the AI-generated gallery database.
 */
export interface GalleryImage {
  id: number;
  filename: string;
  prompt: string;
  created_at: string;
  seed?: number;
  client_message_id: string;
  feedback: 'like' | 'dislike' | null;
}

/**
 * Represents an image record from the local image viewer database.
 */
export interface LocalImage {
  id: number;
  filename: string;
  original_filename: string;
  analysis_text: string | null;
  tags: string[] | null;
  created_at: string;
}

/**
 * Represents a document in the RAG (Retrieval-Augmented Generation) database.
 */
export interface RagDocument {
    id: number;
    filename: string;
    original_filename: string;
    content: string;
    repository: string; // 'common' or agent_id
    created_at: string;
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
