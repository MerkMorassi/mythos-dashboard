
import React from 'react';
import type { Agent } from '../types';
import CloseIcon from './icons/CloseIcon';

interface AgentPanelProps {
  agents: readonly Agent[];
  activeAgents: Set<string>;
  onAgentToggle: (agentId: string) => void;
  onToggleAll: () => void;
  onClose: () => void;
}

const AgentPanel: React.FC<AgentPanelProps> = ({ agents, activeAgents, onAgentToggle, onToggleAll, onClose }) => {
  return (
    <div className="w-full h-full bg-secondary flex flex-col">
      <div className="p-4 border-b border-accent flex justify-between items-center flex-shrink-0">
        <h2 className="text-lg font-semibold text-text-primary">Agents</h2>
        <button
          onClick={onClose}
          className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-accent transition-colors"
          aria-label="Close agents panel"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-text-secondary">
                Active: {activeAgents.size} / {agents.length}
            </div>
            <button
                onClick={onToggleAll}
                className="text-sm text-brand-hover hover:text-text-primary font-semibold"
            >
                {activeAgents.size === agents.length ? 'Deselect All' : 'Select All'}
            </button>
        </div>
        <div className="flex flex-col gap-2">
            {agents.map(agent => {
                const isActive = activeAgents.has(agent.id);
                return (
                    <div
                        key={agent.id}
                        onClick={() => onAgentToggle(agent.id)}
                        className={`p-3 rounded-lg flex items-center gap-4 cursor-pointer transition-colors ${isActive ? 'bg-accent' : 'hover:bg-accent/50'}`}
                    >
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center text-lg flex-shrink-0 ${isActive ? 'bg-brand text-white' : 'bg-primary'}`}>
                            {agent.sigil}
                        </div>
                        <div className="flex-1">
                            <div className="font-semibold text-text-primary">{agent.name}</div>
                            <div className="text-xs text-text-secondary">{agent.specialty}</div>
                        </div>
                        <div className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center ${isActive ? 'bg-brand border-brand-hover' : 'border-accent'}`}>
                            {isActive && <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                        </div>
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
};

export default AgentPanel;
