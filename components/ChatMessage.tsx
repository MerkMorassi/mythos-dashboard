

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
import ThumbsUpIcon from './icons/ThumbsUpIcon';
import ThumbsDownIcon from './icons/ThumbsDownIcon';
import ImageIcon from './icons/ImageIcon';
import { useChat } from '../contexts/ChatContext';
import { useTools } from '../contexts/ToolContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface ChatMessageProps {
  message: Message;
  isSpeaking: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isSpeaking }) => {
  const [copied, setCopied] = useState(false);
  const { handleSpeak, onInitiateEdit, onFeedback } = useChat();
  const { profileImageUrls } = useTools();
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
  
  const ImagePlaceholder = () => (
    <div className="flex flex-col items-center justify-center p-8 bg-black/20 rounded-lg animate-pulse">
      <div className="text-text-secondary">
        <ImageIcon />
      </div>
      <p className="mt-2 text-sm text-text-secondary">Generating your image...</p>
    </div>
  );

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

  const iconWrapperClasses = `flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${
    isUser ? 'bg-indigo-400' : 'bg-accent'
  }`;

  const hasContent = message.content || message.imageUrl || message.videoUrl;
  const isImagePlaceholder = message.content === '...' && message.tags?.includes('image_generation_placeholder');
  const isPlaceholder = message.content === '...'; // Keep for general placeholders
  const hasFeedbackButtons = !isUser && hasContent && !isPlaceholder;
  const agentAuthorName = message.agent ? message.agent.name : 'Assistant';
  const userAuthorName = message.operator ? message.operator.name : 'User';
  const showProgressBar = typeof message.uploadProgress === 'number' && message.uploadProgress < 100;

  const renderAvatar = () => {
    if (isUser && message.operator) {
        const imageUrl = profileImageUrls.get(message.operator.id) || message.operator.profileImageUrl;
        if (imageUrl) {
            return <img src={imageUrl} alt={message.operator.name} className="w-full h-full object-cover" />;
        }
        return <UserIcon />;
    }
    if (!isUser && message.agent) {
        const imageUrl = profileImageUrls.get(message.agent.id) || message.agent.profileImageUrl;
        if (imageUrl) {
            return <img src={imageUrl} alt={message.agent.name} className="w-full h-full object-cover" />;
        }
        if (message.agent.sigil) {
             return <span className="text-xl">{message.agent.sigil}</span>;
        }
        return <BotIcon />;
    }
    // Fallbacks
    return isUser ? <UserIcon /> : <BotIcon />;
  };


  return (
    <div className={wrapperClasses}>
      {!isUser && (
        <div className={iconWrapperClasses} title={agentAuthorName}>
           {renderAvatar()}
        </div>
      )}
      
      <div className={`flex flex-col gap-2 group w-full max-w-lg lg:max-w-xl ${isUser ? 'items-end' : 'items-start'}`}>
        {isUser && message.operator && (
            <div className="text-xs text-text-secondary font-bold">{userAuthorName}</div>
        )}
        {!isUser && (
            <div className="text-xs text-text-secondary font-bold">{agentAuthorName}</div>
        )}
        <div className={`${messageClasses} w-full`}>
          {isImagePlaceholder ? (
            <ImagePlaceholder />
          ) : (
            <>
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
              {message.content && (
                <div className="markdown-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {message.content}
                  </ReactMarkdown>
                </div>
              )}
            </>
          )}
          {showProgressBar && (
            <div className="mt-2 h-2 w-full bg-accent rounded-full overflow-hidden">
                <div 
                    className="h-full bg-brand rounded-full transition-all duration-300 ease-linear" 
                    style={{ width: `${message.uploadProgress}%` }}
                ></div>
            </div>
          )}
          {message.tags && message.tags.length > 0 && !isImagePlaceholder && (
              <div className="mt-3 pt-2 border-t border-accent/50">
                  <div className="flex flex-wrap gap-2">
                      {message.tags.map((tag, index) => (
                          <span key={index} className="bg-accent text-text-primary text-xs font-semibold px-2.5 py-1 rounded-full">
                              {tag}
                          </span>
                      ))}
                  </div>
              </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isUser && message.content && !isPlaceholder && (
            <>
              <button
                onClick={() => handleSpeak(message)}
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
          {hasFeedbackButtons && (
            <div className="flex items-center gap-1 border-l border-accent pl-2 ml-2">
                <button
                    onClick={() => onFeedback(message.id, 'like')}
                    className={`p-1 rounded-full hover:bg-accent transition-colors ${message.feedback === 'like' ? 'text-green-400' : 'text-text-secondary'}`}
                    aria-label="Like response"
                >
                    <ThumbsUpIcon />
                </button>
                 <button
                    onClick={() => onFeedback(message.id, 'dislike')}
                    className={`p-1 rounded-full hover:bg-accent transition-colors ${message.feedback === 'dislike' ? 'text-red-400' : 'text-text-secondary'}`}
                    aria-label="Dislike response"
                >
                    <ThumbsDownIcon />
                </button>
            </div>
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
          {renderAvatar()}
        </div>
      )}
    </div>
  );
};

export default ChatMessage;