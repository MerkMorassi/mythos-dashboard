import React, { useEffect, useState } from 'react';
import { useChat } from '../contexts/ChatContext';
import { useTools } from '../contexts/ToolContext';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import MicrophoneIcon from './icons/MicrophoneIcon';
import CloseIcon from './icons/CloseIcon';

const ConversationalUI: React.FC = () => {
  const { onToolSend, isLoading } = useChat();
  const { handleToggleConversationMode } = useTools();
  const { isListening, transcript, startListening, stopListening, isSupported, setTranscript, error } = useSpeechRecognition();
  const [hasSpoken, setHasSpoken] = useState(false);

  useEffect(() => {
    // Automatically start listening when the component mounts
    startListening();
  }, [startListening]);
  
  useEffect(() => {
    if (!isListening && transcript.trim() && hasSpoken) {
      onToolSend(transcript.trim(), null);
      setTranscript(''); // Clear transcript for next turn
    }
  }, [isListening, transcript, onToolSend, hasSpoken, setTranscript]);
  
  useEffect(() => {
      if(isListening && transcript) {
        setHasSpoken(true);
      }
  }, [isListening, transcript]);

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      setHasSpoken(false);
      startListening();
    }
  };
  
  if (!isSupported) {
    return (
      <div className="text-center text-red-400">
        Speech recognition is not supported by your browser.
        <button onClick={handleToggleConversationMode} className="ml-4 text-brand-hover underline">Exit</button>
      </div>
    );
  }

  if (error) {
    let errorMessage = `An unknown speech recognition error occurred: ${error}`;
    if (error === 'not-allowed' || error === 'service-not-allowed') {
        errorMessage = "Microphone access denied. Please enable it in your browser settings and refresh the page.";
    } else if (error === 'audio-capture') {
        errorMessage = "Could not detect your microphone. Please check your hardware and connections.";
    } else if (error === 'network') {
        errorMessage = "A network error occurred during speech recognition. Please check your connection.";
    }
    
    return (
      <div className="w-full flex flex-col items-center justify-center gap-4 text-center text-red-400">
        <p className="font-semibold">{errorMessage}</p>
        <button onClick={handleToggleConversationMode} className="mt-2 text-brand-hover underline">Exit Voice Chat</button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center justify-center gap-4">
      <div className="relative w-full h-24 bg-primary rounded-lg p-3 text-text-primary text-center flex items-center justify-center border border-accent">
        <p className="italic">{transcript || (isListening ? 'Listening...' : 'Click the mic to speak')}</p>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={handleToggleConversationMode}
          className="p-3 rounded-full bg-accent text-text-secondary hover:bg-brand-hover hover:text-white transition-colors"
          aria-label="Exit voice chat"
        >
          <CloseIcon />
        </button>
        <button
          onClick={handleMicClick}
          disabled={isLoading}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-colors
            ${isListening ? 'bg-red-500 animate-pulse' : 'bg-brand hover:bg-brand-hover'}
            ${isLoading ? 'bg-gray-600 cursor-not-allowed' : ''}
          `}
          aria-label={isListening ? 'Stop Listening' : 'Start Listening'}
        >
          <MicrophoneIcon />
        </button>
        <div className="w-12 h-12"></div>
      </div>
    </div>
  );
};

export default ConversationalUI;