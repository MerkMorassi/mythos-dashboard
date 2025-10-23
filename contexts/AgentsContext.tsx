import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Agent, RoleLayer } from '../types';
import { ALL_AGENTS } from '../types';

const AGENT_ORDER_KEY = 'mythos-agent-order';
const AGENT_CUSTOMIZATIONS_KEY = 'mythos-agent-customizations';

interface AgentsContextState {
  activeAgents: Set<string>;
  setActiveAgents: React.Dispatch<React.SetStateAction<Set<string>>>;
  agentSortOrder: 'name' | 'specialty' | 'custom';
  setAgentSortOrder: (order: 'name' | 'specialty' | 'custom') => void;
  loadSavedCustomOrder: () => void;
  displayedAgents: Agent[];
  setDisplayedAgents: React.Dispatch<React.SetStateAction<Agent[]>>;
  isVoiceModalOpen: boolean;
  selectedAgentForVoice: Agent | null;
  handleAgentToggle: (agentId: string) => void;
  handleToggleAll: () => void;
  handleOpenVoiceModal: (agent: Agent) => void;
  handleCloseVoiceModal: () => void;
  saveAgentOrder: (agentsToSave: readonly Agent[]) => void;
  isOrderDirty: boolean;
  setIsOrderDirty: (isDirty: boolean) => void;
  handleUpdateAgent: (agentId: string, updates: Partial<Agent>) => void;
  addRoleLayerToAgent: (agentId: string) => Promise<void>;
  updateRoleLayerForAgent: (agentId: string, layerIndex: number, updates: Partial<RoleLayer>) => void;
  deleteRoleLayerFromAgent: (agentId: string, layerIndex: number) => Promise<void>;
  // This is a placeholder, implementation is in ToolContext
  handleFetchVoiceData: (forceRefetch?: boolean) => Promise<void>;
}

const AgentsContext = createContext<AgentsContextState | undefined>(undefined);

// Dependency hook to get functions from ToolContext
// This is a pattern to break circular dependencies between contexts
const useToolContextForAgents = () => {
    const context = (window as any).toolContext;
    if (!context) {
        throw new Error("ToolContext is not available on window. Ensure it's rendered.");
    }
    return context as {
        handleCreateRagRepository: (name: string, agentId?: string | null) => Promise<void>;
        handleDeleteRagRepository: (name: string) => Promise<void>;
    };
};


