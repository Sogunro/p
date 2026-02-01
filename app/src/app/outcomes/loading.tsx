import { PageSkeleton } from '@/components/page-skeleton'

export default function OutcomesLoading() {
  return <PageSkeleton cards={3} showStats={true} statCount={5} />
}
