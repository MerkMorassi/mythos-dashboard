import React from 'react';

const IdCardIcon: React.FC = () => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="16" 
        height="16" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round"
        className="text-text-secondary"
    >
        <rect width="20" height="16" x="2" y="4" rx="2"></rect>
        <circle cx="8" cy="10" r="2"></circle>
        <path d="M14 14v-2a2 2 0 0 0-2-2h-4v4"></path>
        <path d="M14 10h4"></path>
        <path d="M14 14h4"></path>
    </svg>
);

export default IdCardIcon;