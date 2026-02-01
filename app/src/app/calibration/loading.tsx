import { PageSkeleton } from '@/components/page-skeleton'

export default function CalibrationLoading() {
  return <PageSkeleton cards={3} showStats={true} statCount={3} />
}
