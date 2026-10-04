import React, { useState, useRef } from 'react';
import { X, Upload, RefreshCw, Image as ImageIcon, Loader2, Sparkles, Server } from 'lucide-react';
import { uploadImageToCloudinary } from '../utils/cloudinary';
import { createServer, ServerData } from '../services/apiService';

interface CreateServerModalProps {
  isOpen: boolean;
  currentUsername: string;
  onClose: () => void;
  onServerCreated: (server: ServerData) => void;
}

export const CreateServerModal: React.FC<CreateServerModalProps> = ({
  isOpen,
  currentUsername,
  onClose,
  onServerCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconUrl, setIconUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const iconInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingIcon(true);
      try {
        const url = await uploadImageToCloudinary(file, { isBanner: false });
        setIconUrl(url);
      } catch (err: any) {
        setError('Failed to upload icon. You can still create without one.');
      } finally {
        setIsUploadingIcon(false);
      }
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingBanner(true);
      try {
        const url = await uploadImageToCloudinary(file, { isBanner: true });
        setBannerUrl(url);
      } catch (err: any) {
        setError('Failed to upload banner.');
      } finally {
        setIsUploadingBanner(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a server name.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const created = await createServer(
        name.trim(),
        currentUsername,
        iconUrl,
        bannerUrl,
        description.trim()
      );

      if (created) {
        onServerCreated(created);
        onClose();
      } else {
        setError('Could not create server. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'Server creation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-[#15171d] border border-[#262835] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#232630] bg-[#181a22]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-100">Create a New Server</h2>
              <p className="text-[11px] text-neutral-400">Your server, custom roles, channels & full Developer controls</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex flex-col gap-4">
          {error && (
            <div className="p-2.5 rounded-md bg-red-950/60 border border-red-800 text-red-200 text-xs">
              {error}
            </div>
          )}

          {/* Server Name */}
          <div className="flex flex-col gap-1.5 text-left">
            <label className="text-xs font-semibold text-neutral-200">
              Server Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Galaxy Lounge, Chill Zone, Gamers Club"
              maxLength={40}
              className="w-full px-3.5 py-2.5 text-sm bg-[#111216] border border-[#2b2d39] focus:border-violet-400 rounded-md text-neutral-100 placeholder-neutral-500 outline-none transition-colors"
            />
          </div>

          {/* Server Description */}
          <div className="flex flex-col gap-1.5 text-left">
            <label className="text-xs font-semibold text-neutral-200">
              Description / Tagline
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of what your community is all about..."
              maxLength={120}
              className="w-full px-3.5 py-2.5 text-sm bg-[#111216] border border-[#2b2d39] focus:border-violet-400 rounded-md text-neutral-100 placeholder-neutral-500 outline-none transition-colors"
            />
          </div>

          {/* Icon & Banner Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Server Icon */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-semibold text-neutral-200">Server Icon</label>
              <div className="flex items-center gap-3 p-3 bg-[#111216] border border-[#282a36] rounded-md">
                <div className="w-12 h-12 rounded-full bg-[#1e2029] border border-[#303342] flex items-center justify-center overflow-hidden shrink-0">
                  {iconUrl ? (
                    <img src={iconUrl} alt="Icon" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-neutral-400">
                      {name.trim() ? name.trim().slice(0, 2).toUpperCase() : '🪐'}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <button
                    type="button"
                    onClick={() => iconInputRef.current?.click()}
                    disabled={isUploadingIcon}
                    className="py-1 px-2.5 bg-[#252733] hover:bg-[#2f3242] text-neutral-200 text-xs font-medium rounded transition-colors flex items-center gap-1.5 justify-center cursor-pointer"
                  >
                    {isUploadingIcon ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : iconUrl ? (
                      <RefreshCw className="w-3 h-3" />
                    ) : (
                      <Upload className="w-3 h-3" />
                    )}
                    <span>{iconUrl ? 'Change' : 'Upload Icon'}</span>
                  </button>
                  {iconUrl && (
                    <button
                      type="button"
                      onClick={() => setIconUrl(null)}
                      className="text-[10px] text-neutral-400 hover:text-red-400 text-left"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <input
                ref={iconInputRef}
                type="file"
                accept="image/*"
                onChange={handleIconUpload}
                className="hidden"
              />
            </div>

            {/* Server Banner */}
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-semibold text-neutral-200">Header Banner</label>
              <div className="relative h-18 bg-[#111216] border border-[#282a36] rounded-md overflow-hidden flex items-center justify-center">
                {bannerUrl ? (
                  <>
                    <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => bannerInputRef.current?.click()}
                      className="absolute inset-0 bg-black/40 hover:bg-black/60 flex items-center justify-center text-xs font-medium text-white transition-colors cursor-pointer"
                    >
                      {isUploadingBanner ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Change Banner'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => bannerInputRef.current?.click()}
                    disabled={isUploadingBanner}
                    className="w-full h-full flex flex-col items-center justify-center gap-1 text-neutral-400 hover:text-neutral-200 hover:bg-[#1a1c24] transition-colors cursor-pointer"
                  >
                    {isUploadingBanner ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <ImageIcon className="w-4 h-4 text-neutral-500" />
                        <span className="text-[11px]">Upload Banner</span>
                      </>
                    )}
                  </button>
                )}
              </div>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                onChange={handleBannerUpload}
                className="hidden"
              />
            </div>
          </div>

          {/* Perks Info */}
          <div className="p-3 bg-violet-950/20 border border-violet-800/30 rounded-lg flex items-start gap-2.5 text-violet-200 text-xs">
            <Sparkles className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
            <span>
              As the Server Creator, you get full <strong>Server Developer</strong> status. You can create custom roles with colors, add/delete channels, manage members, and configure server settings!
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#232630]">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 text-xs font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploadingIcon || isUploadingBanner}
              className="py-2 px-5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow-md transition-colors flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Creating Server...</span>
                </>
              ) : (
                <span>Create Server</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
