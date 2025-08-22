import React, { useEffect, useState } from 'react';
import type { GalleryImage } from '../types';
import CloseIcon from './icons/CloseIcon';
import ChevronLeftIcon from './icons/ChevronLeftIcon';
import ChevronRightIcon from './icons/ChevronRightIcon';
import CopyIcon from './icons/CopyIcon';
import CheckIcon from './icons/CheckIcon';
import ThumbsUpIcon from './icons/ThumbsUpIcon';
import ThumbsDownIcon from './icons/ThumbsDownIcon';

interface GalleryLightboxProps {
  images: GalleryImage[];
  currentIndex: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onFeedback: (messageId: string, feedback: 'like' | 'dislike') => void;
}

const GalleryLightbox: React.FC<GalleryLightboxProps> = ({ images, currentIndex, onClose, onPrev, onNext, onFeedback }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, onPrev, onNext]);

  useEffect(() => {
    // Reset copied state when image changes
    setCopied(false);
  }, [currentIndex]);

  if (currentIndex < 0 || currentIndex >= images.length) {
    return null;
  }

  const currentImage = images[currentIndex];

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(currentImage.prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
        <img 
          src={`/uploads/${currentImage.filename}`} 
          alt={currentImage.prompt} 
          className="max-w-full max-h-[80vh] object-contain" 
        />
        <div className="text-left text-white mt-2 p-3 bg-black bg-opacity-60 rounded-md text-sm">
          <div className="flex justify-between items-start">
            <div className="flex-grow">
              <p className="font-bold text-text-secondary">PROMPT</p>
              <p className="pr-4">{currentImage.prompt}</p>
            </div>
            <div className="flex items-center flex-shrink-0">
               <button
                  onClick={handleCopy}
                  className="p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-accent transition-colors"
                  aria-label={copied ? "Copied" : "Copy prompt"}
                >
                  {copied ? <CheckIcon /> : <CopyIcon />}
              </button>
              <div className="flex items-center gap-1 border-l border-accent/50 pl-2 ml-2">
                <button
                    onClick={(e) => { e.stopPropagation(); onFeedback(currentImage.client_message_id, 'like'); }}
                    className={`p-1 rounded-full hover:bg-accent transition-colors ${currentImage.feedback === 'like' ? 'text-green-400' : 'text-text-secondary'}`}
                    aria-label="Like image"
                >
                    <ThumbsUpIcon />
                </button>
                 <button
                    onClick={(e) => { e.stopPropagation(); onFeedback(currentImage.client_message_id, 'dislike'); }}
                    className={`p-1 rounded-full hover:bg-accent transition-colors ${currentImage.feedback === 'dislike' ? 'text-red-400' : 'text-text-secondary'}`}
                    aria-label="Dislike image"
                >
                    <ThumbsDownIcon />
                </button>
              </div>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-accent/50 grid grid-cols-2 gap-x-4">
            {currentImage.seed != null && (
              <div>
                <p className="font-bold text-text-secondary">SEED</p>
                <p>{currentImage.seed}</p>
              </div>
            )}
             <div>
               <p className="font-bold text-text-secondary">CREATED</p>
               <p>{new Date(currentImage.created_at).toLocaleString()}</p>
             </div>
          </div>
        </div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-50 p-2 bg-black bg-opacity-50 rounded-full"
        aria-label="Close"
      >
        <CloseIcon />
      </button>

      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors z-50 p-2 bg-black bg-opacity-50 rounded-full"
            aria-label="Previous image"
          >
            <ChevronLeftIcon />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 transition-colors z-50 p-2 bg-black bg-opacity-50 rounded-full"
            aria-label="Next image"
          >
            <ChevronRightIcon />
          </button>
        </>
      )}
    </div>
  );
};

export default GalleryLightbox;