

import React, { useRef } from 'react';
import type { Operator } from '../types';
import { HITL_OPERATORS } from '../types';
import CloseIcon from './icons/CloseIcon';
import CameraIcon from './icons/CameraIcon';
import { useTools } from '../contexts/ToolContext';

const OperatorPanel: React.FC = () => {
  const { 
    activeOperator, 
    setActiveOperator, 
    setRightPanelContent,
    profileImageUrls,
    handleUpdateProfileImage 
  } = useTools();

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, operatorId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert("Image file is too large. Maximum size is 5MB.");
        return;
      }
      handleUpdateProfileImage(operatorId, file);
    }
  };

  return (
    <div className="w-full h-full bg-secondary flex flex-col">
      <div className="p-4 border-b border-accent flex justify-between items-center flex-shrink-0">
        <h2 className="text-lg font-semibold text-text-primary">Operator</h2>
        <button
          onClick={() => setRightPanelContent(null)}
          className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-accent transition-colors"
          aria-label="Close operator panel"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-2">
            {HITL_OPERATORS.map(operator => {
                const isActive = activeOperator.id === operator.id;
                const imageUrl = profileImageUrls.get(operator.id) || operator.profileImageUrl;
                return (
                    <div
                        key={operator.id}
                        onClick={() => setActiveOperator(operator)}
                        className={`p-3 rounded-lg flex items-center gap-4 cursor-pointer transition-colors ${isActive ? 'bg-accent' : 'hover:bg-accent/50'}`}
                    >
                        <input
                            type="file"
                            // FIX: The ref callback was incorrectly returning a value. Changed to a block statement to ensure a void return type.
                            ref={el => { fileInputRefs.current[operator.id] = el; }}
                            onChange={(e) => handleFileChange(e, operator.id)}
                            className="hidden"
                            accept="image/png, image/jpeg, image/gif"
                        />
                        <div
                            className="relative group w-10 h-10 flex-shrink-0"
                            onClick={(e) => {
                                e.stopPropagation();
                                fileInputRefs.current[operator.id]?.click();
                            }}
                        >
                            <img
                                src={imageUrl}
                                alt={operator.name}
                                className="w-10 h-10 rounded-full object-cover"
                            />
                            <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <CameraIcon />
                            </div>
                        </div>

                        <div className="flex-1">
                            <div className="font-semibold text-text-primary">{operator.name}</div>
                            <div className="text-xs text-text-secondary">{operator.specialty}</div>
                        </div>
                         <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isActive ? 'border-brand' : 'border-accent'}`}>
                            {isActive && <div className="w-3 h-3 bg-brand rounded-full"></div>}
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
};

export default OperatorPanel;
