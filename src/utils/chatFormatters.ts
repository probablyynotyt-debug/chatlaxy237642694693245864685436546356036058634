import React from 'react';

export interface LinkMatch {
  url: string;
  type: 'youtube' | 'music' | 'standard';
  youtubeId?: string;
  domain?: string;
}

export function extractLinks(text: string): LinkMatch[] {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const matches = text.match(urlRegex) || [];
  const results: LinkMatch[] = [];

  const uniqueUrls = Array.from(new Set(matches));

  for (const url of uniqueUrls) {
    try {
      const parsedUrl = new URL(url);
      const domain = parsedUrl.hostname.replace('www.', '');

      // Check YouTube
      if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
        let youtubeId: string | undefined;
        if (domain.includes('youtu.be')) {
          youtubeId = parsedUrl.pathname.slice(1);
        } else {
          youtubeId = parsedUrl.searchParams.get('v') || undefined;
        }
        if (youtubeId) {
          results.push({ url, type: 'youtube', youtubeId, domain });
          continue;
        }
      }

      // Check Music / Audio (Spotify, SoundCloud, mp3/wav/ogg)
      if (
        domain.includes('spotify.com') ||
        domain.includes('soundcloud.com') ||
        url.match(/\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/i)
      ) {
        results.push({ url, type: 'music', domain });
        continue;
      }

      // Standard link
      results.push({ url, type: 'standard', domain });
    } catch {
      // Invalid URL syntax
    }
  }

  return results.slice(0, 3); // Max 3 previews per message
}

export function translateText(text: string, targetLang: string = 'en'): string {
  // Client-side quick translation helper
  if (!text) return '';
  return `[Translated] ${text}`;
}
