import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Agent, TrainingSample } from '../types';
import { ALL_AGENTS } from '../types';

interface AgentsContextState {
  activeAgents: Set<string>;
  setActiveAgents: React.Dispatch<React.SetStateAction<Set<string>>>;
  agentSortOrder: 'name' | 'specialty' | 'custom';
  setAgentSortOrder: (order: 'name' | 'specialty' | 'custom') => void;
  loadSavedCustomOrder: () => void;
  displayedAgents: readonly Agent[];
  setDisplayedAgents: React.Dispatch<React.SetStateAction<readonly Agent[]>>;
  isVoiceModalOpen: boolean;
  selectedAgentForVoice: Agent | null;
  handleAgentToggle: (agentId: string) => void;
  handleToggleAll: () => void;
  handleOpenVoiceModal: (agent: Agent) => void;
  handleCloseVoiceModal: () => void;
  saveAgentOrder: (agentsToSave: readonly Agent[]) => void;
  isOrderDirty: boolean;
  setIsOrderDirty: (isDirty: boolean) => void;
  // This is a placeholder, implementation is in ToolContext
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
            const agentMap = new Map(ALL_AGENTS.map(agent => [agent.id, agent]));
            const orderedAgents = agentIds.map(id => agentMap.get(id)).filter(Boolean) as Agent[];
            const remainingAgents = ALL_AGENTS.filter(a => !agentIds.includes(a.id));
            setDisplayedAgents([...orderedAgents, ...remainingAgents]);
            setAgentSortOrder('custom');
        } else {
            setAgentSortOrder('name'); // Set default sort if nothing is saved
        }
    } catch (e) {
        console.warn("Could not load custom agent order from localStorage.", e);
        setDisplayedAgents(ALL_AGENTS);
        setAgentSortOrder('name');
    }
  }, []);

  useEffect(() => {
    if (agentSortOrder === 'custom') {
      return; // In custom mode, manual reordering or explicit loading takes precedence
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
    setIsOrderDirty(false); // Reset dirty flag for programmatic sorts
  }, [agentSortOrder]);
  
  const loadSavedCustomOrder = useCallback(() => {
    try {
        const savedOrderJson = localStorage.getItem('mythos-agent-order');
        if (savedOrderJson) {
            const agentIds = JSON.parse(savedOrderJson) as string[];
            const agentMap = new Map(ALL_AGENTS.map(agent => [agent.id, agent]));
            const orderedAgents = agentIds.map(id => agentMap.get(id)).filter(Boolean) as Agent[];
            const remainingAgents = ALL_AGENTS.filter(a => !agentIds.includes(a.id));
            setDisplayedAgents([...orderedAgents, ...remainingAgents]);
        }
    } catch (e) {
        console.warn("Could not load custom agent order from localStorage.", e);
    }
    setAgentSortOrder('custom');
    setIsOrderDirty(false);
  }, []);

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
        return new Set(['mythos_assistant']); // Default to assistant
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

  const saveAgentOrder = (agentsToSave: readonly Agent[]) => {
      try {
          const agentIds = agentsToSave.map(a => a.id);
          localStorage.setItem('mythos-agent-order', JSON.stringify(agentIds));
      } catch (e) {
          console.error("Could not save agent order to localStorage:", e);
      }
  };
  
  const handleFetchVoiceData = async (forceRefetch?: boolean) => {
    console.warn("handleFetchVoiceData is called on AgentsContext but its implementation lives in ToolContext due to architectural constraints.");
    return Promise.resolve();
  };


  const value = {
    activeAgents,
    setActiveAgents,
    agentSortOrder,
    setAgentSortOrder,
    loadSavedCustomOrder,
    displayedAgents,
    setDisplayedAgents,
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