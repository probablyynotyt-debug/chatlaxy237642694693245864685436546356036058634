import React from 'react';
import { MessageSquare, Compass, Sparkles, Users, Globe, Newspaper } from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'chat' | 'servers' | 'explore';
  onlineCount: number;
  hasUnreadNews: boolean;
  onOpenChat: () => void;
  onOpenServers: () => void;
  onOpenExplore: () => void;
  onOpenMoments: () => void;
  onOpenOnlineUsers: () => void;
  onOpenNews: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onlineCount,
  hasUnreadNews,
  onOpenChat,
  onOpenServers,
  onOpenExplore,
  onOpenMoments,
  onOpenOnlineUsers,
  onOpenNews,
}) => {
  return (
    <nav className="flex lg:hidden items-center justify-around w-full bg-[#14151a] border-t border-[#252733] px-2 py-1.5 shrink-0 z-30 select-none shadow-xl">
      {/* Main Chat Tab */}
      <button
        type="button"
        onClick={onOpenChat}
        className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-colors cursor-pointer ${
          activeTab === 'chat' ? 'text-violet-400 font-bold bg-violet-950/40' : 'text-neutral-400 hover:text-neutral-200'
        }`}
      >
        <MessageSquare className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">Chat</span>
      </button>

      {/* Servers Tab */}
      <button
        type="button"
        onClick={onOpenServers}
        className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-colors cursor-pointer ${
          activeTab === 'servers' ? 'text-violet-400 font-bold bg-violet-950/40' : 'text-neutral-400 hover:text-neutral-200'
        }`}
      >
        <Globe className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">Servers</span>
      </button>

      {/* Explore Tab */}
      <button
        type="button"
        onClick={onOpenExplore}
        className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg transition-colors cursor-pointer ${
          activeTab === 'explore' ? 'text-violet-400 font-bold bg-violet-950/40' : 'text-neutral-400 hover:text-neutral-200'
        }`}
      >
        <Compass className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">Explore</span>
      </button>

      {/* Moments Tab */}
      <button
        type="button"
        onClick={onOpenMoments}
        className="flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
      >
        <Sparkles className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">Moments</span>
      </button>

      {/* Online Users Tab */}
      <button
        type="button"
        onClick={onOpenOnlineUsers}
        className="flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer relative"
      >
        <div className="relative">
          <Users className="w-5 h-5" />
          <span className="absolute -top-1 -right-2 px-1 text-[9px] font-mono font-bold bg-violet-600 text-white rounded-full">
            {onlineCount}
          </span>
        </div>
        <span className="text-[10px] mt-0.5">Online</span>
      </button>

      {/* News Tab */}
      <button
        type="button"
        onClick={onOpenNews}
        className="flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-sky-400 hover:text-sky-300 transition-colors cursor-pointer relative"
      >
        <div className="relative">
          <Newspaper className="w-5 h-5" />
          {hasUnreadNews && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
          )}
        </div>
        <span className="text-[10px] mt-0.5">News</span>
      </button>
    </nav>
  );
};
