import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface LightboxModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

export const LightboxModal: React.FC<LightboxModalProps> = ({ imageUrl, onClose }) => {
  const [scale, setScale] = useState(1);

  if (!imageUrl) return null;

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.5, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.5, 1));
  const handleReset = () => setScale(1);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-4 animate-in fade-in duration-200">
      {/* Top Bar */}
      <div className="flex items-center justify-between text-white pt-2 px-2">
        <span className="text-xs font-semibold text-slate-300">Image Lightbox Preview (+Zoom)</span>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Image with Zoom Scale */}
      <div className="flex-1 flex items-center justify-center overflow-hidden p-2">
        <img
          src={imageUrl}
          alt="Product Lightbox Preview"
          style={{ transform: `scale(${scale})` }}
          className="max-h-[70vh] max-w-full object-contain rounded-2xl shadow-2xl transition-transform duration-200 cursor-grab"
        />
      </div>

      {/* Bottom Controls */}
      <div className="flex items-center justify-center space-x-4 pb-6">
        <button
          onClick={handleZoomOut}
          disabled={scale <= 1}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center space-x-1.5 backdrop-blur-sm disabled:opacity-40 transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
          <span>Zoom Out</span>
        </button>

        <button
          onClick={handleReset}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center space-x-1.5 backdrop-blur-sm transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          <span>{Math.round(scale * 100)}%</span>
        </button>

        <button
          onClick={handleZoomIn}
          disabled={scale >= 3}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center space-x-1.5 backdrop-blur-sm disabled:opacity-40 transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
          <span>Zoom In</span>
        </button>
      </div>
    </div>
  );
};
