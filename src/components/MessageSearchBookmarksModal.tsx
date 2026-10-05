import React, { useState } from 'react';
import { Search, Bookmark, Pin, X, MessageSquare, ExternalLink } from 'lucide-react';
import { ChatMessage } from '../types/chat';

interface MessageSearchBookmarksModalProps {
  isOpen: boolean;
  mode: 'search' | 'bookmarks' | 'pinned';
  messages: ChatMessage[];
  bookmarkedIds?: string[];
  onClose: () => void;
  onJumpToMessage?: (messageId: string) => void;
}

export const MessageSearchBookmarksModal: React.FC<MessageSearchBookmarksModalProps> = ({
  isOpen,
  mode,
  messages,
  bookmarkedIds = [],
  onClose,
  onJumpToMessage,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  let filteredMessages: ChatMessage[] = [];

  if (mode === 'pinned') {
    filteredMessages = messages.filter((m) => m.isPinned);
  } else if (mode === 'bookmarks') {
    const bookmarkedSet = new Set(bookmarkedIds);
    filteredMessages = messages.filter((m) => bookmarkedSet.has(m.id));
  } else {
    // Search mode
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filteredMessages = messages.filter(
        (m) => m.content.toLowerCase().includes(q) || m.senderName.toLowerCase().includes(q)
      );
    } else {
      filteredMessages = messages.slice(-20); // default recent
    }
  }

  const title =
    mode === 'pinned'
      ? '📌 Pinned Messages'
      : mode === 'bookmarks'
      ? '🔖 Bookmarked Messages'
      : '🔍 Search Messages';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#161720] border border-[#272a3a] rounded-xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden text-left animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#252838] bg-[#181a23]">
          <h3 className="text-sm font-bold text-neutral-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar for Search Mode */}
        {mode === 'search' && (
          <div className="p-3 border-b border-[#242636] bg-[#12131a]">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type to search chat messages or usernames..."
                autoFocus
                className="w-full pl-9 pr-3 py-2 text-xs bg-[#191b24] border border-[#2d2f40] focus:border-violet-500 rounded-lg text-neutral-100 placeholder-neutral-500 outline-none transition-colors"
              />
            </div>
          </div>
        )}

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
          {filteredMessages.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-neutral-500 text-xs">
              <MessageSquare className="w-8 h-8 mb-2 text-neutral-600" />
              <span>No messages found</span>
            </div>
          ) : (
            filteredMessages.map((msg) => (
              <div
                key={msg.id}
                className="p-3 bg-[#12131b] border border-[#252736] hover:border-violet-500/40 rounded-lg flex flex-col gap-1 transition-all"
              >
                <div className="flex items-center justify-between text-[11px] text-neutral-400">
                  <span className="font-bold text-violet-300">@{msg.senderName}</span>
                  <span className="font-mono text-neutral-500">{msg.formattedTime}</span>
                </div>
                <p className="text-xs text-neutral-200 break-words leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </p>
                {onJumpToMessage && (
                  <button
                    type="button"
                    onClick={() => {
                      onJumpToMessage(msg.id);
                      onClose();
                    }}
                    className="self-end mt-1 text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-1 font-semibold cursor-pointer"
                  >
                    <span>Jump to message</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
