import React from 'react';
import CloseIcon from './icons/CloseIcon';

interface SettingsPanelProps {
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
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
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-center text-text-secondary p-8 bg-primary rounded-lg">
          <p>Application settings are managed externally.</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;