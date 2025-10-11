import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { LocalImage } from '../types';
import { fetchLocalImages, uploadLocalImages, deleteLocalImage, analyzeLocalImage } from '../services/geminiService';
import CloseIcon from './icons/CloseIcon';
import AnalyzeIcon from './icons/AnalyzeIcon';
import { useTools } from '../contexts/ToolContext';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

const LocalImageViewer: React.FC = () => {
  const [images, setImages] = useState<LocalImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [activeImage, setActiveImage] = useState<LocalImage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { isServerReady } = useTools();

  const loadImages = useCallback(async () => {
    if (!isServerReady) return;
    try {
      setError(null);
      setIsLoading(true);
      const fetchedImages = await fetchLocalImages();
      setImages(fetchedImages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load images.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [isServerReady]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const handleFiles = useCallback(async (files: FileList) => {
    if (!isServerReady) {
        setError("Server not ready. Please try again in a moment.");
        return;
    }
    const newImages = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (newImages.length === 0) return;

    const validFiles = newImages.filter(f => f.size <= MAX_FILE_SIZE);
    const oversizedFiles = newImages.filter(f => f.size > MAX_FILE_SIZE);

    if (oversizedFiles.length > 0) {
        setError(`The following files are too large (max 100MB) and were not uploaded: ${oversizedFiles.map(f => f.name).join(', ')}`);
    } else {
        setError(null); // Clear previous errors if all files are valid
    }
    
    if (validFiles.length === 0) return;
    
    try {
      setIsUploading(true);
      await uploadLocalImages(validFiles);
      await loadImages(); // Refresh the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload images.');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  }, [loadImages, isServerReady]);
  
  const handleDelete = async (e: React.MouseEvent, imageToDelete: LocalImage) => {
    e.stopPropagation();
    if (!isServerReady) {
        setError("Server not ready. Please try again.");
        return;
    }
    try {
        setImages(prev => prev.filter(img => img.id !== imageToDelete.id)); // Optimistic update
        await deleteLocalImage(imageToDelete.id);
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete image.');
        console.error(err);
        loadImages(); // Re-fetch to correct state
    }
  };

  const handleAnalyze = async (e: React.MouseEvent, imageToAnalyze: LocalImage) => {
      e.stopPropagation();
      if (!isServerReady) {
        setError("Server not ready. Please try again.");
        return;
      }
      setIsAnalyzing(true);
      try {
          const updatedImage = await analyzeLocalImage(imageToAnalyze.id);
          setImages(prev => prev.map(img => img.id === updatedImage.id ? updatedImage : img));
          setActiveImage(updatedImage); // Update modal view as well
      } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to analyze image.');
          console.error(err);
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) {
      handleFiles(e.dataTransfer.files);
      e.dataTransfer.clearData();
    }
  }, [handleFiles]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) handleFiles(e.target.files); };
  const openFileInput = () => fileInputRef.current?.click();
  const closeModal = () => setActiveImage(null);
  
  const filteredImages = useMemo(() => {
    if (!searchTerm) return images;
    const lowercasedTerm = searchTerm.toLowerCase();
    return images.filter(image => 
        image.original_filename.toLowerCase().includes(lowercasedTerm) ||
        (image.tags && image.tags.some(tag => tag.toLowerCase().includes(lowercasedTerm)))
    );
  }, [images, searchTerm]);

  return (
    <div className="flex flex-col h-full text-text-primary">
        <input type="file" id="fileInput" multiple accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
        
        {/* Header/Controls */}
        <header className="p-4 border-b border-accent flex-shrink-0 flex items-center gap-4">
             <div 
                onClick={openFileInput}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-48 h-12 border-2 border-dashed rounded-lg flex items-center justify-center text-center cursor-pointer transition-colors ${isDragging ? 'border-brand bg-accent' : 'border-accent hover:border-brand'}`}
            >
                {isUploading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <p className="text-text-secondary text-sm">Drop/Click to Add</p>}
            </div>
            <div className="relative flex-grow">
                 <input
                    type="text"
                    placeholder="Search by name or tag..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-secondary text-text-primary placeholder-text-secondary rounded-lg p-3 pr-10 border border-accent focus:ring-2 focus:ring-brand focus:outline-none"
                 />
                 {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary">
                        <CloseIcon />
                    </button>
                 )}
            </div>
        </header>

        {/* Gallery */}
        <section className="flex-1 p-4 overflow-y-auto">
             {isLoading && <div className="flex items-center justify-center h-full"><p className="text-text-secondary">Loading images...</p></div>}
             {error && <div className="flex items-center justify-center h-full"><p className="text-red-500">{error}</p></div>}
             {!isLoading && !error && images.length === 0 && (
                <div className="flex items-center justify-center h-full"><p className="text-text-secondary">Upload images to see them here.</p></div>
             )}
             {!isLoading && !error && filteredImages.length === 0 && images.length > 0 && (
                <div className="flex items-center justify-center h-full"><p className="text-text-secondary">No images match your search.</p></div>
             )}
             {!isLoading && filteredImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {filteredImages.map((image) => (
                        <div
                            key={image.id}
                            className="group relative rounded-lg overflow-hidden border border-accent hover:border-brand-hover cursor-pointer aspect-square"
                            onClick={() => setActiveImage(image)}
                        >
                            <img src={`/local_uploads/${image.filename}`} alt={image.original_filename} className="w-full h-full object-cover" />
                             <button 
                                onClick={(e) => handleDelete(e, image)}
                                className="absolute top-2 right-2 text-white bg-red-600 bg-opacity-80 rounded-full p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500 z-10"
                                aria-label="Delete image"
                             >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                             </button>
                             {image.analysis_text && (
                                <div className="absolute bottom-1 left-1 bg-brand bg-opacity-80 text-white rounded-full p-1 z-10" title="Analyzed">
                                    <AnalyzeIcon />
                                </div>
                             )}
                        </div>
                    ))}
                </div>
             )}
        </section>

        {/* Modal */}
        {activeImage && (
            <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50" onClick={closeModal}>
                <div className="flex max-w-[95vw] max-h-[95vh] h-full w-full p-4" onClick={(e) => e.stopPropagation()}>
                    <img src={`/local_uploads/${activeImage.filename}`} alt="Full size view" className="flex-1 h-full object-contain" />
                    <aside className="w-96 bg-secondary p-4 ml-4 rounded-lg overflow-y-auto flex flex-col">
                        <h3 className="text-lg font-bold border-b border-accent pb-2 mb-2 break-words">{activeImage.original_filename}</h3>
                        {!activeImage.analysis_text && (
                            <div className="flex-grow flex flex-col items-center justify-center text-center">
                                <p className="text-text-secondary mb-4">This image has not been analyzed.</p>
                                <button onClick={(e) => handleAnalyze(e, activeImage)} disabled={isAnalyzing} className="w-full py-2 px-4 bg-brand text-white font-semibold rounded-lg hover:bg-brand-hover transition-colors disabled:bg-gray-500 flex items-center justify-center">
                                    {isAnalyzing ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <><AnalyzeIcon /><span className="ml-2">Analyze Image</span></>}
                                </button>
                            </div>
                        )}
                        {activeImage.analysis_text && (
                            <>
                                {activeImage.tags && activeImage.tags.length > 0 && (
                                    <div className="mb-4">
                                        <h4 className="font-bold text-text-secondary mb-2">TAGS</h4>
                                        <div className="flex flex-wrap gap-2">
                                            {activeImage.tags.map(tag => <span key={tag} className="bg-accent text-text-primary text-xs font-semibold px-2.5 py-1 rounded-full">{tag}</span>)}
                                        </div>
                                    </div>
                                )}
                                <div className="mb-4">
                                     <h4 className="font-bold text-text-secondary mb-2">ANALYSIS</h4>
                                     <div className="prose prose-sm prose-invert text-text-primary whitespace-pre-wrap">{activeImage.analysis_text}</div>
                                </div>
                            </>
                        )}
                    </aside>
                </div>
                <button onClick={closeModal} className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-50 p-2 bg-black bg-opacity-50 rounded-full" aria-label="Close">
                    <CloseIcon />
                </button>
            </div>
        )}
    </div>
  );
};

export default LocalImageViewer;