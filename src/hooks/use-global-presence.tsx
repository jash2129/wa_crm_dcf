"use client"

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface GlobalPresenceContextType {
  activeUserIds: Set<string>;
}

const GlobalPresenceContext = createContext<GlobalPresenceContextType>({ activeUserIds: new Set() })

export function GlobalPresenceProvider({ children }: { children: React.ReactNode }) {
  const { profile, accountId } = useAuth()
  const [activeUserIds, setActiveUserIds] = useState<Set<string>>(new Set())
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!profile || !accountId) return

    const supabase = createClient()
    const channel = supabase.channel(`presence:account_${accountId}`, {
      config: { presence: { key: profile.id } }
    })
    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const userIds = new Set<string>()
        for (const id in state) {
          if (state[id] && state[id].length > 0) {
            userIds.add(id)
          }
        }
        setActiveUserIds(userIds)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: profile.id,
            onlineAt: new Date().toISOString()
          })
        }
      })

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [accountId, profile])

  return (
    <GlobalPresenceContext.Provider value={{ activeUserIds }}>
      {children}
    </GlobalPresenceContext.Provider>
  )
}

export function useGlobalPresence() {
  return useContext(GlobalPresenceContext)
}
