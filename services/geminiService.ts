
import type { Part } from '@google/genai';
import type { GalleryImage, LocalImage, Tool } from '../types';

const API_BASE_URL = 'http://localhost:3001/api';

// This function now initiates a stream from our OWN backend
export const fetchGenerationStream = async (
    tool: Tool, 
    prompt: string, 
    file: File | null, 
    history: any[], 
    clientMessageId: string
) => {
  const formData = new FormData();
  formData.append('tool', tool);
  formData.append('prompt', prompt);
  formData.append('clientMessageId', clientMessageId);
  if (file) {
      formData.append('file', file);
  }
  if (tool === 'CHAT' && history) {
      formData.append('history', JSON.stringify(history));
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

export async function generateCode(prompt: string, clientMessageId: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/generate-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, clientMessageId }),
    });
    if (!response.ok) throw new Error('Failed to generate code');
    const data = await response.json();
    return data.code;
}

export async function generateText(prompt: string, file: File | null, clientMessageId: string): Promise<string> {
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('clientMessageId', clientMessageId);
    if (file) {
        formData.append('file', file);
    }
    const response = await fetch(`${API_BASE_URL}/generate-text`, {
        method: 'POST',
        body: formData,
    });
    if (!response.ok) throw new Error('Failed to generate text');
    const data = await response.json();
    return data.text;
}

export async function analyzeCode(prompt: string, file: File | null, clientMessageId: string): Promise<string> {
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('clientMessageId', clientMessageId);
    if (file) {
        formData.append('file', file);
    }
    const response = await fetch(`${API_BASE_URL}/analyze-code`, {
        method: 'POST',
        body: formData,
    });
    if (!response.ok) throw new Error('Failed to analyze code');
    const data = await response.json();
    return data.text;
}

export async function fetchGallery(): Promise<GalleryImage[]> {
    const response = await fetch(`${API_BASE_URL}/gallery`);
    if (!response.ok) throw new Error('Failed to fetch gallery');
    return await response.json();
}

export async function summarizeDocument(file: File, clientMessageId: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('clientMessageId', clientMessageId);
    const response = await fetch(`${API_BASE_URL}/summarize-document`, {
        method: 'POST',
        body: formData,
    });
    if (!response.ok) throw new Error('Failed to summarize document');
    const data = await response.json();
    return data.summary;
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

export async function processUrl(url: string, prompt: string, clientMessageId: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/process-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, prompt, clientMessageId }),
    });
    if (!response.ok) throw new Error('Failed to process URL');
    const data = await response.json();
    return data.text;
}

export async function analyzeAudio(file: File, clientMessageId: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('clientMessageId', clientMessageId);
    const response = await fetch(`${API_BASE_URL}/analyze-audio`, {
        method: 'POST',
        body: formData,
    });
    if (!response.ok) throw new Error('Failed to analyze audio');
    const data = await response.json();
    return data.transcript;
}

export interface WeatherResult {
  location: string;
  temperature: number;
  unit: 'C' | 'F';
  condition: string;
  humidity: number;
}
export async function getWeather(location: string, clientMessageId: string): Promise<WeatherResult> {
    const response = await fetch(`${API_BASE_URL}/get-weather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, clientMessageId }),
    });
    if (!response.ok) throw new Error('Failed to get weather');
    return response.json();
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
