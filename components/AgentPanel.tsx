

import React, { useState } from 'react';
import CloseIcon from './icons/CloseIcon';
import GripVerticalIcon from './icons/GripVerticalIcon';
import VoiceTrainIcon from './icons/VoiceTrainIcon';
import { useAgents } from '../contexts/AgentsContext';
import { useTools } from '../contexts/ToolContext';

const AgentPanel: React.FC = () => {
  const {
    displayedAgents,
    setDisplayedAgents,
    activeAgents,
    handleAgentToggle,
    handleToggleAll,
    handleOpenVoiceModal,
    // Fix: The property is named agentSortOrder in the context
    agentSortOrder,
    setAgentSortOrder,
    saveAgentOrder,
    isOrderDirty,
    setIsOrderDirty,
  } = useAgents();
  const { allTrainingSamples } = useTools();

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  
  const handleSortChange = (newOrder: 'name' | 'specialty' | 'custom') => {
      setAgentSortOrder(newOrder);
      setIsOrderDirty(false);
  }

  const handleSaveClick = () => {
      saveAgentOrder();
      setSaveStatus('saving');
      setTimeout(() => {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 1500);
      }, 500);
  }

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (index: number) => {
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };
  
  const handleDrop = (dropIndex: number) => {
    if (draggedIndex === null || draggedIndex === dropIndex) {
      handleDragEnd();
      return;
    }

    const reorderedAgents = [...displayedAgents];
    const [draggedItem] = reorderedAgents.splice(draggedIndex, 1);
    reorderedAgents.splice(dropIndex, 0, draggedItem);

    setDisplayedAgents(reorderedAgents);
    setAgentSortOrder('custom');
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

  const { setRightPanelContent } = useTools();

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
        
        <div className="flex items-center gap-2 text-xs mb-4">
            <span className="text-text-secondary font-semibold">SORT BY:</span>
            <button
                onClick={() => handleSortChange('name')}
                // Fix: Use agentSortOrder
                className={`px-2 py-1 rounded transition-colors ${agentSortOrder === 'name' ? 'bg-brand text-white' : 'bg-accent text-text-secondary hover:bg-accent/70'}`}
            >
                Name
            </button>
            <button
                onClick={() => handleSortChange('specialty')}
                // Fix: Use agentSortOrder
                className={`px-2 py-1 rounded transition-colors ${agentSortOrder === 'specialty' ? 'bg-brand text-white' : 'bg-accent text-text-secondary hover:bg-accent/70'}`}
            >
                Specialty
            </button>
             {/* Fix: Use agentSortOrder */}
             {agentSortOrder === 'custom' ? (
                <button
                    onClick={handleSaveClick}
                    disabled={!isOrderDirty || saveStatus !== 'idle'}
                    className={`px-2 py-1 rounded transition-colors w-24 text-center
                        ${!isOrderDirty ? 'bg-brand text-white' : 'bg-green-600 text-white hover:bg-green-500'}
                        ${saveStatus !== 'idle' ? 'bg-green-500' : ''}
                        disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {saveStatus === 'saved' ? 'Saved ✓' : 'Save Order'}
                </button>
            ) : (
                <button
                    disabled
                    className="px-2 py-1 rounded transition-colors bg-accent text-text-secondary opacity-50 cursor-not-allowed"
                >
                    Custom
                </button>
            )}
        </div>

        <div className="flex flex-col gap-2" onDragLeave={() => setDragOverIndex(null)}>
            {displayedAgents.map((agent, index) => {
                const isActive = activeAgents.has(agent.id);
                const isDraggable = agent.id !== 'mythos_assistant';
                const isBeingDragged = draggedIndex === index;
                const isDragOver = dragOverIndex === index;

                return (
                    <div
                        key={agent.id}
                        draggable={isDraggable}
                        onDragStart={isDraggable ? (e) => handleDragStart(e, index) : undefined}
                        onDragEnter={isDraggable ? () => handleDragEnter(index) : undefined}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={isDraggable ? () => handleDrop(index) : undefined}
                        onDragEnd={isDraggable ? handleDragEnd : undefined}
                        className={`p-2 rounded-lg flex items-center gap-2 transition-all duration-150 relative
                            ${isActive ? 'bg-accent' : ''}
                            ${isBeingDragged ? 'opacity-40' : 'hover:bg-accent/50'}
                        `}
                    >
                        {isDragOver && <div className="absolute top-0 left-0 right-0 h-0.5 bg-brand-hover" />}
                        
                        {isDraggable ? (
                            <div className="text-text-secondary cursor-grab touch-none p-1" onMouseDown={(e) => e.stopPropagation()}>
                                <GripVerticalIcon />
                            </div>
                        ) : (
                            <div className="w-8"></div> // Placeholder for alignment
                        )}

                        <div 
                            className="flex-1 flex items-center gap-4 cursor-pointer"
                            onClick={() => handleAgentToggle(agent.id)}
                        >
                            <div className={`w-8 h-8 rounded-md flex items-center justify-center text-lg flex-shrink-0 ${isActive ? 'bg-brand text-white' : 'bg-primary'}`}>
                                {agent.sigil}
                            </div>
                            <div className="flex-1">
                                <div className="font-semibold text-text-primary flex items-center gap-2">
                                    {agent.name}
                                    {getStatusIndicator(agent.id)}
                                </div>
                                <div className="text-xs text-text-secondary">{agent.specialty}</div>
                            </div>
                        </div>

                        <button 
                            onClick={() => handleOpenVoiceModal(agent)}
                            className="p-2 text-text-secondary hover:text-text-primary hover:bg-primary rounded-full"
                            aria-label={`Prepare training data for ${agent.name}`}
                        >
                            <VoiceTrainIcon />
                        </button>
                        
                        <div 
                            onClick={() => handleAgentToggle(agent.id)}
                            className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center cursor-pointer flex-shrink-0 mr-1 ${isActive ? 'bg-brand border-brand-hover' : 'border-accent'}`}
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
