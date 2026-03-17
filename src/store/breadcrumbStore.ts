'use client'
import { create } from 'zustand'

interface BreadcrumbState {
  labels: Record<string, string>
  setLabel: (id: string, label: string) => void
}

export const useBreadcrumbStore = create<BreadcrumbState>()((set) => ({
  labels: {},
  setLabel: (id, label) =>
    set((s) => ({ labels: { ...s.labels, [id]: label } })),
}))
