

import React, { useState } from 'react';
import { useTools } from '../contexts/ToolContext';
import MythosLogoIcon from './icons/MythosLogoIcon';
import SettingsIcon from './icons/SettingsIcon';
import ExternalLinkIcon from './icons/ExternalLinkIcon';
import UserIcon from './icons/UserIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';

const NavLink: React.FC<{
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
      isActive
        ? 'bg-brand text-white'
        : 'text-text-secondary hover:bg-accent hover:text-text-primary'
    }`}
  >
    {label}
  </button>
);

const Navbar: React.FC = () => {
  const {
    rightPanelContent,
    handleToggleAgentPanel,
    handleToggleGallery,
    handleToggleHistoryPanel,
    handleToggleSettingsPanel,
    handleToggleOperatorPanel,
    handleToolChange,
    activeOperator,
    profileImageUrls,
  } = useTools();

  const [isAgentsDropdownOpen, setIsAgentsDropdownOpen] = useState(false);

  const operatorImageUrl = profileImageUrls.get(activeOperator.id) || activeOperator.profileImageUrl;

  return (
    <nav className="sticky top-0 z-20 flex-shrink-0 p-2 border-b border-accent bg-secondary shadow-md flex justify-between items-center h-16">
      {/* Left Section: Brand */}
      <div className="flex items-center gap-3">
        <MythosLogoIcon />
        <span className="text-xl font-semibold text-text-primary hidden md:block">MYTHOS</span>
      </div>

      {/* Center Section: Navigation Links */}
      <div className="flex items-center gap-2">
        {/* Agents Dropdown */}
        <div 
            className="relative"
            onMouseEnter={() => setIsAgentsDropdownOpen(true)}
            onMouseLeave={() => setIsAgentsDropdownOpen(false)}
        >
            <button
                onClick={handleToggleAgentPanel}
                className={`flex items-center gap-1 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                  rightPanelContent === 'AGENTS' || rightPanelContent === 'AGENT_PROFILE'
                    ? 'bg-brand text-white'
                    : 'text-text-secondary hover:bg-accent hover:text-text-primary'
                }`}
                aria-haspopup="true"
                aria-expanded={isAgentsDropdownOpen}
            >
                <span>Agents</span>
                <ChevronDownIcon />
            </button>
            {isAgentsDropdownOpen && (
                <div 
                    className="absolute top-full mt-2 w-48 bg-secondary border border-accent rounded-md shadow-lg z-30"
                    role="menu"
                >
                    <button
                        onClick={handleToggleAgentPanel}
                        className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-accent hover:text-text-primary transition-colors"
                        role="menuitem"
                    >
                        Agent Hub
                    </button>
                    <button
                        onClick={() => handleToolChange('COOM_BRIDGE')}
                        className="w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-accent hover:text-text-primary transition-colors"
                        role="menuitem"
                    >
                        COOM Bridge
                    </button>
                </div>
            )}
        </div>
        <NavLink
          label="Gallery"
          isActive={rightPanelContent === 'GALLERY'}
          onClick={handleToggleGallery}
        />
        <NavLink
          label="History"
          isActive={rightPanelContent === 'HISTORY'}
          onClick={handleToggleHistoryPanel}
        />
      </div>

      {/* Right Section: Actions & Profile */}
      <div className="flex items-center gap-3">
        <a
          href="/gallery.html"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-accent transition-colors"
          aria-label="Open Standalone Viewer"
          title="Open Standalone Viewer"
        >
          <ExternalLinkIcon />
        </a>

        <button
          onClick={handleToggleSettingsPanel}
          className={`p-2 rounded-full transition-colors ${
            rightPanelContent === 'SETTINGS'
              ? 'bg-brand text-white'
              : 'text-text-secondary hover:text-text-primary hover:bg-accent'
          }`}
          aria-label="Open Settings"
          title="Settings"
        >
          <SettingsIcon />
        </button>

        <button
          onClick={handleToggleOperatorPanel}
          className={`flex items-center gap-2 p-1 pr-3 rounded-full transition-colors ${
            rightPanelContent === 'OPERATOR'
              ? 'bg-brand'
              : 'hover:bg-accent'
          }`}
          aria-label="Open Operator Panel"
          title={`Active Operator: ${activeOperator.name}`}
        >
          <div className="w-8 h-8 rounded-full bg-accent overflow-hidden flex-shrink-0">
            {operatorImageUrl ? (
              <img src={operatorImageUrl} alt={activeOperator.name} className="w-full h-full object-cover" />
            ) : (
              <UserIcon />
            )}
          </div>
          <span className="text-sm font-semibold text-text-primary hidden sm:block truncate">
            {activeOperator.name}
          </span>
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
