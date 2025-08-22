
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Part } from '@google/genai';
import { synthesizeSpeech, generateImageFromPrompt, summarizeDocument, generateVideo, checkVideoOperationStatus, fetchGallery, detectContentSafety, analyzeAudio, generateCode, generateText, analyzeCode, getWeather, submitFeedback, fetchGenerationStream, analyzeImageOnBackend, processUrl, generateVideoFromLastImage } from './services/geminiService';
import type { ChatMessage as Message, VoiceOption, Tool, TtsModelOption, GalleryImage } from './types';
import { MessageRole, TTS_MODELS, STABLE_VOICES, PREVIEW_VOICES } from './types';
import ChatMessage from './components/ChatMessage';
import MessageInput from './components/MessageInput';
import Header from './components/Header';
import Toolbar from './components/Toolbar';
import GalleryLightbox from './components/GalleryLightbox';
import GalleryPanel from './components/GalleryPanel';
import PerchancePromptPanel from './components/PerchancePromptPanel';
import TtsPanel from './components/TtsPanel';
import ChevronDoubleLeftIcon from './components/icons/ChevronDoubleLeftIcon';
import ChevronDoubleRightIcon from './components/icons/ChevronDoubleRightIcon';
import LocalImageViewer from './components/LocalImageViewer';

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
  const [activeTool, setActiveTool] = useState<Tool>('CHAT');
  const [selectedTtsModel, setSelectedTtsModel] = useState<TtsModelOption['id']>(TTS_MODELS[0].id);
  const [availableVoices, setAvailableVoices] = useState<readonly VoiceOption[]>(STABLE_VOICES);
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption['id']>(STABLE_VOICES[0].id);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [lastGeneratedImageFilename, setLastGeneratedImageFilename] = useState<string | null>(null);
  
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [rightPanelContent, setRightPanelContent] = useState<'GALLERY' | 'PERCHANCE' | 'TTS' | null>(null);

  const [perchanceFormData, setPerchanceFormData] = useState({
    description: '',
    negative: '',
    numImages: '6 (Default)',
    shape: 'Landscape (768x512)',
    Gscale: '7',
    seed: ''
  });
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rejectedImageHashes = useRef<Map<string, number>>(new Map());

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  useEffect(() => {
    if (selectedTtsModel === 'text-to-speech') {
        setAvailableVoices(STABLE_VOICES);
        setSelectedVoice(STABLE_VOICES[0].id);
    } else {
        setAvailableVoices(PREVIEW_VOICES);
        setSelectedVoice(PREVIEW_VOICES[0].id);
    }
  }, [selectedTtsModel]);

  useEffect(() => {
    if (rightPanelContent === 'GALLERY') {
      handleFetchGallery();
    }
  }, [rightPanelContent]);
  
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const addMessage = (message: Omit<Message, 'id'>) => {
    setMessages(prev => [...prev, { ...message, id: crypto.randomUUID() }]);
  };
  
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
      } else {
         addMessage({
          role: MessageRole.MODEL,
          content: `Sorry, I couldn't generate audio. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          isError: true,
        });
      }
      setSpeakingMessageId(null);
    }
  }, [speakingMessageId, selectedVoice, selectedTtsModel]);

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
        id: crypto.randomUUID(), 
        role: MessageRole.USER, 
        content: finalUserMessageContent,
        ...userMessageOverrides 
    };
    
    // Add user message to UI
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);

    const currentHistory = newMessages.filter(m => (m.role !== MessageRole.MODEL || !m.isError) && m.id !== 'init').map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
    }));
    
    try {
      const responseMessageId = crypto.randomUUID();
      const reader = await fetchGenerationStream(tool, userPrompt, file, currentHistory, responseMessageId);
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

    } catch (error) {
      console.error(`Error during ${tool} generation:`, error);
      const errorMessage = error instanceof Error ? `Stream Error: ${error.message}` : 'An unknown streaming error occurred.';
      addMessage({ role: MessageRole.MODEL, content: errorMessage, isError: true });
    } finally {
      setIsLoading(false);
    }
  };


  const handleGenerateImage = async (prompt: string) => {
    addMessage({ role: MessageRole.USER, content: prompt });
    setIsLoading(true);
    setLastGeneratedImageFilename(null);
    const responseMessageId = crypto.randomUUID();
    
    try {
        setMessages(prev => [...prev, { id: responseMessageId, role: MessageRole.MODEL, content: 'Generating image...' }]);
        const { imageUrl, filename, id } = await generateImageFromPrompt(prompt, responseMessageId);
        setLastGeneratedImageFilename(filename);
        setMessages(prev => prev.map(msg => 
            msg.id === responseMessageId 
            ? { ...msg, content: '', imageUrl, imageId: id, feedback: null }
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
             setMessages(prev => prev.map(msg => msg.id === responseMessageId ? {...msg, content: 'Video is ready!', videoUrl} : msg));
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
    addMessage({ role: MessageRole.USER, content: prompt, imageUrl: imageFile ? URL.createObjectURL(imageFile) : undefined });
    setIsLoading(true);
    const responseMessageId = crypto.randomUUID();
    setMessages(prev => [...prev, {id: responseMessageId, role: MessageRole.MODEL, content: '...'}]);
    await commonVideoGenerationHandler(generateVideo(prompt, imageFile || undefined, responseMessageId), prompt, imageFile ? URL.createObjectURL(imageFile) : undefined, responseMessageId);
  };
  
  const handleGenerateVideoFromLastImage = async (prompt: string) => {
    if (!lastGeneratedImageFilename) return;
    const imageUrl = `http://localhost:3001/uploads/${lastGeneratedImageFilename}`;
    addMessage({ role: MessageRole.USER, content: prompt, imageUrl });
    setIsLoading(true);
    const responseMessageId = crypto.randomUUID();
    setMessages(prev => [...prev, {id: responseMessageId, role: MessageRole.MODEL, content: '...'}]);
    await commonVideoGenerationHandler(generateVideoFromLastImage(prompt, lastGeneratedImageFilename, responseMessageId), prompt, imageUrl, responseMessageId);
  };

  const handleDetectContentSafety = async (file: File) => {
      addMessage({ role: MessageRole.USER, content: `Checking content safety for document:`, fileName: file.name });
      setIsLoading(true);
      const responseMessageId = crypto.randomUUID();
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

  const handleGetWeather = async (location: string) => {
    addMessage({ role: MessageRole.USER, content: `Get weather for: ${location}` });
    setIsLoading(true);
    const responseMessageId = crypto.randomUUID();
    setMessages(prev => [...prev, {id: responseMessageId, role: MessageRole.MODEL, content: '...'}]);
    try {
      const weather = await getWeather(location, responseMessageId);
      const weatherReport = `Weather for ${weather.location}:\n- Temperature: ${weather.temperature}°${weather.unit}\n- Condition: ${weather.condition}\n- Humidity: ${weather.humidity}%`;
      setMessages(prev => prev.map(msg => msg.id === responseMessageId ? {...msg, content: weatherReport} : msg));
    } catch (error) {
      console.error('Error fetching weather:', error);
      const errorMessage = `Failed to get weather: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
  }, []);

  const handleAnalyzeImage = async (file: File) => {
    setIsLoading(true);
    const responseMessageId = crypto.randomUUID();
    
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = async () => {
        const buffer = reader.result as ArrayBuffer;
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
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
      if (!message) return;

      // Optimistic UI update for chat message
      setMessages(prev => prev.map(msg => 
          msg.id === messageId ? { ...msg, feedback } : msg
      ));
      
      // If it's an image, also update the gallery state
      if (message.imageId) {
          setGalleryImages(prev => prev.map(img =>
              img.id === message.imageId ? { ...img, feedback } : img
          ));
      }

      try {
          await submitFeedback(messageId, feedback);
      } catch (error) {
          console.error("Failed to submit feedback", error);
          addMessage({ role: MessageRole.MODEL, content: 'Failed to save your feedback.', isError: true });
          // Revert state on error by refetching gallery if it was an image
          if (message.imageId) {
            handleFetchGallery();
          }
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
      case 'CHAT':
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
      case 'WEATHER':
        handleGetWeather(message);
        break;
      case 'LOCAL_VIEWER':
      case 'RAG_DB':
        // Placeholder for future RAG functionality
        break;
      default:
        handleStreamedGeneration('CHAT', message, file, {});
    }
  };

  const handleToolChange = (tool: Tool) => {
    if (tool === 'NOTEBOOK_LM') {
        window.open('https://notebooklm.google.com', '_blank', 'noopener,noreferrer');
    } else if (tool === 'PERCHANCE_MIXER') {
        setRightPanelContent(rightPanelContent === 'PERCHANCE' ? null : 'PERCHANCE');
    } else if (tool === 'SUNO_MUSIC') {
        window.open('https://suno.com/create', '_blank', 'noopener,noreferrer');
    } else if (tool === 'LINEAR') {
        window.open('https://linear.app/mythos-lia/project/mythos-dashboard-3a768abea8fa/overview', '_blank', 'noopener,noreferrer');
    } else {
        setActiveTool(tool);
    }
  };

  const handleToggleGallery = () => {
    setRightPanelContent(rightPanelContent === 'GALLERY' ? null : 'GALLERY');
  };
  
  const handleToggleTtsPanel = () => {
    setRightPanelContent(rightPanelContent === 'TTS' ? null : 'TTS');
  };

  const handleOpenPerchanceWithParams = () => {
    const { description, negative, numImages, shape, Gscale, seed } = perchanceFormData;
    const baseUrl = 'https://perchance.org/c6m2dfzel7';
    const params = new URLSearchParams();
    
    // Only add params if they have a value to keep the URL clean
    if (description) params.append('description', description);
    if (negative) params.append('negative', negative);
    if (numImages) params.append('numImages', numImages);
    if (shape) params.append('shape', shape.split('=')[1]?.trim() || '');
    if (Gscale) params.append('Gscale', Gscale);
    if (seed) params.append('seed', seed);
    
    const fullUrl = `${baseUrl}?${params.toString()}`;
    window.open(fullUrl, '_blank', 'noopener,noreferrer');
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
  
  return (
    <div className="flex flex-col h-screen bg-primary text-text-primary">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className={`bg-secondary flex flex-col transition-all duration-300 ease-in-out ${isLeftSidebarCollapsed ? 'w-20' : 'w-64'}`}>
            <div className={`p-4 h-16 border-b border-accent flex items-center justify-between`}>
                {!isLeftSidebarCollapsed && <h1 className="text-lg font-semibold text-text-primary">MYTHOS DASHBOARD</h1>}
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
                isCollapsed={isLeftSidebarCollapsed}
                rightPanelContent={rightPanelContent}
             />
        </aside>
        
        {/* Main Content Pane */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <main className="flex-1 overflow-hidden">
            {activeTool === 'LOCAL_VIEWER' ? (
              <LocalImageViewer />
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
          {activeTool !== 'LOCAL_VIEWER' && (
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
                {rightPanelContent === 'TTS' && (
                  <TtsPanel
                    ttsModels={TTS_MODELS}
                    selectedTtsModel={selectedTtsModel}
                    onTtsModelChange={setSelectedTtsModel}
                    voices={availableVoices}
                    selectedVoice={selectedVoice}
                    onVoiceChange={setSelectedVoice}
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
    </div>
  );
};
