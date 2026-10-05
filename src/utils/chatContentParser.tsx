import React, { useState } from 'react';
import { Copy, Check, Play, ExternalLink } from 'lucide-react';

interface CodeBlockProps {
  code: string;
  lang?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, lang = 'code' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 rounded-lg overflow-hidden bg-[#0d0e12] border border-[#272836] font-mono text-xs shadow-md">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#14151c] border-b border-[#222432] text-[11px] text-neutral-400">
        <span className="font-semibold text-violet-300 uppercase tracking-wider">{lang}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-neutral-400 hover:text-white transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-sans text-[10px]">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span className="font-sans text-[10px]">Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-neutral-200 leading-relaxed select-text whitespace-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
};

export const SpoilerSpan: React.FC<{ text: string }> = ({ text }) => {
  const [revealed, setRevealed] = useState(false);

  return (
    <span
      onClick={() => setRevealed(!revealed)}
      className={`inline-block px-1.5 py-0.5 rounded transition-all cursor-pointer select-none font-medium ${
        revealed
          ? 'bg-[#212332] text-neutral-100 border border-violet-500/40'
          : 'bg-[#252733] text-transparent hover:bg-[#2d3040] shadow-inner'
      }`}
      title={revealed ? 'Click to hide spoiler' : 'Click to reveal spoiler'}
    >
      {text}
    </span>
  );
};

export function extractYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export function parseAndRenderText(
  text: string,
  onOpenProfile?: (username: string) => void
): { elements: React.ReactNode[]; youtubeId: string | null } {
  let youtubeId: string | null = null;

  // Check YouTube link in text
  const ytMatch = text.match(/(https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+[^\s]*)/i);
  if (ytMatch) {
    youtubeId = extractYouTubeId(ytMatch[0]);
  }

  // Check code blocks ``` lang \n code ```
  if (text.startsWith('```') && text.endsWith('```')) {
    const lines = text.slice(3, -3).trim().split('\n');
    let lang = 'code';
    let codeStr = text.slice(3, -3).trim();
    if (lines.length > 1 && /^[a-zA-Z0-9_-]+$/.test(lines[0].trim())) {
      lang = lines[0].trim();
      codeStr = lines.slice(1).join('\n');
    }
    return {
      elements: [<CodeBlock key="cb-1" code={codeStr} lang={lang} />],
      youtubeId,
    };
  }

  // Parse inline elements (spoilers ||text||, mentions @username, URLs)
  const tokens = text.split(/(\|\|.*?\|\||@[\w.-]+|https?:\/\/[^\s]+)/g);

  const elements: React.ReactNode[] = tokens.map((token, i) => {
    if (token.startsWith('||') && token.endsWith('||') && token.length > 4) {
      const spoilerContent = token.slice(2, -2);
      return <SpoilerSpan key={i} text={spoilerContent} />;
    }

    if (token.startsWith('@') && token.length > 1) {
      const username = token.slice(1);
      return (
        <span
          key={i}
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenProfile) onOpenProfile(username);
          }}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded bg-violet-500/20 hover:bg-violet-500/40 text-violet-300 font-bold border border-violet-500/30 transition-colors cursor-pointer"
        >
          {token}
        </span>
      );
    }

    if (token.match(/^https?:\/\/[^\s]+$/i)) {
      return (
        <a
          key={i}
          href={token}
          target="_blank"
          rel="noopener noreferrer"
          className="text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors inline-flex items-center gap-1 font-medium"
        >
          <span>{token}</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      );
    }

    return token;
  });

  return { elements, youtubeId };
}
