'use client'

import { SidebarLayout } from '@/components/sidebar-layout'
import { Skeleton } from '@/components/ui/skeleton'

interface PageSkeletonProps {
  /** Number of card rows to show */
  cards?: number
  /** Show stats row at top */
  showStats?: boolean
  /** Number of stat cards */
  statCount?: number
}

export function PageSkeleton({ cards = 3, showStats = false, statCount = 4 }: PageSkeletonProps) {
  return (
    <SidebarLayout>
      {/* Page header skeleton */}
      <div className="flex justify-between items-center mb-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Stats row */}
      {showStats && (
        <div className={`grid grid-cols-2 md:grid-cols-${statCount} gap-4 mb-6`}>
          {Array.from({ length: statCount }).map((_, i) => (
            <div key={i} className="bg-white rounded-lg border p-4">
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      )}

      {/* Card skeletons */}
      <div className="space-y-4">
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border p-4">
            <div className="flex items-center gap-3 mb-3">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-40" />
            </div>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </SidebarLayout>
  )
}
