

import React from 'react';
import type { VoiceOption, TtsModelOption } from '../types';
import CloseIcon from './icons/CloseIcon';
import VoiceCloningPanel from './VoiceCloningPanel';

interface TtsPanelProps {
  ttsModels: readonly TtsModelOption[];
  selectedTtsModel: TtsModelOption['id'];
  onTtsModelChange: (modelId: TtsModelOption['id']) => void;
  voices: readonly VoiceOption[];
  selectedVoice: VoiceOption['id'];
  onVoiceChange: (voiceId: VoiceOption['id']) => void;
  onCloneVoice: (name: string, blob: Blob) => Promise<void>;
  onClose: () => void;
}

const TtsPanel: React.FC<TtsPanelProps> = ({ 
  ttsModels, selectedTtsModel, onTtsModelChange, 
  voices, selectedVoice, onVoiceChange, onCloneVoice, onClose 
}) => {
  return (
    <div className="w-full h-full bg-secondary flex flex-col">
      <div className="p-4 border-b border-accent flex justify-between items-center flex-shrink-0">
        <h2 className="text-lg font-semibold text-text-primary">Speech Settings</h2>
        <button
          onClick={onClose}
          className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-accent transition-colors"
          aria-label="Close speech settings"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label htmlFor="ttsModel" className="block text-sm font-bold text-text-secondary mb-1">TTS Model</label>
          <select
            id="ttsModel"
            value={selectedTtsModel}
            onChange={(e) => onTtsModelChange(e.target.value as TtsModelOption['id'])}
            className="w-full bg-accent text-text-primary rounded-lg p-2 border border-accent focus:ring-2 focus:ring-brand focus:outline-none"
            aria-label="Select a Text-to-Speech model"
          >
            {ttsModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ttsVoice" className="block text-sm font-bold text-text-secondary mb-1">Voice</label>
          <select
            id="ttsVoice"
            value={selectedVoice}
            onChange={(e) => onVoiceChange(e.target.value as VoiceOption['id'])}
            className="w-full bg-accent text-text-primary rounded-lg p-2 border border-accent focus:ring-2 focus:ring-brand focus:outline-none"
            aria-label="Select a voice"
            disabled={voices.length === 0}
          >
            {voices.length === 0 && <option>No voices available</option>}
            {voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name}
              </option>
            ))}
          </select>
        </div>
        <VoiceCloningPanel onSave={onCloneVoice} />
      </div>
    </div>
  );
};

export default TtsPanel;