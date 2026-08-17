import Link from 'next/link';

export function TalkToTutorButton({ className = '' }: { className?: string }) {
  return (
    <Link href="/tutor" className={className}>
      Talk to your tutor
    </Link>
  );
}
