import React, { useRef, useState, useEffect } from 'react';
import { useTools } from '../contexts/ToolContext';
import { useAgents } from '../contexts/AgentsContext';
import { useChat } from '../contexts/ChatContext';
import ChevronLeftIcon from './icons/ChevronLeftIcon';
import VoiceTrainIcon from './icons/VoiceTrainIcon';
import DbIcon from './icons/DbIcon';
import SparklesIcon from './icons/SparklesIcon';
import CameraIcon from './icons/CameraIcon';
import EditIcon from './icons/EditIcon';
import CheckIcon from './icons/CheckIcon';
import CloseIcon from './icons/CloseIcon';
import AddIcon from './icons/AddIcon';
import TrashIcon from './icons/TrashIcon';
import type { Agent, RoleLayer } from '../types';

interface EditableFieldProps {
    label: string;
    value: string;
    onSave: (newValue: string) => void;
    type?: 'input' | 'textarea';
}

const EditableField: React.FC<EditableFieldProps> = ({ label, value, onSave, type = 'input' }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [currentValue, setCurrentValue] = useState(value);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => { setCurrentValue(value); }, [value]);
    useEffect(() => {
        if (isEditing && type === 'textarea' && textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [isEditing, type, currentValue]);

    const handleSave = () => { onSave(currentValue.trim()); setIsEditing(false); };
    const handleCancel = () => { setCurrentValue(value); setIsEditing(false); };
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && type === 'input') handleSave();
        if (e.key === 'Escape') handleCancel();
    };

    return (
        <div className="p-3 bg-primary rounded-lg group border border-transparent hover:border-accent/50">
            <div className="flex justify-between items-center mb-1">
                <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">{label}</h3>
                {!isEditing && (
                    <button onClick={() => setIsEditing(true)} className="p-1 text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" aria-label={`Edit ${label}`}>
                        <EditIcon />
                    </button>
                )}
            </div>
            {isEditing ? (
                <div>
                    {type === 'textarea' ? (
                        <textarea ref={textareaRef} value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} onKeyDown={handleKeyDown} className="w-full text-sm bg-accent text-text-primary rounded-md p-2 border border-brand focus:outline-none resize-y" rows={5} autoFocus />
                    ) : (
                        <input type="text" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} onKeyDown={handleKeyDown} className="w-full text-sm bg-accent text-text-primary rounded-md p-2 border border-brand focus:outline-none" autoFocus />
                    )}
                    <div className="flex justify-end gap-2 mt-2">
                        <button onClick={handleCancel} className="p-2 rounded-full text-red-400 hover:bg-accent"><CloseIcon /></button>
                        <button onClick={handleSave} className="p-2 rounded-full text-green-400 hover:bg-accent"><CheckIcon /></button>
                    </div>
                </div>
            ) : (
                <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{value || 'Not specified'}</p>
            )}
        </div>
    );
};

const RoleLayerEditor: React.FC<{ agent: Agent, layer: RoleLayer, index: number }> = ({ agent, layer, index }) => {
    const { updateRoleLayerForAgent, deleteRoleLayerFromAgent } = useAgents();
    const { setRagRepository, setRightPanelContent } = useTools();

    const handleUpdate = (field: keyof RoleLayer, value: string) => {
        updateRoleLayerForAgent(agent.id, index, { [field]: value });
    };

    const handleDelete = () => {
        if (window.confirm(`Are you sure you want to delete the "${layer.name}" role layer? This will also delete its dedicated knowledge base.`)) {
            deleteRoleLayerFromAgent(agent.id, index);
        }
    };
    
    const handleManageKnowledge = () => {
        const repoName = `${agent.id}::${layer.id}`;
        setRagRepository(repoName);
        setRightPanelContent(null);
        setTimeout(() => {
            const ragDbButton = document.querySelector('[aria-label="Select dB tool"]') as HTMLElement;
            ragDbButton?.click();
        }, 50);
    };

    return (
        <div className="p-3 bg-secondary rounded-lg border border-accent/50 space-y-2">
            <EditableField label="Role Name" value={layer.name} onSave={(val) => handleUpdate('name', val)} />
            <EditableField label="Specialty" value={layer.specialty} onSave={(val) => handleUpdate('specialty', val)} />
            <EditableField label="Biography" value={layer.bio} onSave={(val) => handleUpdate('bio', val)} type="textarea" />
            <EditableField label="Communication Style" value={layer.communicationStyle} onSave={(val) => handleUpdate('communicationStyle', val)} type="textarea" />
            <div className="flex justify-between items-center pt-2 border-t border-accent/50">
                 <button onClick={handleManageKnowledge} className="text-xs flex items-center gap-1 py-1 px-2 bg-accent text-text-primary rounded hover:bg-brand-hover transition-colors">
                    <DbIcon /> Manage Knowledge
                </button>
                <button onClick={handleDelete} className="p-1 rounded-full text-red-500 hover:bg-red-500/10 transition-colors" aria-label={`Delete ${layer.name}`}>
                    <TrashIcon />
                </button>
            </div>
        </div>
    );
};

