import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
// Fix: Import Agent type
import type { ChatMessage as Message, Tool, Agent } from '../types';
import { MessageRole, ALL_AGENTS } from '../types';
import { synthesizeSpeech, generateImageFromPrompt, generateVideo, checkVideoOperationStatus, submitFeedback, fetchGenerationStream, analyzeImageOnBackend, generateVideoFromLastImage, detectContentSafety } from '../services/geminiService';
import { getClonedVoiceBlob, getFirstTrainingSampleBlob } from '../services/dbService';
import { markdownToPlainText } from '../utils/textUtils';
import { useTools } from './ToolContext';
import { useAgents } from './AgentsContext';

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
  // Fix: Add missing properties to the context state interface
  onInitiateEdit: (text: string) => void;
  onFeedback: (messageId: string, feedback: 'like' | 'dislike') => void;
  isImageAvailableForVideo: boolean;
  onGenerateVideoFromLastImage: (prompt: string) => void;
}

const ChatContext = createContext<ChatContextState | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeTool, selectedTtsModel, selectedVoice, activeOperator, handleFetchGallery, isServerReady } = useTools();
  const { activeAgents } = useAgents();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: MessageRole.MODEL,
      content: "Hello! I am a multi-tool assistant. Please select a tool to get started.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [lastGeneratedImageFilename, setLastGeneratedImageFilename] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rejectedImageHashes = useRef<Map<string, number>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = useCallback((message: Omit<Message, 'id'>) => {
    setMessages(prev => [...prev, { ...message, id: window.crypto.randomUUID() }]);
  }, []);
  
  const addServerError = () => {
      addMessage({
        role: MessageRole.MODEL,
        content: "Could not connect to the server. It may be starting up or offline. Please wait a moment and try again.",
        isError: true,
      });
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
      
        if (!isServerReady) {
            addServerError();
            setSpeakingMessageId(null);
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
            let errorMessage = "Sorry, I couldn't generate audio. Error: Unknown error";
            if (error instanceof Error) {
                errorMessage = `Sorry, I couldn't generate audio. Error: ${error.message}`;
            }
            addMessage({
                role: MessageRole.MODEL,
                content: errorMessage,
                isError: true,
            });
        }
        setSpeakingMessageId(null);
    }
  }, [speakingMessageId, selectedVoice, selectedTtsModel, addMessage, isServerReady]);

  const handleStreamedGeneration = async (
      tool: Tool, 
      userPrompt: string, 
      file: File | null = null, 
      userMessageOverrides: Partial<Message> = {}
  ) => {
    if (!isServerReady) {
        addServerError();
        setIsLoading(false);
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
    
    // Add user message to UI
    let newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsLoading(true);
    
    try {
        if (tool === 'AGENT_HUB') {
            if (activeAgents.size === 0) {
                addMessage({ role: MessageRole.MODEL, content: "Please select at least one agent to chat with.", isError: true });
                setIsLoading(false);
                return;
            }
            
            let conversationHistory = newMessages.filter(m => (m.role !== MessageRole.MODEL || !m.isError) && m.id !== 'init').map(m => ({
                role: m.role,
                parts: [{ text: m.operator ? `[OPERATOR: ${m.operator.name}]\n${m.content}` : m.content }]
            }));

            const agentsToQuery = Array.from(activeAgents);
            for (const agentId of agentsToQuery) {
                 const agent = ALL_AGENTS.find(a => a.id === agentId);
                 if (!agent) continue;
                 
                 const responseMessageId = window.crypto.randomUUID();
                 setMessages(prev => [...prev, { id: responseMessageId, role: MessageRole.MODEL, content: '...', agent: agent }]);
                 
                 const reader = await fetchGenerationStream(tool, userPrompt, file, conversationHistory, responseMessageId, [agentId]);
                 const decoder = new TextDecoder();
                 let responseText = '';

                 while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    if (value) {
                      let chunk = String(decoder.decode(value, { stream: true }));
                      const prefix = `${agentId}::`;
                      if (responseText === '' && chunk.startsWith(prefix)) {
                          chunk = chunk.substring(prefix.length);
                      }
                      responseText += chunk;
                      
                      setMessages(prev => prev.map(msg =>
                          msg.id === responseMessageId ? { ...msg, content: responseText } : msg
                      ));
                    }
                 }
                 conversationHistory.push({ role: MessageRole.MODEL, parts: [{ text: responseText }]});
            }

        } else {
             const responseMessageId = window.crypto.randomUUID();
             const currentHistory = newMessages.filter(m => (m.role !== MessageRole.MODEL || !m.isError) && m.id !== 'init').map(m => ({
                role: m.role,
                parts: [{ text: m.operator ? `[OPERATOR: ${m.operator.name}]\n${m.content}` : m.content }]
            }));
             const reader = await fetchGenerationStream(tool, userPrompt, file, currentHistory, responseMessageId, []);
             const decoder = new TextDecoder();
             let responseText = '';
             
             setMessages((prev) => [...prev, { id: responseMessageId, role: MessageRole.MODEL, content: '...' }]);
         
             while (true) {
               const { done, value } = await reader.read();
               if (done) break;
               if (value) {
                 responseText += String(decoder.decode(value, { stream: true }));
                 setMessages((prev) =>
                   prev.map((msg) =>
                     msg.id === responseMessageId ? { ...msg, content: responseText } : msg
                   )
                 );
               }
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
    if (!isServerReady) {
        addServerError();
        return;
    }
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
        let errorMessage = `Image generation failed: Unknown error`;
        if (error instanceof Error) {
            errorMessage = `Image generation failed: ${error.message}`;
        }
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
    if (!isServerReady) {
        addServerError();
        setIsLoading(false);
        return;
    }
    try {
        setMessages(prev => prev.map(msg => msg.id === responseMessageId ? {...msg, content: 'Video generation submitted. This process can take several minutes.'} : msg));
        
        let { operation, sourceImageFilename } = await promise;
        
        let checkCount = 1;
        while (!operation.done) {
            setMessages(prev => prev.map(msg => msg.id === responseMessageId ? {...msg, content: `Video generation in progress... (Status check #${checkCount})`} : msg));
            await new Promise(resolve => setTimeout(resolve, 10000));
            operation = await checkVideoOperationStatus(operation, prompt, sourceImageFilename, responseMessageId);
            checkCount++;
        }

        const localUrl = operation.response?.generatedVideos?.[0]?.video?.localUrl;
        if (localUrl) {
            setMessages(prev => prev.map(msg => msg.id === responseMessageId ? {...msg, content: 'Video generation completed. Displaying now...'} : msg));
            await new Promise(resolve => setTimeout(resolve, 1000));
            setMessages(prev => prev.map(msg => msg.id === responseMessageId ? {...msg, content: '', videoUrl: localUrl} : msg));
        } else {
            setMessages(prev => prev.map(msg => msg.id === responseMessageId ? {...msg, content: 'Video generation failed. The process finished but no video was returned.', isError: true} : msg));
        }

    } catch (error) {
        console.error('Error generating video:', error);
        let errorMessage = `Video generation failed: Unknown error`;
        if (error instanceof Error) {
            errorMessage = `Video generation failed: ${error.message}`;
        }
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
    const imageUrl = `/uploads/${lastGeneratedImageFilename}`;
    addMessage({ role: MessageRole.USER, content: prompt, operator: activeOperator, imageUrl });
    setIsLoading(true);
    const responseMessageId = window.crypto.randomUUID();
    setMessages(prev => [...prev, {id: responseMessageId, role: MessageRole.MODEL, content: '...'}]);
    await commonVideoGenerationHandler(generateVideoFromLastImage(prompt, lastGeneratedImageFilename, responseMessageId), prompt, imageUrl, responseMessageId);
  };

  const handleDetectContentSafety = async (file: File) => {
      if (!isServerReady) {
        addServerError();
        return;
      }
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
          let errorMessage = `Content safety check failed: Unknown error`;
          if (error instanceof Error) {
            errorMessage = `Content safety check failed: ${error.message}`;
          }
          setMessages(prev => prev.map(msg => msg.id === responseMessageId ? {...msg, content: errorMessage, isError: true} : msg));
      } finally {
          setIsLoading(false);
      }
  };

  const handleAnalyzeImage = async (file: File) => {
    if (!isServerReady) {
        addServerError();
        return;
    }
    setIsLoading(true);
    const responseMessageId = window.crypto.randomUUID();

    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onload = async () => {
      const buffer = reader.result as ArrayBuffer;
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const imageHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      if (rejectedImageHashes.current.has(imageHash)) {
        addMessage({ role: MessageRole.MODEL, content: '', rejectionLevel: 2 });
        setIsLoading(false);
        return;
      }

      addMessage({
        role: MessageRole.USER,
        content: '',
        imageUrl: URL.createObjectURL(file),
        operator: activeOperator,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: responseMessageId,
          role: MessageRole.MODEL,
          content: 'Preparing upload...',
          uploadProgress: 0,
        },
      ]);

      const onProgress = (progress: number) => {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === responseMessageId
              ? {
                  ...msg,
                  content: progress < 100 ? `Uploading... ${progress}%` : 'Processing...',
                  uploadProgress: progress,
                }
              : msg
          )
        );
      };

      try {
        const result = await analyzeImageOnBackend(file, responseMessageId, onProgress);
        if (!result.analysis && result.tags.length === 0) {
          rejectedImageHashes.current.set(imageHash, 1);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === responseMessageId
                ? { ...msg, content: '', rejectionLevel: 1, uploadProgress: undefined }
                : msg
            )
          );
        } else {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === responseMessageId
                ? { ...msg, content: result.analysis, tags: result.tags, uploadProgress: undefined }
                : msg
            )
          );
        }
      } catch (error) {
        console.error('Error analyzing image:', error);
        let errorMessage = `Analysis Error: Unknown error`;
        if (error instanceof Error) {
          errorMessage = `Analysis Error: ${error.message}`;
        }
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === responseMessageId
              ? { ...msg, content: errorMessage, isError: true, uploadProgress: undefined }
              : msg
          )
        );
      } finally {
        setIsLoading(false);
      }
    };
  };

  const onFeedback = async (messageId: string, feedback: 'like' | 'dislike') => {
      if (!isServerReady) {
        addServerError();
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
        const userMessage = {
          imageUrl: file ? URL.createObjectURL(file) : undefined,
          fileName: file ? file.name : undefined,
        };
        handleStreamedGeneration(activeTool, message, file, userMessage);
        break;
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
        break;
      default:
        handleStreamedGeneration('AGENT_HUB', message, file, {});
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
    isImageAvailableForVideo: !!lastGeneratedImageFilename,
    onGenerateVideoFromLastImage: handleGenerateVideoFromLastImage,
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