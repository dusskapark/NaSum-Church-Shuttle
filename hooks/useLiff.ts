import { useEffect, useState } from 'react'
import type { LiffUser, Nullable } from '../lib/types'

const IS_DEV = process.env.NODE_ENV === 'development'

const DEV_USER: LiffUser = {
  userId: 'dev-user-001',
  displayName: 'Developer',
  pictureUrl: null,
}

interface LiffProfile {
  userId: string
  displayName: string
  pictureUrl?: string | null
}

interface UseLiffResult {
  user: Nullable<LiffUser>
  loading: boolean
  error: Nullable<unknown>
}

export function useLiff(): UseLiffResult {
  const [user, setUser] = useState<Nullable<LiffUser>>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Nullable<unknown>>(null)

  useEffect(() => {
    if (IS_DEV) {
      const timeoutId = window.setTimeout(() => {
        setUser(DEV_USER)
        setLoading(false)
      }, 300)

      return () => {
        window.clearTimeout(timeoutId)
      }
    }

    async function initLiff() {
      try {
        const liff = (await import('@line/liff')).default
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID as string })

        if (!liff.isLoggedIn()) {
          liff.login()
          return
        }

        const profile = (await liff.getProfile()) as LiffProfile
        setUser({
          userId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl ?? null,
        })
      } catch (caughtError) {
        setError(caughtError)
      } finally {
        setLoading(false)
      }
    }

    void initLiff()

  }, [])

  return { user, loading, error }
}
