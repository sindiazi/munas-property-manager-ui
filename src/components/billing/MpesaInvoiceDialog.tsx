'use client'
import { useState, useRef, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { invoicesApi } from '@/lib/api/invoices.api'
import { useSettingsStore } from '@/store'
import { formatCurrency } from '@/lib/formatCurrency'
import { toast } from 'sonner'
import type { Invoice } from '@/types'

const MAX_POLLS = 20
const POLL_INTERVAL_MS = 3000

interface MpesaInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: Invoice
  tenantPhone: string
  onSuccess: (updated: Invoice) => void
}

export function MpesaInvoiceDialog({
  open,
  onOpenChange,
  invoice,
  tenantPhone,
  onSuccess,
}: MpesaInvoiceDialogProps) {
  const currency = useSettingsStore((s) => s.settings?.currency ?? 'KES')

  const [phase, setPhase] = useState<'input' | 'polling'>('input')
  const [phone, setPhone] = useState(tenantPhone)
  const [amount, setAmount] = useState<number>(invoice.outstandingBalance ?? invoice.amountDue)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollCountRef = useRef(0)
  const pendingTransactionIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (open) {
      setPhase('input')
      setPhone(tenantPhone)
      setAmount(invoice.outstandingBalance ?? invoice.amountDue)
      setIsSubmitting(false)
    }
  }, [open, tenantPhone, invoice])

  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  useEffect(() => {
    return () => stopPolling()
  }, [])

  function startPolling(paymentTransactionId: string) {
    pollCountRef.current = 0
    pendingTransactionIdRef.current = paymentTransactionId

    intervalRef.current = setInterval(async () => {
      pollCountRef.current += 1

      try {
        const status = await invoicesApi.getMpesaStatus(paymentTransactionId)

        if (status.transactionStatus === 'CONFIRMED') {
          stopPolling()
          try {
            const refreshed = await invoicesApi.getById(invoice.invoiceId)
            onSuccess(refreshed)
          } catch {
            // Still close and notify even if refresh fails
          }
          onOpenChange(false)
          toast.success('M-Pesa payment confirmed!')
          return
        }

        if (status.transactionStatus === 'CANCELLED') {
          stopPolling()
          onOpenChange(false)
          toast.warning('Payment was cancelled by the user.')
          return
        }

        if (status.transactionStatus === 'FAILED') {
          stopPolling()
          onOpenChange(false)
          toast.error('M-Pesa payment failed. Please try again.')
          return
        }
      } catch {
        // Network error — keep polling until max polls
      }

      if (pollCountRef.current >= MAX_POLLS) {
        stopPolling()
        onOpenChange(false)
        toast.info('Still processing — you can refresh the page to check the final status.')
      }
    }, POLL_INTERVAL_MS)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const response = await invoicesApi.initiateMpesa(invoice.invoiceId, {
        amount,
        phoneNumber: phone,
      })
      setPhase('polling')
      startPolling(response.paymentTransactionId)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to initiate M-Pesa payment'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleCancelPolling() {
    stopPolling()
    onOpenChange(false)
    toast.info('You can refresh the page to check the payment status later.')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && phase === 'input') onOpenChange(false) }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Pay with M-Pesa</DialogTitle>
        </DialogHeader>

        {phase === 'input' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mpesa-phone">M-Pesa Phone Number</Label>
              <Input
                id="mpesa-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="2547XXXXXXXX"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mpesa-amount">Amount ({currency})</Label>
              <Input
                id="mpesa-amount"
                type="number"
                min={1}
                step="any"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                required
              />
              <p className="text-xs text-muted-foreground">
                Partial payments are allowed. Outstanding: {formatCurrency(invoice.outstandingBalance ?? invoice.amountDue, currency)}
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending…
                  </>
                ) : (
                  'Send STK Push'
                )}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <>
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground text-center">
                Waiting for M-Pesa confirmation… Check your phone.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCancelPolling}>
                Cancel — I&apos;ll check later
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
