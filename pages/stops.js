import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { Button, CheckList, List, NavBar, Skeleton, Toast } from 'antd-mobile'
import { useLiff } from '../hooks/useLiff'
import { getCopy } from '../lib/copy'
import dynamic from 'next/dynamic'

const StopPreviewMap = dynamic(() => import('./components/StopPreviewMap'), { ssr: false })

export default function StopDetailPage() {
  const router = useRouter()
  const { stationId } = router.query
  const { user, loading: liffLoading } = useLiff()
  const copy = getCopy('en')

  const [routes, setRoutes] = useState([])
  const [routesLoading, setRoutesLoading] = useState(true)
  const [selectedStopId, setSelectedStopId] = useState([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/v1/routes')
      .then((r) => r.json())
      .then(setRoutes)
      .catch(() => Toast.show({ content: copy.common.routeLoadError, icon: 'fail' }))
      .finally(() => setRoutesLoading(false))
  }, [copy.common.routeLoadError])

  const allStops = useMemo(() => {
    return routes.flatMap((route) =>
      route.stations
        .filter((station) => !station.is_terminal)
        .map((station, index) => ({
          ...station,
          routeId: route.id,
          routeLabel: `${route.line} LINE (${route.service})`,
          stopOrder: index + 1,
        }))
    )
  }, [routes])

  const sourceStop = useMemo(() => {
    if (typeof stationId !== 'string') return null
    return allStops.find((stop) => stop.id === stationId) ?? null
  }, [allStops, stationId])

  const matchingStops = useMemo(() => {
    if (!sourceStop) return []
    return allStops.filter((stop) => stop.name === sourceStop.name)
  }, [allStops, sourceStop])

  const selectedStop = useMemo(() => {
    const selectedId = selectedStopId[0]
    if (selectedId === undefined) return null
    return matchingStops.find((stop) => stop.id === selectedId) ?? null
  }, [matchingStops, selectedStopId])

  async function handleRegister() {
    if (!user || !selectedStop) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/user-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'line',
          provider_uid: user.userId,
          display_name: user.displayName,
          picture_url: user.pictureUrl,
          route_id: selectedStop.routeId,
          station_id: selectedStop.id,
        }),
      })

      if (!res.ok) throw new Error()

      Toast.show({ content: copy.common.saveSuccess, icon: 'success' })
      router.push('/')
    } catch {
      Toast.show({ content: copy.common.saveError, icon: 'fail' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', paddingBottom: 88, background: '#fff' }}>
      <NavBar onBack={() => router.back()}>{copy.stopDetail.title}</NavBar>

      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#111827' }}>
          {sourceStop?.name ?? '...'}
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: '#6b7280' }}>{copy.stopDetail.chooseRoute}</div>
      </div>

      {!routesLoading && sourceStop && (
        <StopPreviewMap
          stop={selectedStop ?? sourceStop}
          previewLabel={copy.stopDetail.stopPreview}
          routeMapLabel={copy.stopDetail.routeMap}
          googleMapsLabel={copy.common.openInGoogleMaps}
        />
      )}

      {routesLoading ? (
        <div style={{ padding: 16 }}>
          <Skeleton.Title animated />
          <Skeleton.Paragraph lineCount={6} animated />
        </div>
      ) : matchingStops.length === 0 ? (
        <div style={{ padding: 16, fontSize: 14, color: '#6b7280' }}>{copy.stopDetail.noResults}</div>
      ) : (
        <CheckList
          value={selectedStopId}
          onChange={setSelectedStopId}
        >
          {matchingStops.map((stop) => {
            return (
              <CheckList.Item key={`${stop.routeId}-${stop.id}`} value={stop.id}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>{stop.routeLabel}</div>
                  <div style={{ fontSize: 13, color: '#4b5563' }}>
                    {copy.stopDetail.stopOrder} {stop.stopOrder}
                    {stop.pickup_time ? ` · ${copy.stopDetail.boardAt} ${stop.pickup_time}` : ''}
                  </div>
                  {stop.notes && (
                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                      {copy.stopDetail.notes}: {stop.notes}
                    </div>
                  )}
                </div>
              </CheckList.Item>
            )
          })}
        </CheckList>
      )}

      <div
        style={{
          position: 'fixed',
          right: 0,
          bottom: 0,
          left: 0,
          padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
          background: '#f7f7f7',
          borderTop: '1px solid #e5e5ea',
        }}
      >
        <Button
          block
          size='large'
          color='primary'
          disabled={!selectedStop || liffLoading}
          loading={submitting}
          onClick={handleRegister}
        >
          {selectedStop ? copy.stopDetail.registerButton : copy.stopDetail.noSelection}
        </Button>
      </div>
    </div>
  )
}
