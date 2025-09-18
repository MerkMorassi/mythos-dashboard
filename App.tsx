
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Part } from '@google/genai';
import { synthesizeSpeech, generateImageFromPrompt, generateVideo, checkVideoOperationStatus, fetchGallery, detectContentSafety, submitFeedback, fetchGenerationStream, analyzeImageOnBackend, generateVideoFromLastImage, analyzeAudioForSunoStyle, generateSunoLyrics, convertAudioToMidi } from './services/geminiService';
import { initDB, getClonedVoices, addClonedVoice, getClonedVoiceBlob, getAllTrainingSamples, getFirstTrainingSampleBlob } from './services/dbService';
import type { ChatMessage as Message, VoiceOption, Tool, TtsModelOption, GalleryImage, Agent, TrainingSample } from './types';
import { MessageRole, TTS_MODELS, STABLE_VOICES, PREVIEW_VOICES, ELEVENLABS_VOICES, ALL_AGENTS } from './types';
import ChatMessage from './components/ChatMessage';
import MessageInput from './components/MessageInput';
import Header from './components/Header';
import Toolbar from './components/Toolbar';
import GalleryLightbox from './components/GalleryLightbox';
import GalleryPanel from './components/GalleryPanel';
import PerchancePromptPanel from './components/PerchancePromptPanel';
import SunoPromptPanel from './components/SunoPromptPanel';
import TtsPanel from './components/TtsPanel';
import ChevronDoubleLeftIcon from './components/icons/ChevronDoubleLeftIcon';
import ChevronDoubleRightIcon from './components/icons/ChevronDoubleRightIcon';
import LocalImageViewer from './components/LocalImageViewer';
import AgentPanel from './components/AgentPanel';
import RagManager from './components/RagManager';
import OperatorPanel from './components/OperatorPanel';
import { HITL_OPERATORS } from './types';
import type { Operator } from './types';
import AudioToMidiConverter from './components/AudioToMidiConverter';
import AgentVoiceModal from './components/AgentVoiceModal';
import SettingsPanel from './components/SettingsPanel';

