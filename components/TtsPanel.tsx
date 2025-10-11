
import React from 'react';
import type { VoiceOption, TtsModelOption } from '../types';
import CloseIcon from './icons/CloseIcon';
import VoiceCloningPanel from './VoiceCloningPanel';
import { useTools } from '../contexts/ToolContext';
import { useChat } from '../contexts/ChatContext';
import { MessageRole } from '../types';

const TtsPanel: React.FC = () => {
  const {
    ttsModels,
    selectedTtsModel,
    setSelectedTtsModel,
    availableVoices,
    selectedVoice,
    setSelectedVoice,
    handleCloneVoice,
    setRightPanelContent
  } = useTools();
  const { addMessage } = useChat();

  const handleCloneVoiceWithNotification = async (name: string, blob: Blob) => {
    try {
      const newVoice = await handleCloneVoice(name, blob);
      // UX: Switch to the new voice automatically
      setSelectedTtsModel('cloned-voice');
      setSelectedVoice(newVoice.id);
      addMessage({
        role: MessageRole.MODEL,
        content: `New voice "${name}" has been cloned and is ready to use.`,
      });
    } catch (error) {
      console.error("Failed to clone voice:", error);
      addMessage({
        role: MessageRole.MODEL,
        content: `Sorry, there was an error saving the voice to the local database. ${error instanceof Error ? error.message : ''}`,
        isError: true,
      });
    }
  };

  return (
    <div className="w-full h-full bg-secondary flex flex-col">
      <div className="p-4 border-b border-accent flex justify-between items-center flex-shrink-0">
        <h2 className="text-lg font-semibold text-text-primary">Speech Settings</h2>
        <button
          onClick={() => setRightPanelContent(null)}
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
            onChange={(e) => setSelectedTtsModel(e.target.value as TtsModelOption['id'])}
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
            onChange={(e) => setSelectedVoice(e.target.value as VoiceOption['id'])}
            className="w-full bg-accent text-text-primary rounded-lg p-2 border border-accent focus:ring-2 focus:ring-brand focus:outline-none"
            aria-label="Select a voice"
            disabled={availableVoices.length === 0}
          >
            {availableVoices.length === 0 && <option>No voices available</option>}
            {availableVoices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.name}
              </option>
            ))}
          </select>
        </div>
        <VoiceCloningPanel onSave={handleCloneVoiceWithNotification} />
      </div>
    </div>
  );
};

export default TtsPanel;
