
import React from 'react';

interface SpeakerIconProps {
  isSpeaking: boolean;
}

const SpeakerIcon: React.FC<SpeakerIconProps> = ({ isSpeaking }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
    {isSpeaking ? (
      <>
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" className="animate-[pulse_1.5s_ease-in-out_infinite]"></path>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" className="animate-[pulse_1.5s_ease-in-out_infinite_0.2s]"></path>
      </>
    ) : (
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
    )}
  </svg>
);

export default SpeakerIcon;