

export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
}

export const TOOLS = [
    'CHAT', 
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
    'NOTEBOOK_LM',
    'RAG_DB'
] as const;
export type Tool = typeof TOOLS[number];

export const TTS_MODELS = [
    { id: 'text-to-speech', name: 'TTS Stable' },
    { id: 'gemini-2.5-flash-preview-tts', name: 'TTS Preview' },
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

export type VoiceOption = typeof STABLE_VOICES[number] | typeof PREVIEW_VOICES[number];

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  fileName?: string;
  isError?: boolean;
  rejectionLevel?: 0 | 1 | 2;
}

export interface GalleryImage {
  filename: string;
  prompt: string;
  created_at: string;
  seed?: number;
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