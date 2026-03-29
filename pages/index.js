import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import { Button, FloatingPanel, Modal, Skeleton, Toast } from 'antd-mobile'
import { useLiff } from '../hooks/useLiff'
import { getCopy } from '../lib/copy'
import RouteStepper from './components/RouteStepper'

// MapLibre uses browser APIs — must be client-side only
const ShuttleMap = dynamic(() => import('./components/ShuttleMap'), { ssr: false })

function getAnchors() {
  if (typeof window === 'undefined') return [100, 360, 680]
  return [100, Math.round(window.innerHeight * 0.45), Math.round(window.innerHeight * 0.85)]
}

export default function ShuttleHome() {
  const router = useRouter()
  const { user, loading: liffLoading } = useLiff()
  const copy = getCopy('en')
  const [regLoading, setRegLoading] = useState(true)
  const [registration, setRegistration] = useState(null)
  const [anchors, setAnchors] = useState([100, 360, 680])

  useEffect(() => {
    const syncAnchors = () => {
      setAnchors(getAnchors())
    }

    const frameId = window.requestAnimationFrame(syncAnchors)
    window.addEventListener('resize', syncAnchors)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', syncAnchors)
    }
  }, [])

  useEffect(() => {
    if (!user) return

    fetch(`/api/v1/user-registration?provider=line&provider_uid=${encodeURIComponent(user.userId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.registered) {
          setRegistration(data.registration)
        } else {
          Modal.confirm({
            content: copy.home.noRegistration,
            confirmText: copy.home.findStop,
            cancelText: copy.home.later,
            onConfirm: () => router.push('/search'),
          })
        }
      })
      .catch(() => Toast.show({ content: copy.common.serverError, icon: 'fail' }))
      .finally(() => setRegLoading(false))
  }, [copy.common.serverError, copy.home.findStop, copy.home.later, copy.home.noRegistration, router, user])

  const isLoading = liffLoading || regLoading
  const stations = registration?.route?.stations ?? []
  const myStation = registration?.station ?? null

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100dvh', overflow: 'hidden' }}>
      {/* Map layer */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <ShuttleMap stations={stations} myStation={myStation} />
      </div>

      {/* Floating bottom panel */}
      <FloatingPanel anchors={anchors} style={{ '--z-index': 10 }}>
        <div style={{ padding: '0 16px 16px' }}>
          {registration && (
            <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 15, color: '#111' }}>
              {registration.route.line} LINE ({registration.route.service})
            </div>
          )}

          {isLoading ? (
            <>
              <Skeleton.Title animated />
              <Skeleton.Paragraph lineCount={5} animated />
            </>
          ) : registration ? (
            <RouteStepper stations={stations} myStationId={myStation?.id} />
          ) : null}

          <div style={{ marginTop: 20 }}>
            <Button
              block
              size="large"
              color="primary"
              onClick={() => Toast.show({ content: copy.home.qrComingSoon, icon: 'info' })}
            >
              {copy.home.scanQr}
            </Button>
          </div>

          {!isLoading && (
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <span
                style={{ fontSize: 13, color: '#888', cursor: 'pointer' }}
                onClick={() => router.push('/search')}
              >
                {copy.home.changeStop}
              </span>
            </div>
          )}
        </div>
      </FloatingPanel>
    </div>
  )
}
