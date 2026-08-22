import { YouTubeEmbed } from './YouTubeEmbed';

// Two real video sources now share one lesson field: YouTube (external,
// used for curated existing content) and our own narrated, rendered videos
// (apps/video's Remotion pipeline — real animated illustrations, not slides,
// not an AI avatar) served as a direct .mp4. Anything that isn't a
// recognizable YouTube URL is treated as a direct file and rendered with a
// native player.
export function LessonVideo({ url }: { url: string }) {
  const isDirectFile = /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
  if (isDirectFile) {
    // apps/video's render pipeline always renders a matching poster frame
    // alongside the video (same base name, .jpg) — deriving it by
    // convention here avoids needing a second DB column just for this.
    const poster = url.replace(/\.(mp4|webm|mov)(\?.*)?$/i, '.jpg');
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg border border-border bg-ink">
        <video src={url} poster={poster} controls preload="metadata" className="h-full w-full" />
      </div>
    );
  }
  return <YouTubeEmbed url={url} />;
}
