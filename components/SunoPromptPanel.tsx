

import React, { useState, useRef, useEffect } from 'react';
import type { Agent } from '../types';
import { MUSIC_AGENTS } from '../types';
import CloseIcon from './icons/CloseIcon';
import CopyIcon from './icons/CopyIcon';
import CheckIcon from './icons/CheckIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import UploadIcon from './icons/UploadIcon';
import AnalyzeIcon from './icons/AnalyzeIcon';

interface SunoPromptPanelProps {
  formData: {
    lyrics: string;
    style: string;
    title: string;
    instrumental: boolean;
  };
  setFormData: (data: SunoPromptPanelProps['formData']) => void;
  onGenerate: () => void;
  onClose: () => void;
  onAnalyzeAudio: (file: File) => Promise<void>;
  onGenerateLyrics: (topic: string, agentId: string) => Promise<void>;
}

const SunoPromptPanel: React.FC<SunoPromptPanelProps> = ({ 
    formData, setFormData, onGenerate, onClose, onAnalyzeAudio, onGenerateLyrics
}) => {
  const [copied, setCopied] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [guideContent, setGuideContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lyricTopic, setLyricTopic] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string>(MUSIC_AGENTS[0].id);
  const [isDragging, setIsDragging] = useState(false);

  const audioInputRef = useRef<HTMLInputElement>(null);
  const lyricsInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/suno_reference.md')
      .then(res => res.text())
      .then(text => setGuideContent(text))
      .catch(err => console.error("Failed to load Suno guide:", err));
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isCheckbox = type === 'checkbox';
    setFormData({ 
      ...formData, 
      [name]: isCheckbox ? (e.target as HTMLInputElement).checked : value 
    });
  };
  
  const handleGenerateClick = () => {
    onGenerate();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAudioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        setIsAnalyzing(true);
        await onAnalyzeAudio(file);
        setIsAnalyzing(false);
    }
  };

  const handleLyricsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            setFormData({...formData, lyrics: text});
        };
        reader.readAsText(file);
    }
  };

  const handleGenerateLyricsClick = async () => {
    if (!lyricTopic) return;
    setIsGenerating(true);
    await onGenerateLyrics(lyricTopic, selectedAgent);
    setIsGenerating(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('audio/')) {
        setIsAnalyzing(true);
        await onAnalyzeAudio(file);
        setIsAnalyzing(false);
    }
  };

  return (
    <aside className="w-full h-full bg-secondary flex flex-col">
       <input type="file" ref={audioInputRef} onChange={handleAudioFileChange} className="hidden" accept=".mp3,.wav" />
       <input type="file" ref={lyricsInputRef} onChange={handleLyricsFileChange} className="hidden" accept=".txt,.md" />
      <div className="p-4 border-b border-accent flex justify-between items-center flex-shrink-0">
        <h2 className="text-lg font-semibold text-text-primary">Suno Assistant</h2>
        <button
          onClick={onClose}
          className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-accent transition-colors"
          aria-label="Close Suno prompt builder"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        
        {/* --- Guide --- */}
        <div>
            <button onClick={() => setIsGuideOpen(!isGuideOpen)} className="flex items-center justify-between w-full text-sm font-bold text-text-secondary mb-1 hover:text-text-primary">
                <span>Suno Prompting Guide</span>
                <ChevronRightIcon className={`w-4 h-4 transition-transform ${isGuideOpen ? 'rotate-90' : ''}`} />
            </button>
            {isGuideOpen && (
                <div className="p-3 bg-accent/50 rounded-lg text-xs prose prose-sm prose-invert text-text-secondary max-w-none whitespace-pre-wrap">
                    {guideContent || 'Loading guide...'}
                </div>
            )}
        </div>

        {/* --- Style --- */}
        <div 
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`p-3 rounded-lg transition-all duration-200 ${isDragging ? 'bg-brand/20 border-2 border-dashed border-brand-hover' : 'border-2 border-transparent'}`}
        >
          <label htmlFor="style" className="block text-sm font-bold text-text-secondary mb-1">Style of Music (or drop audio file)</label>
          <textarea
            id="style"
            name="style"
            value={formData.style}
            onChange={handleInputChange}
            rows={4}
            className="w-full bg-accent text-text-primary placeholder-text-secondary rounded-lg p-2 resize-y border border-accent focus:ring-2 focus:ring-brand focus:outline-none"
            placeholder="e.g., Acoustic pop, sentimental, female vocals, piano, strings, slow tempo, emotional"
          />
           <button onClick={() => audioInputRef.current?.click()} disabled={isAnalyzing} className="w-full mt-2 text-sm flex items-center justify-center py-2 px-4 bg-accent text-text-primary font-semibold rounded-lg hover:bg-brand-hover transition-colors disabled:opacity-50">
               {isAnalyzing ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><AnalyzeIcon /><span className="ml-2">Analyze Style from Audio</span></>}
           </button>
        </div>
        
        {/* --- Lyrics --- */}
        <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="lyrics" className="block text-sm font-bold text-text-secondary">Lyrics</label>
              <button onClick={() => lyricsInputRef.current?.click()} className="text-sm flex items-center text-brand-hover hover:text-text-primary font-semibold">
                <UploadIcon /> <span className="ml-1">Upload</span>
              </button>
            </div>
            <textarea
                id="lyrics"
                name="lyrics"
                value={formData.lyrics}
                onChange={handleInputChange}
                rows={8}
                className="w-full bg-accent text-text-primary placeholder-text-secondary rounded-lg p-2 resize-y border border-accent focus:ring-2 focus:ring-brand focus:outline-none"
                placeholder={`[Verse]
Chand bhi hai khafa
Raaton mein roti hoon
...`}
            />
        </div>
        
        {/* --- AI Lyric Generation --- */}
        <div className="p-3 bg-accent/50 rounded-lg space-y-2">
            <label className="block text-sm font-bold text-text-secondary">Generate Lyrics with AI</label>
            <input
                type="text"
                value={lyricTopic}
                onChange={(e) => setLyricTopic(e.target.value)}
                className="w-full bg-primary text-text-primary placeholder-text-secondary rounded-lg p-2 border border-accent focus:ring-2 focus:ring-brand focus:outline-none"
                placeholder="Enter a topic..."
            />
            <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="w-full bg-primary text-text-primary rounded-lg p-2 border border-accent focus:ring-2 focus:ring-brand focus:outline-none"
            >
                {MUSIC_AGENTS.map(agent => (
                    <option key={agent.id} value={agent.id}>{agent.name} ({agent.specialty})</option>
                ))}
            </select>
            <button onClick={handleGenerateLyricsClick} disabled={isGenerating || !lyricTopic} className="w-full mt-2 text-sm flex items-center justify-center py-2 px-4 bg-accent text-text-primary font-semibold rounded-lg hover:bg-brand-hover transition-colors disabled:opacity-50">
                {isGenerating ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <span>Generate</span>}
            </button>
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-bold text-text-secondary mb-1">Title</label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            className="w-full bg-accent text-text-primary placeholder-text-secondary rounded-lg p-2 border border-accent focus:ring-2 focus:ring-brand focus:outline-none"
            placeholder="Optional song title"
          />
        </div>

        <div className="flex items-center">
            <input
                type="checkbox"
                id="instrumental"
                name="instrumental"
                checked={formData.instrumental}
                onChange={handleInputChange}
                className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand"
            />
            <label htmlFor="instrumental" className="ml-2 block text-sm text-text-primary">
                Instrumental
            </label>
        </div>
      </div>
      <div className="p-4 border-t border-accent mt-auto">
        <button
          onClick={handleGenerateClick}
          className="w-full py-2 px-4 bg-brand text-white font-semibold rounded-lg hover:bg-brand-hover transition-colors flex items-center justify-center"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span className="ml-2">{copied ? 'Copied! Opening Suno...' : 'Copy Prompt & Open Suno'}</span>
        </button>
      </div>
    </aside>
  );
};

export default SunoPromptPanel;
