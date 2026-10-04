import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Mic, Volume2 } from 'lucide-react';

interface VoiceMessagePlayerProps {
  src: string;
  duration?: number;
}

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({ src, duration: initialDuration }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.playbackRate = playbackRate;
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Audio play error:', err);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const target = Number(e.target.value);
    audio.currentTime = target;
    setCurrentTime(target);
  };

  const toggleRate = () => {
    const rates = [1, 1.5, 2];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatSeconds = (sec: number) => {
    if (isNaN(sec) || !isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Generate 24 pseudo-waveform bars
  const bars = [35, 60, 45, 80, 55, 90, 70, 40, 65, 85, 95, 75, 50, 80, 60, 90, 70, 55, 40, 65, 80, 50, 35, 45];

  return (
    <div className="w-full max-w-sm sm:max-w-md bg-gradient-to-r from-[#171923] via-[#1b1c28] to-[#161722] border border-[#2d2f40] hover:border-violet-500/50 rounded-xl p-3 shadow-lg flex items-center gap-3 select-none transition-all">
      {/* Play/Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className="w-10 h-10 rounded-full bg-gradient-to-tr from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 text-white flex items-center justify-center shadow-md shadow-violet-950/50 transition-transform active:scale-95 cursor-pointer shrink-0"
        title={isPlaying ? 'Pause' : 'Play voice message'}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>

      {/* Waveform & Timeline */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {/* Animated Waveform Bars & Seek Slider */}
        <div className="relative flex items-center gap-0.5 h-6 cursor-pointer">
          {bars.map((height, i) => {
            const barPercent = (i / bars.length) * 100;
            const isPassed = barPercent <= progressPercent;
            return (
              <div
                key={i}
                style={{ height: `${height}%` }}
                className={`flex-1 rounded-full transition-colors ${
                  isPassed
                    ? 'bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.6)]'
                    : 'bg-[#2f3244]'
                }`}
              />
            );
          })}

          {/* Hidden range input for seeking */}
          <input
            type="range"
            min={0}
            max={duration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
          />
        </div>

        {/* Time Stamp & Badges */}
        <div className="flex items-center justify-between text-[11px] text-neutral-400">
          <div className="flex items-center gap-1.5 font-mono">
            <Mic className="w-3 h-3 text-violet-400" />
            <span className="text-neutral-300 font-semibold">{formatSeconds(currentTime)}</span>
            <span>/</span>
            <span>{formatSeconds(duration)}</span>
          </div>

          <button
            type="button"
            onClick={toggleRate}
            className="px-1.5 py-0.5 bg-[#232635] hover:bg-[#2d3144] rounded text-[10px] font-bold text-violet-300 transition-colors cursor-pointer"
            title="Toggle playback speed"
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
};
