
import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { Tool, GalleryImage } from '../types';
import SendIcon from './icons/SendIcon';
import CameraIcon from './icons/CameraIcon';
import MicrophoneIcon from './icons/MicrophoneIcon';
import StopCircleIcon from './icons/StopCircleIcon';
import PaperclipIcon from './icons/PaperclipIcon';
import AudioIcon from './icons/AudioIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';
import CloseIcon from './icons/CloseIcon';
import TrashIcon from './icons/TrashIcon';
import { useChat } from '../contexts/ChatContext';
import { useTools } from '../contexts/ToolContext';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const ACCEPTED_IMAGE_TYPES = 'image/jpeg, image/png';
const ACCEPTED_DOC_TYPES = '.txt,.md,.pdf';
const ACCEPTED_CODE_TYPES = '.txt,.md,.pdf,.js,.ts,.py,.html,.css,.json';
const ACCEPTED_AUDIO_TYPES = '.mp3,.wav';

const MessageInput: React.FC = () => {
  const {
    input,
    setInput,
    onToolSend,
    isLoading,
    isImageAvailableForVideo,
    onGenerateVideoFromLastImage,
    startNewChat,
  } = useChat();
  const { activeTool } = useTools();
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);
  const docFileInputRef = useRef<HTMLInputElement | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
      if (input !== textareaRef.current.value) {
        textareaRef.current.focus();
      }
    }
  }, [input]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInput(transcript);
      };
      
      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
      }
      
      recognition.onend = () => {
        setIsRecording(false);
      }

      speechRecognitionRef.current = recognition;
    } else {
      console.warn("Speech Recognition not supported by this browser.");
    }
    
    return () => {
      speechRecognitionRef.current?.abort();
    };
  }, [setInput]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);
  
  const handleToggleRecording = useCallback(() => {
    if (!speechRecognitionRef.current) return;
    
    if (isRecording) {
      speechRecognitionRef.current.stop();
    } else {
      setInput(''); // Clear input before starting
      speechRecognitionRef.current.start();
    }
    setIsRecording(!isRecording);
  }, [isRecording, setInput]);

  const removeImageFile = () => {
    setImageFile(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImagePreviewUrl(null);
    if (fileError) setFileError(null);
  };
  
  const removeDocFile = () => {
    setDocFile(null);
    if (fileError) setFileError(null);
  };

  const removeAudioFile = () => {
    setAudioFile(null);
    if (fileError) setFileError(null);
  };

  const validateFile = (file: File, acceptedTypesStr?: string): boolean => {
    if (!acceptedTypesStr) return true; 

    const acceptedTypes = acceptedTypesStr.split(',').map(t => t.trim().toLowerCase());
    const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;

    return acceptedTypes.some(type => {
        if (type.startsWith('.')) {
            return fileExtension === type;
        } else if (type.endsWith('/*')) {
            return file.type.startsWith(type.slice(0, -1));
        }
        return file.type.toLowerCase() === type;
    });
  };

  const getToolConfig = useCallback(() => {
    switch(activeTool) {
      case 'AGENT_HUB':
        return { placeholder: 'Send a message...', sendDisabled: isLoading || (!input.trim() && !imageFile && !docFile && !audioFile), showCamera: true, showPaperclip: true, showAudioUpload: true, acceptImage: ACCEPTED_IMAGE_TYPES, acceptDoc: ACCEPTED_CODE_TYPES, acceptAudio: ACCEPTED_AUDIO_TYPES };
      case 'IMAGE_GEN':
        return { placeholder: 'Describe an image to generate...', sendDisabled: isLoading || !input.trim(), showCamera: false, showPaperclip: false, showAudioUpload: false };
      case 'CODE_GEN':
        return { placeholder: 'Describe the code you want to create...', sendDisabled: isLoading || !input.trim(), showCamera: false, showPaperclip: false, showAudioUpload: false };
      case 'TEXT_GEN':
        return { placeholder: 'Describe the text you want to write, or upload a document...', sendDisabled: isLoading || (!input.trim() && !docFile), showCamera: false, showPaperclip: true, showAudioUpload: false, textInputDisabled: false, acceptDoc: ACCEPTED_CODE_TYPES };
      case 'VIDEO_GEN':
        return { placeholder: 'Describe a video... (optional image)', sendDisabled: isLoading || !input.trim(), showCamera: true, showPaperclip: false, showAudioUpload: false, acceptImage: ACCEPTED_IMAGE_TYPES };
      case 'IMAGE_ANALYSIS':
        return { placeholder: 'Upload a JPG or PNG image to analyze...', sendDisabled: isLoading || !imageFile, showCamera: true, showPaperclip: false, showAudioUpload: false, textInputDisabled: true, acceptImage: ACCEPTED_IMAGE_TYPES };
      case 'CODE_ANALYSIS':
        return { placeholder: 'Paste code to analyze, or upload a file...', sendDisabled: isLoading || (!input.trim() && !docFile), showCamera: false, showPaperclip: true, showAudioUpload: false, textInputDisabled: false, acceptDoc: ACCEPTED_CODE_TYPES };
      case 'DOC_SUMMARY':
        return { placeholder: 'Upload a document (.txt, .md, .pdf) to summarize...', sendDisabled: isLoading || !docFile, showCamera: false, showPaperclip: true, showAudioUpload: false, textInputDisabled: true, acceptDoc: ACCEPTED_DOC_TYPES };
      case 'CONTENT_DETECTOR':
        return { placeholder: 'Upload a document (.txt, .md, .pdf) to check for safety violations...', sendDisabled: isLoading || !docFile, showCamera: false, showPaperclip: true, showAudioUpload: false, textInputDisabled: true, acceptDoc: ACCEPTED_DOC_TYPES };
      case 'AUDIO_ANALYSIS':
        return { placeholder: 'Upload an audio file (.mp3, .wav) to analyze...', sendDisabled: isLoading || !audioFile, showCamera: false, showPaperclip: false, showAudioUpload: true, textInputDisabled: true, acceptAudio: ACCEPTED_AUDIO_TYPES };
      case 'URL_CONTEXT':
        return { placeholder: 'Paste a URL and ask a question...', sendDisabled: isLoading || !input.trim(), showCamera: false, showPaperclip: false, showAudioUpload: false };
      case 'RAG_DB':
        return { placeholder: 'Future RAG implementation space...', sendDisabled: true, showCamera: false, showPaperclip: false, showAudioUpload: false, textInputDisabled: true };
      default:
        return { placeholder: 'Send a message...', sendDisabled: false, showCamera: true, showPaperclip: true, showAudioUpload: false, acceptImage: ACCEPTED_IMAGE_TYPES, acceptDoc: ACCEPTED_CODE_TYPES, acceptAudio: ACCEPTED_AUDIO_TYPES };
    }
  }, [activeTool, isLoading, input, imageFile, docFile, audioFile]);

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFileError(null);
      const { acceptImage } = getToolConfig();
      if (!validateFile(selectedFile, acceptImage)) {
        setFileError(`Invalid image type. Please use: ${acceptImage}.`);
        event.target.value = '';
        return;
      }
      if (selectedFile.size > MAX_FILE_SIZE) {
        setFileError(`Image file is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
      } else {
        removeImageFile();
        setImageFile(selectedFile);
        setImagePreviewUrl(URL.createObjectURL(selectedFile));
        removeDocFile();
        removeAudioFile();
      }
    }
    event.target.value = '';
  };

  const handleDocFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
        setFileError(null);
        const { acceptDoc } = getToolConfig();
        if (!validateFile(selectedFile, acceptDoc)) {
            setFileError(`Invalid document type. Please use: ${acceptDoc}.`);
            event.target.value = '';
            return;
        }
        if (selectedFile.size > MAX_FILE_SIZE) {
            setFileError(`Document file is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
        } else {
            setDocFile(selectedFile);
            removeImageFile();
            removeAudioFile();
        }
    }
    event.target.value = '';
  };

  const handleAudioFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
        setFileError(null);
        const { acceptAudio } = getToolConfig();
        if (!validateFile(selectedFile, acceptAudio)) {
            setFileError(`Invalid audio type. Please use: ${acceptAudio}.`);
            event.target.value = '';
            return;
        }
        if (selectedFile.size > MAX_FILE_SIZE) {
            setFileError(`Audio file is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
        } else {
            setAudioFile(selectedFile);
            removeImageFile();
            removeDocFile();
        }
    }
    event.target.value = '';
  };

  const handleSend = () => {
    if (isLoading || fileError) return;
    
    const fileToSend = imageFile || docFile || audioFile;
    if (input.trim() || fileToSend) {
      onToolSend(input, fileToSend);
      setInput('');
      removeImageFile();
      removeDocFile();
      removeAudioFile();
    }
  };

  const handleUseLastImage = () => {
    if (isLoading || !input.trim()) return;
    onGenerateVideoFromLastImage(input);
    setInput('');
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const isSpeechSupported = !!(typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window));
  
  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    setFileError(null);

    // Handle files from filesystem first
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      
      if (droppedFile.size > MAX_FILE_SIZE) {
        setFileError(`File is too large (${(droppedFile.size / 1024 / 1024).toFixed(1)}MB). Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
        return;
      }
      
      const { showCamera, showPaperclip, showAudioUpload, acceptImage, acceptDoc, acceptAudio } = getToolConfig();

      removeImageFile();
      removeDocFile();
      removeAudioFile();

      const isImage = droppedFile.type.startsWith('image/');
      const isAudio = droppedFile.type.startsWith('audio/');

      if (isImage && showCamera) {
          if (validateFile(droppedFile, acceptImage)) {
              setImageFile(droppedFile);
              setImagePreviewUrl(URL.createObjectURL(droppedFile));
              return;
          } else {
              setFileError(`Invalid image type. Please use: ${acceptImage}.`);
              return;
          }
      }
      
      if (isAudio && showAudioUpload) {
          if (validateFile(droppedFile, acceptAudio)) {
              setAudioFile(droppedFile);
              return;
          } else {
              setFileError(`Invalid audio type. Please use: ${acceptAudio}.`);
              return;
          }
      }

      if (showPaperclip) {
          if (validateFile(droppedFile, acceptDoc)) {
              setDocFile(droppedFile);
              return;
          } else {
              setFileError(`Invalid document type. Please use: ${acceptDoc}.`);
              return;
          }
      }

      setFileError(`The current tool (${activeTool}) does not support this file type.`);
      return;
    }

    // Handle gallery images
    try {
      const imageDataString = e.dataTransfer.getData('application/json');
      if (!imageDataString) return;

      const image: GalleryImage = JSON.parse(imageDataString);
      const response = await fetch(`/uploads/${image.filename}`);
      const blob = await response.blob();
      const file = new File([blob], image.filename, { type: blob.type });

      removeImageFile();
      setImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
      removeDocFile();
      removeAudioFile();
      setInput(image.prompt);
    } catch (error) {
      console.error("Failed to handle dropped item from gallery:", error);
      setFileError("Failed to process dropped item from gallery.");
    }
  }, [getToolConfig, activeTool, setInput]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const { placeholder, sendDisabled: toolSendDisabled, showCamera, showPaperclip, showAudioUpload, textInputDisabled, acceptImage, acceptDoc, acceptAudio } = getToolConfig();
  const sendDisabled = toolSendDisabled || !!fileError;

  return (
    <div 
      className={`w-full border-2 border-dashed rounded-lg transition-colors ${isDraggingOver ? 'border-brand bg-brand/10' : 'border-transparent'}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {fileError && (
        <div className="flex items-center justify-between text-red-400 text-sm mb-2 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
            <div className="flex items-center gap-2">
                <AlertTriangleIcon />
                <span className="font-semibold">{fileError}</span>
            </div>
            <button 
                onClick={() => setFileError(null)}
                className="p-1 rounded-full text-red-300 hover:text-white hover:bg-red-500/30 transition-colors"
                aria-label="Dismiss error"
            >
                <CloseIcon />
            </button>
        </div>
      )}
      {(imagePreviewUrl && imageFile) && (
        <div className="relative inline-block mb-2 p-2 rounded-lg bg-[#202020] border border-accent">
          <img src={imagePreviewUrl} alt="Preview" className="max-h-32 rounded-lg" />
          <button 
            onClick={removeImageFile}
            className="absolute top-1 right-1 bg-black bg-opacity-50 rounded-full p-1 text-white hover:bg-opacity-75 transition-colors"
            aria-label="Remove image"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      )}
      {docFile && (
        <div className="relative flex items-center gap-2 mb-2 p-2 bg-accent rounded-lg text-sm">
          <PaperclipIcon/>
          <span className="truncate flex-1">{docFile.name}</span>
          <button 
            onClick={removeDocFile}
            className="p-1 text-text-secondary hover:text-text-primary"
            aria-label="Remove document"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      )}
      {audioFile && (
        <div className="relative flex items-center gap-2 mb-2 p-2 bg-accent rounded-lg text-sm">
          <AudioIcon />
          <span className="truncate flex-1">{audioFile.name}</span>
          <button 
            onClick={removeAudioFile}
            className="p-1 text-text-secondary hover:text-text-primary"
            aria-label="Remove audio file"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
        </div>
      )}
      
      <div className="w-full bg-secondary rounded-lg border border-accent focus-within:ring-2 focus-within:ring-brand transition-shadow duration-200 flex flex-col">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="w-full bg-transparent text-text-primary placeholder-text-secondary resize-none focus:outline-none p-3"
          disabled={isLoading || textInputDisabled}
        />
        
        <div className="flex items-center justify-between p-2 border-t border-accent">
          {/* Left-side action buttons */}
          <div className="flex items-center gap-1">
            {showCamera && <button
              onClick={() => imageFileInputRef.current?.click()}
              disabled={isLoading || !!docFile || !!audioFile}
              className="p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              aria-label="Upload image"
            >
              <CameraIcon />
            </button>}
            {showPaperclip && <button
              onClick={() => docFileInputRef.current?.click()}
              disabled={isLoading || !!imageFile || !!audioFile}
              className="p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              aria-label="Upload document"
            >
              <PaperclipIcon />
            </button>}
            {showAudioUpload && <button
              onClick={() => audioFileInputRef.current?.click()}
              disabled={isLoading || !!imageFile || !!docFile}
              className="p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
              aria-label="Upload audio"
            >
              <AudioIcon />
            </button>}
          </div>

          {/* Right-side action buttons */}
          <div className="flex items-center space-x-1">
            <button
                onClick={startNewChat}
                disabled={isLoading}
                className="p-2 rounded-full text-text-secondary hover:text-red-400 hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                aria-label="Clear chat"
                title="Start New Chat"
            >
                <TrashIcon />
            </button>
            {activeTool === 'VIDEO_GEN' && isImageAvailableForVideo && (
              <button
                onClick={handleUseLastImage}
                disabled={isLoading || !input.trim()}
                className="py-1 px-3 rounded-full bg-indigo-500 text-white hover:bg-indigo-600 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors duration-200 text-xs whitespace-nowrap"
                aria-label="Use Last Image for Video"
                title="Use Last Generated Image"
              >
                Use Last Image
              </button>
            )}
            {isSpeechSupported && (
                <button
                    onClick={handleToggleRecording}
                    disabled={isLoading}
                    className={`p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 ${isRecording ? 'text-red-400 animate-pulse' : ''}`}
                    aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                    >
                    {isRecording ? <StopCircleIcon /> : <MicrophoneIcon />}
                </button>
              )}
            <button
              onClick={handleSend}
              disabled={sendDisabled}
              className="p-2 rounded-full bg-brand text-white hover:bg-brand-hover disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors duration-200"
              aria-label="Send message"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <SendIcon />
              )}
            </button>
          </div>
        </div>
      </div>


      <input
          type="file"
          ref={imageFileInputRef}
          onChange={handleImageFileChange}
          className="hidden"
          accept={acceptImage || ACCEPTED_IMAGE_TYPES}
        />
        <input
          type="file"
          ref={docFileInputRef}
          onChange={handleDocFileChange}
          className="hidden"
          accept={acceptDoc || ACCEPTED_CODE_TYPES}
        />
        <input
          type="file"
          ref={audioFileInputRef}
          onChange={handleAudioFileChange}
          className="hidden"
          accept={acceptAudio || ACCEPTED_AUDIO_TYPES}
        />
    </div>
  );
};

export default MessageInput;
