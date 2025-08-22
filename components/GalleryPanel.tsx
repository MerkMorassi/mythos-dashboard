

import React from 'react';
import type { GalleryImage } from '../types';
import CloseIcon from './icons/CloseIcon';

interface GalleryPanelProps {
  images: GalleryImage[];
  isLoading: boolean;
  onImageClick: (index: number) => void;
  onDragStart: (e: React.DragEvent<HTMLDivElement>, image: GalleryImage) => void;
  onClose: () => void;
}

const GalleryPanel: React.FC<GalleryPanelProps> = ({ images, isLoading, onImageClick, onDragStart, onClose }) => {
  return (
    <div className="w-full h-full bg-secondary flex flex-col">
      <div className="p-4 border-b border-accent flex justify-between items-center flex-shrink-0">
        <h2 className="text-lg font-semibold text-text-primary">Gallery</h2>
        <button
          onClick={onClose}
          className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-accent transition-colors"
          aria-label="Close gallery"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && <p className="text-text-secondary text-center">Loading gallery...</p>}
        {!isLoading && images.length === 0 && <p className="text-text-secondary text-center">No images found.</p>}
        <div className="grid grid-cols-2 gap-4">
          {images.map((img, index) => (
            <div
              key={img.filename}
              className="group relative rounded-lg overflow-hidden border border-accent cursor-pointer"
              onClick={() => onImageClick(index)}
              draggable="true"
              onDragStart={(e) => onDragStart(e, img)}
            >
              <img src={`/${img.filename}`} alt={img.prompt} className="w-full h-full object-cover aspect-square" />
              <div className="absolute inset-0 bg-black bg-opacity-70 opacity-0 group-hover:opacity-100 transition-opacity p-2 text-xs text-text-primary overflow-y-auto">
                <p className="font-bold">Prompt:</p>
                <p className="mb-2 line-clamp-3">{img.prompt}</p>
                {img.seed && (
                  <>
                    <p className="font-bold border-t border-accent/50 pt-1 mt-1">Seed:</p>
                    <p>{img.seed}</p>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GalleryPanel;