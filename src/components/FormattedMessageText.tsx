import React, { useState } from 'react';
import { Copy, Check, EyeOff, Eye } from 'lucide-react';

interface FormattedMessageTextProps {
  content: string;
  styleInline?: React.CSSProperties;
  colorClass?: string;
  onOpenProfile?: (username: string) => void;
}

export const FormattedMessageText: React.FC<FormattedMessageTextProps> = ({
  content,
  styleInline,
  colorClass = 'text-neutral-200',
  onOpenProfile,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null);
  const [revealedSpoilers, setRevealedSpoilers] = useState<Record<number, boolean>>({});

  if (!content) return null;

  // Check if content has code blocks: ```lang ... ```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  const codeBlocks: { language: string; code: string; fullMatch: string }[] = [];
  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    codeBlocks.push({
      language: match[1] || 'code',
      code: match[2].trim(),
      fullMatch: match[0],
    });
  }

  // If message contains code block
  if (codeBlocks.length > 0) {
    const parts = content.split(codeBlockRegex);
    return (
      <div className="flex flex-col gap-2 w-full max-w-full overflow-hidden">
        {parts.map((part, index) => {
          // If part corresponds to a code block
          if (index % 3 === 2) {
            const language = parts[index - 1] || 'code';
            const code = part.trim();
            const blockIdx = Math.floor(index / 3);

            const handleCopyCode = () => {
              navigator.clipboard.writeText(code);
              setCopiedCodeIndex(blockIdx);
              setTimeout(() => setCopiedCodeIndex(null), 2000);
            };

            return (
              <div
                key={index}
                className="my-1.5 rounded-lg border border-[#2e3144] bg-[#0d0e14] overflow-hidden text-xs font-mono shadow-md"
              >
                <div className="flex items-center justify-between px-3 py-1.5 bg-[#171822] border-b border-[#292b3c] text-[11px] text-neutral-400 font-sans">
                  <span className="font-bold text-violet-400 uppercase tracking-wider">{language}</span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-white px-2 py-0.5 rounded bg-[#232535] hover:bg-[#2e3146] transition-colors cursor-pointer"
                  >
                    {copiedCodeIndex === blockIdx ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 overflow-x-auto text-neutral-200 font-mono text-[12px] leading-relaxed select-text">
                  <code>{code}</code>
                </pre>
              </div>
            );
          } else if (index % 3 === 1) {
            // Language tag match string, handled above
            return null;
          } else if (part.trim()) {
            return (
              <RenderInlineFormattedText
                key={index}
                text={part}
                styleInline={styleInline}
                colorClass={colorClass}
                onOpenProfile={onOpenProfile}
              />
            );
          }
          return null;
        })}
      </div>
    );
  }

  // Handle collapsible long messages (> 400 chars)
  const isLongMessage = content.length > 400;
  const displayedText = isLongMessage && !isExpanded ? content.slice(0, 400) + '...' : content;

  return (
    <div className="flex flex-col gap-1 w-full">
      <RenderInlineFormattedText
        text={displayedText}
        styleInline={styleInline}
        colorClass={colorClass}
        onOpenProfile={onOpenProfile}
      />
      {isLongMessage && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="self-start text-[11px] text-violet-400 hover:text-violet-300 font-bold transition-colors cursor-pointer mt-0.5"
        >
          {isExpanded ? 'Show less' : 'Read more...'}
        </button>
      )}
    </div>
  );
};

// Helper component for parsing inline formatting: markdown, spoilers, mentions, links
interface RenderInlineFormattedTextProps {
  text: string;
  styleInline?: React.CSSProperties;
  colorClass?: string;
  onOpenProfile?: (username: string) => void;
}

const RenderInlineFormattedText: React.FC<RenderInlineFormattedTextProps> = ({
  text,
  styleInline,
  colorClass,
  onOpenProfile,
}) => {
  const [spoilerRevealed, setSpoilerRevealed] = useState<Record<number, boolean>>({});

  // Parse tokenized regex for spoilers ||spoiler||, mentions @username, URLs, bold **, italic *, strikethrough ~~, inline code `code`
  // We process text into nodes
  const tokens = text.split(/(\|\|[\s\S]+?\|\||@[a-zA-Z0-9_]+|https?:\/\/[^\s]+|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|__[^_]+__)/g);

  return (
    <p style={styleInline} className={`text-xs sm:text-sm leading-relaxed break-words whitespace-pre-wrap select-text ${colorClass}`}>
      {tokens.map((token, idx) => {
        if (!token) return null;

        // Spoiler: ||hidden text||
        if (token.startsWith('||') && token.endsWith('||') && token.length > 4) {
          const isRevealed = spoilerRevealed[idx];
          const innerText = token.slice(2, -2);

          return (
            <span
              key={idx}
              onClick={() => setSpoilerRevealed((prev) => ({ ...prev, [idx]: !prev[idx] }))}
              title={isRevealed ? 'Click to hide spoiler' : 'Click to reveal spoiler'}
              className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold cursor-pointer transition-all ${
                isRevealed
                  ? 'bg-[#282a3c] text-neutral-200 border border-[#383b54]'
                  : 'bg-neutral-800 text-transparent select-none border border-neutral-700 hover:bg-neutral-700'
              }`}
            >
              {innerText}
            </span>
          );
        }

        // Mention: @username
        if (token.startsWith('@') && token.length > 1) {
          const username = token.slice(1);
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onOpenProfile && onOpenProfile(username)}
              className="inline-flex items-center px-1.5 py-0.5 rounded bg-violet-950/80 hover:bg-violet-900 border border-violet-700/60 text-violet-300 hover:text-violet-100 font-semibold text-xs transition-colors cursor-pointer mx-0.5"
            >
              @{username}
            </button>
          );
        }

        // URL
        if (token.startsWith('http://') || token.startsWith('https://')) {
          return (
            <a
              key={idx}
              href={token}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300 underline underline-offset-2 break-all transition-colors cursor-pointer"
            >
              {token}
            </a>
          );
        }

        // Inline code: `code`
        if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
          return (
            <code key={idx} className="bg-[#212330] text-violet-300 px-1.5 py-0.5 rounded text-[11px] font-mono border border-[#2d2f40]">
              {token.slice(1, -1)}
            </code>
          );
        }

        // Bold: **text**
        if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
          return <strong key={idx} className="font-extrabold text-white">{token.slice(2, -2)}</strong>;
        }

        // Italic: *text*
        if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
          return <em key={idx} className="italic text-neutral-300">{token.slice(1, -1)}</em>;
        }

        // Strikethrough: ~~text~~
        if (token.startsWith('~~') && token.endsWith('~~') && token.length > 4) {
          return <del key={idx} className="line-through text-neutral-500">{token.slice(2, -2)}</del>;
        }

        // Underline: __text__
        if (token.startsWith('__') && token.endsWith('__') && token.length > 4) {
          return <u key={idx} className="underline underline-offset-2 text-neutral-100">{token.slice(2, -2)}</u>;
        }

        // Plain text
        return <span key={idx}>{token}</span>;
      })}
    </p>
  );
};
