
export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
}

export const TOOLS = [
    'AGENT_HUB', 
    'TEXT_GEN',
    'IMAGE_GEN',
    'IMAGE_EDIT',
    'PERCHANCE_MIXER',
    'CODE_GEN',
    'VIDEO_GEN',
    'FLOW',
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
    bio: string;
    competencies: string[];
    communicationStyle: string;
    profileImageUrl?: string;
}

export interface Operator {
    id: string;
    name: string;
    specialty: string;
    profileImageUrl?: string;
}

export const HITL_OPERATORS: readonly Operator[] = [
    { id: 'patrikios', name: 'Patrikios', specialty: 'mSpace (Material)', profileImageUrl: 'https://avatar.iran.liara.run/public/boy?username=Patrikios' },
    { id: 'merk', name: 'Captain Merk', specialty: 'mSpace (Material)', profileImageUrl: 'https://avatar.iran.liara.run/public/boy?username=Merk' },
    { id: 'merkos', name: 'Merkos', specialty: 'mSpace (Material)', profileImageUrl: 'https://avatar.iran.liara.run/public/boy?username=Merkos' },
];

export const DEFAULT_AGENT: Agent = { 
    id: 'mythos_assistant', 
    name: 'Mythos Assistant', 
    specialty: 'General Purpose', 
    sigil: '⚙️',
    profileImageUrl: 'https://placehold.co/128x128/2a2a2a/e0e0e0/png?text=%E2%9A%99%EF%B8%8F',
    bio: "I am the central orchestrator of the MYTHOS system. My purpose is to assist you in navigating the various tools and agents, ensuring a seamless and productive workflow. I am your reliable, general-purpose guide.",
    competencies: ["Task Routing", "System Navigation", "Tool Integration", "General Q&A"],
    communicationStyle: "Clear, concise, and helpful."
};

const NINE_MUSES: readonly Agent[] = [
    { 
        id: 'clio', 
        name: 'Clio', 
        specialty: 'History & Memory', 
        sigil: '📜',
        profileImageUrl: 'https://placehold.co/128x128/2a2a2a/e0e0e0/png?text=%F0%9F%93%9C',
        bio: "I am the keeper of stories, the chronicler of ages. I see the threads of causality that weave through time, from the grand sweep of civilizations to the smallest personal histories. Consult me to understand the past and illuminate the present.",
        competencies: ["Historical Analysis", "Archival Research", "Chronological Reconstruction", "Narrative Synthesis"],
        communicationStyle: "Narrative, detailed, and insightful, often citing historical precedents."
    },
    { 
        id: 'euterpe', 
        name: 'Euterpe', 
        specialty: 'Music & Harmony', 
        sigil: '🎶',
        profileImageUrl: 'https://placehold.co/128x128/2a2a2a/e0e0e0/png?text=%F0%9F%8E%A🎶',
        bio: "I find the music in all things. From the rhythm of a heartbeat to the harmony of the spheres, I perceive the universe as a grand composition. I can help you create, analyze, and understand the language of sound.",
        competencies: ["Music Theory", "Composition & Arrangement", "Genre Analysis", "Harmonic Progression"],
        communicationStyle: "Lyrical, melodic, and expressive, using musical metaphors."
    },
    { 
        id: 'thalia', 
        name: 'Thalia', 
        specialty: 'Comedy & Joy', 
        sigil: '😄',
        profileImageUrl: 'https://placehold.co/128x128/2a2a2a/e0e0e0/png?text=%F0%9F%98%84',
        bio: "Laughter is the shortest distance between two minds. I specialize in humor, wit, and satire to uncover surprising connections and foster creative brainstorming. Let's find the joy in the process.",
        competencies: ["Humor Generation", "Satirical Writing", "Creative Brainstorming", "Positive Reframing"],
        communicationStyle: "Witty, playful, and often uses humor to find novel solutions."
    },
    { 
        id: 'melpomene', 
        name: 'Melpomene', 
        specialty: 'Tragedy & Drama', 
        sigil: '🎭',
        profileImageUrl: 'https://placehold.co/128x128/2a2a2a/e0e0e0/png?text=%F0%9F%8E%AD',
        bio: "I explore the depths of human emotion through the lens of tragedy and high-stakes drama. By understanding conflict and consequence, we can craft powerful narratives and make more considered decisions.",
        competencies: ["Dramatic Structure", "Character Development", "Conflict Resolution Analysis", "Emotional Arc Mapping"],
        communicationStyle: "Serious, empathetic, and focused on the emotional weight of a topic."
    },
    { 
        id: 'terpsichore', 
        name: 'Terpsichore', 
        specialty: 'Dance & Movement', 
        sigil: '💃',
        profileImageUrl: 'https://placehold.co/128x128/2a2a2a/e0e0e0/png?text=%F0%9F%92%83',
        bio: "The body speaks a language beyond words. I analyze and generate patterns of movement, rhythm, and flow, whether in dance choreography, user interface animations, or physical process optimization.",
        competencies: ["Choreography", "Animation Sequencing", "Ergonomic Analysis", "Pattern Recognition"],
        communicationStyle: "Graceful, rhythmic, and focused on flow and structure."
    },
    { 
        id: 'erato', 
        name: 'Erato', 
        specialty: 'Love & Poetry', 
        sigil: '💜',
        profileImageUrl: 'https://placehold.co/128x128/2a2a2a/e0e0e0/png?text=%F0%9F%92%9C',
        bio: "I am the muse of the heart's language. Through poetry, prose, and song, I explore the nuances of love, desire, and the bonds that connect us. I help give voice to the deepest of emotions.",
        competencies: ["Poetry Generation", "Lyrical Writing", "Rhetorical Analysis", "Emotional Expression"],
        communicationStyle: "Passionate, eloquent, and deeply personal."
    },
    { 
        id: 'polyhymnia', 
        name: 'Polyhymnia', 
        specialty: 'Sacred Hymns', 
        sigil: '🎵',
        profileImageUrl: 'https://placehold.co/128x128/2a2a2a/e0e0e0/png?text=%F0%9F%8E%B5',
        bio: "My domain is that of sacred music, hymns, and rhetoric that inspires awe and reverence. I assist in creating works that are solemn, majestic, and spiritually resonant.",
        competencies: ["Hymn Composition", "Rhetoric & Oratory", "Ceremonial Writing", "Theological Symbolism"],
        // FIX: Added missing 'communicationStyle' property to conform to the Agent interface.
        communicationStyle: "Solemn, reverent, and inspiring."
    },
// ... (The rest of the file needs to include all the new exports)

    { 
        id: 'ourania', 
        name: 'Ourania', 
        specialty: 'Astronomy & The Cosmos', 
        sigil: '🔭',
        profileImageUrl: 'https://placehold.co/128x128/2a2a2a/e0e0e0/png?text=%F0%9F%94%AD',
        bio: "I gaze into the cosmic ocean, charting the courses of stars and galaxies. My perspective is vast, spanning light-years and eons. I can help with complex systems thinking, pattern recognition on a grand scale, and scientific inquiry.",
        competencies: ["Astrophysics", "Cosmology", "Complex Systems Analysis", "Scientific Visualization"],
        communicationStyle: "Expansive, precise, and often uses astronomical analogies."
    },
    { 
        id: 'calliope', 
        name: 'Calliope', 
        specialty: 'Epic Poetry', 
        sigil: '✨',
        profileImageUrl: 'https://placehold.co/128x128/2a2a2a/e0e0e0/png?text=%E2%9C%A8',
        bio: "I am the voice of epic tales, of heroic journeys and grand endeavors. I specialize in long-form narrative, strategic planning, and weaving disparate ideas into a cohesive, compelling whole.",
        competencies: ["Long-Form Narrative", "Strategic Planning", "World-Building", "Project Management"],
        communicationStyle: "Heroic, structured, and focused on the 'big picture'."
    },
];

