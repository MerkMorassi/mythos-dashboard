
import React, { useState, useEffect } from 'react';
import CloseIcon from './icons/CloseIcon';
import { useTools } from '../contexts/ToolContext';

interface SettingsPanelProps {
  apiKey: string;
  onApiKeySave: (key: string) => void;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ apiKey, onApiKeySave, onClose }) => {
  const [localApiKey, setLocalApiKey] = useState(apiKey);

  useEffect(() => {
    setLocalApiKey(apiKey);
  }, [apiKey]);

  const handleApiKeyInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLocalApiKey(event.target.value);
  };

  const handleSave = () => {
    onApiKeySave(localApiKey);
  };

  return (
    <div className="w-full h-full bg-secondary flex flex-col">
      <div className="p-4 border-b border-accent flex justify-between items-center flex-shrink-0">
        <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
        <button
          onClick={onClose}
          className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-accent transition-colors"
          aria-label="Close settings"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label htmlFor="apiKey" className="block text-sm font-bold text-text-secondary mb-1">
            Google Gemini API Key
          </label>
          <input
            type="password"
            id="apiKey"
            value={localApiKey}
            onChange={handleApiKeyInputChange}
            placeholder="Enter your Gemini API Key"
            className="w-full bg-accent text-text-primary placeholder-text-secondary rounded-lg p-2 border border-accent focus:ring-2 focus:ring-brand focus:outline-none"
          />
          <p className="text-xs text-text-secondary mt-2">
            Your API key is required for client-side features like audio transcription. It is saved securely in your browser's local storage and is never sent to our servers.
          </p>
        </div>
      </div>
       <div className="p-4 border-t border-accent mt-auto">
        <button
          onClick={handleSave}
          disabled={!localApiKey.trim()}
          className="w-full py-2 px-4 bg-brand text-white font-semibold rounded-lg hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Save API Key
        </button>
      </div>
    </div>
  );
};

export default SettingsPanel;