const markdownToPlainText = (markdown: string): string => {
  if (!markdown) return '';
  let text = markdown;
  // Remove code blocks but keep content
  text = text.replace(/```[\s\S]*?\n([\s\S]*?)```/g, '$1');
  // Remove headers
  text = text.replace(/^#{1,6}\s/gm, '');
  // Remove links, keeping the link text
  text = text.replace(/\[(.*?)\]\(.*?\)/g, '$1');
  // Remove images, keeping the alt text
  text = text.replace(/!\[(.*?)\]\(.*?\)/g, '$1');
  // Remove bold and italic markers but keep content
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');
  // Remove inline code backticks
  text = text.replace(/`([^`]+)`/g, '$1');
  // Remove blockquotes
  text = text.replace(/^\s*>\s?/gm, '');
  // Remove horizontal rules
  text = text.replace(/^-{3,}|^\*{3,}|^_{3,}/gm, '');
  // Tidy up lists, but keep the content
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');
  // Remove all leading whitespace (indentation) from each line
  text = text.replace(/^\s+/gm, '');

  return text.trim();
};


export const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: MessageRole.MODEL,
      content: "Hello! I am a multi-tool assistant. Please select a tool to get started.",
    },
  ]);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [activeTool, setActiveTool] = useState<Tool>('AGENT_HUB');
  const [selectedTtsModel, setSelectedTtsModel] = useState<TtsModelOption['id']>(TTS_MODELS[0].id);
  const [availableVoices, setAvailableVoices] = useState<readonly VoiceOption[]>(STABLE_VOICES);
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption['id']>(STABLE_VOICES[0].id);
  const [clonedVoices, setClonedVoices] = useState<VoiceOption[]>([]);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [lastGeneratedImageFilename, setLastGeneratedImageFilename] = useState<string | null>(null);
  
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [rightPanelContent, setRightPanelContent] = useState<'GALLERY' | 'PERCHANCE' | 'TTS' | 'AGENTS' | 'SUNO' | 'OPERATOR' | 'SETTINGS' | null>('AGENTS');
  const [activeAgents, setActiveAgents] = useState<Set<string>>(() => new Set(['mythos_assistant']));
  const [activeOperator, setActiveOperator] = useState<Operator>(HITL_OPERATORS[0]);
  const [agentSortOrder, setAgentSortOrder] = useState<'name' | 'specialty' | 'custom'>('name');
  const [displayedAgents, setDisplayedAgents] = useState<readonly Agent[]>(ALL_AGENTS);
  const [apiKey, setApiKey] = useState<string>('');

  // Voice Training State (now client-side)
  const [allTrainingSamples, setAllTrainingSamples] = useState<TrainingSample[]>([]);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [selectedAgentForVoice, setSelectedAgentForVoice] = useState<Agent | null>(null);
  const [voiceDataLoaded, setVoiceDataLoaded] = useState(false);

  const [perchanceFormData, setPerchanceFormData] = useState({
    description: '',
    negative: '',
    numImages: '6 (Default)',
    shape: 'Landscape (768x512)',
    Gscale: '7',
    seed: ''
  });
  const [sunoFormData, setSunoFormData] = useState({
    lyrics: '',
    style: '',
    title: '',
    instrumental: false,
  });
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rejectedImageHashes = useRef<Map<string, number>>(new Map());

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    try {
        const savedKey = localStorage.getItem('gemini-api-key');
        if (savedKey) {
            setApiKey(savedKey);
        }
    } catch (e) {
        console.warn("Could not access localStorage to get API key.");
    }
  }, []);

  const addMessage = useCallback((message: Omit<Message, 'id'>) => {
    setMessages(prev => [...prev, { ...message, id: window.crypto.randomUUID() }]);
  }, []);

  const handleFetchVoiceData = useCallback(async (forceRefetch = false) => {
    if (voiceDataLoaded && !forceRefetch) {
      return;
    }
    try {
      await initDB();
      console.log("Fetching latest voice data from local DB...");

      const [cloned, samples] = await Promise.all([
          getClonedVoices(),
          getAllTrainingSamples()
      ]);

      setClonedVoices(cloned);
      setAllTrainingSamples(samples);
      
      if (!voiceDataLoaded) {
        setVoiceDataLoaded(true);
      }
    } catch (error) {
      console.error("Could not load voice data from local DB:", error);
      addMessage({
          role: MessageRole.MODEL,
          content: `Custom voice features may be unavailable: Could not load data from local database.`,
          isError: true,
      });
    }
  }, [addMessage, voiceDataLoaded]);
  
  useEffect(() => {
    if (selectedTtsModel === 'text-to-speech') {
        setAvailableVoices(STABLE_VOICES);
        setSelectedVoice(STABLE_VOICES[0].id);
    } else if (selectedTtsModel === 'gemini-2.5-flash-preview-tts') {
        setAvailableVoices(PREVIEW_VOICES);
        setSelectedVoice(PREVIEW_VOICES[0].id);
    } else if (selectedTtsModel === 'eleven-labs') {
        setAvailableVoices(ELEVENLABS_VOICES);
        setSelectedVoice(ELEVENLABS_VOICES[0].id);
    } else if (selectedTtsModel === 'cloned-voice') {
        setAvailableVoices(clonedVoices);
        if (clonedVoices.length > 0) {
            setSelectedVoice(clonedVoices[0].id);
        } else {
            setSelectedVoice(''); // No voice available
        }
    } else if (selectedTtsModel === 'trained-voice') {
        const agentIdsWithSamples = [...new Set(allTrainingSamples.map(s => s.agent_id))];
        const trained = agentIdsWithSamples.map(agentId => {
            const agent = ALL_AGENTS.find(a => a.id === agentId);
            return { id: agentId, name: agent?.name || agentId };
        });
        
        setAvailableVoices(trained);
        if (trained.length > 0) {
            setSelectedVoice(trained[0].id);
        } else {
            setSelectedVoice('');
        }
    }
  }, [selectedTtsModel, clonedVoices, allTrainingSamples]);

  useEffect(() => {
    if (rightPanelContent === 'GALLERY') {
      handleFetchGallery();
    }
  }, [rightPanelContent]);
  
  useEffect(() => {
    // When the sort order changes (but not to custom), re-sort the agents.
    if (agentSortOrder === 'custom') {
      return;
    }
    const defaultAgent = ALL_AGENTS.find(a => a.id === 'mythos_assistant');
    const sortableAgents = [...ALL_AGENTS].filter(a => a.id !== 'mythos_assistant');

    sortableAgents.sort((a, b) => {
      if (agentSortOrder === 'specialty') {
        const specialtyCompare = a.specialty.localeCompare(b.specialty);
        if (specialtyCompare !== 0) return specialtyCompare;
      }
      return a.name.localeCompare(b.name);
    });

    setDisplayedAgents(defaultAgent ? [defaultAgent, ...sortableAgents] : sortableAgents);
  }, [agentSortOrder]);
  
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);
  
  const handleSpeak = useCallback(async (message: Message) => {
    if (speakingMessageId === message.id) {
        if (audioRef.current) {
            audioRef.current.pause();
        }
        setSpeakingMessageId(null);
        return;
    }

    if (audioRef.current) {
        audioRef.current.pause();
    }

    setSpeakingMessageId(message.id);
    try {
        const plainText = markdownToPlainText(message.content);

        if (selectedTtsModel === 'cloned-voice') {
            if (!selectedVoice) throw new Error("No cloned voice selected.");
            const audioBlob = await getClonedVoiceBlob(selectedVoice);
            if (!audioBlob) {
                throw new Error(`Cloned voice with ID ${selectedVoice} not found in local storage.`);
            }
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audioRef.current = audio;
            
            audio.onended = () => {
              setSpeakingMessageId(null);
              URL.revokeObjectURL(audioUrl);
            };
            await audio.play();
            return;
        }
        
        if (selectedTtsModel === 'trained-voice') {
            if (!selectedVoice) throw new Error("No trained voice selected.");
            const audioBlob = await getFirstTrainingSampleBlob(selectedVoice); // selectedVoice is agent_id
            if (!audioBlob) {
                throw new Error(`No training sample found for agent ID ${selectedVoice}.`);
            }
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audioRef.current = audio;
            
            audio.onended = () => {
              setSpeakingMessageId(null);
              URL.revokeObjectURL(audioUrl);
            };
            await audio.play();
            return;
        }
      
        // Original logic for server-side TTS
        const audioContent = await synthesizeSpeech(plainText, selectedVoice, selectedTtsModel);
        const audioBlob = new Blob([Uint8Array.from(atob(audioContent), c => c.charCodeAt(0))], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
      
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
      
        audio.onended = () => {
            setSpeakingMessageId(null);
            URL.revokeObjectURL(audioUrl);
        };

        await audio.play();
    } catch (error) {
        console.error('Speech synthesis error:', error);
        if (error instanceof Error && error.message.includes('interrupted')) {
            // Do nothing, this is expected if the user stops playback.
        } else {
            addMessage({
                role: MessageRole.MODEL,
                content: `Sorry, I couldn't generate audio. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                isError: true,
            });
        }
        setSpeakingMessageId(null);
    }
  }, [speakingMessageId, selectedVoice, selectedTtsModel, addMessage]);

  const handleStreamedGeneration = async (
      tool: Tool, 
      userPrompt: string, 
      file: File | null = null, 
      userMessageOverrides: Partial<Message> = {}
  ) => {
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
    
    // Add user message to UI
    let newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    const currentHistory = newMessages.filter(m => (m.role !== MessageRole.MODEL || !m.isError) && m.id !== 'init').map(m => ({
        role: m.role,
        parts: [{ text: m.operator ? `[OPERATOR: ${m.operator.name}]\n${m.content}` : m.content }]
    }));
    
    try {
        if (tool === 'AGENT_HUB') {
            if (activeAgents.size === 0) {
                addMessage({ role: MessageRole.MODEL, content: "Please select at least one agent to chat with.", isError: true });
                setIsLoading(false);
                return;
            }
            const agentsToQuery = Array.from(activeAgents);
            for (const agentId of agentsToQuery) {
                 const agent = ALL_AGENTS.find(a => a.id === agentId);
                 if (!agent) continue;
                 
                 const responseMessageId = window.crypto.randomUUID();
                 setMessages(prev => [...prev, { id: responseMessageId, role: MessageRole.MODEL, content: '...', agent: agent }]);
                 
                 const reader = await fetchGenerationStream(tool, userPrompt, file, currentHistory, responseMessageId, [agentId]);
                 const decoder = new TextDecoder();
                 let responseText = '';

                 while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    let chunk = decoder.decode(value, { stream: true });
                    // The server prefixes with agentId::, we strip it here.
                    const prefix = `${agentId}::`;
                    if (responseText === '' && chunk.startsWith(prefix)) {
                        chunk = chunk.substring(prefix.length);
                    }
                    responseText += chunk;
                    
                    setMessages(prev => prev.map(msg =>
                        msg.id === responseMessageId ? { ...msg, content: responseText } : msg
                    ));
                 }
                 // Add the final response to history for the next agent
                 currentHistory.push({ role: MessageRole.MODEL, parts: [{ text: responseText }]});
            }

        } else {
             const responseMessageId = window.crypto.randomUUID();
             const reader = await fetchGenerationStream(tool, userPrompt, file, currentHistory, responseMessageId, []);
             const decoder = new TextDecoder();
             let responseText = '';
             
             // Add empty model message bubble
             setMessages((prev) => [...prev, { id: responseMessageId, role: MessageRole.MODEL, content: '...' }]);
         
             // Stream the response
             while (true) {
               const { done, value } = await reader.read();
               if (done) break;
               responseText += decoder.decode(value, { stream: true });
               setMessages((prev) =>
                 prev.map((msg) =>
                   msg.id === responseMessageId ? { ...msg, content: responseText } : msg
                 )
               );
             }
             
             // Final update in case of empty stream
             setMessages((prev) =>
                 prev.map((msg) =>
                   msg.id === responseMessageId && msg.content === '...' ? { ...msg, content: '' } : msg
                 )
               );
        }

    } catch (error) {
      console.error(`Error during ${tool} generation:`, error);
      const errorMessage = error instanceof Error ? `Stream Error: ${error.message}` : 'An unknown streaming error occurred.';
      addMessage({ role: MessageRole.MODEL, content: errorMessage, isError: true });
    } finally {
      setIsLoading(false);
    }
  };


  const handleGenerateImage = async (prompt: string) => {
    addMessage({ role: MessageRole.USER, content: prompt, operator: activeOperator });
    setIsLoading(true);
    setLastGeneratedImageFilename(null);
    const responseMessageId = window.crypto.randomUUID();
    
    try {
        setMessages(prev => [...prev, { id: responseMessageId, role: MessageRole.MODEL, content: 'Generating image...' }]);
        const { imageUrl, filename, id } = await generateImageFromPrompt(prompt, responseMessageId);
        setLastGeneratedImageFilename(filename);
        setMessages(prev => prev.map(msg => 
            msg.id === responseMessageId 
            ? { ...msg, content: '', imageUrl, imageId: id, feedback: null, client_message_id: responseMessageId }
            : msg
        ));
    } catch (error) {
        console.error('Error generating image:', error);
        const errorMessage = `Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        setMessages(prev => prev.map(msg => 
            msg.id === responseMessageId 
            ? { ...msg, content: errorMessage, isError: true }
            : msg
        ));
    } finally {
        setIsLoading(false);
    }
  };
  
  const commonVideoGenerationHandler = async (promise: Promise<{ operation: any; sourceImageFilename: string | null; }>, prompt: string, imageUrl: string | undefined, responseMessageId: string) => {
    try {
        setMessages(prev => prev.map(msg => msg.id === responseMessageId ? {...msg, content: 'Video generation started... This can take a few minutes.'} : msg));
        
        let { operation, sourceImageFilename } = await promise;
        setMessages(prev => prev.map(msg => msg.id === responseMessageId ? {...msg, content: 'Checking status...'} : msg));

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await checkVideoOperationStatus(operation, prompt, sourceImageFilename, responseMessageId);
        }

        const localUrl = operation.response?.generatedVideos?.[0]?.video?.localUrl;
        if (localUrl) {
            const videoUrl = `http://localhost:3001${localUrl}`;
             setMessages(prev => prev.map(msg => msg.id === responseMessageId ? {...msg, content: '', videoUrl} : msg));
        } else {
            throw new Error('Video generation finished but no local URL was provided.');
        }

    } catch (error) {
        console.error('Error generating video:', error);
        const errorMessage = `Video generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        setMessages(prev => prev.map(msg => msg.id === responseMessageId ? {...msg, content: errorMessage, isError: true} : msg));
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleGenerateVideo = async (prompt: string, imageFile: File | null) => {
    addMessage({ role: MessageRole.USER, content: prompt, operator: activeOperator, imageUrl: imageFile ? URL.createObjectURL(imageFile) : undefined });
    setIsLoading(true);
    const responseMessageId = window.crypto.randomUUID();
    setMessages(prev => [...prev, {id: responseMessageId, role: MessageRole.MODEL, content: '...'}]);
    await commonVideoGenerationHandler(generateVideo(prompt, imageFile || undefined, responseMessageId), prompt, imageFile ? URL.createObjectURL(imageFile) : undefined, responseMessageId);
  };
  
  const handleGenerateVideoFromLastImage = async (prompt: string) => {
    if (!lastGeneratedImageFilename) return;
    const imageUrl = `http://localhost:3001/uploads/${lastGeneratedImageFilename}`;
    addMessage({ role: MessageRole.USER, content: prompt, operator: activeOperator, imageUrl });
    setIsLoading(true);
    const responseMessageId = window.crypto.randomUUID();
    setMessages(prev => [...prev, {id: responseMessageId, role: MessageRole.MODEL, content: '...'}]);
    await commonVideoGenerationHandler(generateVideoFromLastImage(prompt, lastGeneratedImageFilename, responseMessageId), prompt, imageUrl, responseMessageId);
  };

  const handleDetectContentSafety = async (file: File) => {
      addMessage({ role: MessageRole.USER, content: `Checking content safety for document:`, operator: activeOperator, fileName: file.name });
      setIsLoading(true);
      const responseMessageId = window.crypto.randomUUID();
      setMessages(prev => [...prev, {id: responseMessageId, role: MessageRole.MODEL, content: '...'}]);
      try {
          const result = await detectContentSafety(file, responseMessageId);
          const resultContent = `Safety Check Result:\nCategory: ${result.category}\nReason: ${result.reason}`;
          setMessages(prev => prev.map(msg => msg.id === responseMessageId ? {...msg, content: resultContent} : msg));
      } catch (error) {
          console.error('Error detecting content safety:', error);
          const errorMessage = `Content safety check failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
          setMessages(prev => prev.map(msg => msg.id === responseMessageId ? {...msg, content: errorMessage, isError: true} : msg));
      } finally {
          setIsLoading(false);
      }
  };

  const handleFetchGallery = useCallback(async () => {
    // No longer gate fetching by isLoading, allow refetching.
    setIsLoading(true);
    try {
      const images = await fetchGallery();
      setGalleryImages(images);
    } catch (error) {
      console.error('Error fetching gallery:', error);
      addMessage({ role: MessageRole.MODEL, content: `Failed to load gallery: ${error instanceof Error ? error.message : 'Unknown error'}`, isError: true });
    } finally {
      setIsLoading(false);
    }
  }, [addMessage]);

  const handleAnalyzeImage = async (file: File) => {
    setIsLoading(true);
    const responseMessageId = window.crypto.randomUUID();
    
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = async () => {
        const buffer = reader.result as ArrayBuffer;
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const imageHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        if (rejectedImageHashes.current.has(imageHash)) {
            addMessage({ role: MessageRole.MODEL, content: '', rejectionLevel: 2 });
            setIsLoading(false);
            return;
        }

        addMessage({
          role: MessageRole.USER,
          content: 'Analyzing the following image:',
          imageUrl: URL.createObjectURL(file),
          operator: activeOperator
        });
        setMessages(prev => [...prev, {id: responseMessageId, role: MessageRole.MODEL, content: '...'}]);
    
        try {
          const result = await analyzeImageOnBackend(file, responseMessageId);
          if (!result.text) {
              rejectedImageHashes.current.set(imageHash, 1);
              setMessages(prev => prev.map(msg => msg.id === responseMessageId ? {...msg, content: '', rejectionLevel: 1} : msg));
          } else {
              setMessages(prev => prev.map(msg => msg.id === responseMessageId ? {...msg, content: result.text} : msg));
          }
        } catch (error) {
          console.error('Error analyzing image:', error);
          const errorMessage = `Analysis Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
          setMessages(prev => prev.map(msg => msg.id === responseMessageId ? {...msg, content: errorMessage, isError: true} : msg));
        } finally {
          setIsLoading(false);
        }
    };
  };

  const handleFeedback = async (messageId: string, feedback: 'like' | 'dislike') => {
      const message = messages.find(m => m.id === messageId);
      if (!message || !message.client_message_id) return;

      const clientMessageId = message.client_message_id;

      // Optimistic UI update for all related messages
      setMessages(prev => prev.map(msg => 
          msg.client_message_id === clientMessageId ? { ...msg, feedback } : msg
      ));
      
      // If it's an image, also update the gallery state
      setGalleryImages(prev => prev.map(img =>
          img.client_message_id === clientMessageId ? { ...img, feedback } : img
      ));

      try {
          await submitFeedback(clientMessageId, feedback);
      } catch (error) {
          console.error("Failed to submit feedback", error);
          addMessage({ role: MessageRole.MODEL, content: 'Failed to save your feedback.', isError: true });
          // Revert state on error by refetching gallery
          handleFetchGallery();
      }
  };


  const handleOpenLightbox = (index: number) => {
    setLightboxIndex(index);
  };

  const handleCloseLightbox = () => {
      setLightboxIndex(null);
  };

  const handlePrevImage = () => {
      if (lightboxIndex !== null) {
          setLightboxIndex((prevIndex) => 
              prevIndex === null ? 0 : (prevIndex - 1 + galleryImages.length) % galleryImages.length
          );
      }
  };

  const handleNextImage = () => {
      if (lightboxIndex !== null) {
          setLightboxIndex((prevIndex) => 
              prevIndex === null ? 0 : (prevIndex + 1) % galleryImages.length
          );
      }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, image: GalleryImage) => {
    e.dataTransfer.setData('application/json', JSON.stringify(image));
  };

  const onToolSend = (message: string, file: File | null) => {
    switch (activeTool) {
      case 'AGENT_HUB':
      case 'CODE_GEN':
      case 'TEXT_GEN':
      case 'CODE_ANALYSIS':
      case 'URL_CONTEXT':
        handleStreamedGeneration(activeTool, message, file, {});
        break;
      case 'DOC_SUMMARY':
        if(file) handleStreamedGeneration(activeTool, "Summarize this document", file, {content: `Summarize document:`, fileName: file.name});
        break;
      case 'AUDIO_ANALYSIS':
        if(file) handleStreamedGeneration(activeTool, "Transcribe this audio", file, {content: `Analyzing audio file:`, fileName: file.name});
        break;
      case 'IMAGE_GEN':
        handleGenerateImage(message);
        break;
      case 'VIDEO_GEN':
        handleGenerateVideo(message, file);
        break;
      case 'IMAGE_ANALYSIS':
        if(file) handleAnalyzeImage(file);
        break;
      case 'CONTENT_DETECTOR':
        if(file) handleDetectContentSafety(file);
        break;
      case 'LOCAL_VIEWER':
      case 'RAG_DB':
      case 'AUDIO_TO_MIDI':
      case 'SETTINGS_PANEL':
        // No-op, these tools have their own UI and don't use the main input.
        break;
      default:
        handleStreamedGeneration('AGENT_HUB', message, file, {});
    }
  };

  const handleToolChange = (tool: Tool) => {
    if (tool === 'NOTEBOOK_LM') {
        window.open('https://notebooklm.google.com', '_blank', 'noopener,noreferrer');
    } else if (tool === 'PERCHANCE_MIXER') {
        setRightPanelContent(rightPanelContent === 'PERCHANCE' ? null : 'PERCHANCE');
    } else if (tool === 'SUNO_MUSIC') {
        setRightPanelContent(rightPanelContent === 'SUNO' ? null : 'SUNO');
    } else if (tool === 'LINEAR') {
        window.open('https://linear.app/mythos-lia/project/mythos-dashboard-3a768abea8fa/overview', '_blank', 'noopener,noreferrer');
    } else if (tool === 'COOM_BRIDGE') {
        window.open('/mythos_consciousness_interface.html', '_blank', 'noopener,noreferrer');
    } else if (tool === 'SETTINGS_PANEL') {
        setRightPanelContent(rightPanelContent === 'SETTINGS' ? null : 'SETTINGS');
    } else {
        setActiveTool(tool);
    }
  };

  const handleToggleGallery = () => {
    setRightPanelContent(rightPanelContent === 'GALLERY' ? null : 'GALLERY');
  };
  
  const handleToggleTtsPanel = () => {
    // The check for rightPanelContent ensures we only fetch when OPENING the panel
    if (rightPanelContent !== 'TTS') {
        handleFetchVoiceData(false);
    }
    setRightPanelContent(rightPanelContent === 'TTS' ? null : 'TTS');
  };
  
  const handleToggleAgentPanel = () => {
    if (rightPanelContent !== 'AGENTS') {
        handleFetchVoiceData(false);
    }
    setRightPanelContent(rightPanelContent === 'AGENTS' ? null : 'AGENTS');
  };
  
  const handleToggleOperatorPanel = () => {
    setRightPanelContent(rightPanelContent === 'OPERATOR' ? null : 'OPERATOR');
  };
  
  const handleToggleSettingsPanel = () => {
    setRightPanelContent(rightPanelContent === 'SETTINGS' ? null : 'SETTINGS');
  };

  const handleApiKeySave = (key: string) => {
    try {
        setApiKey(key);
        localStorage.setItem('gemini-api-key', key);
        addMessage({
            role: MessageRole.MODEL,
            content: "API Key saved successfully to browser's local storage.",
        });
        setRightPanelContent(null); // Close panel on save
    } catch (e) {
        console.error("Could not save API key to local storage:", e);
        addMessage({
            role: MessageRole.MODEL,
            content: "Error: Could not save API key. Your browser may be blocking local storage.",
            isError: true,
        });
    }
  };

  const handleOpenPerchanceWithParams = () => {
    const { description, negative, numImages, shape, Gscale, seed } = perchanceFormData;
    const baseUrl = 'https://perchance.org/c6m2dfzel7';
    const params = new URLSearchParams();
    
    // Only add params if they have a value to keep the URL clean
    if (description) params.append('description', description);
    if (negative) params.append('negative', negative);
    if (numImages) params.append('numImages', numImages);
    if (shape) params.append('shape', shape.split(' (')[0].toLowerCase() || 'landscape');
    if (Gscale) params.append('Gscale', Gscale);
    if (seed) params.append('seed', seed);
    
    const fullUrl = `${baseUrl}?${params.toString()}`;
    window.open(fullUrl, '_blank', 'noopener,noreferrer');
  };

  const handleOpenSunoWithParams = () => {
    const { style, lyrics } = sunoFormData;
    let fullPrompt = lyrics;
    if (style) {
      fullPrompt = `[Style: ${style}]\n\n${lyrics}`;
    }
    navigator.clipboard.writeText(fullPrompt.trim());
    window.open('https://suno.com/create', '_blank', 'noopener,noreferrer');
  };

  const handleAnalyzeAudio = async (file: File) => {
    try {
        const style = await analyzeAudioForSunoStyle(file);
        setSunoFormData(prev => ({...prev, style: style }));
    } catch (error) {
        console.error("Failed to analyze audio for Suno:", error);
        addMessage({ role: MessageRole.MODEL, content: 'Failed to analyze audio style.', isError: true });
    }
  };

  const handleGenerateSunoLyrics = async (topic: string, agentId: string) => {
    try {
        const reader = await generateSunoLyrics(topic, agentId);
        const decoder = new TextDecoder();
        setSunoFormData(prev => ({...prev, lyrics: ''})); // Clear existing lyrics

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            setSunoFormData(prev => ({...prev, lyrics: prev.lyrics + chunk}));
        }
    } catch (error) {
        console.error("Failed to generate Suno lyrics:", error);
        addMessage({ role: MessageRole.MODEL, content: 'Failed to generate lyrics.', isError: true });
    }
  };

  const handleInitiateEdit = (text: string) => {
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
  
  const handleAgentToggle = (agentId: string) => {
    setActiveAgents(prev => {
        const newSet = new Set(prev);
        if (newSet.has(agentId)) {
            newSet.delete(agentId);
        } else {
            newSet.add(agentId);
        }
        return newSet;
    });
  };

  const handleToggleAllAgents = () => {
    setActiveAgents(prev => {
        if (prev.size === ALL_AGENTS.length) {
            return new Set();
        } else {
            return new Set(ALL_AGENTS.map(a => a.id));
        }
    });
  };

  const handleCloneVoice = async (name: string, blob: Blob): Promise<void> => {
    try {
        const newVoiceId = window.crypto.randomUUID();
        const newVoice = await addClonedVoice({ id: newVoiceId, name, blob });
        
        const updatedVoices = [...clonedVoices, newVoice];
        setClonedVoices(updatedVoices);
        
        // UX: Switch to the new voice automatically
        setSelectedTtsModel('cloned-voice');
        // The useEffect for selectedTtsModel will handle setting available voices
        setSelectedVoice(newVoice.id);

        addMessage({
            role: MessageRole.MODEL,
            content: `New voice "${name}" has been cloned and is ready to use.`,
        });
    } catch (error) {
        console.error("Failed to clone voice:", error);
        addMessage({
            role: MessageRole.MODEL,
            content: `Sorry, there was an error saving the voice to the local database. ${error instanceof Error ? error.message : ''}`,
            isError: true,
        });
    }
  };

  const handleOpenVoiceModal = (agent: Agent) => {
    setSelectedAgentForVoice(agent);
    setIsVoiceModalOpen(true);
  };
  
  const handleCloseVoiceModal = () => {
    setIsVoiceModalOpen(false);
    setSelectedAgentForVoice(null);
  };

  const isMainView = activeTool !== 'LOCAL_VIEWER' && activeTool !== 'RAG_DB' && activeTool !== 'AUDIO_TO_MIDI';
  const showMessageInput = isMainView && rightPanelContent !== 'SUNO';

  return (
    <div className="flex flex-col h-screen bg-primary text-text-primary">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className={`bg-secondary flex flex-col transition-all duration-300 ease-in-out ${isLeftSidebarCollapsed ? 'w-20' : 'w-64'}`}>
            <div className={`p-4 h-16 border-b border-accent flex items-center justify-between`}>
                {!isLeftSidebarCollapsed && <h1 className="text-lg font-semibold text-text-primary">MYTHOS</h1>}
                 <button 
                    onClick={() => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed)}
                    className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-accent transition-colors"
                    aria-label={isLeftSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {isLeftSidebarCollapsed ? <ChevronDoubleRightIcon /> : <ChevronDoubleLeftIcon />}
                </button>
            </div>
            
            <Toolbar
                activeTool={activeTool}
                onToolChange={handleToolChange}
                onToggleGallery={handleToggleGallery}
                onToggleTtsPanel={handleToggleTtsPanel}
                onToggleAgentPanel={handleToggleAgentPanel}
                onToggleOperatorPanel={handleToggleOperatorPanel}
                onToggleSettingsPanel={handleToggleSettingsPanel}
                isCollapsed={isLeftSidebarCollapsed}
                rightPanelContent={rightPanelContent}
             />
        </aside>
        
        {/* Main Content Pane */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <main className="flex-1 overflow-hidden min-h-0">
            {!isMainView ? (
              <>
                {activeTool === 'LOCAL_VIEWER' && <LocalImageViewer />}
                {activeTool === 'RAG_DB' && <RagManager />}
                {activeTool === 'AUDIO_TO_MIDI' && <AudioToMidiConverter />}
              </>
            ) : (
              <div className="h-full overflow-y-auto p-4 md:p-6">
                <div className="w-full space-y-8">
                  {messages.map((message) => (
                    <ChatMessage
                      key={message.id}
                      message={message}
                      onSpeak={handleSpeak}
                      isSpeaking={speakingMessageId === message.id}
                      onInitiateEdit={handleInitiateEdit}
                      onFeedback={handleFeedback}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            )}
          </main>
          {showMessageInput && (
              <footer className="p-4 md:p-6 border-t border-accent bg-secondary">
                <MessageInput
                  input={input}
                  setInput={setInput}
                  onSend={onToolSend}
                  isLoading={isLoading}
                  activeTool={activeTool}
                  isImageAvailableForVideo={!!lastGeneratedImageFilename}
                  onGenerateVideoFromLastImage={handleGenerateVideoFromLastImage}
                />
              </footer>
          )}
        </div>

        {/* Right Sidebar */}
        {rightPanelContent && (
             <aside className="transition-all duration-300 ease-in-out h-full flex flex-col flex-shrink-0" style={{width: '24rem'}}>
                {rightPanelContent === 'GALLERY' && (
                    <GalleryPanel
                        images={galleryImages}
                        isLoading={isLoading && galleryImages.length === 0}
                        onImageClick={handleOpenLightbox}
                        onDragStart={handleDragStart}
                        onClose={() => setRightPanelContent(null)}
                    />
                )}
                {rightPanelContent === 'PERCHANCE' && (
                    <PerchancePromptPanel
                        formData={perchanceFormData}
                        setFormData={setPerchanceFormData}
                        onGenerate={handleOpenPerchanceWithParams}
                        onClose={() => setRightPanelContent(null)}
                    />
                )}
                {rightPanelContent === 'SUNO' && (
                    <SunoPromptPanel
                        formData={sunoFormData}
                        setFormData={setSunoFormData}
                        onGenerate={handleOpenSunoWithParams}
                        onClose={() => setRightPanelContent(null)}
                        onAnalyzeAudio={handleAnalyzeAudio}
                        onGenerateLyrics={handleGenerateSunoLyrics}
                    />
                )}
                {rightPanelContent === 'TTS' && (
                  <TtsPanel
                    ttsModels={TTS_MODELS}
                    selectedTtsModel={selectedTtsModel}
                    onTtsModelChange={setSelectedTtsModel}
                    voices={availableVoices}
                    selectedVoice={selectedVoice}
                    onVoiceChange={setSelectedVoice}
                    onCloneVoice={handleCloneVoice}
                    onClose={() => setRightPanelContent(null)}
                  />
                )}
                {rightPanelContent === 'AGENTS' && (
                    <AgentPanel
                        agents={displayedAgents}
                        allTrainingSamples={allTrainingSamples}
                        onAgentsReorder={setDisplayedAgents}
                        activeAgents={activeAgents}
                        onAgentToggle={handleAgentToggle}
                        onToggleAll={handleToggleAllAgents}
                        onClose={() => setRightPanelContent(null)}
                        onOpenVoiceModal={handleOpenVoiceModal}
                        sortOrder={agentSortOrder}
                        onSortOrderChange={setAgentSortOrder}
                    />
                )}
                {rightPanelContent === 'OPERATOR' && (
                    <OperatorPanel
                        operators={HITL_OPERATORS}
                        activeOperator={activeOperator}
                        onOperatorChange={setActiveOperator}
                        onClose={() => setRightPanelContent(null)}
                    />
                )}
                {rightPanelContent === 'SETTINGS' && (
                    <SettingsPanel
                        apiKey={apiKey}
                        onApiKeySave={handleApiKeySave}
                        onClose={() => setRightPanelContent(null)}
                    />
                )}
            </aside>
        )}
      
      </div>
      {/* Lightbox Modal */}
      {lightboxIndex !== null && (
        <GalleryLightbox 
            images={galleryImages}
            currentIndex={lightboxIndex}
            onClose={handleCloseLightbox}
            onPrev={handlePrevImage}
            onNext={handleNextImage}
            onFeedback={handleFeedback}
        />
      )}
      {/* Voice Training Modal */}
      {isVoiceModalOpen && selectedAgentForVoice && (
        <AgentVoiceModal
            agent={selectedAgentForVoice}
            onClose={handleCloseVoiceModal}
            onDataUpdate={() => handleFetchVoiceData(true)}
        />
      )}
    </div>
  );
};