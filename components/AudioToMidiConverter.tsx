

import React, { useState, useRef } from 'react';
import { convertAudioToMidi } from '../services/geminiService';
import UploadIcon from './icons/UploadIcon';
import MidiIcon from './icons/MidiIcon';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const AudioToMidiConverter: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [projectName, setProjectName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resultUrl, setResultUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.size > MAX_FILE_SIZE) {
                setError(`File is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
                setFile(null);
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
                return;
            }
            setError(null); // Clear errors on valid file selection
            setFile(selectedFile);
            setResultUrl(null); // Reset result on new file
        }
    };

    const handleConvert = async () => {
        if (!file || !projectName) {
            setError('Please provide an audio file and a project name.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setResultUrl(null);
        try {
            const result = await convertAudioToMidi(file, projectName);
            setResultUrl(result.downloadUrl);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred during conversion.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const isButtonDisabled = !file || !projectName || isLoading;

    return (
        <div className="flex flex-col h-full text-text-primary bg-primary items-center justify-center p-4">
            <div className="w-full max-w-lg bg-secondary p-8 rounded-xl shadow-lg border border-accent">
                <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-accent rounded-lg">
                        <MidiIcon />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-text-primary">Audio to MIDI Converter</h1>
                        <p className="text-text-secondary">Convert audio stems to MIDI data using AI.</p>
                    </div>
                </div>

                {error && <div className="bg-red-500/10 text-red-400 p-3 rounded-md mb-4 text-sm">{error}</div>}
                
                <div className="space-y-4">
                    <div>
                        <label htmlFor="projectName" className="block text-sm font-bold text-text-secondary mb-1">Project / Song Title</label>
                        <input
                            type="text"
                            id="projectName"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                            placeholder="e.g., My New Song Idea"
                            className="w-full bg-accent text-text-primary placeholder-text-secondary rounded-lg p-3 border border-accent focus:ring-2 focus:ring-brand focus:outline-none"
                        />
                    </div>

                    <div>
                         <label htmlFor="audioFile" className="block text-sm font-bold text-text-secondary mb-1">Audio Stem (.wav, .mp3)</label>
                         <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-colors bg-accent hover:border-brand-hover hover:bg-brand/10"
                         >
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".mp3,.wav" />
                            <UploadIcon />
                            {file ? (
                                <p className="text-text-primary mt-2">{file.name}</p>
                            ) : (
                                <p className="text-text-secondary mt-2">Click or drop audio file here</p>
                            )}
                         </div>
                    </div>
                    
                    <button
                        onClick={handleConvert}
                        disabled={isButtonDisabled}
                        className="w-full py-3 px-4 bg-brand text-white font-semibold rounded-lg hover:bg-brand-hover transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            <span>Convert to MIDI</span>
                        )}
                    </button>

                    {resultUrl && (
                        <div className="bg-green-500/10 text-green-300 p-4 rounded-md text-center">
                            <p className="font-semibold mb-2">Conversion Successful!</p>
                            <a 
                                href={resultUrl} 
                                download 
                                className="inline-block py-2 px-6 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500 transition-colors"
                            >
                                Download MIDI (.json)
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AudioToMidiConverter;
