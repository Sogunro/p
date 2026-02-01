'use client'

import { SidebarLayout } from '@/components/sidebar-layout'

interface DashboardClientProps {
  children: React.ReactNode
  userName: string
}

export function DashboardClient({ children, userName }: DashboardClientProps) {
  return (
    <SidebarLayout userName={userName}>
      {children}
    </SidebarLayout>
  )
}
