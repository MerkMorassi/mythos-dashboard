
import React from 'react';
import type { Operator } from '../types';
import { HITL_OPERATORS } from '../types';
import CloseIcon from './icons/CloseIcon';
import { useTools } from '../contexts/ToolContext';

const OperatorPanel: React.FC = () => {
  const { activeOperator, setActiveOperator, setRightPanelContent } = useTools();

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
                return (
                    <div
                        key={operator.id}
                        onClick={() => setActiveOperator(operator)}
                        className={`p-3 rounded-lg flex items-center gap-4 cursor-pointer transition-colors ${isActive ? 'bg-accent' : 'hover:bg-accent/50'}`}
                    >
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center text-lg flex-shrink-0 ${isActive ? 'bg-brand text-white' : 'bg-primary'}`}>
                            👤
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
