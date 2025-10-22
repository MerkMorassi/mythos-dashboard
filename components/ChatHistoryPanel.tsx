import React, { useState, useEffect, useMemo } from 'react';
import { useChat } from '../contexts/ChatContext';
import { useTools } from '../contexts/ToolContext';
import { ALL_AGENTS } from '../types';
import CloseIcon from './icons/CloseIcon';
import SearchIcon from './icons/SearchIcon';
import SaveToDbIcon from './icons/SaveToDbIcon';

const ChatHistoryPanel: React.FC = () => {
  const { 
    savedChats, 
    saveCurrentChat, 
    loadChat, 
    deleteChat, 
    startNewChat,
    currentChatId,
    openSaveToRagModal,
    isSavingChat,
  } = useChat();
  const { setRightPanelContent } = useTools();
  
  const currentChat = savedChats.find(c => c.id === currentChatId);
  const [chatName, setChatName] = useState(currentChat?.name || '');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setChatName(currentChat?.name || '');
  }, [currentChat]);

  const handleSave = () => {
    saveCurrentChat(chatName);
  };
  
  const handleLoad = (chatId: string) => {
    loadChat(chatId);
    setRightPanelContent(null);
  };

  const filteredChats = useMemo(() => {
    if (!searchTerm.trim()) {
        return savedChats;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    return savedChats.filter(chat => {
        const nameMatch = chat.name.toLowerCase().includes(lowercasedTerm);
        const summaryMatch = chat.summary?.toLowerCase().includes(lowercasedTerm);
        const tagsMatch = chat.tags?.some(tag => tag.toLowerCase().includes(lowercasedTerm));
        const messageMatch = chat.messages.some(message =>
            (message.role === 'user' || message.role === 'model') && 
            message.content && 
            !message.isError &&
            message.content.toLowerCase().includes(lowercasedTerm)
        );
        return nameMatch || summaryMatch || tagsMatch || messageMatch;
    });
  }, [savedChats, searchTerm]);

  return (
    <div className="w-full h-full bg-secondary flex flex-col">
      <div className="p-4 border-b border-accent flex justify-between items-center flex-shrink-0">
        <h2 className="text-lg font-semibold text-text-primary">Chat History</h2>
        <button
          onClick={() => setRightPanelContent(null)}
          className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-accent transition-colors"
          aria-label="Close chat history"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-2">
             <button
                onClick={startNewChat}
                className="w-full py-2 px-4 bg-accent text-text-primary font-semibold rounded-lg hover:bg-brand-hover transition-colors"
            >
                Start New Chat
            </button>
            <div className="p-3 bg-primary rounded-lg space-y-2">
                <input
                    type="text"
                    value={chatName}
                    onChange={(e) => setChatName(e.target.value)}
                    placeholder="Enter chat name..."
                    className="w-full bg-accent text-text-primary placeholder-text-secondary rounded-lg p-2 border border-accent focus:ring-2 focus:ring-brand focus:outline-none"
                />
                 <button
                    onClick={handleSave}
                    disabled={isSavingChat}
                    className="w-full py-2 px-4 bg-brand text-white font-semibold rounded-lg hover:bg-brand-hover transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                    {isSavingChat ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                            Analyzing & Saving...
                        </>
                    ) : (
                        currentChatId ? 'Update Current Chat' : 'Save Current Chat'
                    )}
                </button>
            </div>
          </div>
          
          <div>
            <h3 className="text-md font-semibold text-text-secondary mb-2">Saved Sessions</h3>

            <div className="relative mb-4">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none">
                    <SearchIcon />
                </div>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name, summary, tag..."
                    className="w-full bg-primary text-text-primary placeholder-text-secondary rounded-lg p-2 pl-10 border border-accent focus:ring-2 focus:ring-brand focus:outline-none"
                />
                {searchTerm && (
                    <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-secondary hover:text-text-primary"
                        aria-label="Clear search"
                    >
                        <CloseIcon />
                    </button>
                )}
            </div>
            
            {savedChats.length === 0 ? (
                <p className="text-sm text-text-secondary text-center italic">No saved chats yet.</p>
            ) : filteredChats.length === 0 ? (
                <p className="text-sm text-text-secondary text-center italic">No chats match your search.</p>
            ) : (
                <ul className="space-y-2">
                    {filteredChats.map(chat => {
                        const agentIds = chat.agentIds || [];
                        const agentsInChat = ALL_AGENTS.filter(a => agentIds.includes(a.id));
                        return (
                            <li key={chat.id} className={`p-3 rounded-lg flex flex-col transition-colors ${chat.id === currentChatId ? 'bg-brand/20 border border-brand' : 'bg-primary'}`}>
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 overflow-hidden">
                                        <p className="font-semibold text-text-primary truncate" title={chat.name}>{chat.name}</p>
                                        <p className="text-xs text-text-secondary">
                                            {new Date(chat.timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                        {agentsInChat.map(agent => (
                                            <div key={agent.id} title={agent.name} className="w-5 h-5 rounded-full bg-accent text-xs flex items-center justify-center">
                                                {agent.sigil}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {chat.summary && <p className="text-xs text-text-secondary italic mt-2 truncate">{chat.summary}</p>}
                                
                                {chat.tags && chat.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {chat.tags.slice(0, 5).map(tag => (
                                            <span key={tag} className="bg-accent text-text-secondary text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                                
                                <div className="flex items-center gap-1 self-end mt-2">
                                    <button
                                        onClick={() => openSaveToRagModal(chat)}
                                        className="p-2 text-text-secondary hover:text-text-primary hover:bg-accent rounded-full"
                                        aria-label={`Save chat to RAG: ${chat.name}`}
                                        title="Save to RAG"
                                    >
                                        <SaveToDbIcon />
                                    </button>
                                    <button
                                        onClick={() => handleLoad(chat.id)}
                                        className="py-1 px-3 text-xs bg-accent rounded-md hover:bg-brand-hover"
                                        aria-label={`Load chat: ${chat.name}`}
                                    >
                                        Load
                                    </button>
                                     <button
                                        onClick={() => deleteChat(chat.id)}
                                        className="p-1 text-red-500 hover:bg-red-500/10 rounded-full"
                                        aria-label={`Delete chat: ${chat.name}`}
                                    >
                                        <CloseIcon />
                                    </button>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            )}
          </div>
      </div>
    </div>
  );
};

export default ChatHistoryPanel;