
import React, { useState } from 'react';
import ChatMessage from './components/ChatMessage';
import MessageInput from './components/MessageInput';
import Header from './components/Header';
import Toolbar from './components/Toolbar';
import GalleryLightbox from './components/GalleryLightbox';
import GalleryPanel from './components/GalleryPanel';
import PerchancePromptPanel from './components/PerchancePromptPanel';
import SunoPromptPanel from './components/SunoPromptPanel';
import TtsPanel from './components/TtsPanel';
import ChevronDoubleLeftIcon from './components/icons/ChevronDoubleLeftIcon';
import ChevronDoubleRightIcon from './components/icons/ChevronDoubleRightIcon';
import LocalImageViewer from './components/LocalImageViewer';
import AgentPanel from './components/AgentPanel';
import AgentProfilePanel from './components/AgentProfilePanel';
import RagManager from './components/RagManager';
import OperatorPanel from './components/OperatorPanel';
import AudioToMidiConverter from './components/AudioToMidiConverter';
import AgentVoiceModal from './components/AgentVoiceModal';
import SettingsPanel from './components/SettingsPanel';
import ChatHistoryPanel from './components/ChatHistoryPanel';
import SaveToRagModal from './components/SaveToRagModal';
import { ChatProvider, useChat } from './contexts/ChatContext';
import { AgentsProvider, useAgents } from './contexts/AgentsContext';
import { ToolProvider, useTools } from './contexts/ToolContext';

