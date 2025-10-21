import React from 'react';

const PlayIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="64" 
        height="64" 
        viewBox="0 0 24 24" 
        fill="currentColor" 
        className={className || "text-accent"}
    >
        <path d="M8 5v14l11-7z"></path>
    </svg>
);

export default PlayIcon;
