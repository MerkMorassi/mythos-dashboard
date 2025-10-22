import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Tool, VoiceOption, TtsModelOption, GalleryImage, Operator, TrainingSample, Agent, RagRepository } from '../types';
import { ALL_AGENTS, ELEVENLABS_VOICES, HITL_OPERATORS, PREVIEW_VOICES, STABLE_VOICES, TTS_MODELS, MessageRole } from '../types';
import { addClonedVoice, getAllTrainingSamples, getClonedVoices, initDB, addProfileImage, getAllProfileImages } from '../services/dbService';
import { createRagRepository, deleteRagRepository, fetchGallery, fetchRagRepositories, generateSunoLyrics, analyzeAudioForSunoStyle } from '../services/geminiService';

interface ToolContextState {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  isLeftSidebarCollapsed: boolean;
  setIsLeftSidebarCollapsed: (collapsed: boolean) => void;
  rightPanelContent: 'GALLERY' | 'PERCHANCE' | 'TTS' | 'AGENTS' | 'SUNO' | 'OPERATOR' | 'SETTINGS' | 'HISTORY' | 'AGENT_PROFILE' | null;
  setRightPanelContent: (panel: ToolContextState['rightPanelContent']) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  selectedTtsModel: TtsModelOption['id'];
  setSelectedTtsModel: (modelId: TtsModelOption['id']) => void;
  availableVoices: readonly VoiceOption[];
  selectedVoice: VoiceOption['id'];
  setSelectedVoice: (voiceId: VoiceOption['id']) => void;
  ttsModels: typeof TTS_MODELS;
  handleCloneVoice: (name: string, blob: Blob) => Promise<VoiceOption>;
  allTrainingSamples: TrainingSample[];
  handleFetchVoiceData: (forceRefetch?: boolean) => Promise<void>;
  ragRepository: string;
  setRagRepository: (repo: string) => void;
  activeOperator: Operator;
  setActiveOperator: (operator: Operator) => void;
  handleToolChange: (tool: Tool) => void;
  handleToggleGallery: () => void;
  handleToggleTtsPanel: () => void;
  handleToggleAgentPanel: () => void;
  handleToggleOperatorPanel: () => void;
  handleToggleSettingsPanel: () => void;
  handleToggleHistoryPanel: () => void;
  handleApiKeySave: (key: string) => void;
  galleryImages: GalleryImage[];
  isGalleryLoading: boolean;
  handleFetchGallery: () => Promise<void>;
  lightboxIndex: number | null;
  handleOpenLightbox: (index: number) => void;
  handleCloseLightbox: () => void;
  handlePrevImage: () => void;
  handleNextImage: () => void;
  handleDragStart: (e: React.DragEvent<HTMLDivElement>, image: GalleryImage) => void;
  perchanceFormData: any;
  setPerchanceFormData: (data: any) => void;
  handleOpenPerchanceWithParams: () => void;
  sunoFormData: any;
  setSunoFormData: (data: any) => void;
  handleOpenSunoWithParams: () => void;
  handleAnalyzeAudio: (file: File) => Promise<void>;
  handleGenerateSunoLyrics: (topic: string, agentId: string) => Promise<void>;
  customRagRepositories: RagRepository[];
  handleCreateRagRepository: (name: string, agentId?: string | null) => Promise<void>;
  handleDeleteRagRepository: (name: string) => Promise<void>;
  isServerReady: boolean;
  serverStatus: 'checking' | 'ready' | 'failed';
  viewingAgentProfile: Agent | null;
  handleOpenAgentProfile: (agent: Agent) => void;
  handleCloseAgentProfile: () => void;
  profileImageUrls: Map<string, string>;
  handleUpdateProfileImage: (id: string, blob: Blob) => Promise<void>;
}

const ToolContext = createContext<ToolContextState | undefined>(undefined);

