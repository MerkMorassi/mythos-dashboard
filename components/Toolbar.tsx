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

interface ToolbarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  onToggleGallery: () => void;
  onToggleTtsPanel: () => void;
  onToggleAgentPanel: () => void;
  onToggleOperatorPanel: () => void;
  onToggleSettingsPanel: () => void;
  isCollapsed: boolean;
  rightPanelContent: 'GALLERY' | 'PERCHANCE' | 'TTS' | 'AGENTS' | 'SUNO' | 'OPERATOR' | 'SETTINGS' | null;
}

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

const Toolbar: React.FC<ToolbarProps> = ({ 
    activeTool, 
    onToolChange, 
    onToggleGallery,
    onToggleTtsPanel,
    onToggleAgentPanel,
    onToggleOperatorPanel,
    onToggleSettingsPanel,
    isCollapsed,
    rightPanelContent
}) => {
  const [collapsedSections, setCollapsedSections] = useState({
    generate: false,
    analyze: false,
    data: false,
    system: false,
  });

  const toggleSection = (section: keyof typeof collapsedSections) => {
    if (!isCollapsed) {
        setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
    }
  };

  const renderToolGroup = (
    title: string, 
    sectionKey: keyof typeof collapsedSections,
    children: React.ReactNode
  ) => {
    const isSectionCollapsed = isCollapsed || collapsedSections[sectionKey];
    return (
        <div>
            {!isCollapsed && (
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
             {!isCollapsed && <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 px-3">Agent Chat</h3>}
             <div className="flex flex-col gap-1">
                <ToolButton label="Agent Hub" isActive={activeTool === 'AGENT_HUB'} onClick={() => onToolChange('AGENT_HUB')} isCollapsed={isCollapsed}><AgentHubIcon /></ToolButton>
             </div>
        </div>

        {renderToolGroup('Generate', 'generate', <>
            <ToolButton label="Text" isActive={activeTool === 'TEXT_GEN'} onClick={() => onToolChange('TEXT_GEN')} isCollapsed={isCollapsed}><TextIcon /></ToolButton>
            <ToolButton label="Image" isActive={activeTool === 'IMAGE_GEN'} onClick={() => onToolChange('IMAGE_GEN')} isCollapsed={isCollapsed}><ImageIcon /></ToolButton>
            <ToolButton label="Image Mixer" isActive={rightPanelContent === 'PERCHANCE'} onClick={() => onToolChange('PERCHANCE_MIXER')} isCollapsed={isCollapsed}><ImageMixerIcon /></ToolButton>
            <ToolButton label="Code" isActive={activeTool === 'CODE_GEN'} onClick={() => onToolChange('CODE_GEN')} isCollapsed={isCollapsed}><CodeIcon /></ToolButton>
            <ToolButton label="Video" isActive={activeTool === 'VIDEO_GEN'} onClick={() => onToolChange('VIDEO_GEN')} isCollapsed={isCollapsed}><VideoIcon /></ToolButton>
            <ToolButton label="Suno" isActive={rightPanelContent === 'SUNO'} onClick={() => onToolChange('SUNO_MUSIC')} isCollapsed={isCollapsed}><SunoIcon /></ToolButton>
            <ToolButton label="Speech" isActive={rightPanelContent === 'TTS'} onClick={onToggleTtsPanel} isCollapsed={isCollapsed}><TtsIcon /></ToolButton>
        </>)}
        
        {renderToolGroup('Analyze', 'analyze', <>
            <ToolButton label="Image" isActive={activeTool === 'IMAGE_ANALYSIS'} onClick={() => onToolChange('IMAGE_ANALYSIS')} isCollapsed={isCollapsed}><AnalyzeIcon /></ToolButton>
            <ToolButton label="Code" isActive={activeTool === 'CODE_ANALYSIS'} onClick={() => onToolChange('CODE_ANALYSIS')} isCollapsed={isCollapsed}><CodeAnalyzeIcon /></ToolButton>
            <ToolButton label="Summarize" isActive={activeTool === 'DOC_SUMMARY'} onClick={() => onToolChange('DOC_SUMMARY')} isCollapsed={isCollapsed}><FileIcon /></ToolButton>
            <ToolButton label="Safety" isActive={activeTool === 'CONTENT_DETECTOR'} onClick={() => onToolChange('CONTENT_DETECTOR')} isCollapsed={isCollapsed}><DetectorIcon /></ToolButton>
            <ToolButton label="Audio" isActive={activeTool === 'AUDIO_ANALYSIS'} onClick={() => onToolChange('AUDIO_ANALYSIS')} isCollapsed={isCollapsed}><AudioIcon /></ToolButton>
            <ToolButton label="Audio to MIDI" isActive={activeTool === 'AUDIO_TO_MIDI'} onClick={() => onToolChange('AUDIO_TO_MIDI')} isCollapsed={isCollapsed}><MidiIcon /></ToolButton>
            <ToolButton label="URL" isActive={activeTool === 'URL_CONTEXT'} onClick={() => onToolChange('URL_CONTEXT')} isCollapsed={isCollapsed}><UrlIcon /></ToolButton>
        </>)}
        
        {renderToolGroup('Data', 'data', <>
            <ToolButton label="Gallery" isActive={rightPanelContent === 'GALLERY'} onClick={onToggleGallery} isCollapsed={isCollapsed}><GalleryIcon /></ToolButton>
            <ToolButton label="Local Viewer" isActive={activeTool === 'LOCAL_VIEWER'} onClick={() => onToolChange('LOCAL_VIEWER')} isCollapsed={isCollapsed}><LocalViewerIcon /></ToolButton>
            <ToolButton label="NotebookLM" isActive={activeTool === 'NOTEBOOK_LM'} onClick={() => onToolChange('NOTEBOOK_LM')} isCollapsed={isCollapsed}><NotebookIcon /></ToolButton>
            <ToolButton label="Linear" isActive={activeTool === 'LINEAR'} onClick={() => onToolChange('LINEAR')} isCollapsed={isCollapsed}><LinearIcon /></ToolButton>
            <ToolButton label="dB" isActive={activeTool === 'RAG_DB'} onClick={() => onToolChange('RAG_DB')} isCollapsed={isCollapsed}><DbIcon /></ToolButton>
        </>)}

        {renderToolGroup('System', 'system', <>
            <ToolButton label="Agents" isActive={rightPanelContent === 'AGENTS'} onClick={onToggleAgentPanel} isCollapsed={isCollapsed}><AgentHubIcon /></ToolButton>
            <ToolButton label="Operator" isActive={rightPanelContent === 'OPERATOR'} onClick={onToggleOperatorPanel} isCollapsed={isCollapsed}><OperatorIcon /></ToolButton>
            <ToolButton label="Settings" isActive={rightPanelContent === 'SETTINGS'} onClick={onToggleSettingsPanel} isCollapsed={isCollapsed}><SettingsIcon /></ToolButton>
        </>)}
      </div>
    </div>
  );
};

export default Toolbar;