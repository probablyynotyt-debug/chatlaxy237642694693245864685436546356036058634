import React, { useState } from 'react';
import { Search, X, Sparkles, Image, Smile } from 'lucide-react';

interface GifStickerPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGif: (gifUrl: string) => void;
  onSelectSticker: (stickerUrl: string) => void;
}

const CHATLAXY_STICKERS = [
  { id: 'st1', name: 'Astro Rocket', url: 'https://images.unsplash.com/photo-1517976487492-5750f3195933?auto=format&fit=crop&w=300&q=80' },
  { id: 'st2', name: 'Galaxy Gem', url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=300&q=80' },
  { id: 'st3', name: 'Cute Cat', url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=300&q=80' },
  { id: 'st4', name: 'Hype Fire', url: 'https://images.unsplash.com/photo-1519074069444-1ba4eff56022?auto=format&fit=crop&w=300&q=80' },
  { id: 'st5', name: 'VIP Crown', url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=300&q=80' },
  { id: 'st6', name: 'Neon Heart', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=300&q=80' },
];

const CURATED_GIFS = [
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbnZrcWRzcWNrdmpxOHl3Z2lsb3dwdmdudGtzZnQwdW5rdTBvaDFnZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0HlHFRbmaZtBRhXG/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3ZuaGFwN2NrcTZmZGt5ZzMzcjdzaDF0dXpyYnY4YjRsdmVpd3Y3OCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3o7TKSjRrfIPjeiVyM/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHk1MGpncHdqdXpramUxbnp5cW5icWV0eTlhdWk3eHRzZjU4YjY3ZiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3oKIPnAiaMCws8nOsE/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMWk3amFqODltY3ZqbzZ2dGlqczRjczF6cjJtdGZ3OGtzcXFwZGkwaSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/d31w24psGYeekCXY/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbXZpMnZtMmRndThtODg1aWZ3Mnd2aG4zYnMzODZiaTNqdmluZm9zbiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26ufdipQqU2lhNA4g/giphy.gif',
  'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHNxcGNsbmRreGZ0NzVzNWpnbnN1bzRsaHRyMmVydDFsdTFvNW5rdSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l0AM3Z50x91IflhM4/giphy.gif',
];

export const GifStickerPickerModal: React.FC<GifStickerPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectGif,
  onSelectSticker,
}) => {
  const [activeTab, setActiveTab] = useState<'gifs' | 'stickers'>('gifs');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#161720] border border-[#282b3d] rounded-xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden text-left animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#252838] bg-[#181a23]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-bold text-neutral-100">GIFs & Stickers</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher & Search */}
        <div className="p-3 border-b border-[#242636] bg-[#12131a] flex flex-col gap-2.5">
          <div className="flex bg-[#191b26] p-1 rounded-lg border border-[#2b2d3d]">
            <button
              type="button"
              onClick={() => setActiveTab('gifs')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                activeTab === 'gifs' ? 'bg-violet-600 text-white shadow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              GIFs
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stickers')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                activeTab === 'stickers' ? 'bg-violet-600 text-white shadow' : 'text-neutral-400 hover:text-white'
              }`}
            >
              Stickers
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="w-full pl-8 pr-3 py-1.5 bg-[#0f1016] border border-[#282a3a] focus:border-violet-500 rounded-lg text-xs text-neutral-100 outline-none"
            />
          </div>
        </div>

        {/* Content Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'gifs' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {CURATED_GIFS.map((gif, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onSelectGif(gif);
                    onClose();
                  }}
                  className="rounded-lg overflow-hidden border border-[#27293a] hover:border-violet-500 hover:scale-[1.02] transition-all cursor-pointer aspect-video bg-black"
                >
                  <img src={gif} alt="GIF" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {CHATLAXY_STICKERS.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    onSelectSticker(st.url);
                    onClose();
                  }}
                  className="p-3 bg-[#12131b] border border-[#27293a] hover:border-violet-500 hover:bg-[#1a1b26] rounded-xl flex flex-col items-center gap-2 transition-all cursor-pointer group"
                >
                  <img src={st.url} alt={st.name} className="w-16 h-16 object-cover rounded-lg group-hover:scale-105 transition-transform" />
                  <span className="text-[11px] font-bold text-neutral-300 group-hover:text-violet-300">{st.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
