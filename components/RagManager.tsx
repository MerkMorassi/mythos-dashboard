

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { RagDocument, Agent } from '../types';
import { ALL_AGENTS } from '../types';
import { fetchRagDocuments, uploadRagDocument, deleteRagDocument } from '../services/geminiService';
import CloseIcon from './icons/CloseIcon';
import UploadIcon from './icons/UploadIcon';

const RagManager: React.FC = () => {
    const [repository, setRepository] = useState('common');
    const [documents, setDocuments] = useState<RagDocument[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

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

        setIsLoading(true);
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
    
    const repositories = [{ id: 'common', name: 'Common Knowledge' }, ...ALL_AGENTS];

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
                <aside className="w-64 bg-secondary p-4 border-r border-accent overflow-y-auto">
                    <h2 className="text-md font-semibold mb-3 text-text-secondary">Repositories</h2>
                    <ul className="space-y-1">
                        {repositories.map(repo => (
                            <li key={repo.id}>
                                <button
                                    onClick={() => setRepository(repo.id)}
                                    className={`w-full text-left p-2 rounded-md text-sm transition-colors ${repository === repo.id ? 'bg-brand text-white' : 'hover:bg-accent text-text-primary'}`}
                                >
                                    {repo.name} {repo.id !== 'common' && `(${(repo as Agent).sigil})`}
                                </button>
                            </li>
                        ))}
                    </ul>
                </aside>

                <main className="flex-1 p-4 overflow-y-auto">
                    <h2 className="text-xl font-bold mb-4">
                        Documents in <span className="text-brand-hover">{repositories.find(r => r.id === repository)?.name}</span>
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