import { PageSkeleton } from '@/components/page-skeleton'

export default function DecisionsLoading() {
  return <PageSkeleton cards={4} showStats={true} statCount={5} />
}
