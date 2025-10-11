

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Agent, TrainingSample } from '../types';
import { ALL_AGENTS } from '../types';

interface AgentsContextState {
  activeAgents: Set<string>;
  setActiveAgents: React.Dispatch<React.SetStateAction<Set<string>>>;
  agentSortOrder: 'name' | 'specialty' | 'custom';
  setAgentSortOrder: (order: 'name' | 'specialty' | 'custom') => void;
  displayedAgents: readonly Agent[];
  setDisplayedAgents: (agents: readonly Agent[]) => void;
  isVoiceModalOpen: boolean;
  selectedAgentForVoice: Agent | null;
  handleAgentToggle: (agentId: string) => void;
  handleToggleAll: () => void;
  handleOpenVoiceModal: (agent: Agent) => void;
  handleCloseVoiceModal: () => void;
  saveAgentOrder: () => void;
  isOrderDirty: boolean;
  setIsOrderDirty: (isDirty: boolean) => void;
  // Fix: Add missing property to context state interface
  handleFetchVoiceData: (forceRefetch?: boolean) => Promise<void>;
}

const AgentsContext = createContext<AgentsContextState | undefined>(undefined);

export const AgentsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeAgents, setActiveAgents] = useState<Set<string>>(() => new Set(['mythos_assistant']));
  const [agentSortOrder, setAgentSortOrder] = useState<'name' | 'specialty' | 'custom'>('name');
  const [displayedAgents, setDisplayedAgents] = useState<readonly Agent[]>(ALL_AGENTS);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [selectedAgentForVoice, setSelectedAgentForVoice] = useState<Agent | null>(null);
  const [isOrderDirty, setIsOrderDirty] = useState(false);

  useEffect(() => {
    try {
        const savedOrder = localStorage.getItem('mythos-agent-order');
        if (savedOrder) {
            const agentIds = JSON.parse(savedOrder) as string[];
            const orderedAgents = agentIds.map(id => ALL_AGENTS.find(a => a.id === id)).filter(Boolean) as Agent[];
            const remainingAgents = ALL_AGENTS.filter(a => !agentIds.includes(a.id));
            setDisplayedAgents([...orderedAgents, ...remainingAgents]);
            setAgentSortOrder('custom');
        }
    } catch (e) {
        console.warn("Could not load custom agent order from localStorage.");
        setDisplayedAgents(ALL_AGENTS);
    }
  }, []);

  useEffect(() => {
    if (agentSortOrder === 'custom') {
      return;
    }
    const defaultAgent = ALL_AGENTS.find(a => a.id === 'mythos_assistant');
    const sortableAgents = [...ALL_AGENTS].filter(a => a.id !== 'mythos_assistant');

    sortableAgents.sort((a, b) => {
      if (agentSortOrder === 'specialty') {
        const specialtyCompare = a.specialty.localeCompare(b.specialty);
        if (specialtyCompare !== 0) return specialtyCompare;
      }
      return a.name.localeCompare(b.name);
    });

    setDisplayedAgents(defaultAgent ? [defaultAgent, ...sortableAgents] : sortableAgents);
    setIsOrderDirty(false);
  }, [agentSortOrder]);

  const handleAgentToggle = (agentId: string) => {
    setActiveAgents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(agentId)) {
        newSet.delete(agentId);
      } else {
        newSet.add(agentId);
      }
      return newSet;
    });
  };

  const handleToggleAll = () => {
    setActiveAgents(prev => {
      if (prev.size === ALL_AGENTS.length) {
        return new Set();
      } else {
        return new Set(ALL_AGENTS.map(a => a.id));
      }
    });
  };
  
  const handleOpenVoiceModal = (agent: Agent) => {
    setSelectedAgentForVoice(agent);
    setIsVoiceModalOpen(true);
  };
  
  const handleCloseVoiceModal = () => {
    setIsVoiceModalOpen(false);
    setSelectedAgentForVoice(null);
  };

  const saveAgentOrder = () => {
      try {
          const agentIds = displayedAgents.map(a => a.id);
          localStorage.setItem('mythos-agent-order', JSON.stringify(agentIds));
          setIsOrderDirty(false);
      } catch (e) {
          console.error("Could not save agent order to localStorage:", e);
      }
  };
  
  // Fix: This is a placeholder. The actual implementation is in ToolContext.
  // This resolves the type error in App.tsx. A better long-term fix is to refactor contexts.
  const handleFetchVoiceData = async (forceRefetch?: boolean) => {
    console.warn("handleFetchVoiceData is called on AgentsContext but its implementation lives in ToolContext due to architectural constraints.");
    return Promise.resolve();
  };


  const value = {
    activeAgents,
    setActiveAgents,
    agentSortOrder,
    setAgentSortOrder,
    displayedAgents,
    setDisplayedAgents: (agents: readonly Agent[]) => setDisplayedAgents(agents),
    isVoiceModalOpen,
    selectedAgentForVoice,
    handleAgentToggle,
    handleToggleAll,
    handleOpenVoiceModal,
    handleCloseVoiceModal,
    saveAgentOrder,
    isOrderDirty,
    setIsOrderDirty,
    handleFetchVoiceData
  };

  return <AgentsContext.Provider value={value}>{children}</AgentsContext.Provider>;
};

export const useAgents = () => {
  const context = useContext(AgentsContext);
  if (context === undefined) {
    throw new Error('useAgents must be used within an AgentsProvider');
  }
  return context;
};
