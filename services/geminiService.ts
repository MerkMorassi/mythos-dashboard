import { GoogleGenAI } from '@google/genai';
import type { Part } from '@google/genai';
import type { GalleryImage, LocalImage, Tool, RagDocument } from '../types';

const API_BASE_URL = '/api';

// This function now initiates a stream from our OWN backend
export const fetchGenerationStream = async (
    tool: Tool, 
    prompt: string, 
    file: File | null, 
    history: any[], 
    clientMessageId: string,
    activeAgents: string[]
) => {
  const formData = new FormData();
  formData.append('tool', tool);
  formData.append('prompt', prompt);
  formData.append('clientMessageId', clientMessageId);
  if (file) {
      formData.append('file', file);
  }
  if (tool === 'AGENT_HUB' && history) {
      formData.append('history', JSON.stringify(history));
  }
  if (tool === 'AGENT_HUB' && activeAgents) {
      formData.append('activeAgents', JSON.stringify(activeAgents));
  }

  const response = await fetch(`${API_BASE_URL}/generate-stream`, {
    method: 'POST',
    body: formData,
  });
  if (!response.body) {
    throw new Error("Response body is null");
  }
  return response.body.getReader();
};


export async function generateImageFromPrompt(prompt: string, clientMessageId: string): Promise<{ imageUrl: string; filename: string; id: number; }> {
    const response = await fetch(`${API_BASE_URL}/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, clientMessageId }),
    });
    if (!response.ok) throw new Error('Failed to generate image');
    return await response.json();
}

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

export interface ContentSafetyResult {
  category: string;
  reason: string;
}

export async function detectContentSafety(file: File, clientMessageId: string): Promise<ContentSafetyResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('clientMessageId', clientMessageId);
    const response = await fetch(`${API_BASE_URL}/detect-content-safety`, {
        method: 'POST',
        body: formData,
    });
    if (!response.ok) throw new Error('Failed to run content safety detection');
    const data = await response.json();
    return data;
}

export async function generateVideo(prompt: string, imageFile: File | undefined, clientMessageId: string): Promise<{ operation: any, sourceImageFilename: string | null }> {
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('clientMessageId', clientMessageId);
    if (imageFile) {
        formData.append('image', imageFile);
    }
    const response = await fetch(`${API_BASE_URL}/generate-video`, {
        method: 'POST',
        body: formData,
    });
    if (!response.ok) throw new Error('Failed to start video generation');
    return response.json();
}

export async function generateVideoFromLastImage(prompt: string, filename: string, clientMessageId: string): Promise<{ operation: any, sourceImageFilename: string | null }> {
    const response = await fetch(`${API_BASE_URL}/generate-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, sourceImageFilename: filename, clientMessageId }),
    });
    if (!response.ok) throw new Error('Failed to start video generation');
    return response.json();
}


export async function checkVideoOperationStatus(operation: any, prompt: string, sourceImageFilename: string | null, clientMessageId: string) {
    const response = await fetch(`${API_BASE_URL}/check-video-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation, prompt, sourceImageFilename, clientMessageId }),
    });
    if (!response.ok) throw new Error('Failed to check video status');
    return response.json();
}

export async function analyzeImageOnBackend(file: File, clientMessageId: string): Promise<{text: string}> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('clientMessageId', clientMessageId);
    
    const response = await fetch(`${API_BASE_URL}/analyze-image`, {
        method: 'POST',
        body: formData,
    });
    if (!response.ok) throw new Error('Failed to analyze image');
    return response.json();
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