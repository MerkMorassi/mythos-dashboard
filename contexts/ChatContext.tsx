import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import type { ChatMessage as Message, Tool, Agent, SavedChat } from '../types';
import { MessageRole, ALL_AGENTS } from '../types';
import { GoogleGenAI, Modality } from '@google/genai';
import type { Part } from '@google/genai';
import { synthesizeSpeech, submitFeedback, saveChatToRag } from '../services/geminiService';
import { getClonedVoiceBlob, getFirstTrainingSampleBlob } from '../services/dbService';
import { markdownToPlainText } from '../utils/textUtils';
import { decodeBase64, decodePcm } from '../utils/audioUtils';
import { useTools } from './ToolContext';
import { useAgents } from './AgentsContext';

const CHAT_HISTORY_KEY = 'mythos-chat-history';

const initialMessage: Message = {
  id: 'init',
  role: MessageRole.MODEL,
  content: "Hello! I am a multi-tool assistant. Please select a tool to get started. Note: In this environment, server-dependent features like the Gallery, RAG, and Video Generation are unavailable.",
};


interface ChatContextState {
  messages: Message[];
  isLoading: boolean;
  input: string;
  setInput: (input: string) => void;
  speakingMessageId: string | null;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  addMessage: (message: Omit<Message, 'id'>) => void;
  handleSpeak: (message: Message) => void;
  onToolSend: (message: string, file: File | null) => void;
  onInitiateEdit: (text: string) => void;
  onFeedback: (messageId: string, feedback: 'like' | 'dislike') => void;
  isImageAvailableForVideo: boolean;
  onGenerateVideoFromLastImage: (prompt: string) => void;
  // Video Generation State
  isGeneratingVideo: boolean;
  videoGenerationProgress: string;
  lastGeneratedVideoUrl: string | null;
  videoGenerationError: string | null;
  // Chat History state and functions
  savedChats: SavedChat[];
  currentChatId: string | null;
  isSavingChat: boolean;
  startNewChat: () => void;
  saveCurrentChat: (name: string) => void;
  loadChat: (chatId: string) => void;
  deleteChat: (chatId: string) => void;
  // Save to RAG Modal state
  isSaveToRagModalOpen: boolean;
  chatToSaveToRag: SavedChat | null;
  openSaveToRagModal: (chat: SavedChat) => void;
  closeSaveToRagModal: () => void;
  handleSaveChatToRag: (chat: SavedChat, repository: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextState | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeTool, selectedTtsModel, selectedVoice, activeOperator, handleFetchGallery, isServerReady, isConversationModeActive } = useTools();
  const { activeAgents } = useAgents();

