import { Toast } from 'antd-mobile'
import { useEffect, useState } from 'react'
import type {
  Nullable,
  RegisteredUserPayload,
  RegisteredUserResponse,
  RegistrationWithRelations,
} from '../lib/types'

interface UseRegistrationResult {
  user: Nullable<RegisteredUserPayload>
  registration: Nullable<RegistrationWithRelations>
  loading: boolean
  error: Nullable<unknown>
}

export function useRegistration(
  providerUid: Nullable<string>,
  serverErrorMessage?: string
): UseRegistrationResult {
  const [user, setUser] = useState<Nullable<RegisteredUserPayload>>(null)
  const [registration, setRegistration] = useState<Nullable<RegistrationWithRelations>>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Nullable<unknown>>(null)

  useEffect(() => {
    if (!providerUid) {
      setUser(null)
      setRegistration(null)
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const response = await fetch(
          `/api/v1/user-registration?provider=line&provider_uid=${encodeURIComponent(providerUid)}`
        )

        if (!response.ok) {
          throw new Error('Failed to load registration')
        }

        const data = (await response.json()) as RegisteredUserResponse

        if (!cancelled) {
          setUser(data.user ?? null)
          setRegistration(data.registration ?? null)
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(caughtError)

          if (serverErrorMessage) {
            Toast.show({ content: serverErrorMessage, icon: 'fail' })
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [providerUid, serverErrorMessage])

  return { user, registration, loading, error }
}
