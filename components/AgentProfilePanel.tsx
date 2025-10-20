import React, { useRef } from 'react';
import { useTools } from '../contexts/ToolContext';
import { useAgents } from '../contexts/AgentsContext';
import ChevronLeftIcon from './icons/ChevronLeftIcon';
import VoiceTrainIcon from './icons/VoiceTrainIcon';
import DbIcon from './icons/DbIcon';
import SparklesIcon from './icons/SparklesIcon';
import CameraIcon from './icons/CameraIcon';

const AgentProfilePanel: React.FC = () => {
    const { 
        viewingAgentProfile, 
        handleCloseAgentProfile, 
        setRightPanelContent, 
        setRagRepository,
        profileImageUrls,
        handleUpdateProfileImage,
    } = useTools();
    const { handleOpenVoiceModal } = useAgents();
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!viewingAgentProfile) {
        return (
            <div className="w-full h-full bg-secondary flex items-center justify-center">
                <p className="text-text-secondary">No agent selected.</p>
            </div>
        );
    }
    
    const { id, sigil, name, specialty, bio, competencies, communicationStyle, profileImageUrl } = viewingAgentProfile;
    const customImageUrl = profileImageUrls.get(id) || profileImageUrl;

    const handleManageKnowledge = () => {
        setRagRepository(viewingAgentProfile.id);
        setRightPanelContent(null);
        // This is a bit of a hack to ensure the main view changes
        setTimeout(() => {
            const ragDbButton = document.querySelector('[aria-label="Select dB tool"]') as HTMLElement;
            ragDbButton?.click();
        }, 50);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                alert("Image file is too large. Maximum size is 5MB.");
                return;
            }
            handleUpdateProfileImage(id, file);
        }
    };

    return (
        <div className="w-full h-full bg-secondary flex flex-col">
            <div className="p-4 border-b border-accent flex items-center flex-shrink-0 relative">
                <button
                    onClick={handleCloseAgentProfile}
                    className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-accent transition-colors absolute left-4"
                    aria-label="Back to agent list"
                >
                    <ChevronLeftIcon />
                </button>
                <h2 className="text-lg font-semibold text-text-primary text-center flex-grow">Agent Profile</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Header */}
                <div className="flex flex-col items-center text-center p-4 bg-primary rounded-lg">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept="image/png, image/jpeg, image/gif"
                    />
                     <div
                        className="relative group w-24 h-24 mb-3 cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        {customImageUrl ? (
                            <img src={customImageUrl} alt={name} className="w-24 h-24 rounded-full object-cover border-4 border-secondary" />
                        ) : (
                            <div className="w-24 h-24 rounded-full bg-accent flex items-center justify-center text-5xl border-4 border-secondary">
                                {sigil}
                            </div>
                        )}
                        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                            <CameraIcon />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-text-primary">{name}</h1>
                    <p className="text-md text-brand-hover flex items-center gap-2">
                        <SparklesIcon /> {specialty}
                    </p>
                </div>
                
                {/* Bio */}
                <div className="p-4 bg-primary rounded-lg">
                    <h3 className="font-bold text-text-secondary mb-2">BIOGRAPHY</h3>
                    <p className="text-sm text-text-primary leading-relaxed">{bio}</p>
                </div>

                {/* Core Competencies */}
                <div className="p-4 bg-primary rounded-lg">
                    <h3 className="font-bold text-text-secondary mb-2">CORE COMPETENCIES</h3>
                    <div className="flex flex-wrap gap-2">
                        {competencies.map((skill, index) => (
                            <span key={index} className="bg-accent text-text-primary text-xs font-semibold px-2.5 py-1 rounded-full">
                                {skill}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Communication Style */}
                <div className="p-4 bg-primary rounded-lg">
                    <h3 className="font-bold text-text-secondary mb-2">COMMUNICATION STYLE</h3>
                    <p className="text-sm text-text-primary italic">{communicationStyle}</p>
                </div>

                {/* Agent Management */}
                <div className="p-4 bg-primary rounded-lg space-y-3">
                     <h3 className="font-bold text-text-secondary mb-2">AGENT MANAGEMENT</h3>
                     <button
                        onClick={() => handleOpenVoiceModal(viewingAgentProfile)}
                        className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-accent text-text-primary font-semibold rounded-lg hover:bg-brand-hover transition-colors"
                     >
                        <VoiceTrainIcon />
                        Manage Voice Training
                     </button>
                     <button
                        onClick={handleManageKnowledge}
                        className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-accent text-text-primary font-semibold rounded-lg hover:bg-brand-hover transition-colors"
                     >
                        <DbIcon />
                        Manage Knowledge Base
                     </button>
                </div>
            </div>
        </div>
    );
};

export default AgentProfilePanel;