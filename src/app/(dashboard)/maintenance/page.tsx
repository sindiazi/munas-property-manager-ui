'use client'
import { useEffect } from 'react'
import { Wrench, Clock } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { useEventLogger } from '@/hooks/useEventLogger'

export default function MaintenancePage() {
  const logEvent = useEventLogger()

  useEffect(() => {
    logEvent('PAGE_VIEW', 'maintenance')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <PageHeader
        title="Maintenance"
        description="Track and manage property maintenance requests"
      />
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <div className="relative mb-4">
            <Wrench className="h-12 w-12 opacity-20" />
            <Clock className="h-5 w-5 absolute -bottom-1 -right-1 opacity-40" />
          </div>
          <p className="text-base font-medium text-foreground">Coming Soon</p>
          <p className="text-sm mt-1 text-center max-w-xs">
            Maintenance request tracking is under development and will be available in a future
            release.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
