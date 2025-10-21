import React, { useState, useMemo } from 'react';
import CloseIcon from './icons/CloseIcon';
import GripVerticalIcon from './icons/GripVerticalIcon';
import VoiceTrainIcon from './icons/VoiceTrainIcon';
import IdCardIcon from './icons/IdCardIcon';
import SparklesIcon from './icons/SparklesIcon';
import SearchIcon from './icons/SearchIcon';
import { useAgents } from '../contexts/AgentsContext';
import { useTools } from '../contexts/ToolContext';
import type { Agent } from '../types';

const AgentPanel: React.FC = () => {
  const {
    displayedAgents,
    setDisplayedAgents,
    activeAgents,
    handleAgentToggle,
    handleToggleAll,
    handleOpenVoiceModal,
    agentSortOrder,
    setAgentSortOrder,
    loadSavedCustomOrder,
    saveAgentOrder,
    isOrderDirty,
    setIsOrderDirty,
  } = useAgents();
  const { allTrainingSamples, handleOpenAgentProfile, setRightPanelContent } = useTools();

  const [searchTerm, setSearchTerm] = useState('');
  const [draggedAgent, setDraggedAgent] = useState<Agent | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const handleSaveClick = () => {
      saveAgentOrder(displayedAgents);
      setSaveStatus('saving');
      setTimeout(() => {
          setSaveStatus('saved');
          setTimeout(() => {
              setSaveStatus('idle');
              setIsOrderDirty(false);
          }, 1500);
      }, 500);
  }

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, agent: Agent) => {
    if (agentSortOrder !== 'custom') {
        setAgentSortOrder('custom');
    }
    setDraggedAgent(agent);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedAgent(null);
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropAgentId = e.currentTarget.dataset.agentId;

    if (!draggedAgent || !dropAgentId || draggedAgent.id === dropAgentId) {
      handleDragEnd();
      return;
    }

    setDisplayedAgents(prevDisplayedAgents => {
      const currentAgents = [...prevDisplayedAgents];
      const draggedItemIndex = currentAgents.findIndex(a => a.id === draggedAgent.id);
      const dropItemIndex = currentAgents.findIndex(a => a.id === dropAgentId);
  
      if (draggedItemIndex === -1 || dropItemIndex === -1) {
        return prevDisplayedAgents;
      }
      
      const [draggedItem] = currentAgents.splice(draggedItemIndex, 1);
      currentAgents.splice(dropItemIndex, 0, draggedItem);
      
      return currentAgents;
    });
    
    setIsOrderDirty(true);
    handleDragEnd();
  };
  
  const getStatusIndicator = (agentId: string) => {
    const hasSamples = allTrainingSamples.some(s => s.agent_id === agentId);
    if (hasSamples) {
        return <div className="w-2 h-2 rounded-full bg-green-500" title="Training Data Available"></div>;
    }
    return <div className="w-2 h-2 rounded-full bg-gray-500" title="No Training Data"></div>;
  };

  const filteredAgents = useMemo(() => {
    if (!searchTerm.trim()) {
        return displayedAgents;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    return displayedAgents.filter(agent =>
        agent.name.toLowerCase().includes(lowercasedTerm) ||
        agent.specialty.toLowerCase().includes(lowercasedTerm)
    );
  }, [displayedAgents, searchTerm]);

  return (
    <div className="w-full h-full bg-secondary flex flex-col">
      <div className="p-4 border-b border-accent flex justify-between items-center flex-shrink-0">
        <h2 className="text-lg font-semibold text-text-primary">Agents</h2>
        <button
          onClick={() => setRightPanelContent(null)}
          className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-accent transition-colors"
          aria-label="Close agents panel"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex justify-between items-center mb-2">
            <div className="text-sm text-text-secondary">
                Active: {activeAgents.size} / {displayedAgents.length}
            </div>
            <button
                onClick={handleToggleAll}
                className="text-sm text-brand-hover hover:text-text-primary font-semibold"
            >
                {activeAgents.size === displayedAgents.length ? 'Deselect All' : 'Select All'}
            </button>
        </div>

        <div className="relative mb-4">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none">
                <SearchIcon />
            </div>
            <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or specialty..."
                className="w-full bg-primary text-text-primary placeholder-text-secondary rounded-lg p-2 pl-10 border border-accent focus:ring-2 focus:ring-brand focus:outline-none"
            />
            {searchTerm && (
                <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-secondary hover:text-text-primary"
                    aria-label="Clear search"
                >
                    <CloseIcon />
                </button>
            )}
        </div>
        
        <div className="flex items-center gap-2 text-xs mb-4">
            <span className="text-text-secondary font-semibold">SORT BY:</span>
            <button
                onClick={() => setAgentSortOrder('name')}
                className={`px-2 py-1 rounded transition-colors ${agentSortOrder === 'name' ? 'bg-brand text-white' : 'bg-accent text-text-secondary hover:bg-accent/70'}`}
            >
                Name
            </button>
            <button
                onClick={() => setAgentSortOrder('specialty')}
                className={`px-2 py-1 rounded transition-colors ${agentSortOrder === 'specialty' ? 'bg-brand text-white' : 'bg-accent text-text-secondary hover:bg-accent/70'}`}
            >
                Specialty
            </button>
             <button
                onClick={loadSavedCustomOrder}
                className={`px-2 py-1 rounded transition-colors ${agentSortOrder === 'custom' ? 'bg-brand text-white' : 'bg-accent text-text-secondary hover:bg-accent/70'}`}
            >
                Custom
            </button>
            <div className="flex-grow"></div>
             {agentSortOrder === 'custom' && (
                <button
                    onClick={handleSaveClick}
                    disabled={!isOrderDirty || saveStatus !== 'idle'}
                    className="px-2 py-1 rounded transition-colors w-24 text-center bg-green-600 text-white hover:bg-green-500 disabled:bg-accent disabled:text-text-secondary disabled:cursor-not-allowed"
                >
                    {saveStatus === 'saved' ? 'Saved ✓' : (saveStatus === 'saving' ? 'Saving...' : 'Save Order')}
                </button>
            )}
        </div>

        <div className="flex flex-col gap-2">
            {filteredAgents.length === 0 && (
                 <p className="text-sm text-text-secondary text-center italic mt-4">No agents match your search.</p>
            )}
            {filteredAgents.map((agent) => {
                const isActive = activeAgents.has(agent.id);
                const isDraggable = agent.id !== 'mythos_assistant';
                const isBeingDragged = draggedAgent?.id === agent.id;

                return (
                    <div
                        key={agent.id}
                        data-agent-id={agent.id}
                        draggable={isDraggable}
                        onDragStart={isDraggable ? (e) => handleDragStart(e, agent) : undefined}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={isDraggable ? handleDrop : undefined}
                        onDragEnd={isDraggable ? handleDragEnd : undefined}
                        className={`p-2 rounded-lg flex items-center gap-2 transition-all duration-150 relative border-2 border-transparent
                            ${isActive ? 'bg-accent' : ''}
                            ${isBeingDragged ? 'opacity-40 border-brand' : ''}
                        `}
                    >
                        
                        {isDraggable ? (
                            <div className="text-text-secondary cursor-grab touch-none p-1" onMouseDown={(e) => e.stopPropagation()}>
                                <GripVerticalIcon />
                            </div>
                        ) : (
                            <div className="w-8"></div>
                        )}
                        
                        <div 
                            className="flex-1 flex items-center gap-4 cursor-pointer group"
                            onClick={() => handleOpenAgentProfile(agent)}
                        >
                            <div className={`w-10 h-10 rounded-md flex items-center justify-center text-xl flex-shrink-0 ${isActive ? 'bg-brand text-white' : 'bg-primary'}`}>
                                {agent.sigil}
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <div className="font-semibold text-text-primary flex items-center gap-2">
                                    <IdCardIcon /> <span className="truncate">{agent.name}</span> {getStatusIndicator(agent.id)}
                                </div>
                                <div className="text-xs text-text-secondary flex items-center gap-2">
                                    <SparklesIcon /> <span className="truncate">{agent.specialty}</span>
                                </div>
                            </div>
                        </div>

                        <button 
                            onClick={(e) => { e.stopPropagation(); handleOpenVoiceModal(agent); }}
                            className="p-2 text-text-secondary hover:text-text-primary hover:bg-primary rounded-full z-10"
                            aria-label={`Prepare training data for ${agent.name}`}
                        >
                            <VoiceTrainIcon />
                        </button>
                        
                        <div 
                            onClick={(e) => { e.stopPropagation(); handleAgentToggle(agent.id); }}
                            className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center cursor-pointer flex-shrink-0 mr-1 z-10 ${isActive ? 'bg-brand border-brand-hover' : 'border-accent'}`}
                        >
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