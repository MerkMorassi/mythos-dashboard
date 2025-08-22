

import React from 'react';
import CloseIcon from './icons/CloseIcon';

interface PerchancePromptPanelProps {
  formData: {
    description: string;
    negative: string;
    numImages: string;
    shape: string;
    Gscale: string;
    seed: string;
  };
  setFormData: (data: PerchancePromptPanelProps['formData']) => void;
  onGenerate: () => void;
  onClose: () => void;
}

const PerchancePromptPanel: React.FC<PerchancePromptPanelProps> = ({ formData, setFormData, onGenerate, onClose }) => {

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  return (
    <aside className="w-full h-full bg-secondary flex flex-col">
      <div className="p-4 border-b border-accent flex justify-between items-center flex-shrink-0">
        <h2 className="text-lg font-semibold text-text-primary">Perchance Builder</h2>
        <button
          onClick={onClose}
          className="p-1 rounded-full text-text-secondary hover:text-text-primary hover:bg-accent transition-colors"
          aria-label="Close prompt builder"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label htmlFor="description" className="block text-sm font-bold text-text-secondary mb-1">Positive Prompt</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows={6}
            className="w-full bg-accent text-text-primary placeholder-text-secondary rounded-lg p-2 resize-y border border-accent focus:ring-2 focus:ring-brand focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="negative" className="block text-sm font-bold text-text-secondary mb-1">Negative Prompt</label>
          <textarea
            id="negative"
            name="negative"
            value={formData.negative}
            onChange={handleInputChange}
            rows={4}
            className="w-full bg-accent text-text-primary placeholder-text-secondary rounded-lg p-2 resize-y border border-accent focus:ring-2 focus:ring-brand focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label htmlFor="numImages" className="block text-sm font-bold text-text-secondary mb-1">Generations</label>
                <select id="numImages" name="numImages" value={formData.numImages} onChange={handleInputChange} className="w-full bg-accent text-text-primary rounded-lg p-2 border border-accent focus:ring-2 focus:ring-brand focus:outline-none">
                    <option>6 (Default)</option><option>1</option><option>2</option><option>3</option><option>6</option><option>9</option><option>12</option><option>15</option><option>18</option><option>21</option><option>24</option>
                </select>
            </div>
            <div>
                <label htmlFor="Gscale" className="block text-sm font-bold text-text-secondary mb-1">Guidance</label>
                <select id="Gscale" name="Gscale" value={formData.Gscale} onChange={handleInputChange} className="w-full bg-accent text-text-primary rounded-lg p-2 border border-accent focus:ring-2 focus:ring-brand focus:outline-none">
                    <option>7</option><option>1</option><option>2</option><option>3</option><option>4</option><option>5</option><option>6</option><option>8</option><option>9</option><option>10</option><option>11</option><option>12</option><option>13</option><option>14</option><option>15</option><option>16</option><option>17</option><option>18</option><option>19</option><option>20</option><option>21</option><option>22</option><option>23</option><option>24</option><option>25</option><option>26</option><option>27</option><option>28</option><option>29</option><option>30</option>
                </select>
            </div>
        </div>
        <div>
          <label htmlFor="shape" className="block text-sm font-bold text-text-secondary mb-1">Dimensions</label>
          <select id="shape" name="shape" value={formData.shape} onChange={handleInputChange} className="w-full bg-accent text-text-primary rounded-lg p-2 border border-accent focus:ring-2 focus:ring-brand focus:outline-none">
            <option>Landscape (768x512)</option>
            <option>Portrait (512x768)</option>
            <option>Square (512x512)</option>
          </select>
        </div>
         <div>
          <label htmlFor="seed" className="block text-sm font-bold text-text-secondary mb-1">Seed</label>
          <input
            type="text"
            id="seed"
            name="seed"
            value={formData.seed}
            onChange={handleInputChange}
            className="w-full bg-accent text-text-primary placeholder-text-secondary rounded-lg p-2 border border-accent focus:ring-2 focus:ring-brand focus:outline-none"
            placeholder="Leave blank for random"
          />
        </div>
      </div>
      <div className="p-4 border-t border-accent mt-auto">
        <button
          onClick={onGenerate}
          className="w-full py-2 px-4 bg-brand text-white font-semibold rounded-lg hover:bg-brand-hover transition-colors"
        >
          Open Perchance with Prompts
        </button>
      </div>
    </aside>
  );
};

export default PerchancePromptPanel;