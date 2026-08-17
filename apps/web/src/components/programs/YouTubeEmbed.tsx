function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1);
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v');
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

export function YouTubeEmbed({ url }: { url: string }) {
  const id = extractYouTubeId(url);
  if (!id) return null;

  return (
    <div className="aspect-video w-full overflow-hidden rounded-lg border border-border">
      <iframe
        src={`https://www.youtube.com/embed/${id}`}
        title="Lesson video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="h-full w-full"
      />
    </div>
  );
}
