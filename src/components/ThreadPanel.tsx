import React, { useState } from 'react';
import { X, Send, MessageSquare, CornerUpLeft } from 'lucide-react';
import { ChatMessage } from '../types/chat';
import { FormattedMessageText } from './FormattedMessageText';
import { UserAvatar } from './UserAvatar';

interface ThreadPanelProps {
  parentMessage: ChatMessage | null;
  onClose: () => void;
  onSendThreadReply: (parentMessageId: string, text: string) => void;
}

export const ThreadPanel: React.FC<ThreadPanelProps> = ({
  parentMessage,
  onClose,
  onSendThreadReply,
}) => {
  const [replyText, setReplyText] = useState('');

  if (!parentMessage) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    onSendThreadReply(parentMessage.id, replyText.trim());
    setReplyText('');
  };

  return (
    <div className="w-full sm:w-96 max-w-full h-full bg-[#151620] border-l border-[#27293a] flex flex-col shadow-2xl z-30 select-none animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#262838] bg-[#181a24]">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-violet-400" />
          <h3 className="text-xs font-bold text-neutral-100">Thread Reply</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-neutral-400 hover:text-white rounded transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Parent Message Card */}
      <div className="p-3.5 bg-[#101118] border-b border-[#232535] flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <UserAvatar src={parentMessage.senderAvatar} username={parentMessage.senderName} size="sm" />
          <div className="flex flex-col">
            <span className="text-xs font-bold text-violet-300">@{parentMessage.senderName}</span>
            <span className="text-[10px] text-neutral-500 font-mono">{parentMessage.formattedTime}</span>
          </div>
        </div>
        <div className="p-2.5 bg-[#171822] border border-[#2b2d3d] rounded-lg text-xs">
          <FormattedMessageText content={parentMessage.content} />
        </div>
      </div>

      {/* Thread Messages List */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-bold uppercase tracking-wider my-1">
          <CornerUpLeft className="w-3.5 h-3.5 text-violet-400" />
          <span>Replies to thread</span>
        </div>

        <div className="p-3 bg-[#12131b] border border-[#232535] rounded-lg text-xs text-neutral-400 italic">
          Start typing below to add a reply to this thread conversation!
        </div>
      </div>

      {/* Reply Input Form */}
      <form onSubmit={handleSubmit} className="p-3 bg-[#13141d] border-t border-[#252737] flex items-center gap-2">
        <input
          type="text"
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder={`Reply in thread...`}
          className="flex-1 px-3 py-2 bg-[#0e0f15] border border-[#2a2c3d] focus:border-violet-500 rounded-lg text-xs text-neutral-100 outline-none"
        />
        <button
          type="submit"
          disabled={!replyText.trim()}
          className="p-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg transition-colors cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
