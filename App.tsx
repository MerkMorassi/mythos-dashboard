
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Part } from '@google/genai';
import { synthesizeSpeech, generateImageFromPrompt, summarizeDocument, generateVideo, checkVideoOperationStatus, fetchChatStream, analyzeImageOnBackend, processUrl, generateVideoFromLastImage, fetchGallery, detectContentSafety, analyzeAudio, generateCode, generateText, analyzeCode, getWeather } from './services/geminiService';
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

const ANALYSIS_PROMPT = `
You are an expert descriptive analyst for high-quality imagery. Your task is to provide a detailed, accurate, and objective visual description of the provided image. Do not infer emotions or make subjective judgments.

Your response MUST be formatted in Markdown and structured in two distinct parts: "PART 1: ANALYSIS" and "PART 2: PROMPT SUGGESTION".

---

**PART 1: ANALYSIS**

Provide a detailed analysis of the image, divided into the following numbered sections. Each section number and title must be bolded. If a section is not applicable, state "Not applicable". Double newlines MUST be used between each numbered section for readability.

1.  **Main subject(s) and their primary, observable characteristics.**
    (Provide detailed description here)

2.  **Clothing or items in detail.**
    (Provide detailed description here)

3.  **Accessories.**
    (Provide detailed description here)

4.  **Pose and expression of any individuals.**
    (Provide detailed description here)

5.  **Characterize the background.**
    (Provide detailed description here)

6.  **Describe the overall lighting.**
    (Provide detailed description here)

---

**PART 2: PROMPT SUGGESTION**

Provide a prompt suggestion for generating a similar image. This part must contain a "Positive Prompt" and a "Negative Prompt" section.

Positive Prompt: 
A comma-separated list of keywords and descriptive phrases derived directly from your analysis in PART 1.

Negative Prompt: 
The following exact keywords, comma-separated: blurry, low quality, cartoon, watermark, signature, text, distorted, disfigured, bad anatomy, ugly, tiling, poor lighting, unnatural pose, human, accessories, clothing

---

Now, please provide the analysis and prompt suggestion for the image I will provide, strictly following the format above.
`;

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

  const handleSendMessage = async (messageText: string, file: File | null) => {
    if (file) {
        addMessage({ role: MessageRole.MODEL, content: "File uploads are not supported in this chat tool yet. Please use the Document or Image analysis tools.", isError: true });
        return;
    }
    
    const userMessage: Message = { id: crypto.randomUUID(), role: MessageRole.USER, content: messageText };
    const currentHistory = messages.filter(m => m.role !== MessageRole.MODEL || !m.isError).map(m => ({
        role: m.role,
        parts: [{ text: m.content }]
    }));

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
  
    try {
      const parts: Part[] = [{ text: messageText }];
      const reader = await fetchChatStream(currentHistory, parts);
      const decoder = new TextDecoder();
      let responseText = '';
      const responseMessageId = crypto.randomUUID();
      setMessages((prev) => [...prev, { id: responseMessageId, role: MessageRole.MODEL, content: '...' }]);
  
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

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = error instanceof Error ? `Error: ${error.message}` : 'An unknown error occurred.';
      addMessage({ role: MessageRole.MODEL, content: errorMessage, isError: true });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateImage = async (prompt: string) => {
    addMessage({ role: MessageRole.USER, content: prompt });
    setIsLoading(true);
    setLastGeneratedImageFilename(null);
    try {
        addMessage({ role: MessageRole.MODEL, content: 'Generating image...' });
        const { imageUrl, filename } = await generateImageFromPrompt(prompt);
        setLastGeneratedImageFilename(filename);
        addMessage({
            role: MessageRole.MODEL,
            content: '',
            imageUrl,
        });
    } catch (error) {
        console.error('Error generating image:', error);
        addMessage({ role: MessageRole.MODEL, content: `Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, isError: true });
    } finally {
        setIsLoading(false);
        setMessages(prev => prev.filter(m => m.content !== 'Generating image...'));
    }
  };

  const handleGenerateCode = async (prompt: string) => {
    addMessage({ role: MessageRole.USER, content: prompt });
    setIsLoading(true);
    try {
        const code = await generateCode(prompt);
        addMessage({ role: MessageRole.MODEL, content: code });
    } catch (error) {
        console.error('Error generating code:', error);
        addMessage({ role: MessageRole.MODEL, content: `Code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, isError: true });
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleSummarizeDocument = async (file: File) => {
      addMessage({ role: MessageRole.USER, content: `Summarize document:`, fileName: file.name });
      setIsLoading(true);
      try {
          const summary = await summarizeDocument(file);
          addMessage({ role: MessageRole.MODEL, content: summary });
      } catch (error) {
          console.error('Error summarizing document:', error);
          addMessage({ role: MessageRole.MODEL, content: `Summarization failed: ${error instanceof Error ? error.message : 'Unknown error'}`, isError: true });
      } finally {
          setIsLoading(false);
      }
  };

  const commonVideoGenerationHandler = async (promise: Promise<{ operation: any; sourceImageFilename: string | null; }>, prompt: string, imageUrl?: string) => {
     addMessage({ role: MessageRole.USER, content: prompt, imageUrl });
     setIsLoading(true);
    try {
        addMessage({ role: MessageRole.MODEL, content: 'Video generation started... This can take a few minutes.' });
        let { operation, sourceImageFilename } = await promise;
        addMessage({ role: MessageRole.MODEL, content: 'Checking status...' });

        while (!operation.done) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await checkVideoOperationStatus(operation, prompt, sourceImageFilename);
        }

        const localUrl = operation.response?.generatedVideos?.[0]?.video?.localUrl;
        if (localUrl) {
            const videoUrl = `http://localhost:3001${localUrl}`;
            addMessage({ role: MessageRole.MODEL, content: 'Video is ready!', videoUrl });
        } else {
            throw new Error('Video generation finished but no local URL was provided.');
        }

    } catch (error) {
        console.error('Error generating video:', error);
        addMessage({ role: MessageRole.MODEL, content: `Video generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, isError: true });
    } finally {
        setIsLoading(false);
        setMessages(prev => prev.filter(m => !m.content.includes('generation started') && !m.content.includes('Checking status...')));
    }
  };
  
  const handleGenerateVideo = async (prompt: string, imageFile: File | null) => {
    await commonVideoGenerationHandler(generateVideo(prompt, imageFile || undefined), prompt, imageFile ? URL.createObjectURL(imageFile) : undefined);
  };
  
  const handleGenerateVideoFromLastImage = async (prompt: string) => {
    if (!lastGeneratedImageFilename) return;
    const imageUrl = `http://localhost:3001/${lastGeneratedImageFilename}`;
    await commonVideoGenerationHandler(generateVideoFromLastImage(prompt, lastGeneratedImageFilename), prompt, imageUrl);
  };

  const handleGenerateText = async (prompt: string, file: File | null) => {
    if (file) {
      addMessage({ role: MessageRole.USER, content: prompt, fileName: file.name });
    } else {
      addMessage({ role: MessageRole.USER, content: prompt });
    }
    setIsLoading(true);
    try {
        const result = await generateText(prompt, file);
        addMessage({ role: MessageRole.MODEL, content: result });
    } catch (error) {
        console.error('Error generating text:', error);
        addMessage({ role: MessageRole.MODEL, content: `Text generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, isError: true });
    } finally {
        setIsLoading(false);
    }
  };

  const handleAnalyzeCode = async (prompt: string, file: File | null) => {
    if (file) {
      addMessage({ role: MessageRole.USER, content: prompt, fileName: file.name });
    } else {
      addMessage({ role: MessageRole.USER, content: prompt });
    }
    setIsLoading(true);
    try {
        const result = await analyzeCode(prompt, file);
        addMessage({ role: MessageRole.MODEL, content: result });
    } catch (error) {
        console.error('Error analyzing code:', error);
        addMessage({ role: MessageRole.MODEL, content: `Code analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`, isError: true });
    } finally {
        setIsLoading(false);
    }
  };

  const handleDetectContentSafety = async (file: File) => {
      addMessage({
          role: MessageRole.USER,
          content: `Checking content safety for document:`,
          fileName: file.name,
      });
      setIsLoading(true);
      try {
          const result = await detectContentSafety(file);
          const resultContent = `Safety Check Result:\nCategory: ${result.category}\nReason: ${result.reason}`;
          addMessage({ role: MessageRole.MODEL, content: resultContent });
      } catch (error) {
          console.error('Error detecting content safety:', error);
          addMessage({ role: MessageRole.MODEL, content: `Content safety check failed: ${error instanceof Error ? error.message : 'Unknown error'}`, isError: true });
      } finally {
          setIsLoading(false);
      }
  };

  const handleAnalyzeAudio = async (file: File) => {
    addMessage({ role: MessageRole.USER, content: `Analyzing audio file:`, fileName: file.name });
    setIsLoading(true);
    try {
        const transcript = await analyzeAudio(file);
        addMessage({ role: MessageRole.MODEL, content: transcript });
    } catch (error) {
        console.error('Error analyzing audio:', error);
        addMessage({ role: MessageRole.MODEL, content: `Audio analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`, isError: true });
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleProcessUrl = async (fullInput: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/;
    const match = fullInput.match(urlRegex);
    
    if (!match) {
        addMessage({ role: MessageRole.MODEL, content: "Please provide a valid URL.", isError: true });
        return;
    }

    const url = match[0];
    const prompt = fullInput.replace(url, '').trim();

    addMessage({ role: MessageRole.USER, content: `URL: ${url}\nPrompt: ${prompt}` });
    setIsLoading(true);
    try {
        const response = await processUrl(url, prompt);
        addMessage({ role: MessageRole.MODEL, content: response });
    } catch (error) {
        console.error('Error processing URL:', error);
        addMessage({ role: MessageRole.MODEL, content: `URL processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, isError: true });
    } finally {
        setIsLoading(false);
    }
  };

  const handleGetWeather = async (location: string) => {
    addMessage({ role: MessageRole.USER, content: `Get weather for: ${location}` });
    setIsLoading(true);
    try {
      const weather = await getWeather(location);
      const weatherReport = `Weather for ${weather.location}:\n- Temperature: ${weather.temperature}°${weather.unit}\n- Condition: ${weather.condition}\n- Humidity: ${weather.humidity}%`;
      addMessage({ role: MessageRole.MODEL, content: weatherReport });
    } catch (error) {
      console.error('Error fetching weather:', error);
      addMessage({ role: MessageRole.MODEL, content: `Failed to get weather: ${error instanceof Error ? error.message : 'Unknown error'}`, isError: true });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleFetchGallery = useCallback(async () => {
    if (galleryImages.length > 0 && !isLoading) return;
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
  }, [galleryImages.length, isLoading]);

  const handleAnalyzeImage = async (file: File) => {
    setIsLoading(true);
    
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = async () => {
        const buffer = reader.result as ArrayBuffer;
        const hashBuffer = await crypto.subtle.digest('SHA-265', buffer);
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
    
        try {
          const result = await analyzeImageOnBackend(file, ANALYSIS_PROMPT);
          if (!result.text) {
              rejectedImageHashes.current.set(imageHash, 1);
              addMessage({ role: MessageRole.MODEL, content: '', rejectionLevel: 1 });
          } else {
              addMessage({ role: MessageRole.MODEL, content: result.text });
          }
        } catch (error) {
          console.error('Error analyzing image:', error);
          const errorMessage = `Analysis Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
          addMessage({ role: MessageRole.MODEL, content: errorMessage, isError: true });
        } finally {
          setIsLoading(false);
        }
    };
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
        handleSendMessage(message, file);
        break;
      case 'IMAGE_GEN':
        handleGenerateImage(message);
        break;
      case 'CODE_GEN':
        handleGenerateCode(message);
        break;
      case 'TEXT_GEN':
        handleGenerateText(message, file);
        break;
      case 'VIDEO_GEN':
        handleGenerateVideo(message, file);
        break;
      case 'IMAGE_ANALYSIS':
        if(file) handleAnalyzeImage(file);
        break;
      case 'CODE_ANALYSIS':
        handleAnalyzeCode(message, file);
        break;
      case 'DOC_SUMMARY':
        if(file) handleSummarizeDocument(file);
        break;
      case 'CONTENT_DETECTOR':
        if(file) handleDetectContentSafety(file);
        break;
      case 'AUDIO_ANALYSIS':
        if(file) handleAnalyzeAudio(file);
        break;
      case 'URL_CONTEXT':
        handleProcessUrl(message);
        break;
      case 'WEATHER':
        handleGetWeather(message);
        break;
      case 'RAG_DB':
        // Placeholder for future RAG functionality
        break;
      default:
        handleSendMessage(message, file);
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
            <div className={`p-4 h-16 border-b border-accent flex items-center`}>
                {!isLeftSidebarCollapsed && <h1 className="text-lg font-semibold text-text-primary">Gemini MCP</h1>}
            </div>
            
            <Toolbar
                activeTool={activeTool}
                onToolChange={handleToolChange}
                onToggleGallery={handleToggleGallery}
                onToggleTtsPanel={handleToggleTtsPanel}
                isCollapsed={isLeftSidebarCollapsed}
                rightPanelContent={rightPanelContent}
             />

            <div className="p-2 border-t border-accent mt-auto">
              <button 
                  onClick={() => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed)}
                  className="w-full text-sm text-text-secondary hover:text-text-primary hover:bg-accent p-2 rounded-lg transition-colors"
                  aria-label={isLeftSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                  {isLeftSidebarCollapsed ? 'Show' : 'Hide'}
              </button>
            </div>
        </aside>
        
        {/* Main Content Pane */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <main className="flex-1 overflow-hidden p-4 md:p-6 overflow-y-auto">
            <div className="w-full space-y-8">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onSpeak={handleSpeak}
                  isSpeaking={speakingMessageId === message.id}
                  onInitiateEdit={handleInitiateEdit}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </main>
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
        />
      )}
    </div>
  );
};
