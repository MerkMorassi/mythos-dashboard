import React from 'react';

interface WarningIconProps {
  level: 1 | 2;
}

const WarningIcon: React.FC<WarningIconProps> = ({ level }) => {
  const color = level === 1 ? '#facc15' : '#ef4444'; // yellow-400 or red-500

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill={color}
      stroke="#1a1a1a" // primary bg color for contrast
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13" stroke="#1a1a1a" strokeWidth="2"></line>
      <line x1="12" y1="17" x2="12.01" y2="17" stroke="#1a1a1a" strokeWidth="2"></line>
    </svg>
  );
};

export default WarningIcon;
