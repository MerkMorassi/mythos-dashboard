import React from 'react';
import { useChat } from '../contexts/ChatContext';
import PlayIcon from './icons/PlayIcon';

const VideoGenerationPanel: React.FC = () => {
  const { 
    isGeneratingVideo, 
    videoGenerationProgress, 
    lastGeneratedVideoUrl, 
    videoGenerationError 
  } = useChat();

  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-4">
      {isGeneratingVideo && (
        <div className="flex flex-col items-center max-w-md">
          <div className="w-16 h-16 border-4 border-brand border-t-transparent rounded-full animate-spin mb-4"></div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">{videoGenerationProgress}</h2>
          <p className="text-text-secondary">Please keep this tab open. Video generation can take several minutes.</p>
        </div>
      )}
      {!isGeneratingVideo && lastGeneratedVideoUrl && (
        <div className="w-full max-w-2xl">
          <h2 className="text-xl font-semibold text-text-primary mb-4">Generated Video</h2>
          <video src={lastGeneratedVideoUrl} controls autoPlay loop className="w-full rounded-lg shadow-lg aspect-video bg-black"></video>
        </div>
      )}
      {!isGeneratingVideo && videoGenerationError && (
        <div className="text-red-400 bg-red-500/10 p-4 rounded-lg">
          <h2 className="font-bold mb-2">Generation Failed</h2>
          <p>{videoGenerationError}</p>
        </div>
      )}
      {!isGeneratingVideo && !lastGeneratedVideoUrl && !videoGenerationError && (
        <div className="w-full max-w-2xl">
            <div className="aspect-video bg-black rounded-lg flex items-center justify-center border-2 border-dashed border-accent">
                <div className="text-center text-text-secondary">
                    <PlayIcon className="text-accent/50 inline-block" />
                    <p className="mt-2 font-semibold">Your generated video will appear here</p>
                </div>
            </div>
            <div className="mt-4 text-text-secondary">
                <h2 className="text-2xl font-semibold text-text-primary">Video Generation</h2>
                <p className="mt-2 max-w-md mx-auto">
                    Describe the video you want to create in the input below. You can also provide an optional starting image to guide the generation process.
                </p>
            </div>
        </div>
      )}
    </div>
  );
};

export default VideoGenerationPanel;