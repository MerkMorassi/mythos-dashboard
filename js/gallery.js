// Dekatria Photo Viewer - Core Module
class PhotoViewer {
    constructor() {
        this.images = [];
        this.imageUrls = new Map(); // For memory management
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateStatus('Drop or select images to view.');
    }

    setupEventListeners() {
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const scanButton = document.getElementById('scanButton');
        const modal = document.getElementById('imageModal');
        const closeModal = document.getElementById('closeModal');

        // Drag and drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        scanButton.addEventListener('click', () => {
            fileInput.click();
        });

        closeModal.addEventListener('click', () => {
            modal.classList.remove('active');
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });

        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                modal.classList.remove('active');
            }
        });
    }

    handleFiles(files) {
        const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        const uniqueFiles = imageFiles.filter(file => {
             // Simple duplicate check based on name and size
            return !this.images.some(img => img.name === file.name && img.size === file.size);
        });

        if (uniqueFiles.length > 0) {
           this.updateStatus(`Adding ${uniqueFiles.length} new image(s)...`);
           uniqueFiles.forEach(file => this.addImage(file));
        } else if (imageFiles.length > 0) {
            this.updateStatus(`All selected images are already in the viewer.`);
        }
    }

    addImage(file) {
        // We'll store the file object directly
        this.images.push(file);
        
        // Create an object URL for display
        const imageUrl = URL.createObjectURL(file);
        this.imageUrls.set(file, imageUrl);
        
        this.renderThumbnail(file, imageUrl);
    }

    renderThumbnail(imageFile, imageUrl) {
        const grid = document.getElementById('thumbnailGrid');
        const thumbnail = document.createElement('div');
        thumbnail.className = 'thumbnail';
        
        const img = document.createElement('img');
        img.src = imageUrl;
        img.alt = imageFile.name;
        img.loading = 'lazy';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = 'close';
        deleteBtn.title = 'Delete image';
        
        thumbnail.appendChild(img);
        thumbnail.appendChild(deleteBtn);
        
        thumbnail.addEventListener('click', (e) => {
            if (e.target !== deleteBtn) {
                this.showFullImage(imageFile, imageUrl);
            }
        });
        
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteImage(imageFile, thumbnail);
        });
        
        grid.appendChild(thumbnail);
        this.updateStatus(`${this.images.length} image(s) loaded.`);
    }

    showFullImage(imageFile, imageUrl) {
        const modal = document.getElementById('imageModal');
        const modalImage = document.getElementById('modalImage');
        
        modalImage.src = imageUrl;
        modalImage.alt = imageFile.name;
        modal.classList.add('active');
    }

    updateStatus(message) {
        const status = document.querySelector('.status');
        status.textContent = message;
    }

    deleteImage(imageFile, thumbnailElement) {
        // Remove from images array
        const index = this.images.indexOf(imageFile);
        if (index > -1) {
            this.images.splice(index, 1);
        }

        // Revoke the object URL to free memory
        const url = this.imageUrls.get(imageFile);
        if (url) {
            URL.revokeObjectURL(url);
            this.imageUrls.delete(imageFile);
        }
        
        // Remove thumbnail element
        thumbnailElement.remove();
        
        this.updateStatus(`Deleted: ${imageFile.name}. Total: ${this.images.length} image(s).`);
    }
}

// Initialize viewer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.photoViewer = new PhotoViewer();
});