  const [messages, setMessages] = useState<Message[]>([initialMessage]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [lastGeneratedImageBase64, setLastGeneratedImageBase64] = useState<string | null>(null);
  
  // Video state
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoGenerationProgress, setVideoGenerationProgress] = useState('');
  const [lastGeneratedVideoUrl, setLastGeneratedVideoUrl] = useState<string | null>(null);
  const [videoGenerationError, setVideoGenerationError] = useState<string | null>(null);

  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isSavingChat, setIsSavingChat] = useState(false);
  const [isSaveToRagModalOpen, setIsSaveToRagModalOpen] = useState(false);
  const [chatToSaveToRag, setChatToSaveToRag] = useState<SavedChat | null>(null);

  const audioSourceRef = useRef<AudioBufferSourceNode | HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastSpokenMessageIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    try {
        const historyJson = localStorage.getItem(CHAT_HISTORY_KEY);
        if (historyJson) {
            setSavedChats(JSON.parse(historyJson));
        }
    } catch (e) {
        console.error("Could not load chat history from localStorage:", e);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = useCallback((message: Omit<Message, 'id'>) => {
    setMessages(prev => [...prev, { ...message, id: window.crypto.randomUUID() }]);
  }, []);
  
  const addServerError = (featureName: string) => {
      addMessage({
        role: MessageRole.MODEL,
        content: `${featureName} is only available when running with the full backend server. This feature is currently disabled.`,
        isError: true,
      });
  };

  const stopPlayback = () => {
    if (audioSourceRef.current) {
      if (audioSourceRef.current instanceof AudioBufferSourceNode) {
        audioSourceRef.current.stop();
      } else if (audioSourceRef.current instanceof HTMLAudioElement) {
        audioSourceRef.current.pause();
      }
      audioSourceRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setSpeakingMessageId(null);
  };

  const handleSpeak = useCallback(async (message: Message) => {
    if (speakingMessageId === message.id) {
        stopPlayback();
        return;
    }
    stopPlayback();
    setSpeakingMessageId(message.id);

    try {
        const plainText = markdownToPlainText(message.content);
        const isGoogleModel = selectedTtsModel === 'text-to-speech' || selectedTtsModel === 'gemini-2.5-flash-preview-tts';

        if (isGoogleModel) {
            if (!process.env.API_KEY) throw new Error("Google Gemini API key not configured.");
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
              model: "gemini-2.5-flash-preview-tts",
              contents: [{ parts: [{ text: plainText }] }],
              config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
                },
              },
            });
            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (!base64Audio) throw new Error("No audio data from Gemini TTS.");

            const audioBytes = decodeBase64(base64Audio);
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            audioContextRef.current = audioContext;
            const audioBuffer = await decodePcm(audioBytes, audioContext, 24000, 1);
            
            const source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            source.onended = stopPlayback;
            source.start();
            audioSourceRef.current = source;
        } else if (selectedTtsModel === 'cloned-voice' || selectedTtsModel === 'trained-voice') {
            const getBlobFn = selectedTtsModel === 'cloned-voice' ? getClonedVoiceBlob : getFirstTrainingSampleBlob;
            const voiceId = selectedTtsModel === 'trained-voice' ? (message.agent?.id || selectedVoice) : selectedVoice;
            if (!voiceId) throw new Error("No voice/agent ID found for local playback.");
            
            const audioBlob = await getBlobFn(voiceId);
            if (!audioBlob) throw new Error(`Local voice data for ID ${voiceId} not found.`);
            
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.onended = () => { stopPlayback(); URL.revokeObjectURL(audioUrl); };
            audio.play();
            audioSourceRef.current = audio;
        } else { // eleven-labs or other server-based
            if (!isServerReady) {
                addServerError("Text-to-Speech");
                stopPlayback();
                return;
            }
            const audioContent = await synthesizeSpeech(plainText, selectedVoice, selectedTtsModel);
            const audioBlob = new Blob([Uint8Array.from(atob(audioContent), c => c.charCodeAt(0))], { type: 'audio/mpeg' });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.onended = () => { stopPlayback(); URL.revokeObjectURL(audioUrl); };
            audio.play();
            audioSourceRef.current = audio;
        }

    } catch (error) {
        console.error('Speech synthesis error:', error);
        addMessage({
            role: MessageRole.MODEL,
            content: `Sorry, I couldn't generate audio. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            isError: true,
        });
        stopPlayback();
    }
  }, [speakingMessageId, selectedVoice, selectedTtsModel, addMessage, isServerReady]);

  // FIX: Moved handleSpeak definition before this useEffect to resolve use-before-declaration error.
  useEffect(() => {
    if (isLoading || !isConversationModeActive) return;
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === MessageRole.MODEL && lastMessage.content && lastMessage.content !== '...' && !lastMessage.isError) {
        if (lastMessage.id !== lastSpokenMessageIdRef.current) {
            handleSpeak(lastMessage);
            lastSpokenMessageIdRef.current = lastMessage.id;
        }
    }
  }, [messages, isLoading, isConversationModeActive, handleSpeak]);

  const fileToGenerativePart = async (file: File): Promise<Part> => {
    const base64EncodedData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });
    return { inlineData: { data: base64EncodedData, mimeType: file.type } };
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
  };

  const handleStreamedGeneration = async (
      tool: Tool, 
      userPrompt: string, 
      file: File | null = null, 
      userMessageOverrides: Partial<Message> = {}
  ) => {
    if (!process.env.API_KEY) {
      addMessage({ role: MessageRole.MODEL, content: "Google Gemini API key is not configured.", isError: true });
      return;
    }

    const userMessageContent = file ? userPrompt || `File Upload: ${file.name}` : userPrompt;
    
    let finalUserMessageContent = userMessageOverrides.content || userMessageContent;
    if (tool === 'URL_CONTEXT') {
      const urlRegex = /(https?:\/\/[^\s]+)/;
      const match = userPrompt.match(urlRegex);
      const url = match ? match[0] : '';
      const question = userPrompt.replace(url, '').trim();
      finalUserMessageContent = `URL: ${url}\nPrompt: ${question}`;
    }

    const userMessage: Message = { 
        id: window.crypto.randomUUID(), 
        role: MessageRole.USER, 
        content: finalUserMessageContent,
        operator: activeOperator,
        ...userMessageOverrides 
    };
    
    let newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    
    const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
    
    try {
        if (tool === 'AGENT_HUB') {
            if (activeAgents.size === 0) {
                addMessage({ role: MessageRole.MODEL, content: "Please select at least one agent to chat with.", isError: true });
                setIsLoading(false);
                return;
            }
            
            const conversationHistory = newMessages
                .filter(m => (m.role !== MessageRole.MODEL || !m.isError) && m.id !== 'init')
                .map(m => ({
                    role: m.role,
                    parts: [{ text: m.operator ? `[OPERATOR: ${m.operator.name}]\n${m.content}` : m.content }]
                }));

            const agentsToQuery = Array.from(activeAgents);
            for (const agentId of agentsToQuery) {
                const agent = ALL_AGENTS.find(a => a.id === agentId);
                if (!agent) continue;
                 
                const responseMessageId = window.crypto.randomUUID();
                setMessages(prev => [...prev, { id: responseMessageId, role: MessageRole.MODEL, content: '...', agent: agent }]);
                 
                const systemInstruction = `You are ${agent.name}, an AI assistant specializing in ${agent.specialty}. Act strictly as this persona. Your communication style is: ${agent.communicationStyle}`;
                const contents = [...conversationHistory];
                 
                const stream = await ai.models.generateContentStream({
                    model: 'gemini-2.5-flash',
                    contents,
                    config: { systemInstruction }
                });

                let responseText = '';
                for await (const chunk of stream) {
                    responseText += chunk.text;
                    setMessages(prev => prev.map(msg =>
                        msg.id === responseMessageId ? { ...msg, content: responseText } : msg
                    ));
                }
                conversationHistory.push({ role: MessageRole.MODEL, parts: [{ text: responseText }]});
            }

        } else {
            const responseMessageId = window.crypto.randomUUID();
            setMessages((prev) => [...prev, { id: responseMessageId, role: MessageRole.MODEL, content: '...' }]);
            
            let model = 'gemini-2.5-flash';
            let parts: Part[] = [{ text: userPrompt }];
            if (file) {
                 const filePart = await fileToGenerativePart(file);
                 parts.push(filePart);
            }
            const contents = [{ role: 'user', parts }];

            const stream = await ai.models.generateContentStream({ model, contents });
            let responseText = '';
            for await (const chunk of stream) {
                responseText += chunk.text;
                setMessages((prev) =>
                    prev.map((msg) =>
                        msg.id === responseMessageId ? { ...msg, content: responseText } : msg
                    )
                );
            }
             
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.id === responseMessageId && msg.content === '...' ? { ...msg, content: '' } : msg
                )
            );
        }

    } catch (error) {
      console.error(`Error during ${tool} generation:`, error);
      let errorMessage = 'An unknown streaming error occurred.';
      if (error instanceof Error) {
        errorMessage = `Stream Error: ${error.message}`;
      }
      addMessage({ role: MessageRole.MODEL, content: errorMessage, isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateImage = async (prompt: string) => {
    if (!process.env.API_KEY) {
      addMessage({ role: MessageRole.MODEL, content: "API key is not configured.", isError: true });
      return;
    }
    addMessage({ role: MessageRole.USER, content: prompt, operator: activeOperator });
    setIsLoading(true);
    setLastGeneratedImageBase64(null);
    const responseMessageId = window.crypto.randomUUID();
    
    setMessages(prev => [...prev, { id: responseMessageId, role: MessageRole.MODEL, content: '...', tags: ['image_generation_placeholder'] }]);
    
    try {
        const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt,
            config: { numberOfImages: 1 }
        });

        const base64Image = response.generatedImages[0].image.imageBytes;
        if (!base64Image) throw new Error("API did not return image data.");

        const imageUrl = `data:image/png;base64,${base64Image}`;
        setLastGeneratedImageBase64(base64Image);

        setMessages(prev => prev.map(msg => 
            msg.id === responseMessageId 
            ? { ...msg, content: '', imageUrl, client_message_id: responseMessageId }
            : msg
        ));
    } catch (error) {
        console.error('Error generating image:', error);
        const errorMessage = `Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        setMessages(prev => prev.map(msg => 
            msg.id === responseMessageId ? { ...msg, content: errorMessage, isError: true } : msg
        ));
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleEditImage = async (prompt: string, file: File) => {
    if (!process.env.API_KEY) {
      addMessage({ role: MessageRole.MODEL, content: "API key is not configured.", isError: true });
      return;
    }
    const userMessage: Omit<Message, 'id'> = {
        role: MessageRole.USER,
        content: prompt,
        imageUrl: URL.createObjectURL(file),
        operator: activeOperator,
    };
    addMessage(userMessage);
    setIsLoading(true);
    setLastGeneratedImageBase64(null); // Clear previous image
    const responseMessageId = window.crypto.randomUUID();
    setMessages(prev => [...prev, { id: responseMessageId, role: MessageRole.MODEL, content: '...', tags: ['image_generation_placeholder'] }]);

    try {
        const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
        const imagePart = await fileToGenerativePart(file);
        const textPart = { text: prompt };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [imagePart, textPart] },
            config: { responseModalities: [Modality.IMAGE] }
        });

        const imagePartResponse = response.candidates?.[0]?.content?.parts.find(p => p.inlineData);
        if (!imagePartResponse || !imagePartResponse.inlineData) throw new Error("API did not return an edited image.");

        const base64Image = imagePartResponse.inlineData.data;
        const imageUrl = `data:${imagePartResponse.inlineData.mimeType};base64,${base64Image}`;
        setLastGeneratedImageBase64(base64Image); // Save for potential video generation

        setMessages(prev => prev.map(msg => msg.id === responseMessageId ? { ...msg, content: '', imageUrl, client_message_id: responseMessageId } : msg));
    } catch (error) {
        console.error('Error editing image:', error);
        const errorMessage = `Image editing failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        setMessages(prev => prev.map(msg => msg.id === responseMessageId ? { ...msg, content: errorMessage, isError: true } : msg));
    } finally {
        setIsLoading(false);
    }
  };

  const handleAnalyzeImage = async (prompt: string, file: File) => {
    if (!process.env.API_KEY) {
      addMessage({ role: MessageRole.MODEL, content: "API key is not configured.", isError: true });
      return;
    }
    const userMessage: Omit<Message, 'id'> = {
        role: MessageRole.USER,
        content: prompt,
        imageUrl: URL.createObjectURL(file),
        operator: activeOperator,
    };
    addMessage(userMessage);
    setIsLoading(true);
    const responseMessageId = window.crypto.randomUUID();
    setMessages(prev => [...prev, { id: responseMessageId, role: MessageRole.MODEL, content: 'Analyzing image...' }]);

    try {
        const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
        const imagePart = await fileToGenerativePart(file);
        const fullPrompt = prompt || 'Describe this image in detail. Then, on a new line, add "Tags:" followed by a short, comma-separated list of relevant keywords.';
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, { text: fullPrompt }] }
        });

        const fullText = response.text;
        const tagsMatch = fullText.match(/Tags: (.*)/i);
        const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()) : [];
        const analysis = tagsMatch ? fullText.split(/Tags: .*/i)[0].trim() : fullText.trim();
        
        setMessages(prev => prev.map(msg =>
            msg.id === responseMessageId ? { ...msg, content: analysis, tags } : msg
        ));
    } catch (error) {
        console.error('Error analyzing image:', error);
        const errorMessage = `Image analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        setMessages(prev => prev.map(msg => 
            msg.id === responseMessageId ? { ...msg, content: errorMessage, isError: true } : msg
        ));
    } finally {
        setIsLoading(false);
    }
  };

  const handleGenerateVideo = async (prompt: string, image?: File | string | null) => {
    if (!process.env.API_KEY) {
        addMessage({ role: MessageRole.MODEL, content: "API key is not configured.", isError: true });
        return;
    }
    addMessage({ 
        role: MessageRole.USER, 
        content: prompt, 
        operator: activeOperator,
        imageUrl: image instanceof File ? URL.createObjectURL(image) : undefined
    });
    
    setIsLoading(true);
    setIsGeneratingVideo(true);
    setVideoGenerationError(null);
    setLastGeneratedVideoUrl(null);

    const responseMessageId = window.crypto.randomUUID();
    setMessages(prev => [...prev, { id: responseMessageId, role: MessageRole.MODEL, content: 'Video generation started...' }]);
    
    let progressInterval: number;

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        let imagePayload;
        if (image) {
            const base64Data = typeof image === 'string' ? image : await fileToBase64(image);
            imagePayload = {
                imageBytes: base64Data,
                mimeType: image instanceof File ? image.type : 'image/png',
            };
        }
        
        const progressMessages = [
            "Initializing...",
            "Processing request...",
            "Generating frames... this can take a moment.",
            "Compiling video...",
        ];
        let progressIndex = 0;
        setVideoGenerationProgress(progressMessages[0]);

        progressInterval = window.setInterval(() => {
            progressIndex = (progressIndex + 1) % progressMessages.length;
            setVideoGenerationProgress(progressMessages[progressIndex]);
        }, 15000);

        let operation = await ai.models.generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt,
            image: imagePayload,
        });

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
            operation = await ai.operations.getVideosOperation({ operation });
        }

        clearInterval(progressInterval);
        setVideoGenerationProgress('Finalizing and downloading...');

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) {
            throw new Error('Video generation completed, but no download link was found.');
        }

        const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        if (!videoResponse.ok) {
            throw new Error(`Failed to download video file. Status: ${videoResponse.status}`);
        }
        const videoBlob = await videoResponse.blob();
        const videoUrl = URL.createObjectURL(videoBlob);

        setLastGeneratedVideoUrl(videoUrl);
        setMessages(prev => prev.map(msg => msg.id === responseMessageId ? { ...msg, content: '', videoUrl } : msg));

    } catch (error) {
        console.error('Error generating video:', error);
        const errorMessage = `Video generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        setVideoGenerationError(errorMessage);
        setMessages(prev => prev.map(msg => msg.id === responseMessageId ? { ...msg, content: errorMessage, isError: true } : msg));
        if (progressInterval) clearInterval(progressInterval);
    } finally {
        setIsLoading(false);
        setIsGeneratingVideo(false);
        setVideoGenerationProgress('');
    }
  };


  const onFeedback = async (messageId: string, feedback: 'like' | 'dislike') => {
      // Feedback requires a database, so it's a server-only feature.
      if (!isServerReady) {
        addServerError("Image feedback");
        return;
      }
      const message = messages.find(m => m.id === messageId);
      if (!message || !message.client_message_id) return;
      
      const clientMessageId = message.client_message_id;
      const originalFeedback = message.feedback;

      setMessages(prev => prev.map(msg => 
          msg.client_message_id === clientMessageId ? { ...msg, feedback } : msg
      ));
      
      try {
          await submitFeedback(clientMessageId, feedback);
          handleFetchGallery();
      } catch (error) {
          console.error("Failed to submit feedback", error);
          let errorMessage = 'Failed to save your feedback.';
          if (error instanceof Error) {
              errorMessage = `Failed to save your feedback: ${error.message}`;
          }
          addMessage({ role: MessageRole.MODEL, content: errorMessage, isError: true });
          // Revert optimistic update on error
          setMessages(prev => prev.map(msg => 
              msg.client_message_id === clientMessageId ? { ...msg, feedback: originalFeedback } : msg
          ));
      }
  };

  const onInitiateEdit = (text: string) => {
    setInput(text);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setTimeout(() => {
        const textarea = document.querySelector('textarea');
        if (textarea) {
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }
    }, 0);
  };

  const onToolSend = (message: string, file: File | null) => {
    switch (activeTool) {
      case 'AGENT_HUB':
      case 'CODE_GEN':
      case 'TEXT_GEN':
      case 'CODE_ANALYSIS':
      case 'URL_CONTEXT':
      case 'DOC_SUMMARY':
      case 'AUDIO_ANALYSIS':
        const userMessage = {
          imageUrl: (file && file.type.startsWith('image/')) ? URL.createObjectURL(file) : undefined,
          fileName: file ? file.name : undefined,
          content: activeTool === 'DOC_SUMMARY' ? `Summarize document:` : (activeTool === 'AUDIO_ANALYSIS' ? `Analyzing audio file:` : message)
        };
        handleStreamedGeneration(activeTool, message, file, userMessage);
        break;
      case 'IMAGE_GEN':
        handleGenerateImage(message);
        break;
      case 'IMAGE_EDIT':
        if(file) handleEditImage(message, file);
        break;
      case 'IMAGE_ANALYSIS':
        if(file) handleAnalyzeImage(message, file);
        break;
      case 'VIDEO_GEN':
        handleGenerateVideo(message, file);
        break;
      case 'CONTENT_DETECTOR':
        addServerError("Content Safety Detection");
        break;
      default:
        // Do nothing for tools that don't use the main input
        break;
    }
  };
  
  // --- Chat History Functions ---
    const startNewChat = useCallback(() => {
        if (messages.length > 1 || (messages.length === 1 && messages[0].id !== 'init')) {
            if (!window.confirm('Are you sure you want to start a new chat? The current conversation will be cleared.')) {
                return;
            }
        }
        setMessages([initialMessage]);
        setCurrentChatId(null);
    }, [messages]);

    const analyzeChatForMetadata = async (chatMessages: Message[]): Promise<{ summary: string; tags: string[] }> => {
        if (!process.env.API_KEY) {
            addMessage({ role: MessageRole.MODEL, content: "Cannot analyze chat because API key is not configured. Saving without summary.", isError: true });
            return { summary: '', tags: [] };
        }
        try {
            const transcript = chatMessages
                .filter(msg => !msg.isError && msg.id !== 'init' && msg.content && msg.content !== '...')
                .map(msg => `${msg.agent?.name || msg.operator?.name || msg.role}: ${msg.content}`)
                .join('\n');

            if (!transcript) return { summary: 'Chat is empty.', tags: [] };
            
            const prompt = `Analyze the following chat transcript. Provide a concise, one-sentence summary. Then, on a new line, list up to 5 relevant comma-separated keywords (tags).
            
            FORMAT:
            Summary: [Your one-sentence summary]
            Tags: [tag1, tag2, tag3, tag4, tag5]

            TRANSCRIPT:
            ---
            ${transcript}
            ---
            `;
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });
            const text = response.text;
            
            const summaryMatch = text.match(/Summary: (.*)/);
            const tagsMatch = text.match(/Tags: (.*)/);
            
            const summary = summaryMatch ? summaryMatch[1].trim() : 'Could not generate summary.';
            const tags = tagsMatch ? tagsMatch[1].split(',').map(t => t.trim()).filter(Boolean) : [];
            
            return { summary, tags };
        } catch (error) {
            console.error("Chat analysis failed:", error);
            addMessage({ role: MessageRole.MODEL, content: `Chat analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}. Saving without summary.`, isError: true });
            return { summary: '', tags: [] };
        }
    };

    const saveCurrentChat = useCallback(async (name: string) => {
        setIsSavingChat(true);
        try {
            const { summary, tags } = await analyzeChatForMetadata(messages);
            const chatName = name.trim() || summary || `Chat from ${new Date().toLocaleString()}`;
            const agentIds = Array.from(activeAgents);
            let newSavedChats: SavedChat[];
            let newChatId = currentChatId;

            if (currentChatId) {
                // Update existing chat
                newSavedChats = savedChats.map(chat =>
                    chat.id === currentChatId
                        ? { ...chat, name: chatName, messages, timestamp: Date.now(), summary, tags, agentIds }
                        : chat
                );
            } else {
                // Save new chat
                newChatId = window.crypto.randomUUID();
                const newChat: SavedChat = {
                    id: newChatId,
                    name: chatName,
                    timestamp: Date.now(),
                    messages,
                    summary,
                    tags,
                    agentIds,
                };
                newSavedChats = [...savedChats, newChat];
            }
            
            newSavedChats.sort((a, b) => b.timestamp - a.timestamp);
            localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(newSavedChats));
            setSavedChats(newSavedChats);
            if(newChatId) setCurrentChatId(newChatId);
        } finally {
            setIsSavingChat(false);
        }
    }, [currentChatId, messages, savedChats, activeAgents]);
    
    const loadChat = useCallback((chatId: string) => {
        const chatToLoad = savedChats.find(c => c.id === chatId);
        if (chatToLoad) {
            setMessages(chatToLoad.messages);
            setCurrentChatId(chatToLoad.id);
        }
    }, [savedChats]);
    
    const deleteChat = useCallback((chatId: string) => {
        if (!window.confirm('Are you sure you want to delete this chat history?')) return;
        
        const newSavedChats = savedChats.filter(c => c.id !== chatId);
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(newSavedChats));
        setSavedChats(newSavedChats);

        if (currentChatId === chatId) {
            startNewChat();
        }
    }, [savedChats, currentChatId, startNewChat]);

    // --- Save to RAG Modal Functions ---
    const openSaveToRagModal = (chat: SavedChat) => {
      setChatToSaveToRag(chat);
      setIsSaveToRagModalOpen(true);
    };

    const closeSaveToRagModal = () => {
        setChatToSaveToRag(null);
        setIsSaveToRagModalOpen(false);
    };

    const handleSaveChatToRag = async (chat: SavedChat, repository: string) => {
        if (!isServerReady) {
            addServerError("Saving chat to RAG");
            return;
        }
        try {
            await saveChatToRag(chat, repository);
            addMessage({
                role: MessageRole.MODEL,
                content: `Chat "${chat.name}" was successfully saved to the "${repository}" knowledge base.`,
            });
            closeSaveToRagModal();
        } catch (error) {
            console.error('Failed to save chat to RAG:', error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
            addMessage({
                role: MessageRole.MODEL,
                content: `Error saving chat to RAG: ${errorMessage}`,
                isError: true,
            });
        }
    };


  const value = {
    messages,
    isLoading,
    input,
    setInput,
    speakingMessageId,
    messagesEndRef,
    addMessage,
    handleSpeak,
    onToolSend,
    onInitiateEdit,
    onFeedback,
    isImageAvailableForVideo: !!lastGeneratedImageBase64,
    onGenerateVideoFromLastImage: (prompt: string) => handleGenerateVideo(prompt, lastGeneratedImageBase64),
    isGeneratingVideo,
    videoGenerationProgress,
    lastGeneratedVideoUrl,
    videoGenerationError,
    savedChats,
    currentChatId,
    isSavingChat,
    startNewChat,
    saveCurrentChat,
    loadChat,
    deleteChat,
    isSaveToRagModalOpen,
    chatToSaveToRag,
    openSaveToRagModal,
    closeSaveToRagModal,
    handleSaveChatToRag,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};