export const AgentsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [activeAgents, setActiveAgents] = useState<Set<string>>(() => new Set(['pleroma']));
  const [agentSortOrder, setAgentSortOrder] = useState<'name' | 'specialty' | 'custom'>('name');
  const [displayedAgents, setDisplayedAgents] = useState<Agent[]>([]);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [selectedAgentForVoice, setSelectedAgentForVoice] = useState<Agent | null>(null);
  const [isOrderDirty, setIsOrderDirty] = useState(false);

  const persistAllAgents = useCallback((agents: Agent[]) => {
      setAllAgents(agents);
      try {
        const customizations = agents.reduce((acc, agent) => {
            // Find the original agent to compare against
            const originalAgent = ALL_AGENTS.find(a => a.id === agent.id);
            if (!originalAgent) return acc;

            const diff: Partial<Agent> = {};
            if (agent.name !== originalAgent.name) diff.name = agent.name;
            if (agent.specialty !== originalAgent.specialty) diff.specialty = agent.specialty;
            if (agent.bio !== originalAgent.bio) diff.bio = agent.bio;
            if (agent.communicationStyle !== originalAgent.communicationStyle) diff.communicationStyle = agent.communicationStyle;
            if (agent.roleLayers.length > 0) diff.roleLayers = agent.roleLayers;
            
            if (Object.keys(diff).length > 0) {
                acc[agent.id] = diff;
            }
            return acc;
        }, {} as Record<string, Partial<Agent>>);
        
        localStorage.setItem(AGENT_CUSTOMIZATIONS_KEY, JSON.stringify(customizations));
      } catch (e) {
          console.error("Could not save agent customizations to localStorage:", e);
      }
  }, []);

  useEffect(() => {
    try {
      const customizations = JSON.parse(localStorage.getItem(AGENT_CUSTOMIZATIONS_KEY) || '{}');
      const initialAgents = ALL_AGENTS.map(agent => ({
          ...agent,
          ...(customizations[agent.id] || {}),
          roleLayers: customizations[agent.id]?.roleLayers || [],
      }));
      setAllAgents(initialAgents);

      const savedOrder = localStorage.getItem(AGENT_ORDER_KEY);
      if (savedOrder) {
          setAgentSortOrder('custom');
      } else {
          setAgentSortOrder('name');
      }
    } catch (e) {
        console.warn("Could not load custom agent data from localStorage.", e);
        setAllAgents([...ALL_AGENTS.map(a => ({...a, roleLayers: []}))]);
        setAgentSortOrder('name');
    }
  }, []);

  useEffect(() => {
    if (allAgents.length === 0) return;

    let sortedAgents: Agent[];

    if (agentSortOrder === 'custom') {
        const savedOrderJson = localStorage.getItem(AGENT_ORDER_KEY);
        if (savedOrderJson) {
            const agentIds = JSON.parse(savedOrderJson) as string[];
            const agentMap = new Map(allAgents.map(agent => [agent.id, agent]));
            const orderedAgents = agentIds.map(id => agentMap.get(id)).filter(Boolean) as Agent[];
            const remainingAgents = allAgents.filter(a => !agentIds.includes(a.id));
            sortedAgents = [...orderedAgents, ...remainingAgents];
        } else {
            sortedAgents = [...allAgents];
        }
    } else {
        const defaultAgent = allAgents.find(a => a.id === 'pleroma');
        const sortableAgents = [...allAgents].filter(a => a.id !== 'pleroma');

        sortableAgents.sort((a, b) => {
            if (agentSortOrder === 'specialty') {
                const specialtyCompare = a.specialty.localeCompare(b.specialty);
                if (specialtyCompare !== 0) return specialtyCompare;
            }
            return a.name.localeCompare(b.name);
        });
        
        sortedAgents = defaultAgent ? [defaultAgent, ...sortableAgents] : sortableAgents;
    }
    
    setDisplayedAgents(sortedAgents);
    setIsOrderDirty(false);
  }, [agentSortOrder, allAgents]);
  
  const loadSavedCustomOrder = useCallback(() => {
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
      if (prev.size === allAgents.length) {
        return new Set(['pleroma']); // Default to assistant
      } else {
        return new Set(allAgents.map(a => a.id));
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
          localStorage.setItem(AGENT_ORDER_KEY, JSON.stringify(agentIds));
      } catch (e) {
          console.error("Could not save agent order to localStorage:", e);
      }
  };
  
  const handleUpdateAgent = (agentId: string, updates: Partial<Agent>) => {
    const newAgents = allAgents.map(agent => 
        agent.id === agentId ? { ...agent, ...updates } : agent
    );
    persistAllAgents(newAgents);
  };
  
  const addRoleLayerToAgent = async (agentId: string) => {
      const { handleCreateRagRepository } = useToolContextForAgents();
      const newAgents = [...allAgents];
      const agent = newAgents.find(a => a.id === agentId);
      if (agent && agent.roleLayers.length < 3) {
          const newLayer: RoleLayer = {
              id: window.crypto.randomUUID(),
              name: `New Role Layer ${agent.roleLayers.length + 1}`,
              specialty: 'Not specified',
              bio: 'Not specified',
              communicationStyle: 'Not specified'
          };
          agent.roleLayers.push(newLayer);
          
          const repoName = `${agent.id}::${newLayer.id}`;
          try {
              await handleCreateRagRepository(repoName, agent.id);
              persistAllAgents(newAgents);
          } catch(e) {
              console.error("Failed to create RAG repo for new role layer:", e);
              // Optionally revert the agent update
          }
      }
  };

  const updateRoleLayerForAgent = (agentId: string, layerIndex: number, updates: Partial<RoleLayer>) => {
      const newAgents = [...allAgents];
      const agent = newAgents.find(a => a.id === agentId);
      if (agent && agent.roleLayers[layerIndex]) {
          agent.roleLayers[layerIndex] = { ...agent.roleLayers[layerIndex], ...updates };
          persistAllAgents(newAgents);
      }
  };

  const deleteRoleLayerFromAgent = async (agentId: string, layerIndex: number) => {
      const { handleDeleteRagRepository } = useToolContextForAgents();
      const newAgents = [...allAgents];
      const agent = newAgents.find(a => a.id === agentId);
      const layerToDelete = agent?.roleLayers[layerIndex];

      if (agent && layerToDelete) {
          const repoName = `${agent.id}::${layerToDelete.id}`;
          try {
              await handleDeleteRagRepository(repoName);
              agent.roleLayers.splice(layerIndex, 1);
              persistAllAgents(newAgents);
          } catch(e) {
              console.error("Failed to delete RAG repo for role layer:", e);
              // Optionally revert the agent update
          }
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
    handleUpdateAgent,
    addRoleLayerToAgent,
    updateRoleLayerForAgent,
    deleteRoleLayerFromAgent,
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