'use client';

import { useEffect, useRef, useState } from 'react';
import { YouTubeEmbed } from './YouTubeEmbed';

// Two real video sources now share one lesson field: YouTube (external,
// used for curated existing content) and our own narrated, rendered videos
// (apps/video's Remotion pipeline — real animated illustrations, not slides,
// not an AI avatar) served as a direct .mp4. Anything that isn't a
// recognizable YouTube URL is treated as a direct file and rendered with a
// native player.
export function LessonVideo({ url }: { url: string }) {
  const isDirectFile = /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
  if (isDirectFile) return <DirectVideoPlayer url={url} />;
  return <YouTubeEmbed url={url} />;
}

function DirectVideoPlayer({ url }: { url: string }) {
  // apps/video's render pipeline always renders a matching poster frame
  // alongside the video (same base name, .jpg) — deriving it by convention
  // here avoids needing a second DB column just for this.
  const poster = url.replace(/\.(mp4|webm|mov)(\?.*)?$/i, '.jpg');
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Browsers are inconsistent about what a <video> shows once playback
  // ends (some hold the last frame, some don't) — rather than trust that,
  // we track it ourselves and show our own branded poster overlay on
  // 'ended', so the stopped state is always the same branded frame
  // (confirmed missing live, 2026-08-24).
  const [ended, setEnded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  };

  return (
    <div
      ref={containerRef}
      className="group relative w-full overflow-hidden rounded-lg border border-border bg-ink [&:fullscreen]:flex [&:fullscreen]:items-center [&:fullscreen]:rounded-none [&:fullscreen]:border-none"
      style={{ aspectRatio: '16 / 9' }}
    >
      <video
        ref={videoRef}
        src={url}
        poster={poster}
        controls
        preload="metadata"
        className="absolute inset-0 h-full w-full object-contain"
        onPlay={() => setEnded(false)}
        onEnded={() => setEnded(true)}
      />
      {ended && (
        <img
          src={poster}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
        />
      )}
      <button
        type="button"
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Expand video'}
        className="absolute right-3 top-3 z-10 rounded-md bg-ink/70 p-2 text-background opacity-0 transition-opacity duration-150 hover:bg-ink/90 focus-visible:opacity-100 group-hover:opacity-100"
      >
        {isFullscreen ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 4v3a2 2 0 0 1-2 2H4M15 4v3a2 2 0 0 0 2 2h3M9 20v-3a2 2 0 0 0-2-2H4M15 20v-3a2 2 0 0 1 2-2h3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </div>
  );
}
