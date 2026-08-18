import Link from 'next/link';

export function TalkToTutorButton({ className = '', onClick }: { className?: string; onClick?: () => void }) {
  return (
    <Link href="/tutor" className={className} onClick={onClick}>
      Talk to your tutor
    </Link>
  );
}