const AppContent: React.FC = () => {
  const { messages, messagesEndRef, speakingMessageId, onToolSend, isSaveToRagModalOpen } = useChat();
  const {
    activeTool, isLeftSidebarCollapsed, setIsLeftSidebarCollapsed, rightPanelContent,
    setRightPanelContent, lightboxIndex, handleCloseLightbox, handlePrevImage, handleNextImage,
    galleryImages, handleOpenLightbox, handleDragStart, perchanceFormData, setPerchanceFormData,
    handleOpenPerchanceWithParams, sunoFormData, setSunoFormData, handleOpenSunoWithParams,
    handleAnalyzeAudio, handleGenerateSunoLyrics, apiKey, handleApiKeySave,
    handleFetchVoiceData, isGalleryLoading, serverStatus
  } = useTools();
  const { isVoiceModalOpen, selectedAgentForVoice } = useAgents();

  const [isDraggingOverChat, setIsDraggingOverChat] = useState(false);

  const isMainView = activeTool !== 'LOCAL_VIEWER' && activeTool !== 'RAG_DB' && activeTool !== 'AUDIO_TO_MIDI';
  const showMessageInput = isMainView && rightPanelContent !== 'SUNO';

  const handleChatDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (activeTool === 'IMAGE_ANALYSIS' || activeTool === 'AGENT_HUB') {
        setIsDraggingOverChat(true);
    }
  };

  const handleChatDragLeave = () => {
      setIsDraggingOverChat(false);
  };

  const handleChatDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingOverChat(false);
      if (activeTool === 'IMAGE_ANALYSIS' || activeTool === 'AGENT_HUB') {
          const file = e.dataTransfer.files?.[0];
          if (file && file.type.startsWith('image/')) {
              onToolSend('', file);
          }
      }
  };

  return (
    <div className={`flex flex-col h-screen bg-primary text-text-primary ${serverStatus !== 'ready' ? 'pt-8' : ''}`}>
      {serverStatus !== 'ready' && (
        <div className={`fixed inset-x-0 top-0 z-50 p-2 text-center text-sm text-white transition-colors ${serverStatus === 'failed' ? 'bg-red-600' : 'bg-yellow-600 animate-pulse'}`}>
          {serverStatus === 'checking' && 'Connecting to server...'}
          {serverStatus === 'failed' && 'Could not connect to the server. Please refresh the page to try again.'}
        </div>
      )}
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className={`bg-secondary flex flex-col transition-all duration-300 ease-in-out ${isLeftSidebarCollapsed ? 'w-20' : 'w-64'}`}>
          <div className={`p-4 h-16 border-b border-accent flex items-center justify-between`}>
            {!isLeftSidebarCollapsed && <h1 className="text-lg font-semibold text-text-primary">MYTHOS</h1>}
            <button
              onClick={() => setIsLeftSidebarCollapsed(!isLeftSidebarCollapsed)}
              className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-accent transition-colors"
              aria-label={isLeftSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isLeftSidebarCollapsed ? <ChevronDoubleRightIcon /> : <ChevronDoubleLeftIcon />}
            </button>
          </div>
          <Toolbar />
        </aside>

        {/* Main Content Pane */}
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          <main 
            className="flex-1 overflow-hidden min-h-0 relative"
            onDragOver={handleChatDragOver}
            onDragLeave={handleChatDragLeave}
            onDrop={handleChatDrop}
          >
            {isDraggingOverChat && (
                <div className="absolute inset-0 bg-brand/30 border-4 border-dashed border-brand-hover rounded-lg flex items-center justify-center pointer-events-none z-10">
                    <div className="text-center text-white p-4 bg-black/50 rounded-lg">
                        <p className="text-2xl font-bold">Drop Image to Analyze</p>
                        <p>Release to start the analysis</p>
                    </div>
                </div>
            )}
            {!isMainView ? (
              <>
                {activeTool === 'LOCAL_VIEWER' && <LocalImageViewer />}
                {activeTool === 'RAG_DB' && <RagManager />}
                {activeTool === 'AUDIO_TO_MIDI' && <AudioToMidiConverter />}
              </>
            ) : (
              <div className="h-full overflow-y-auto p-4 md:p-6">
                <div className="w-full space-y-8">
                  {messages.map((message) => (
                    <ChatMessage
                      key={message.id}
                      message={message}
                      isSpeaking={speakingMessageId === message.id}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            )}
          </main>
          {showMessageInput && (
            <footer className="p-4 md:p-6 border-t border-accent bg-secondary">
              <MessageInput />
            </footer>
          )}
        </div>

        {/* Right Sidebar */}
        {rightPanelContent && (
          <aside className="transition-all duration-300 ease-in-out h-full flex flex-col flex-shrink-0" style={{ width: '24rem' }}>
            {rightPanelContent === 'GALLERY' && (
              <GalleryPanel
                images={galleryImages}
                isLoading={isGalleryLoading}
                onImageClick={handleOpenLightbox}
                onDragStart={handleDragStart}
                onClose={() => setRightPanelContent(null)}
              />
            )}
            {rightPanelContent === 'PERCHANCE' && (
              <PerchancePromptPanel
                formData={perchanceFormData}
                setFormData={setPerchanceFormData}
                onGenerate={handleOpenPerchanceWithParams}
                onClose={() => setRightPanelContent(null)}
              />
            )}
            {rightPanelContent === 'SUNO' && (
              <SunoPromptPanel
                formData={sunoFormData}
                setFormData={setSunoFormData}
                onGenerate={handleOpenSunoWithParams}
                onClose={() => setRightPanelContent(null)}
                onAnalyzeAudio={handleAnalyzeAudio}
                onGenerateLyrics={handleGenerateSunoLyrics}
              />
            )}
            {rightPanelContent === 'TTS' && <TtsPanel />}
            {rightPanelContent === 'AGENTS' && <AgentPanel />}
            {rightPanelContent === 'AGENT_PROFILE' && <AgentProfilePanel />}
            {rightPanelContent === 'OPERATOR' && <OperatorPanel />}
            {rightPanelContent === 'HISTORY' && <ChatHistoryPanel />}
            {rightPanelContent === 'SETTINGS' && (
              <SettingsPanel
                apiKey={apiKey}
                onApiKeySave={handleApiKeySave}
                onClose={() => setRightPanelContent(null)}
              />
            )}
          </aside>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxIndex !== null && (
        <GalleryLightbox
          images={galleryImages}
          currentIndex={lightboxIndex}
          onClose={handleCloseLightbox}
          onPrev={handlePrevImage}
          onNext={handleNextImage}
          onFeedback={useChat().onFeedback}
        />
      )}
      {/* Voice Training Modal */}
      {isVoiceModalOpen && selectedAgentForVoice && (
        <AgentVoiceModal
          agent={selectedAgentForVoice}
          onDataUpdate={() => handleFetchVoiceData(true)}
        />
      )}
      {/* Save to RAG Modal */}
      {isSaveToRagModalOpen && <SaveToRagModal />}
    </div>
  );
};

export const App: React.FC = () => (
  <ToolProvider>
    <AgentsProvider>
      <ChatProvider>
        <AppContent />
      </ChatProvider>
    </AgentsProvider>
  </ToolProvider>
);
