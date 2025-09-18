
import React, { useState, useRef, useEffect } from 'react';
import RecordIcon from './icons/RecordIcon';
import StopCircleIcon from './icons/StopCircleIcon';
import UploadIcon from './icons/UploadIcon';

interface VoiceCloningPanelProps {
  onSave: (name: string, blob: Blob) => Promise<void>;
}

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
const ACCEPTED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp3'];

const VoiceCloningPanel: React.FC<VoiceCloningPanelProps> = ({ onSave }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceName, setVoiceName] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [statusMessage, setStatusMessage] = useState('Record or upload a short audio clip (5-30s) to clone a voice.');
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<number | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup timer on component unmount
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      // Ensure microphone is released
      if (mediaRecorderRef.current && mediaRecorderRef.current.stream) {
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  const stopCurrentRecording = () => {
     if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  }

  const handleFileSelect = (file: File) => {
      stopCurrentRecording(); // Stop recording if a file is selected
      if (!ACCEPTED_AUDIO_TYPES.includes(file.type)) {
          setStatusMessage(`Invalid file type. Please upload one of: ${ACCEPTED_AUDIO_TYPES.join(', ')}.`);
          return;
      }
      if (file.size > MAX_FILE_SIZE) {
          setStatusMessage(`File is too large. Max size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
          return;
      }
      setAudioBlob(file);
      setRecordingSeconds(0);
      setStatusMessage(`Selected file: ${file.name}`);
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileSelect(file);
  };

  const startRecording = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setStatusMessage('Recording finished. Enter a name and save.');
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setAudioBlob(null); // Clear any uploaded file
      setRecordingSeconds(0);
      setStatusMessage('Recording...');
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      setStatusMessage('Microphone access was denied. Please enable it in your browser settings.');
    }
  };

  const stopRecording = () => {
    stopCurrentRecording();
  };

  const handleSave = async () => {
    if (voiceName.trim() && audioBlob) {
      setIsSaving(true);
      setStatusMessage('Saving voice...');
      await onSave(voiceName.trim(), audioBlob);
      // Reset form after saving
      setVoiceName('');
      setAudioBlob(null);
      setRecordingSeconds(0);
      setStatusMessage('Voice saved successfully! It is now available in the Cloned Voices model.');
      setIsSaving(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  return (
    <div className="mt-4 pt-4 border-t border-accent">
      <h3 className="text-md font-bold text-text-primary mb-2">Custom Voice Cloning</h3>
      <p className="text-xs text-text-secondary mb-3 h-8">{statusMessage}</p>
      
      <div className="flex items-center gap-4 mb-3">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className="p-3 rounded-full bg-accent text-text-primary hover:bg-brand-hover transition-colors flex items-center justify-center"
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        >
          {isRecording ? <StopCircleIcon /> : <RecordIcon />}
        </button>
        <div className="flex-1 text-center bg-primary rounded-md p-2">
          <span className="font-mono text-lg">{formatTime(recordingSeconds)}</span>
        </div>
      </div>
      
      <div className="text-center my-2 text-xs text-text-secondary font-semibold">OR</div>

      <div 
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-colors
            ${isDragging ? 'border-brand-hover bg-brand/10' : 'border-accent hover:border-brand'}`}
      >
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept={ACCEPTED_AUDIO_TYPES.join(',')} />
        <UploadIcon />
        <p className="text-text-secondary mt-2 text-sm">
            {audioBlob instanceof File ? audioBlob.name : 'Drop audio file or click to upload'}
        </p>
      </div>

      <div className="space-y-2 mt-4">
        <input
          type="text"
          value={voiceName}
          onChange={(e) => setVoiceName(e.target.value)}
          placeholder="Enter voice name..."
          className="w-full bg-accent text-text-primary placeholder-text-secondary rounded-lg p-2 border border-accent focus:ring-2 focus:ring-brand focus:outline-none"
          disabled={!audioBlob || isSaving}
        />
        <button
          onClick={handleSave}
          disabled={!voiceName.trim() || !audioBlob || isSaving}
          className="w-full py-2 px-4 bg-brand text-white font-semibold rounded-lg hover:bg-brand-hover transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex justify-center items-center"
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            'Save Voice'
          )}
        </button>
      </div>
    </div>
  );
};

export default VoiceCloningPanel;
