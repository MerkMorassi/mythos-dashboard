
import React, { useState } from 'react';
import type { Tool } from '../types';
import AnalyzeIcon from './icons/AnalyzeIcon';
import AgentHubIcon from './icons/AgentHubIcon';
import ImageIcon from './icons/ImageIcon';
import VideoIcon from './icons/VideoIcon';
import DetectorIcon from './icons/DetectorIcon';
import FileIcon from './icons/FileIcon';
import UrlIcon from './icons/UrlIcon';
import GalleryIcon from './icons/GalleryIcon';
import DbIcon from './icons/DbIcon';
import AudioIcon from './icons/AudioIcon';
import CodeIcon from './icons/CodeIcon';
import TextIcon from './icons/TextIcon';
import CodeAnalyzeIcon from './icons/CodeAnalyzeIcon';
import NotebookIcon from './icons/NotebookIcon';
import ImageMixerIcon from './icons/ImageMixerIcon';
import TtsIcon from './icons/TtsIcon';
import SunoIcon from './icons/SunoIcon';
import LinearIcon from './icons/LinearIcon';
import LocalViewerIcon from './icons/LocalViewerIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import OperatorIcon from './icons/OperatorIcon';
import MidiIcon from './icons/MidiIcon';
import SettingsIcon from './icons/SettingsIcon';
import HistoryIcon from './icons/HistoryIcon';
import { useTools } from '../contexts/ToolContext';

const ToolButton: React.FC<{
  label: string;
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
  isCollapsed: boolean;
}> = ({ label, isActive, onClick, children, isCollapsed }) => (
  <button
    onClick={onClick}
    className={`flex items-center p-3 rounded-lg w-full transition-colors duration-200 ${
      isActive ? 'bg-brand text-white' : 'hover:bg-accent text-text-secondary'
    } ${isCollapsed ? 'justify-center' : 'justify-start'}`}
    aria-label={`Select ${label} tool`}
  >
    <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">{children}</div>
    {!isCollapsed && <span className="text-sm ml-4 whitespace-nowrap">{label}</span>}
  </button>
);