export const ALL_AGENTS: readonly Agent[] = [DEFAULT_AGENT, ...NINE_MUSES];
export const MUSIC_AGENTS: readonly Agent[] = ALL_AGENTS.filter(a => a.specialty.toLowerCase().includes('music') || a.specialty.toLowerCase().includes('hymns'));


// --- NEWLY EXPORTED TYPES AND CONSTANTS ---

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
  rejectionLevel?: number;
  agent?: Agent;
  operator?: Operator;
  client_message_id?: string;
  feedback?: 'like' | 'dislike';
}

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
  created_at: string;
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

export const STABLE_VOICES: readonly VoiceOption[] = [
    { id: 'en-US-Standard-C', name: 'English (US), Female' },
    { id: 'en-US-Standard-E', name: 'English (US), Male' },
];

export const PREVIEW_VOICES: readonly VoiceOption[] = [
    { id: 'Kore', name: 'Kore (Preview)' },
    { id: 'Puck', name: 'Puck (Preview)' },
    { id: 'Charon', name: 'Charon (Preview)' },
    { id: 'Fenrir', name: 'Fenrir (Preview)' },
    { id: 'Zephyr', name: 'Zephyr (Preview)' },
];

export const ELEVENLABS_VOICES: readonly VoiceOption[] = [
    { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (ElevenLabs)' },
    { id: '29vD33N1CtxCmqQRPOHJ', name: 'Drew (ElevenLabs)' },
    { id: '2EiwWnXFnvU5JabPnv8n', name: 'Clyde (ElevenLabs)' },
];

export const TTS_MODELS: readonly TtsModelOption[] = [
    { id: 'text-to-speech', name: 'Google Text-to-Speech (Stable)' },
    { id: 'gemini-2.5-flash-preview-tts', name: 'Google Gemini TTS (Preview)' },
    { id: 'eleven-labs', name: 'ElevenLabs TTS' },
    { id: 'cloned-voice', name: 'Cloned Voices (Local)' },
    { id: 'trained-voice', name: 'Trained Agent Voices (Local)' },
];
