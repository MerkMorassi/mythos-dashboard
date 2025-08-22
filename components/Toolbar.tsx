



import React from 'react';
import type { Tool } from '../types';
import AnalyzeIcon from './icons/AnalyzeIcon';
import ChatIcon from './icons/ChatIcon';
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

interface ToolbarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  onToggleGallery: () => void;
  onToggleTtsPanel: () => void;
  isCollapsed: boolean;
  rightPanelContent: 'GALLERY' | 'PERCHANCE' | 'TTS' | null;
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
    isCollapsed,
    rightPanelContent
}) => {
  const renderToolGroup = (title: string, children: React.ReactNode) => (
    <div>
        {!isCollapsed && <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2 px-3">{title}</h3>}
        <div className="flex flex-col gap-1">
            {children}
        </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-2">
      <div className="flex flex-col gap-4">
        {renderToolGroup('Generate', <>
            <ToolButton label="Chat" isActive={activeTool === 'CHAT'} onClick={() => onToolChange('CHAT')} isCollapsed={isCollapsed}><ChatIcon /></ToolButton>
            <ToolButton label="Text" isActive={activeTool === 'TEXT_GEN'} onClick={() => onToolChange('TEXT_GEN')} isCollapsed={isCollapsed}><TextIcon /></ToolButton>
            <ToolButton label="Image" isActive={activeTool === 'IMAGE_GEN'} onClick={() => onToolChange('IMAGE_GEN')} isCollapsed={isCollapsed}><ImageIcon /></ToolButton>
            <ToolButton label="Image Mixer" isActive={rightPanelContent === 'PERCHANCE'} onClick={() => onToolChange('PERCHANCE_MIXER')} isCollapsed={isCollapsed}><ImageMixerIcon /></ToolButton>
            <ToolButton label="Code" isActive={activeTool === 'CODE_GEN'} onClick={() => onToolChange('CODE_GEN')} isCollapsed={isCollapsed}><CodeIcon /></ToolButton>
            <ToolButton label="Video" isActive={activeTool === 'VIDEO_GEN'} onClick={() => onToolChange('VIDEO_GEN')} isCollapsed={isCollapsed}><VideoIcon /></ToolButton>
            <ToolButton label="Suno" isActive={activeTool === 'SUNO_MUSIC'} onClick={() => onToolChange('SUNO_MUSIC')} isCollapsed={isCollapsed}><SunoIcon /></ToolButton>
            <ToolButton label="Speech" isActive={rightPanelContent === 'TTS'} onClick={onToggleTtsPanel} isCollapsed={isCollapsed}><TtsIcon /></ToolButton>
        </>)}
        {renderToolGroup('Analyze', <>
            <ToolButton label="Image" isActive={activeTool === 'IMAGE_ANALYSIS'} onClick={() => onToolChange('IMAGE_ANALYSIS')} isCollapsed={isCollapsed}><AnalyzeIcon /></ToolButton>
            <ToolButton label="Code" isActive={activeTool === 'CODE_ANALYSIS'} onClick={() => onToolChange('CODE_ANALYSIS')} isCollapsed={isCollapsed}><CodeAnalyzeIcon /></ToolButton>
            <ToolButton label="Summarize" isActive={activeTool === 'DOC_SUMMARY'} onClick={() => onToolChange('DOC_SUMMARY')} isCollapsed={isCollapsed}><FileIcon /></ToolButton>
            <ToolButton label="Safety" isActive={activeTool === 'CONTENT_DETECTOR'} onClick={() => onToolChange('CONTENT_DETECTOR')} isCollapsed={isCollapsed}><DetectorIcon /></ToolButton>
            <ToolButton label="Audio" isActive={activeTool === 'AUDIO_ANALYSIS'} onClick={() => onToolChange('AUDIO_ANALYSIS')} isCollapsed={isCollapsed}><AudioIcon /></ToolButton>
            <ToolButton label="Weather" isActive={activeTool === 'WEATHER'} onClick={() => onToolChange('WEATHER')} isCollapsed={isCollapsed}><AnalyzeIcon /></ToolButton>
            <ToolButton label="URL" isActive={activeTool === 'URL_CONTEXT'} onClick={() => onToolChange('URL_CONTEXT')} isCollapsed={isCollapsed}><UrlIcon /></ToolButton>
        </>)}
        {renderToolGroup('Data', <>
            <ToolButton label="Gallery" isActive={rightPanelContent === 'GALLERY'} onClick={onToggleGallery} isCollapsed={isCollapsed}><GalleryIcon /></ToolButton>
            <ToolButton label="NotebookLM" isActive={activeTool === 'NOTEBOOK_LM'} onClick={() => onToolChange('NOTEBOOK_LM')} isCollapsed={isCollapsed}><NotebookIcon /></ToolButton>
            <ToolButton label="Linear" isActive={activeTool === 'LINEAR'} onClick={() => onToolChange('LINEAR')} isCollapsed={isCollapsed}><LinearIcon /></ToolButton>
            <ToolButton label="dB" isActive={activeTool === 'RAG_DB'} onClick={() => onToolChange('RAG_DB')} isCollapsed={isCollapsed}><DbIcon /></ToolButton>
        </>)}
      </div>
    </div>
  );
};

export default Toolbar;
