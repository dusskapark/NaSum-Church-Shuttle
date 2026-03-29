import { useState, useEffect } from 'react'

const IS_DEV = process.env.NODE_ENV === 'development'

// Dev mock user — set to null to test the "unregistered" flow
const DEV_USER = {
  userId: 'dev-user-001',
  displayName: 'Developer',
  pictureUrl: null,
}

export function useLiff() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (IS_DEV) {
      // Simulate async LIFF init
      setTimeout(() => {
        setUser(DEV_USER)
        setLoading(false)
      }, 300)
      return
    }

    async function initLiff() {
      try {
        const liff = (await import('@line/liff')).default
        await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID })

        if (!liff.isLoggedIn()) {
          liff.login()
          return
        }

        const profile = await liff.getProfile()
        setUser({
          userId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
        })
      } catch (e) {
        setError(e)
      } finally {
        setLoading(false)
      }
    }

    initLiff()
  }, [])

  return { user, loading, error }
}