const Toolbar: React.FC = () => {
  const {
    activeTool,
    handleToolChange,
    handleToggleGallery,
    handleToggleTtsPanel,
    handleToggleAgentPanel,
    handleToggleOperatorPanel,
    handleToggleSettingsPanel,
    handleToggleHistoryPanel,
    isLeftSidebarCollapsed,
    rightPanelContent
  } = useTools();

  const [collapsedSections, setCollapsedSections] = useState({
    generate: false,
    analyze: false,
    data: false,
    system: false,
  });

  const toggleSection = (section: keyof typeof collapsedSections) => {
    if (!isLeftSidebarCollapsed) {
        setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
    }
  };

  const renderToolGroup = (
    title: string, 
    sectionKey: keyof typeof collapsedSections,
    children: React.ReactNode
  ) => {
    const isSectionCollapsed = isLeftSidebarCollapsed || collapsedSections[sectionKey];
    return (
        <div>
            {!isLeftSidebarCollapsed && (
                <button onClick={() => toggleSection(sectionKey)} className="flex items-center justify-between w-full text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 px-3 hover:text-text-primary">
                    <span>{title}</span>
                    <ChevronRightIcon className={`w-4 h-4 transition-transform ${!isSectionCollapsed ? 'rotate-90' : ''}`} />
                </button>
            )}
            {!isSectionCollapsed && (
                <div className="flex flex-col gap-1">
                    {children}
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-2">
      <div className="flex flex-col gap-4">
        <div>
             {!isLeftSidebarCollapsed && <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 px-3">Agent Chat</h3>}
             <div className="flex flex-col gap-1">
                <ToolButton label="Agent Hub" isActive={activeTool === 'AGENT_HUB'} onClick={() => handleToolChange('AGENT_HUB')} isCollapsed={isLeftSidebarCollapsed}><AgentHubIcon /></ToolButton>
             </div>
        </div>

        {renderToolGroup('Generate', 'generate', <>
            <ToolButton label="Text" isActive={activeTool === 'TEXT_GEN'} onClick={() => handleToolChange('TEXT_GEN')} isCollapsed={isLeftSidebarCollapsed}><TextIcon /></ToolButton>
            <ToolButton label="Image" isActive={activeTool === 'IMAGE_GEN'} onClick={() => handleToolChange('IMAGE_GEN')} isCollapsed={isLeftSidebarCollapsed}><ImageIcon /></ToolButton>
            <ToolButton label="Image Mixer" isActive={rightPanelContent === 'PERCHANCE'} onClick={() => handleToolChange('PERCHANCE_MIXER')} isCollapsed={isLeftSidebarCollapsed}><ImageMixerIcon /></ToolButton>
            <ToolButton label="Code" isActive={activeTool === 'CODE_GEN'} onClick={() => handleToolChange('CODE_GEN')} isCollapsed={isLeftSidebarCollapsed}><CodeIcon /></ToolButton>
            <ToolButton label="Video" isActive={activeTool === 'VIDEO_GEN'} onClick={() => handleToolChange('VIDEO_GEN')} isCollapsed={isLeftSidebarCollapsed}><VideoIcon /></ToolButton>
            <ToolButton label="Suno" isActive={rightPanelContent === 'SUNO'} onClick={() => handleToolChange('SUNO_MUSIC')} isCollapsed={isLeftSidebarCollapsed}><SunoIcon /></ToolButton>
            <ToolButton label="Speech" isActive={rightPanelContent === 'TTS'} onClick={handleToggleTtsPanel} isCollapsed={isLeftSidebarCollapsed}><TtsIcon /></ToolButton>
        </>)}
        
        {renderToolGroup('Analyze', 'analyze', <>
            <ToolButton label="Image" isActive={activeTool === 'IMAGE_ANALYSIS'} onClick={() => handleToolChange('IMAGE_ANALYSIS')} isCollapsed={isLeftSidebarCollapsed}><AnalyzeIcon /></ToolButton>
            <ToolButton label="Code" isActive={activeTool === 'CODE_ANALYSIS'} onClick={() => handleToolChange('CODE_ANALYSIS')} isCollapsed={isLeftSidebarCollapsed}><CodeAnalyzeIcon /></ToolButton>
            <ToolButton label="Summarize" isActive={activeTool === 'DOC_SUMMARY'} onClick={() => handleToolChange('DOC_SUMMARY')} isCollapsed={isLeftSidebarCollapsed}><FileIcon /></ToolButton>
            <ToolButton label="Safety" isActive={activeTool === 'CONTENT_DETECTOR'} onClick={() => handleToolChange('CONTENT_DETECTOR')} isCollapsed={isLeftSidebarCollapsed}><DetectorIcon /></ToolButton>
            <ToolButton label="Audio" isActive={activeTool === 'AUDIO_ANALYSIS'} onClick={() => handleToolChange('AUDIO_ANALYSIS')} isCollapsed={isLeftSidebarCollapsed}><AudioIcon /></ToolButton>
            <ToolButton label="Audio to MIDI" isActive={activeTool === 'AUDIO_TO_MIDI'} onClick={() => handleToolChange('AUDIO_TO_MIDI')} isCollapsed={isLeftSidebarCollapsed}><MidiIcon /></ToolButton>
            <ToolButton label="URL" isActive={activeTool === 'URL_CONTEXT'} onClick={() => handleToolChange('URL_CONTEXT')} isCollapsed={isLeftSidebarCollapsed}><UrlIcon /></ToolButton>
        </>)}
        
        {renderToolGroup('Data', 'data', <>
            <ToolButton label="Gallery" isActive={rightPanelContent === 'GALLERY'} onClick={handleToggleGallery} isCollapsed={isLeftSidebarCollapsed}><GalleryIcon /></ToolButton>
            <ToolButton label="Local Viewer" isActive={activeTool === 'LOCAL_VIEWER'} onClick={() => handleToolChange('LOCAL_VIEWER')} isCollapsed={isLeftSidebarCollapsed}><LocalViewerIcon /></ToolButton>
            <ToolButton label="NotebookLM" isActive={activeTool === 'NOTEBOOK_LM'} onClick={() => handleToolChange('NOTEBOOK_LM')} isCollapsed={isLeftSidebarCollapsed}><NotebookIcon /></ToolButton>
            <ToolButton label="Linear" isActive={activeTool === 'LINEAR'} onClick={() => handleToolChange('LINEAR')} isCollapsed={isLeftSidebarCollapsed}><LinearIcon /></ToolButton>
            <ToolButton label="dB" isActive={activeTool === 'RAG_DB'} onClick={() => handleToolChange('RAG_DB')} isCollapsed={isLeftSidebarCollapsed}><DbIcon /></ToolButton>
        </>)}

        {renderToolGroup('System', 'system', <>
            <ToolButton label="Agents" isActive={rightPanelContent === 'AGENTS'} onClick={handleToggleAgentPanel} isCollapsed={isLeftSidebarCollapsed}><AgentHubIcon /></ToolButton>
            <ToolButton label="Operator" isActive={rightPanelContent === 'OPERATOR'} onClick={handleToggleOperatorPanel} isCollapsed={isLeftSidebarCollapsed}><OperatorIcon /></ToolButton>
            <ToolButton label="History" isActive={rightPanelContent === 'HISTORY'} onClick={handleToggleHistoryPanel} isCollapsed={isLeftSidebarCollapsed}><HistoryIcon /></ToolButton>
            <ToolButton label="Settings" isActive={rightPanelContent === 'SETTINGS'} onClick={handleToggleSettingsPanel} isCollapsed={isLeftSidebarCollapsed}><SettingsIcon /></ToolButton>
        </>)}
      </div>
    </div>
  );
};

export default Toolbar;