import React, { useState, useEffect, useMemo } from 'react';
import { useChat } from '../contexts/ChatContext';
import { useTools } from '../contexts/ToolContext';
import CloseIcon from './icons/CloseIcon';
import SearchIcon from './icons/SearchIcon';

const ChatHistoryPanel: React.FC = () => {
  const { 
    savedChats, 
    saveCurrentChat, 
    loadChat, 
    deleteChat, 
    startNewChat,
    currentChatId 
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
        const messageMatch = chat.messages.some(message =>
            (message.role === 'user' || message.role === 'model') && 
            message.content && 
            !message.isError &&
            message.content.toLowerCase().includes(lowercasedTerm)
        );
        return nameMatch || messageMatch;
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
                    className="w-full py-2 px-4 bg-brand text-white font-semibold rounded-lg hover:bg-brand-hover transition-colors"
                >
                    {currentChatId ? 'Update Current Chat' : 'Save Current Chat'}
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
                    placeholder="Search by name or content..."
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
                    {filteredChats.map(chat => (
                        <li key={chat.id} className={`p-3 rounded-lg flex flex-col transition-colors ${chat.id === currentChatId ? 'bg-brand/20 border border-brand' : 'bg-primary'}`}>
                            <div className="flex justify-between items-start">
                                <div className="flex-1 overflow-hidden">
                                    <p className="font-semibold text-text-primary truncate" title={chat.name}>{chat.name}</p>
                                    <p className="text-xs text-text-secondary">
                                        {new Date(chat.timestamp).toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
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
                            </div>
                        </li>
                    ))}
                </ul>
            )}
          </div>
      </div>
    </div>
  );
};

export default ChatHistoryPanel;