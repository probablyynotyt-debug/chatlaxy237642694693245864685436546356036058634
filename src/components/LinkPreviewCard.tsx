import React from 'react';
import { ExternalLink, Youtube, Music, Globe } from 'lucide-react';
import { LinkMatch } from '../utils/chatFormatters';

interface LinkPreviewCardProps {
  links: LinkMatch[];
}

export const LinkPreviewCard: React.FC<LinkPreviewCardProps> = ({ links }) => {
  if (!links || links.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 mt-2 w-full max-w-md select-none">
      {links.map((link, idx) => {
        if (link.type === 'youtube' && link.youtubeId) {
          return (
            <div
              key={idx}
              className="rounded-xl overflow-hidden border border-red-900/50 bg-[#141015] shadow-lg flex flex-col"
            >
              <div className="flex items-center justify-between px-3 py-2 bg-red-950/40 border-b border-red-900/40 text-xs text-red-300 font-bold">
                <div className="flex items-center gap-1.5">
                  <Youtube className="w-4 h-4 text-red-500 fill-current" />
                  <span>YouTube Video</span>
                </div>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-red-400 hover:text-red-200 flex items-center gap-1 cursor-pointer"
                >
                  <span>Watch on YouTube</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="relative w-full aspect-video bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${link.youtubeId}`}
                  title="YouTube video player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0 rounded-b-xl"
                />
              </div>
            </div>
          );
        }

        if (link.type === 'music') {
          return (
            <div
              key={idx}
              className="p-3 rounded-xl border border-purple-900/50 bg-gradient-to-r from-[#171122] via-[#1a1428] to-[#12111b] shadow-lg flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-purple-950 border border-purple-700/60 flex items-center justify-center shrink-0">
                  <Music className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-neutral-100 truncate">Playable Music Link</span>
                  <span className="text-[11px] text-purple-300/80 font-mono truncate">{link.domain}</span>
                </div>
              </div>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg shrink-0 flex items-center gap-1 transition-colors cursor-pointer shadow"
              >
                <span>Listen</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          );
        }

        return (
          <div
            key={idx}
            className="p-3 rounded-xl border border-[#2c2f42] bg-[#12131b] hover:border-violet-500/40 shadow-md flex items-center justify-between gap-3 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#1c1e2b] border border-[#2f3248] flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4 text-violet-400" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-neutral-200 truncate">{link.domain}</span>
                <span className="text-[10px] text-neutral-500 truncate">{link.url}</span>
              </div>
            </div>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-[#202230] rounded-lg transition-colors cursor-pointer shrink-0"
              title="Open link in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        );
      })}
    </div>
  );
};
