import React, { useState } from 'react';
import { Search, X } from 'lucide-react';

interface ReactionPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onClose: () => void;
}

const COMMON_EMOJIS = [
  '❤️', '🔥', '👍', '👎', '😂', '😮', '😢', '🎉', '💯', '✨',
  '🚀', '👑', '💀', '🙏', '👀', '🤯', '💎', '⭐', '🤝', '⚡',
  '😎', '🥳', '💩', '🤡', '🤔', '💪', '🏆', '🎯', '🔥', '💖'
];

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  onSelectEmoji,
  onClose,
}) => {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? COMMON_EMOJIS.filter((e) => e.includes(search.trim()))
    : COMMON_EMOJIS;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute bottom-full mb-2 left-0 z-50 w-64 bg-[#171822] border border-[#2d2f40] rounded-xl shadow-2xl p-3 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150 select-none"
    >
      {/* Header & Search */}
      <div className="flex items-center justify-between gap-2 border-b border-[#252736] pb-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reaction..."
            className="w-full pl-8 pr-2 py-1 text-xs bg-[#101117] border border-[#282a3a] rounded-md text-neutral-100 placeholder-neutral-500 outline-none focus:border-violet-500 transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-neutral-400 hover:text-white rounded transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Emoji Grid */}
      <div className="grid grid-cols-5 gap-1.5 max-h-40 overflow-y-auto p-1">
        {filtered.map((emoji, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => {
              onSelectEmoji(emoji);
              onClose();
            }}
            className="w-9 h-9 flex items-center justify-center text-lg hover:bg-violet-600/30 hover:scale-110 rounded-lg transition-all cursor-pointer"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
