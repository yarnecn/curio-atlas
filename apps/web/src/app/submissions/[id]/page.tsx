import { CandidateDetail } from './reader';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <CandidateDetail id={(await params).id} />;
}
