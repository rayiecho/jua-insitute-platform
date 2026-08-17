// Shared background treatment for every screen in the live-class flow
// (lobby, connecting, in-session) so it reads as one designed space instead
// of a sequence of flat white screens stitched together.
export function ClassroomShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% -10%, rgba(200,134,43,0.12), transparent 55%), radial-gradient(circle at 100% 100%, rgba(200,134,43,0.07), transparent 50%)',
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
