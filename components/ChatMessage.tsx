
import React, { useState } from 'react';
import type { ChatMessage as Message } from '../types';
import { MessageRole } from '../types';
import BotIcon from './icons/BotIcon';
import UserIcon from './icons/UserIcon';
import SpeakerIcon from './icons/SpeakerIcon';
import FileIcon from './icons/FileIcon';
import WarningIcon from './icons/WarningIcon';
import CopyIcon from './icons/CopyIcon';
import EditIcon from './icons/EditIcon';
import CheckIcon from './icons/CheckIcon';

interface ChatMessageProps {
  message: Message;
  onSpeak: (message: Message) => void;
  isSpeaking: boolean;
  onInitiateEdit: (text: string) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onSpeak, isSpeaking, onInitiateEdit }) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === MessageRole.USER;

  if (!isUser && message.rejectionLevel && message.rejectionLevel > 0) {
    // Special rendering for rejection messages: only show the icon.
    return (
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-secondary">
          <WarningIcon level={message.rejectionLevel as 1 | 2} />
        </div>
      </div>
    );
  }

  const handleCopy = () => {
    // Copy the original markdown content
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
    });
  };

  const wrapperClasses = `flex items-start gap-4 ${isUser ? 'justify-end' : ''}`;
  const messageClasses = `rounded-lg p-4 max-w-lg lg:max-w-xl ${
    isUser
      ? 'bg-brand text-white'
      : 'bg-secondary text-text-primary'
  } ${message.isError ? 'border border-red-500' : ''}`;

  const Icon = isUser ? UserIcon : BotIcon;
  const iconWrapperClasses = `flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
    isUser ? 'bg-indigo-400' : 'bg-accent'
  }`;

  return (
    <div className={wrapperClasses}>
      {!isUser && (
        <div className={iconWrapperClasses}>
          <Icon />
        </div>
      )}
      
      <div className="flex flex-col items-start gap-2 group">
        <div className={messageClasses}>
          {message.videoUrl && (
            <div className="mb-2 rounded-md bg-[#202020] border border-accent overflow-hidden">
                <video src={message.videoUrl} controls className="w-full"></video>
            </div>
          )}
          {message.imageUrl && (
             <div className="mb-2 p-1 rounded-md bg-[#202020] border border-accent inline-block">
               <img 
                 src={message.imageUrl} 
                 alt="User upload" 
                 className="rounded-md max-w-full h-auto"
               />
             </div>
          )}
          {message.fileName && (
            <div className="rounded-md mb-2 p-3 bg-black bg-opacity-20 flex items-center text-sm">
              <FileIcon />
              <span className="truncate">{message.fileName}</span>
            </div>
          )}
          {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}
        </div>

        <div className="flex items-center gap-2">
          {!isUser && message.content && (
            <>
              <button
                onClick={() => onSpeak(message)}
                className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-accent transition-colors"
                aria-label={isSpeaking ? "Stop speaking" : "Read message aloud"}
              >
                <SpeakerIcon isSpeaking={isSpeaking} />
              </button>
              <button
                onClick={handleCopy}
                className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-accent transition-colors"
                aria-label={copied ? "Copied" : "Copy message"}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </button>
            </>
          )}
          {isUser && message.content && (
            <button
              onClick={() => onInitiateEdit(message.content)}
              className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-accent transition-colors opacity-0 group-hover:opacity-100"
              aria-label="Edit message"
            >
              <EditIcon />
            </button>
          )}
        </div>
      </div>

      {isUser && (
        <div className={iconWrapperClasses}>
          <Icon />
        </div>
      )}
    </div>
  );
};

export default ChatMessage;