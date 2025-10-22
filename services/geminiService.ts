import { GoogleGenAI } from '@google/genai';
import type { Part } from '@google/genai';
import type { GalleryImage, LocalImage, Tool, RagDocument, RagRepository, SavedChat } from '../types';

const API_BASE_URL = '/api';

export async function submitFeedback(clientMessageId: string, feedback: 'like' | 'dislike'): Promise<Response> {
    const response = await fetch(`${API_BASE_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientMessageId, feedback }),
    });
    if (!response.ok) throw new Error('Failed to submit feedback');
    return response;
}

export async function fetchGallery(): Promise<GalleryImage[]> {
    const response = await fetch(`${API_BASE_URL}/gallery`);
    if (!response.ok) throw new Error('Failed to fetch gallery');
    return await response.json();
}

export async function synthesizeSpeech(text: string, voiceId: string, ttsModelId: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/synthesize-speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId, ttsModelId }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'TTS request failed');
  }

  const data = await response.json();
  if (!data.audioContent) {
    throw new Error("No audio content in TTS response.");
  }
  return data.audioContent;
}

// --- Client-Side Voice Data Preparation ---

const getApiKey = (): string | null => {
    try {
        return localStorage.getItem('gemini-api-key');
    } catch (e) {
        console.error("Could not access localStorage:", e);
        return null;
    }
};

const fileToGenerativePart = async (file: File): Promise<Part> => {
    const base64EncodedData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });

    return {
        inlineData: {
            data: base64EncodedData,
            mimeType: file.type,
        },
    };
};

export async function transcribeAudioSample(file: File): Promise<string> {
    const apiKey = getApiKey();
    
    if (!apiKey) {
        const errorMessage = "Gemini API key not found. Please set it in the Settings panel.";
        console.error(errorMessage);
        return Promise.reject(new Error(errorMessage));
    }
    
    try {
        const ai = new GoogleGenAI({ apiKey });
        const audioPart = await fileToGenerativePart(file);
        const textPart = { text: "Transcribe this audio file accurately. The output should be only the transcribed text." };
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [audioPart, textPart] }
        });
        
        return response.text.trim();
    } catch (error) {
        console.error("Error during client-side transcription:", error);
        throw new Error("Failed to transcribe audio.");
    }
}


// --- Local Image Viewer Services ---

export async function fetchLocalImages(): Promise<LocalImage[]> {
    const response = await fetch(`${API_BASE_URL}/local-images`);
    if (!response.ok) throw new Error('Failed to fetch local images');
    return await response.json();
}

export async function uploadLocalImages(files: File[]): Promise<Response> {
    const formData = new FormData();
    files.forEach(file => {
        formData.append('images', file);
    });
    const response = await fetch(`${API_BASE_URL}/local-images/upload`, {
        method: 'POST',
        body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload images');
    return response;
}

export async function deleteLocalImage(id: number): Promise<Response> {
    const response = await fetch(`${API_BASE_URL}/local-images/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete image');
    return response;
}

export async function analyzeLocalImage(id: number): Promise<LocalImage> {
    const response = await fetch(`${API_BASE_URL}/local-images/${id}/analyze`, {
        method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to analyze image');
    return await response.json();
}

// --- RAG Services ---
export async function fetchRagDocuments(repository: string): Promise<RagDocument[]> {
    const response = await fetch(`${API_BASE_URL}/rag-documents/${repository}`);
    if (!response.ok) throw new Error('Failed to fetch RAG documents');
    return await response.json();
}

export async function uploadRagDocument(repository: string, file: File): Promise<RagDocument> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}/rag-documents/${repository}/upload`, {
        method: 'POST',
        body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload RAG document');
    return await response.json();
}

export async function deleteRagDocument(id: number): Promise<Response> {
    const response = await fetch(`${API_BASE_URL}/rag-documents/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete RAG document');
    return response;
}

export async function saveChatToRag(chat: SavedChat, repository: string): Promise<RagDocument> {
    const response = await fetch(`${API_BASE_URL}/rag-documents/save-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat, repository }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save chat to RAG');
    }
    return await response.json();
}


// --- RAG Repository Services ---
export async function fetchRagRepositories(): Promise<RagRepository[]> {
    const response = await fetch(`${API_BASE_URL}/rag-repositories`);
    if (!response.ok) throw new Error('Failed to fetch RAG repositories');
    return await response.json();
}

export async function createRagRepository(name: string, agentId?: string | null): Promise<RagRepository> {
    const response = await fetch(`${API_BASE_URL}/rag-repositories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, agentId }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create RAG repository');
    }
    return await response.json();
}

export async function deleteRagRepository(name: string): Promise<Response> {
    const response = await fetch(`${API_BASE_URL}/rag-repositories/${name}`, {
        method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete RAG repository');
    return response;
}

// --- Suno Services ---
export async function analyzeAudioForSunoStyle(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}/analyze-audio-style`, {
        method: 'POST',
        body: formData,
    });
    if (!response.ok) throw new Error('Failed to analyze audio style');
    const data = await response.json();
    return data.style;
}

export async function generateSunoLyrics(topic: string, agentId: string): Promise<ReadableStreamDefaultReader<Uint8Array>> {
    const response = await fetch(`${API_BASE_URL}/generate-suno-lyrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, agentId }),
    });
    if (!response.ok || !response.body) {
        throw new Error('Failed to generate lyrics stream');
    }
    return response.body.getReader();
}

// --- Audio to MIDI Service ---
export async function convertAudioToMidi(file: File, projectName: string): Promise<{ downloadUrl: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectName', projectName);
    const response = await fetch(`${API_BASE_URL}/convert-audio-to-midi`, {
        method: 'POST',
        body: formData,
    });
    if (!response.ok) throw new Error('Failed to convert audio to MIDI');
    return await response.json();
}