import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Agent, TrainingSample } from '../types';
import { addTrainingSample, deleteTrainingSample, getTrainingSamplesForAgent, updateTrainingSampleTranscript } from '../services/dbService';
import { transcribeAudioSample } from '../services/geminiService';
import CloseIcon from './icons/CloseIcon';
import UploadIcon from './icons/UploadIcon';
import FileIcon from './icons/FileIcon';

interface AgentVoiceModalProps {
  agent: Agent;
  onClose: () => void;
  onDataUpdate: () => void; // To refresh the main app's sample list
}

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB for large training samples
const ACCEPTED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp3', 'audio/x-wav', 'audio/flac'];

const AgentVoiceModal: React.FC<AgentVoiceModalProps> = ({ agent, onClose, onDataUpdate }) => {
  const [samples, setSamples] = useState<TrainingSample[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [transcribingId, setTranscribingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [editedTranscripts, setEditedTranscripts] = useState<Record<number, string>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadSamples = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedSamples = await getTrainingSamplesForAgent(agent.id);
      setSamples(fetchedSamples);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load training samples.');
    } finally {
      setIsLoading(false);
    }
  }, [agent.id]);

  useEffect(() => {
    loadSamples();
  }, [loadSamples]);

  const handleFileUpload = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
        setError(`File is too large. Max size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
        return;
    }
    setError(null);
    setIsLoading(true);
    try {
        const newSample = await addTrainingSample({
            agent_id: agent.id,
            filename: file.name,
            original_filename: file.name,
            blob: file
        });
        setSamples(prev => [...prev, newSample]);
        onDataUpdate();
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to upload file.');
    } finally {
        setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    if (e.target) e.target.value = ''; // Reset input
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };
  
  const handleDeleteSample = async (sampleId: number) => {
    try {
        setSamples(prev => prev.filter(s => s.id !== sampleId));
        await deleteTrainingSample(sampleId);
        onDataUpdate();
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete sample.');
        loadSamples(); // Re-fetch to correct state
    }
  };

  const handleTranscribe = async (sample: TrainingSample) => {
    setTranscribingId(sample.id);
    setError(null);
    try {
        const file = new File([sample.blob], sample.original_filename, { type: sample.blob.type || 'audio/wav' });
        const transcript = await transcribeAudioSample(file);
        await updateTrainingSampleTranscript(sample.id, transcript);
        setSamples(prev => prev.map(s => s.id === sample.id ? { ...s, transcript } : s));
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Transcription failed.');
    } finally {
        setTranscribingId(null);
    }
  };

  const handleSaveTranscript = async (sampleId: number) => {
    const newTranscript = editedTranscripts[sampleId];
    if (typeof newTranscript !== 'string') return;
    try {
        await updateTrainingSampleTranscript(sampleId, newTranscript);
        setSamples(prev => prev.map(s => s.id === sampleId ? { ...s, transcript: newTranscript } : s));
        setEditedTranscripts(prev => {
            const updated = {...prev};
            delete updated[sampleId];
            return updated;
        });
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save transcript.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[90vh] bg-secondary rounded-lg shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <header className="p-4 border-b border-accent flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold text-text-primary">Voice Training: {agent.name} <span className="text-lg">{agent.sigil}</span></h2>
          <button onClick={onClose} className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-accent transition-colors" aria-label="Close modal">
            <CloseIcon />
          </button>
        </header>

        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`w-full p-6 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${isDragging ? 'border-brand-hover bg-brand/10' : 'border-accent hover:border-brand'}`}
          >
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept={ACCEPTED_AUDIO_TYPES.join(',')} />
            <UploadIcon />
            <p className="text-text-secondary mt-2 text-sm">Drop audio file here or click to upload</p>
            <p className="text-xs text-text-secondary mt-1">Max file size: {MAX_FILE_SIZE / 1024 / 1024}MB</p>
          </div>

          {error && <div className="bg-red-500/10 text-red-400 p-3 rounded-md text-sm">{error}</div>}

          <div className="space-y-2">
            {isLoading && samples.length === 0 ? (
              <p className="text-text-secondary text-center">Loading samples...</p>
            ) : !isLoading && samples.length === 0 ? (
              <p className="text-text-secondary text-center">No training samples for this agent yet.</p>
            ) : (
              samples.map(sample => (
                <div key={sample.id} className="bg-primary p-3 rounded-md space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileIcon />
                      <span className="font-semibold text-sm truncate" title={sample.original_filename}>{sample.original_filename}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleTranscribe(sample)}
                        disabled={transcribingId === sample.id}
                        className="text-xs py-1 px-2 bg-accent text-text-primary rounded hover:bg-brand-hover transition-colors disabled:opacity-50"
                      >
                        {transcribingId === sample.id ? 'Transcribing...' : 'Transcribe'}
                      </button>
                      <button
                        onClick={() => handleDeleteSample(sample.id)}
                        className="p-1 text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                        aria-label="Delete sample"
                      >
                        <CloseIcon />
                      </button>
                    </div>
                  </div>
                  {(sample.transcript || transcribingId === sample.id) && (
                    <div>
                      <textarea
                        value={editedTranscripts[sample.id] ?? sample.transcript ?? ''}
                        onChange={(e) => setEditedTranscripts(prev => ({...prev, [sample.id]: e.target.value}))}
                        placeholder={transcribingId === sample.id ? 'Transcription in progress...' : 'Transcript will appear here...'}
                        rows={3}
                        className="w-full bg-secondary text-text-primary text-xs p-2 rounded border border-accent focus:ring-2 focus:ring-brand focus:outline-none"
                      />
                      {editedTranscripts[sample.id] !== undefined && (
                        <div className="text-right mt-1">
                          <button
                            onClick={() => handleSaveTranscript(sample.id)}
                            className="text-xs py-1 px-2 bg-brand text-white font-semibold rounded hover:bg-brand-hover transition-colors"
                          >
                            Save Transcript
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentVoiceModal;