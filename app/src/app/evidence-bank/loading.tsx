import { PageSkeleton } from '@/components/page-skeleton'

export default function EvidenceBankLoading() {
  return <PageSkeleton cards={5} showStats={true} statCount={5} />
}