const AgentProfilePanel: React.FC = () => {
    const { viewingAgentProfile, handleCloseAgentProfile, setRightPanelContent, setRagRepository, profileImageUrls, handleUpdateProfileImage } = useTools();
    const { handleOpenVoiceModal, handleUpdateAgent, addRoleLayerToAgent } = useAgents();
    const { setInput } = useChat();
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!viewingAgentProfile) return <div className="w-full h-full bg-secondary flex items-center justify-center"><p className="text-text-secondary">No agent selected.</p></div>;

    const { id, sigil, name, specialty, bio, competencies, communicationStyle, profileImageUrl, roleLayers } = viewingAgentProfile;
    const customImageUrl = profileImageUrls.get(id) || profileImageUrl;

    const handleManageKnowledge = () => { setRagRepository(viewingAgentProfile.id); setRightPanelContent(null); setTimeout(() => { (document.querySelector('[aria-label="Select dB tool"]') as HTMLElement)?.click(); }, 50); };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { if (file.size > 5 * 1024 * 1024) { alert("Image file is too large. Maximum size is 5MB."); return; } handleUpdateProfileImage(id, file); } };
    const handleCompetencyClick = (skill: string) => { setInput(`Tell me more about your competency in: ${skill}`); setRightPanelContent(null); };
    const handleUpdateField = (field: keyof Agent, value: string) => { handleUpdateAgent(id, { [field]: value }); };

    return (
        <div className="w-full h-full bg-secondary flex flex-col">
            <div className="p-4 border-b border-accent flex items-center flex-shrink-0 relative">
                <button onClick={handleCloseAgentProfile} className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-accent transition-colors absolute left-4" aria-label="Back to agent list"><ChevronLeftIcon /></button>
                <h2 className="text-lg font-semibold text-text-primary text-center flex-grow">Agent Profile</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex flex-col items-center text-center p-4 bg-primary rounded-lg">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/gif"/>
                    <div className="relative group w-24 h-24 mb-3 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                        {customImageUrl ? <img src={customImageUrl} alt={name} className="w-24 h-24 rounded-full object-cover border-4 border-secondary" /> : <div className="w-24 h-24 rounded-full bg-accent flex items-center justify-center text-5xl border-4 border-secondary">{sigil}</div>}
                        <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"><CameraIcon /></div>
                    </div>
                    <EditableField label="" value={name} onSave={(newName) => handleUpdateField('name', newName)} />
                    <p className="text-md text-brand-hover flex items-center gap-2 mt-1"><SparklesIcon /> {specialty}</p>
                </div>

                <EditableField label="SPECIALTY" value={specialty} onSave={(newValue) => handleUpdateField('specialty', newValue)} />
                <EditableField label="BIOGRAPHY" value={bio} onSave={(newValue) => handleUpdateField('bio', newValue)} type="textarea" />
                
                <div className="p-4 bg-primary rounded-lg">
                    <h3 className="font-bold text-text-secondary mb-2">CORE COMPETENCIES</h3>
                    <div className="flex flex-wrap gap-2">{competencies.map((skill, index) => <button key={index} onClick={() => handleCompetencyClick(skill)} className="bg-accent text-text-primary text-xs font-semibold px-2.5 py-1 rounded-full hover:bg-brand-hover transition-colors focus:outline-none focus:ring-2 focus:ring-brand">{skill}</button>)}</div>
                </div>
                
                <EditableField label="COMMUNICATION STYLE" value={communicationStyle} onSave={(newValue) => handleUpdateField('communicationStyle', newValue)} type="textarea" />
                
                <div className="p-4 bg-primary rounded-lg space-y-3">
                    <h3 className="font-bold text-text-secondary mb-2">ROLE LAYERS ({roleLayers.length}/3)</h3>
                    {roleLayers.length > 0 && <div className="space-y-3">{roleLayers.map((layer, index) => <RoleLayerEditor key={layer.id} agent={viewingAgentProfile} layer={layer} index={index} />)}</div>}
                    <button onClick={() => addRoleLayerToAgent(id)} disabled={roleLayers.length >= 3} className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-accent text-text-primary font-semibold rounded-lg hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"><AddIcon /> Add Role Layer</button>
                </div>

                <div className="p-4 bg-primary rounded-lg space-y-3">
                     <h3 className="font-bold text-text-secondary mb-2">AGENT MANAGEMENT</h3>
                     <button onClick={() => handleOpenVoiceModal(viewingAgentProfile)} className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-accent text-text-primary font-semibold rounded-lg hover:bg-brand-hover transition-colors"><VoiceTrainIcon /> Manage Voice Training</button>
                     <button onClick={handleManageKnowledge} className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-accent text-text-primary font-semibold rounded-lg hover:bg-brand-hover transition-colors"><DbIcon /> Manage Knowledge Base</button>
                </div>
            </div>
        </div>
    );
};

export default AgentProfilePanel;