export const ToolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTool, setActiveTool] = useState<Tool>('AGENT_HUB');
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [rightPanelContent, setRightPanelContent] = useState<ToolContextState['rightPanelContent']>('AGENTS');
  const [apiKey, setApiKey] = useState<string>('');
  
  const [selectedTtsModel, setSelectedTtsModel] = useState<TtsModelOption['id']>(TTS_MODELS[0].id);
  const [availableVoices, setAvailableVoices] = useState<readonly VoiceOption[]>(STABLE_VOICES);
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption['id']>(STABLE_VOICES[0].id);
  const [clonedVoices, setClonedVoices] = useState<VoiceOption[]>([]);
  const [allTrainingSamples, setAllTrainingSamples] = useState<TrainingSample[]>([]);
  const [voiceDataLoaded, setVoiceDataLoaded] = useState(false);
  
  const [ragRepository, setRagRepository] = useState('common');
  const [customRagRepositories, setCustomRagRepositories] = useState<RagRepository[]>([]);
  const [activeOperator, setActiveOperator] = useState<Operator>(HITL_OPERATORS[0]);
  
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [isGalleryLoading, setIsGalleryLoading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const [perchanceFormData, setPerchanceFormData] = useState({
    description: '', negative: '', numImages: '6 (Default)', shape: 'Landscape (768x512)', Gscale: '7', seed: ''
  });
  const [sunoFormData, setSunoFormData] = useState({
    lyrics: '', style: '', title: '', instrumental: false,
  });

  const [isServerReady, setIsServerReady] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'ready' | 'failed'>('checking');
  const [viewingAgentProfile, setViewingAgentProfile] = useState<Agent | null>(null);
  const [profileImageUrls, setProfileImageUrls] = useState<Map<string, string>>(new Map());
  const imageUrlsRef = useRef(profileImageUrls);
  imageUrlsRef.current = profileImageUrls;

  useEffect(() => {
      // This cleanup runs when the component unmounts
      return () => {
          imageUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      };
  }, []);

  // Server status check
  useEffect(() => {
    const checkServerStatus = async () => {
        setServerStatus('checking');
        // In a serverless environment, this will time out and fail, which is expected.
        for (let i = 0; i < 50; i++) { // Poll for 10 seconds
            try {
                const response = await fetch(`/api/health?t=${new Date().getTime()}`);
                if (response.ok) {
                    setIsServerReady(true);
                    setServerStatus('ready');
                    return;
                }
            } catch (error) { /* wait and retry */ }
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        setIsServerReady(false);
        setServerStatus('failed');
    };
    checkServerStatus();
  }, []);

  // Client-side initialization (API key, IndexedDB) - does not depend on server
  useEffect(() => {
    try {
        const savedKey = localStorage.getItem('gemini-api-key');
        if (savedKey) setApiKey(savedKey);
    } catch (e) {
        console.warn("Could not access localStorage to get API key.");
    }
    const loadClientDbData = async () => {
        try {
            await initDB();
            const images = await getAllProfileImages();
            // Revoke any existing URLs before creating new ones
            imageUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
            const newImageUrlMap = new Map<string, string>();
            for (const img of images) {
                newImageUrlMap.set(img.id, URL.createObjectURL(img.blob));
            }
            setProfileImageUrls(newImageUrlMap);
        } catch (error) {
            console.error("Failed to load client DB data:", error);
        }
    };
    loadClientDbData();
  }, []);

  // Server-side data fetching - depends on server
  useEffect(() => {
    if (!isServerReady) return;

    const loadServerData = async () => {
        try {
            const repos = await fetchRagRepositories();
            setCustomRagRepositories(repos);
        } catch (error) {
            console.error("Failed to load server data (RAG repos):", error);
        }
    };
    loadServerData();
  }, [isServerReady]);


  const handleFetchVoiceData = useCallback(async (forceRefetch = false) => {
    if (voiceDataLoaded && !forceRefetch) return;
    try {
      await initDB();
      const [cloned, samples] = await Promise.all([getClonedVoices(), getAllTrainingSamples()]);
      setClonedVoices(cloned);
      setAllTrainingSamples(samples);
      if (!voiceDataLoaded) setVoiceDataLoaded(true);
    } catch (error) {
      console.error("Could not load voice data from local DB:", error);
    }
  }, [voiceDataLoaded]);

  useEffect(() => {
    if (selectedTtsModel === 'cloned-voice') {
        setAvailableVoices(clonedVoices);
        setSelectedVoice(clonedVoices.length > 0 ? clonedVoices[0].id : '');
    } else if (selectedTtsModel === 'trained-voice') {
        const agentIdsWithSamples = [...new Set(allTrainingSamples.map(s => s.agent_id))];
        const trained = agentIdsWithSamples.map(agentId => {
            const agent = ALL_AGENTS.find(a => a.id === agentId);
            return { id: agentId, name: agent?.name || agentId };
        });
        setAvailableVoices(trained);
        setSelectedVoice(trained.length > 0 ? trained[0].id : '');
    } else {
        const voiceMap = {
            'text-to-speech': STABLE_VOICES,
            'gemini-2.5-flash-preview-tts': PREVIEW_VOICES,
            'eleven-labs': ELEVENLABS_VOICES
        };
        const newVoices = voiceMap[selectedTtsModel as keyof typeof voiceMap] || [];
        setAvailableVoices(newVoices);
        setSelectedVoice(newVoices.length > 0 ? newVoices[0].id : '');
    }
  }, [selectedTtsModel, clonedVoices, allTrainingSamples]);

  const handleCloneVoice = async (name: string, blob: Blob): Promise<VoiceOption> => {
    const newVoiceId = window.crypto.randomUUID();
    const newVoiceData = { id: newVoiceId, name, blob };
    await addClonedVoice(newVoiceData);
    const newVoiceOption = { id: newVoiceData.id, name: newVoiceData.name };
    setClonedVoices(prev => [...prev, newVoiceOption]);
    return newVoiceOption;
  };
  
  const handleCreateRagRepository = async (name: string, agentId?: string | null) => {
    if (!isServerReady) throw new Error("Server is not ready. Please try again in a moment.");
    try {
        const newRepo = await createRagRepository(name, agentId);
        setCustomRagRepositories(prev => [newRepo, ...prev].sort((a,b) => a.name.localeCompare(b.name)));
        setRagRepository(newRepo.name);
    } catch (error) {
        console.error("Failed to create RAG repository:", error);
        throw error;
    }
  };

  const handleDeleteRagRepository = async (name: string) => {
      if (!isServerReady) throw new Error("Server is not ready. Please try again in a moment.");
      try {
          await deleteRagRepository(name);
          setCustomRagRepositories(prev => prev.filter(repo => repo.name !== name));
      } catch (error) {
          console.error("Failed to delete RAG repository:", error);
          throw error;
      }
  };

  const handleToolChange = (tool: Tool) => {
    if (tool === 'NOTEBOOK_LM') {
        window.open('https://notebooklm.google.com', '_blank', 'noopener,noreferrer');
    } else if (tool === 'PERCHANCE_MIXER') {
        setRightPanelContent(rightPanelContent === 'PERCHANCE' ? null : 'PERCHANCE');
    } else if (tool === 'SUNO_MUSIC') {
        setRightPanelContent(rightPanelContent === 'SUNO' ? null : 'SUNO');
    } else if (tool === 'LINEAR') {
        window.open('https://linear.app/mythos-lia/project/mythos-dashboard-3a768abea8fa/overview', '_blank', 'noopener,noreferrer');
    } else if (tool === 'COOM_BRIDGE') {
        window.open('/mythos_consciousness_interface.html', '_blank', 'noopener,noreferrer');
    } else if (tool === 'SETTINGS_PANEL') {
        setRightPanelContent(rightPanelContent === 'SETTINGS' ? null : 'SETTINGS');
    } else if (tool === 'FLOW') {
        window.open('https://labs.google/fx/tools/flow', '_blank', 'noopener,noreferrer');
    } else if (tool === 'VISUALI_IO') {
        window.open('https://visuali.io/', '_blank', 'noopener,noreferrer');
    } else {
        setActiveTool(tool);
    }
  };

  const handleToggleGallery = () => {
    if (rightPanelContent !== 'GALLERY') handleFetchGallery();
    setRightPanelContent(rightPanelContent === 'GALLERY' ? null : 'GALLERY');
  };
  const handleToggleTtsPanel = () => {
    if (rightPanelContent !== 'TTS') handleFetchVoiceData(false);
    setRightPanelContent(rightPanelContent === 'TTS' ? null : 'TTS');
  };
  const handleToggleAgentPanel = () => {
    if (rightPanelContent !== 'AGENTS') handleFetchVoiceData(false);
    setRightPanelContent(rightPanelContent === 'AGENTS' ? null : 'AGENTS');
    setViewingAgentProfile(null); // Clear profile when returning to agent list
  };
  const handleToggleOperatorPanel = () => setRightPanelContent(rightPanelContent === 'OPERATOR' ? null : 'OPERATOR');
  const handleToggleSettingsPanel = () => setRightPanelContent(rightPanelContent === 'SETTINGS' ? null : 'SETTINGS');
  const handleToggleHistoryPanel = () => setRightPanelContent(rightPanelContent === 'HISTORY' ? null : 'HISTORY');


  const handleApiKeySave = (key: string) => {
    try {
        setApiKey(key);
        localStorage.setItem('gemini-api-key', key);
        console.log("API Key saved successfully to browser's local storage.");
        setRightPanelContent(null);
    } catch (e) {
        console.error("Could not save API key to local storage:", e);
    }
  };

  const handleFetchGallery = useCallback(async () => {
    if (!isServerReady) {
        console.warn("Server not ready, aborting gallery fetch.");
        return;
    }
    setIsGalleryLoading(true);
    try {
      setGalleryImages(await fetchGallery());
    } catch (error) {
      console.error('Error fetching gallery:', error);
    } finally {
        setIsGalleryLoading(false);
    }
  }, [isServerReady]);

  const handleOpenLightbox = (index: number) => setLightboxIndex(index);
  const handleCloseLightbox = () => setLightboxIndex(null);
  const handlePrevImage = () => {
      if (lightboxIndex !== null) setLightboxIndex((prev) => (prev === null ? 0 : (prev - 1 + galleryImages.length) % galleryImages.length));
  };
  const handleNextImage = () => {
      if (lightboxIndex !== null) setLightboxIndex((prev) => (prev === null ? 0 : (prev + 1) % galleryImages.length));
  };
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, image: GalleryImage) => {
    e.dataTransfer.setData('application/json', JSON.stringify(image));
  };

  const handleOpenPerchanceWithParams = () => {
    const { description, negative, numImages, shape, Gscale, seed } = perchanceFormData;
    const baseUrl = 'https://perchance.org/c6m2dfzel7';
    const params = new URLSearchParams();
    if (description) params.append('description', description);
    if (negative) params.append('negative', negative);
    if (numImages) params.append('numImages', numImages);
    if (shape) params.append('shape', shape.split(' (')[0].toLowerCase() || 'landscape');
    if (Gscale) params.append('Gscale', Gscale);
    if (seed) params.append('seed', seed);
    window.open(`${baseUrl}?${params.toString()}`, '_blank', 'noopener,noreferrer');
  };

  const handleOpenSunoWithParams = () => {
    const { style, lyrics } = sunoFormData;
    let fullPrompt = lyrics;
    if (style) fullPrompt = `[Style: ${style}]\n\n${lyrics}`;
    navigator.clipboard.writeText(fullPrompt.trim());
    window.open('https://suno.com/create', '_blank', 'noopener,noreferrer');
  };

  const handleAnalyzeAudio = async (file: File) => {
    if (!isServerReady) {
        console.error("Cannot analyze audio, server is not ready.");
        return;
    }
    try {
        const style = await analyzeAudioForSunoStyle(file);
        setSunoFormData(prev => ({...prev, style: style }));
    } catch (error) {
        console.error('Failed to analyze audio style.', error);
    }
  };

  const handleGenerateSunoLyrics = async (topic: string, agentId: string) => {
    if (!isServerReady) {
        console.error("Cannot generate lyrics, server is not ready.");
        return;
    }
    try {
        const reader = await generateSunoLyrics(topic, agentId);
        const decoder = new TextDecoder();
        setSunoFormData(prev => ({...prev, lyrics: ''})); // Clear existing lyrics
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            // FIX: The result of decoder.decode is not guaranteed to be a string. Explicitly cast it.
            const chunk = String(decoder.decode(value, { stream: true }));
            setSunoFormData(prev => ({...prev, lyrics: prev.lyrics + chunk}));
        }
    } catch (error) {
        console.error('Failed to generate lyrics.', error);
    }
  };

  const handleOpenAgentProfile = (agent: Agent) => {
    setViewingAgentProfile(agent);
    setRightPanelContent('AGENT_PROFILE');
  };

  const handleCloseAgentProfile = () => {
    setViewingAgentProfile(null);
    setRightPanelContent('AGENTS');
  };

  const handleUpdateProfileImage = async (id: string, blob: Blob) => {
    try {
      await addProfileImage(id, blob);
      setProfileImageUrls(prevMap => {
        const newMap = new Map(prevMap);
        const oldUrl = newMap.get(id);
        if (oldUrl) {
          URL.revokeObjectURL(oldUrl);
        }
        newMap.set(id, URL.createObjectURL(blob));
        return newMap;
      });
    } catch (error) {
      console.error("Failed to update profile image:", error);
      // Optionally, add a user-facing error message here
    }
  };

  const value = {
    activeTool, setActiveTool, isLeftSidebarCollapsed, setIsLeftSidebarCollapsed, rightPanelContent, setRightPanelContent,
    apiKey, setApiKey, selectedTtsModel, setSelectedTtsModel, availableVoices, selectedVoice, setSelectedVoice,
    ttsModels: TTS_MODELS, handleCloneVoice, allTrainingSamples, handleFetchVoiceData,
    ragRepository, setRagRepository: setRagRepository, activeOperator, setActiveOperator, handleToolChange, handleToggleGallery,
    handleToggleTtsPanel, handleToggleAgentPanel, handleToggleOperatorPanel, handleToggleSettingsPanel, handleToggleHistoryPanel, handleApiKeySave,
    galleryImages, isGalleryLoading, handleFetchGallery, lightboxIndex, handleOpenLightbox, handleCloseLightbox, handlePrevImage, handleNextImage,
    handleDragStart, perchanceFormData, setPerchanceFormData, handleOpenPerchanceWithParams,
    sunoFormData, setSunoFormData, handleOpenSunoWithParams, handleAnalyzeAudio, handleGenerateSunoLyrics,
    customRagRepositories, handleCreateRagRepository, handleDeleteRagRepository, isServerReady, serverStatus,
    viewingAgentProfile, handleOpenAgentProfile, handleCloseAgentProfile,
    profileImageUrls, handleUpdateProfileImage,
  };

  return <ToolContext.Provider value={value}>{children}</ToolContext.Provider>;
};

export const useTools = () => {
  const context = useContext(ToolContext);
  if (context === undefined) {
    throw new Error('useTools must be used within a ToolProvider');
  }
  return context;
};