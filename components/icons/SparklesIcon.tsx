import React from 'react';

const SparklesIcon: React.FC = () => (
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
        <path d="M9.93 2.25 12 7.5l2.07-5.25"></path>
        <path d="M2.25 9.93 7.5 12l-5.25 2.07"></path>
        <path d="M16.5 12.07 21.75 14.14 16.5 16.21"></path>
        <path d="M12.07 16.5 14.14 21.75 16.21 16.5"></path>
        <path d="M12 2v2"></path><path d="M12 20v2"></path>
        <path d="m4.93 4.93 1.41 1.41"></path>
        <path d="m17.66 17.66 1.41 1.41"></path>
        <path d="M2 12h2"></path><path d="M20 12h2"></path>
        <path d="m4.93 19.07 1.41-1.41"></path>
        <path d="m17.66 6.34 1.41-1.41"></path>
    </svg>
);

export default SparklesIcon;