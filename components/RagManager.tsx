

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { RagDocument, Agent } from '../types';
import { ALL_AGENTS } from '../types';
import { fetchRagDocuments, uploadRagDocument, deleteRagDocument } from '../services/geminiService';
import CloseIcon from './icons/CloseIcon';
import UploadIcon from './icons/UploadIcon';
import { useAgents } from '../contexts/AgentsContext';
import { useTools } from '../contexts/ToolContext';
import AddIcon from './icons/AddIcon';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const RagManager: React.FC = () => {
    const { activeAgents } = useAgents();
    // FIX: The properties are named ragRepository and setRagRepository in the context. Use aliasing.
    const { 
      ragRepository: repository, 
      setRagRepository: setRepository,
      customRagRepositories,
      handleCreateRagRepository,
      handleDeleteRagRepository,
    } = useTools();

    const [documents, setDocuments] = useState<RagDocument[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [newRepoName, setNewRepoName] = useState('');
    const [newRepoAgentId, setNewRepoAgentId] = useState<string>('');
    const [isCreatingRepo, setIsCreatingRepo] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const loadDocuments = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const docs = await fetchRagDocuments(repository);
            setDocuments(docs);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load documents.';
            setError(message);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [repository]);

    useEffect(() => {
        loadDocuments();
    }, [loadDocuments]);

    const filteredDocuments = useMemo(() => {
        if (!searchTerm) {
            return documents;
        }
        const lowercasedTerm = searchTerm.toLowerCase();
        return documents.filter(doc =>
            doc.original_filename.toLowerCase().includes(lowercasedTerm) ||
            doc.content.toLowerCase().includes(lowercasedTerm)
        );
    }, [documents, searchTerm]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > MAX_FILE_SIZE) {
            setError(`File is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
            if (fileInputRef.current) {
                fileInputRef.current.value = ''; // Reset file input
            }
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const newDoc = await uploadRagDocument(repository, file);
            setDocuments(prev => [newDoc, ...prev]); // Add to top of list
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to upload document.';
            setError(message);
            console.error(err);
        } finally {
            setIsLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = ''; // Reset file input
            }
        }
    };

    const handleDelete = async (docId: number) => {
        if (!window.confirm('Are you sure you want to delete this document?')) return;
        
        const originalDocuments = documents;
        setDocuments(prev => prev.filter(doc => doc.id !== docId)); // Optimistic update
        try {
            await deleteRagDocument(docId);
        } catch (err) {
            setDocuments(originalDocuments); // Revert on error
            const message = err instanceof Error ? err.message : 'Failed to delete document.';
            setError(message);
            console.error(err);
        }
    };
    
    const handleAddRepo = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = newRepoName.trim();
        if (!trimmedName || isCreatingRepo) return;

        if (['common', ...ALL_AGENTS.map(a => a.id)].includes(trimmedName)) {
            setError('This is a reserved repository name.');
            return;
        }
        if (customRagRepositories.some(r => r.name === trimmedName)) {
            setError('A custom repository with this name already exists.');
            return;
        }

        setIsCreatingRepo(true);
        setError(null);
        try {
            await handleCreateRagRepository(trimmedName, newRepoAgentId || undefined);
            setNewRepoName('');
            setNewRepoAgentId('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create repository.');
        } finally {
            setIsCreatingRepo(false);
        }
    };

    const handleDeleteRepo = async (e: React.MouseEvent, name: string) => {
        e.stopPropagation();
        if (window.confirm(`Are you sure you want to delete the "${name}" repository and all its documents? This action cannot be undone.`)) {
            setError(null);
            try {
                await handleDeleteRagRepository(name);
                if (repository === name) {
                    setRepository('common');
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to delete repository.');
            }
        }
    };
    
    const repositoryNote = useMemo(() => {
        if (activeAgents.size === 1) {
            const agentId = activeAgents.values().next().value;
            const agent = ALL_AGENTS.find(r => r.id === agentId);
            return `Defaulting to active agent: ${agent?.name || ''}`;
        }
        if (activeAgents.size > 1) {
            return `Multiple agents active. Defaulting to Common Knowledge.`;
        }
        return 'No agents active. Defaulting to Common Knowledge.';
    }, [activeAgents]);
    
    const currentRepo = useMemo(() => {
        if (repository === 'common') return { name: 'Common Knowledge' };
        return ALL_AGENTS.find(a => a.id === repository) || customRagRepositories.find(r => r.name === repository);
    }, [repository, customRagRepositories]);

    return (
        <div className="flex flex-col h-full text-text-primary bg-primary">
            <input type="file" ref={fileInputRef} onChange={handleUpload} className="hidden" accept=".txt,.md" />
            
            <header className="p-4 border-b border-accent flex-shrink-0 flex items-center gap-4">
                <h1 className="text-lg font-bold">RAG Document Manager</h1>
                <div className="flex-grow"></div>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="flex items-center gap-2 py-2 px-4 bg-brand text-white font-semibold rounded-lg hover:bg-brand-hover transition-colors disabled:opacity-50"
                >
                    <UploadIcon />
                    <span>Upload to Current Repo</span>
                </button>
            </header>
            
            <div className="flex flex-1 overflow-hidden">
                <aside className="w-64 bg-secondary p-4 border-r border-accent flex flex-col">
                    <div className="flex-grow overflow-y-auto">
                        <h2 className="text-md font-semibold mb-1 text-text-secondary">Repositories</h2>
                        <p className="text-xs text-text-secondary mb-3 italic">{repositoryNote}</p>
                        
                        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 mt-2">System</h3>
                        <ul className="space-y-1">
                            <li>
                                <button
                                    onClick={() => setRepository('common')}
                                    className={`w-full text-left p-2 rounded-md text-sm transition-colors ${repository === 'common' ? 'bg-brand text-white' : 'hover:bg-accent text-text-primary'}`}
                                >
                                    Common Knowledge
                                </button>
                            </li>
                            {ALL_AGENTS.map(repo => (
                                <li key={repo.id}>
                                    <button
                                        onClick={() => setRepository(repo.id)}
                                        className={`w-full text-left p-2 rounded-md text-sm transition-colors ${repository === repo.id ? 'bg-brand text-white' : 'hover:bg-accent text-text-primary'}`}
                                    >
                                        {repo.name} {repo.id !== 'common' && `(${repo.sigil})`}
                                    </button>
                                </li>
                            ))}
                        </ul>

                        <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 mt-4">Custom</h3>
                        {customRagRepositories.length > 0 ? (
                            <ul className="space-y-1">
                                {customRagRepositories.map(repo => {
                                    const associatedAgent = repo.agent_id ? ALL_AGENTS.find(a => a.id === repo.agent_id) : null;
                                    return (
                                    <li key={repo.name}>
                                        <button
                                            onClick={() => setRepository(repo.name)}
                                            className={`w-full p-2 rounded-md transition-colors group flex justify-between items-center ${repository === repo.name ? 'bg-brand text-white' : 'hover:bg-accent text-text-primary'}`}
                                        >
                                             <div className="flex-grow text-left overflow-hidden">
                                                <span className="truncate block text-sm">{repo.name}</span>
                                                {associatedAgent && (
                                                    <span className={`text-xs truncate block ${repository === repo.name ? 'text-gray-200' : 'text-text-secondary'}`}>
                                                        Linked: {associatedAgent.name}
                                                    </span>
                                                )}
                                            </div>
                                            <span
                                                onClick={(e) => handleDeleteRepo(e, repo.name)}
                                                className="p-1 text-red-500 hover:bg-red-500/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2"
                                                title="Delete Repository"
                                            >
                                                <CloseIcon />
                                            </span>
                                        </button>
                                    </li>
                                )})}
                            </ul>
                        ) : (
                            <p className="text-xs text-text-secondary italic">No custom repositories.</p>
                        )}
                    </div>
                    
                    <form onSubmit={handleAddRepo} className="mt-auto pt-4 border-t border-accent flex-shrink-0 flex flex-col gap-2">
                        <label className="text-sm font-semibold text-text-secondary block">New Repository</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newRepoName}
                                onChange={(e) => setNewRepoName(e.target.value)}
                                placeholder="Repository name..."
                                className="flex-grow bg-accent text-text-primary rounded-md p-2 text-sm border border-transparent focus:ring-2 focus:ring-brand focus:outline-none"
                            />
                            <button
                                type="submit"
                                disabled={isCreatingRepo || !newRepoName.trim()}
                                className="p-2 bg-brand text-white rounded-md hover:bg-brand-hover disabled:opacity-50"
                                aria-label="Add new repository"
                            >
                                {isCreatingRepo ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <AddIcon />}
                            </button>
                        </div>
                         <div>
                            <label htmlFor="agent-select" className="text-xs text-text-secondary mb-1 block">Associate with Agent (Optional)</label>
                            <select
                                id="agent-select"
                                value={newRepoAgentId}
                                onChange={(e) => setNewRepoAgentId(e.target.value)}
                                className="w-full bg-accent text-text-primary rounded-md p-2 text-sm border border-transparent focus:ring-2 focus:ring-brand focus:outline-none"
                            >
                                <option value="">None</option>
                                {ALL_AGENTS.map(agent => (
                                    <option key={agent.id} value={agent.id}>
                                        {agent.name} ({agent.sigil})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </form>
                </aside>

                <main className="flex-1 p-4 overflow-y-auto">
                    <h2 className="text-xl font-bold mb-4">
                        Documents in <span className="text-brand-hover">{currentRepo?.name}</span>
                    </h2>
                    
                    <div className="mb-4">
                        <input
                            type="text"
                            placeholder="Search by filename or content..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-primary text-text-primary placeholder-text-secondary rounded-lg p-3 border border-accent focus:ring-2 focus:ring-brand focus:outline-none"
                        />
                    </div>
                    
                    {error && <p className="text-red-500 bg-red-500/10 p-3 rounded-md">{error}</p>}
                    
                    {isLoading ? (
                        <p className="text-text-secondary">Loading documents...</p>
                    ) : documents.length === 0 ? (
                        <p className="text-text-secondary">No documents in this repository.</p>
                    ) : filteredDocuments.length === 0 ? (
                        <p className="text-text-secondary">No documents match your search.</p>
                    ) : (
                        <div className="space-y-2">
                            {filteredDocuments.map(doc => (
                                <div key={doc.id} className="bg-secondary p-3 rounded-md flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold">{doc.original_filename}</p>
                                        <p className="text-xs text-text-secondary">Added: {new Date(doc.created_at).toLocaleString()}</p>
                                    </div>
                                    <button 
                                        onClick={() => handleDelete(doc.id)}
                                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-full"
                                        aria-label="Delete document"
                                    >
                                        <CloseIcon />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default RagManager;
