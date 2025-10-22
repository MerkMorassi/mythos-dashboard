

import React, { useState, useMemo } from 'react';
import type { SavedChat } from '../types';
import { ALL_AGENTS } from '../types';
import { useChat } from '../contexts/ChatContext';
import { useTools } from '../contexts/ToolContext';
import CloseIcon from './icons/CloseIcon';

const SaveToRagModal: React.FC = () => {
    const { chatToSaveToRag, closeSaveToRagModal, handleSaveChatToRag } = useChat();
    const { customRagRepositories } = useTools();
    const [selectedRepo, setSelectedRepo] = useState('common');
    const [isLoading, setIsLoading] = useState(false);

    const availableRepositories = useMemo(() => {
        const agentRepos = ALL_AGENTS.map(agent => ({
            id: agent.id,
            name: `${agent.name} (${agent.sigil})`
        }));
        const customRepos = customRagRepositories.map(repo => ({
            id: repo.name,
            name: repo.name
        }));
        return [
            { id: 'common', name: 'Common Knowledge' },
            ...agentRepos,
            ...customRepos
        ];
    }, [customRagRepositories]);

    const handleSave = async () => {
        if (!chatToSaveToRag) return;
        setIsLoading(true);
        await handleSaveChatToRag(chatToSaveToRag, selectedRepo);
        setIsLoading(false);
    };

    if (!chatToSaveToRag) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50" onClick={closeSaveToRagModal}>
            <div className="w-full max-w-md bg-secondary rounded-lg shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
                <header className="p-4 border-b border-accent flex justify-between items-center">
                    <h2 className="text-lg font-bold text-text-primary">Save Chat to RAG</h2>
                    <button onClick={closeSaveToRagModal} className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-accent transition-colors" aria-label="Close modal">
                        <CloseIcon />
                    </button>
                </header>
                <div className="p-4 space-y-4">
                    <p>Select a knowledge base repository to save this chat to.</p>
                    <p className="text-sm bg-primary p-2 rounded-md"><strong>Chat:</strong> {chatToSaveToRag.name}</p>
                    <div>
                        <label htmlFor="repo-select" className="block text-sm font-bold text-text-secondary mb-1">Repository</label>
                        <select
                            id="repo-select"
                            value={selectedRepo}
                            onChange={(e) => setSelectedRepo(e.target.value)}
                            className="w-full bg-accent text-text-primary rounded-lg p-2 border border-accent focus:ring-2 focus:ring-brand focus:outline-none"
                        >
                            {availableRepositories.map(repo => (
                                <option key={repo.id} value={repo.id}>{repo.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <footer className="p-4 border-t border-accent flex justify-end gap-2">
                    <button onClick={closeSaveToRagModal} className="py-2 px-4 bg-accent text-text-primary font-semibold rounded-lg hover:bg-accent/70 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="py-2 px-4 bg-brand text-white font-semibold rounded-lg hover:bg-brand-hover transition-colors disabled:opacity-50"
                    >
                        {isLoading ? 'Saving...' : 'Save'}
                    </button>
                </footer>
            </div>
        </div>
    );
};

export default SaveToRagModal;
