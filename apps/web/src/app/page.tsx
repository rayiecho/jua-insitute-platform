import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-2xl font-semibold">AI Tutor Platform</h1>
      <p className="text-sm text-gray-500">
        Phase 1 scaffold — self-paced platform UI isn&apos;t built yet. Jump into the live
        tutoring room to test the LiveKit + voice loop.
      </p>
      <Link href="/session/demo-room" className="rounded bg-black px-4 py-2 text-white">
        Start a demo session
      </Link>
    </main>
  );
}
