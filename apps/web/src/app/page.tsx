import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-semibold">AI Tutor Platform</h1>
      <p className="text-sm text-gray-500">
        Phase 1 + 2 scaffold — one seeded lesson with a live code sandbox, and a live tutoring
        room to test the LiveKit + voice loop.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/learn/variables-and-types" className="rounded bg-black px-4 py-2 text-white">
          Start the lesson
        </Link>
        <Link
          href="/session/demo-room"
          className="rounded border border-gray-300 px-4 py-2 text-gray-900"
        >
          Start a live session
        </Link>
      </div>
    </main>
  );
}
