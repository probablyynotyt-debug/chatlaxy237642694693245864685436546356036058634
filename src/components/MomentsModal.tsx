import React, { useState, useEffect } from 'react';
import { X, Sparkles, Plus, Image, Trash2, Heart } from 'lucide-react';
import { ProfileData } from '../types/bio';
import { uploadNewsMediaToCloudinary } from '../utils/cloudinary';
import { UserAvatar } from './UserAvatar';

export interface MomentPost {
  id: string;
  authorUsername: string;
  authorAvatar: string | null;
  content: string;
  mediaUrl?: string | null;
  likes: string[];
  timestamp: number;
}

interface MomentsModalProps {
  isOpen: boolean;
  currentUser: ProfileData;
  onClose: () => void;
}

export const MomentsModal: React.FC<MomentsModalProps> = ({
  isOpen,
  currentUser,
  onClose,
}) => {
  const [moments, setMoments] = useState<MomentPost[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/moments')
        .then((r) => (r.ok ? r.json() : []))
        .then((list) => setMoments(Array.isArray(list) ? list : []))
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !selectedFile) return;

    setIsUploading(true);
    try {
      let mediaUrl: string | null = null;
      if (selectedFile) {
        const uploadRes = await uploadNewsMediaToCloudinary(selectedFile);
        mediaUrl = uploadRes.url;
      }

      const res = await fetch('/api/moments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          mediaUrl,
        }),
      });

      if (res.ok) {
        const newMoment = await res.json();
        setMoments((prev) => [newMoment, ...prev]);
        setContent('');
        setSelectedFile(null);
        setIsCreating(false);
      }
    } catch (err) {
      console.warn('Create moment error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleLike = async (momentId: string) => {
    try {
      const res = await fetch(`/api/moments/${momentId}/like`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        setMoments((prev) => prev.map((m) => (m.id === momentId ? updated : m)));
      }
    } catch {}
  };

  const handleDelete = async (momentId: string) => {
    try {
      await fetch(`/api/moments/${momentId}`, { method: 'DELETE' });
      setMoments((prev) => prev.filter((m) => m.id !== momentId));
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none animate-in fade-in duration-150">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#161720] border border-[#272a3a] rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-left animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#252838] bg-[#181a23]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-neutral-100">Chatlaxy Moments (24h Disappearing)</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-white rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="p-3 border-b border-[#242636] bg-[#12131a] flex items-center justify-between">
          <span className="text-xs text-neutral-400">Temporary status posts & snaps</span>
          <button
            type="button"
            onClick={() => setIsCreating(!isCreating)}
            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-md flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Moment</span>
          </button>
        </div>

        {/* Create Form */}
        {isCreating && (
          <form onSubmit={handleCreate} className="p-4 bg-[#14151e] border-b border-[#262838] flex flex-col gap-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's happening right now?"
              rows={2}
              className="w-full p-2.5 bg-[#0e0f15] border border-[#2a2c3a] focus:border-violet-500 rounded-lg text-xs text-neutral-100 placeholder-neutral-500 outline-none transition-colors"
            />

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200 cursor-pointer">
                <Image className="w-4 h-4" />
                <span>{selectedFile ? selectedFile.name : 'Attach Photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>

              <button
                type="submit"
                disabled={isUploading || (!content.trim() && !selectedFile)}
                className="py-1.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-md shadow transition-colors cursor-pointer"
              >
                {isUploading ? 'Posting...' : 'Post Moment'}
              </button>
            </div>
          </form>
        )}

        {/* Moments Feed */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {moments.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center text-neutral-500 text-xs">
              <Sparkles className="w-8 h-8 mb-2 text-amber-500/50" />
              <span>No active moments. Be the first to share one!</span>
            </div>
          ) : (
            moments.map((m) => {
              const hasLiked = m.likes?.includes(currentUser.username);
              return (
                <div key={m.id} className="p-3.5 bg-[#12131b] border border-[#252736] rounded-xl flex flex-col gap-2.5 shadow-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserAvatar src={m.authorAvatar} username={m.authorUsername} size="sm" />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-neutral-200">@{m.authorUsername}</span>
                        <span className="text-[10px] text-neutral-500 font-mono">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {m.authorUsername.toLowerCase() === currentUser.username.toLowerCase() && (
                      <button
                        type="button"
                        onClick={() => handleDelete(m.id)}
                        className="p-1 text-neutral-500 hover:text-red-400 rounded transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {m.content && <p className="text-xs text-neutral-200 leading-relaxed">{m.content}</p>}

                  {m.mediaUrl && (
                    <div className="rounded-lg overflow-hidden max-h-60 border border-[#282a3a]">
                      <img src={m.mediaUrl} alt="Moment photo" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 pt-1 text-xs text-neutral-400">
                    <button
                      type="button"
                      onClick={() => handleLike(m.id)}
                      className={`flex items-center gap-1 px-2 py-1 rounded transition-colors cursor-pointer ${
                        hasLiked ? 'text-red-400 bg-red-950/30' : 'hover:text-red-300'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${hasLiked ? 'fill-current text-red-500' : ''}`} />
                      <span>{m.likes ? m.likes.length : 0}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
