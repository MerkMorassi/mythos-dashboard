import React, { useRef, useState } from 'react';
import type { Operator, RoleLayer } from '../types';
import CloseIcon from './icons/CloseIcon';
import CameraIcon from './icons/CameraIcon';
import { useTools } from '../contexts/ToolContext';
import EditIcon from './icons/EditIcon';
import CheckIcon from './icons/CheckIcon';
import AddIcon from './icons/AddIcon';
import TrashIcon from './icons/TrashIcon';
import DbIcon from './icons/DbIcon';

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

    React.useEffect(() => { setCurrentValue(value); }, [value]);
    React.useEffect(() => {
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
                    <button onClick={() => setIsEditing(true)} className="p-1 text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" aria-label={`Edit ${label}`}><EditIcon /></button>
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


const OperatorPanel: React.FC = () => {
  const { 
    activeOperator, 
    handleUpdateOperator, 
    setRightPanelContent,
    profileImageUrls,
    handleUpdateProfileImage,
    handleCreateRagRepository,
    handleDeleteRagRepository,
    setRagRepository
  } = useTools();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert("Image file is too large. Maximum size is 5MB.");
        return;
      }
      handleUpdateProfileImage(activeOperator.id, file);
    }
  };
  
  const handleUpdateField = (field: keyof Operator, value: string) => {
    handleUpdateOperator(activeOperator.id, { [field]: value });
  };
  
  const handleAddRoleLayer = async () => {
    if (activeOperator.roleLayers.length < 3) {
      const newLayer: RoleLayer = {
        id: window.crypto.randomUUID(),
        name: `New Role Layer ${activeOperator.roleLayers.length + 1}`,
        specialty: 'Not specified',
        bio: 'Not specified',
        communicationStyle: 'Not specified'
      };
      const repoName = `${activeOperator.id}::${newLayer.id}`;
      try {
        await handleCreateRagRepository(repoName, activeOperator.id);
        handleUpdateOperator(activeOperator.id, { roleLayers: [...activeOperator.roleLayers, newLayer] });
      } catch(e) {
        console.error("Failed to create RAG repo for new role layer:", e);
      }
    }
  };

  const handleUpdateRoleLayer = (layerIndex: number, updates: Partial<RoleLayer>) => {
    const newLayers = [...activeOperator.roleLayers];
    newLayers[layerIndex] = { ...newLayers[layerIndex], ...updates };
    handleUpdateOperator(activeOperator.id, { roleLayers: newLayers });
  };

  const handleDeleteRoleLayer = async (layerIndex: number) => {
    const layerToDelete = activeOperator.roleLayers[layerIndex];
    if (window.confirm(`Are you sure you want to delete the "${layerToDelete.name}" role layer? This will also delete its dedicated knowledge base.`)) {
      const repoName = `${activeOperator.id}::${layerToDelete.id}`;
      try {
        await handleDeleteRagRepository(repoName);
        const newLayers = activeOperator.roleLayers.filter((_, index) => index !== layerIndex);
        handleUpdateOperator(activeOperator.id, { roleLayers: newLayers });
      } catch(e) {
        console.error("Failed to delete RAG repo for role layer:", e);
      }
    }
  };

  const handleManageKnowledge = (layer: RoleLayer) => {
    const repoName = `${activeOperator.id}::${layer.id}`;
    setRagRepository(repoName);
    setRightPanelContent(null);
    setTimeout(() => { (document.querySelector('[aria-label="Select dB tool"]') as HTMLElement)?.click(); }, 50);
  };
  
  const imageUrl = profileImageUrls.get(activeOperator.id) || activeOperator.profileImageUrl;

  return (
    <div className="w-full h-full bg-secondary flex flex-col">
      <div className="p-4 border-b border-accent flex justify-between items-center flex-shrink-0">
        <h2 className="text-lg font-semibold text-text-primary">Operator Profile</h2>
        <button
          onClick={() => setRightPanelContent(null)}
          className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-accent transition-colors"
          aria-label="Close operator panel"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex flex-col items-center text-center p-4 bg-primary rounded-lg">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/gif"/>
            <div className="relative group w-20 h-20 mb-3 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <img src={imageUrl} alt={activeOperator.name} className="w-20 h-20 rounded-full object-cover border-4 border-secondary" />
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"><CameraIcon /></div>
            </div>
            <EditableField label="" value={activeOperator.name} onSave={(val) => handleUpdateField('name', val)} />
        </div>

        <EditableField label="SPECIALTY" value={activeOperator.specialty} onSave={(val) => handleUpdateField('specialty', val)} />
        
        <div className="p-3 bg-primary rounded-lg space-y-3">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">ROLE LAYERS ({activeOperator.roleLayers.length}/3)</h3>
            {activeOperator.roleLayers.map((layer, index) => (
              <div key={layer.id} className="p-3 bg-secondary rounded-lg border border-accent/50 space-y-2">
                <EditableField label="Role Name" value={layer.name} onSave={(val) => handleUpdateRoleLayer(index, { name: val })} />
                <EditableField label="Specialty" value={layer.specialty} onSave={(val) => handleUpdateRoleLayer(index, { specialty: val })} />
                <div className="flex justify-between items-center pt-2 border-t border-accent/50">
                   <button onClick={() => handleManageKnowledge(layer)} className="text-xs flex items-center gap-1 py-1 px-2 bg-accent text-text-primary rounded hover:bg-brand-hover transition-colors">
                      <DbIcon /> Manage Knowledge
                  </button>
                  <button onClick={() => handleDeleteRoleLayer(index)} className="p-1 rounded-full text-red-500 hover:bg-red-500/10 transition-colors" aria-label={`Delete ${layer.name}`}><TrashIcon /></button>
                </div>
              </div>
            ))}
            <button onClick={handleAddRoleLayer} disabled={activeOperator.roleLayers.length >= 3} className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-accent text-text-primary font-semibold rounded-lg hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              <AddIcon /> Add Role Layer
            </button>
        </div>

      </div>
    </div>
  );
};

export default OperatorPanel;