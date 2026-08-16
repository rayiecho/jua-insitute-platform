import { TutorSessionRoom } from '@/components/tutor/TutorSessionRoom';

export default async function SessionPage({ params }: { params: Promise<{ room: string }> }) {
  const { room } = await params;
  return <TutorSessionRoom room={room} />;
}
