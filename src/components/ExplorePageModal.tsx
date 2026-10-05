import React, { useState, useEffect } from 'react';
import { Compass, TrendingUp, Users, Activity, Sparkles, X, ExternalLink } from 'lucide-react';
import { ChatMessage } from '../types/chat';
import { ProfileData } from '../types/bio';
import { FormattedMessageText } from './FormattedMessageText';
import { UserAvatar } from './UserAvatar';

interface ExplorePageModalProps {
  isOpen: boolean;
  messages: ChatMessage[];
  allUsers?: Record<string, ProfileData>;
  onClose: () => void;
  onOpenProfile: (username: string) => void;
}

export const ExplorePageModal: React.FC<ExplorePageModalProps> = ({
  isOpen,
  messages,
  allUsers = {},
  onClose,
  onOpenProfile,
}) => {
  const [activeTab, setActiveTab] = useState<'trending' | 'profiles' | 'activity'>('trending');

  if (!isOpen) return null;

  // Filter top messages by reaction counts / content
  const trendingMessages = [...messages]
    .filter((m) => m.content && !m.isSystemBot)
    .sort((a, b) => {
      const aReactions = a.reactions ? Object.values(a.reactions).reduce((sum, arr) => sum + arr.length, 0) : 0;
      const bReactions = b.reactions ? Object.values(b.reactions).reduce((sum, arr) => sum + arr.length, 0) : 0;
      return bReactions - aReactions;
    })
    .slice(0, 10);

  const userList = Object.values(allUsers).slice(0, 12);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[#161720] border border-[#282b3d] rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-left animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#252838] bg-[#181a23]">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-violet-400" />
            <h3 className="text-sm font-bold text-neutral-100">Explore Chatlaxy</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="p-3 border-b border-[#242636] bg-[#12131a] flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('trending')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'trending'
                ? 'bg-violet-600 text-white shadow'
                : 'bg-[#181a25] text-neutral-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Trending Messages</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profiles')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'profiles'
                ? 'bg-violet-600 text-white shadow'
                : 'bg-[#181a25] text-neutral-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Discover Profiles</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'activity'
                ? 'bg-violet-600 text-white shadow'
                : 'bg-[#181a25] text-neutral-400 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Activity Feed</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'trending' && (
            <div className="flex flex-col gap-3">
              {trendingMessages.length === 0 ? (
                <div className="py-12 text-center text-xs text-neutral-500">
                  No trending messages yet. Start chatting to surface top content!
                </div>
              ) : (
                trendingMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-3.5 bg-[#12131b] border border-[#252736] hover:border-violet-500/50 rounded-xl flex flex-col gap-2 transition-all shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserAvatar src={msg.senderAvatar} username={msg.senderName} size="sm" />
                        <button
                          type="button"
                          onClick={() => {
                            onOpenProfile(msg.senderName);
                            onClose();
                          }}
                          className="text-xs font-bold text-violet-300 hover:underline cursor-pointer"
                        >
                          @{msg.senderName}
                        </button>
                      </div>
                      <span className="text-[10px] text-neutral-500 font-mono">{msg.formattedTime}</span>
                    </div>

                    <div className="text-xs">
                      <FormattedMessageText content={msg.content} />
                    </div>

                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className="flex items-center gap-1.5 pt-1 border-t border-[#1f212e]">
                        {Object.entries(msg.reactions).map(([emoji, users]) => (
                          <span
                            key={emoji}
                            className="px-2 py-0.5 rounded-full text-[11px] bg-[#1a1c27] border border-[#2a2c3c] text-neutral-300 font-bold"
                          >
                            {emoji} {users.length}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'profiles' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {userList.map((user) => (
                <div
                  key={user.username}
                  className="p-3.5 bg-[#12131b] border border-[#252736] hover:border-violet-500/50 rounded-xl flex items-center justify-between gap-3 transition-all shadow"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar src={user.profilePicture} username={user.username} size="md" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-neutral-100 truncate">@{user.username}</span>
                      <span className="text-[10px] text-violet-400 font-semibold uppercase">
                        Level {user.level || 1} • {user.rank || 'VIP'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenProfile(user.username);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="flex flex-col gap-2.5">
              <div className="p-3 bg-[#12131b] border border-[#252736] rounded-xl flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
                <div className="flex flex-col text-xs">
                  <span className="font-bold text-neutral-200">System Activity Feed</span>
                  <span className="text-neutral-400">Live milestone updates and achievements earned across Chatlaxy.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
