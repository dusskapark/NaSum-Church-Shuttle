import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { Button, CheckList, NavBar, Skeleton, Toast } from 'antd-mobile'
import type { CheckListValue } from 'antd-mobile/es/components/check-list'
import dynamic from 'next/dynamic'
import { useLiff } from '../hooks/useLiff'
import { getCopy } from '../lib/copy'
import type { RoutesResponse, StopCandidate, UserRegistrationRequest } from '../lib/types'

const StopPreviewMap = dynamic(() => import('./components/StopPreviewMap'), { ssr: false })

export default function StopDetailPage() {
  const router = useRouter()
  const { stationId } = router.query
  const { user, loading: liffLoading } = useLiff()
  const copy = getCopy('en')

  const [routes, setRoutes] = useState<RoutesResponse>([])
  const [routesLoading, setRoutesLoading] = useState(true)
  const [selectedStopId, setSelectedStopId] = useState<CheckListValue[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void fetch('/api/v1/routes')
      .then(async (response) => (await response.json()) as RoutesResponse)
      .then(setRoutes)
      .catch(() => Toast.show({ content: copy.common.routeLoadError, icon: 'fail' }))
      .finally(() => setRoutesLoading(false))
  }, [copy.common.routeLoadError])

  const allStops = useMemo<StopCandidate[]>(
    () =>
      routes.flatMap((route) =>
        route.stations.filter((station) => !station.is_terminal).map((station, index) => ({
          ...station,
          routeId: route.id,
          routeLabel: `${route.line} LINE (${route.service})`,
          stopOrder: index + 1,
          google_maps_url: route.google_maps_url,
        }))
      ),
    [routes]
  )

  const sourceStop = useMemo<StopCandidate | null>(() => {
    if (typeof stationId !== 'string') return null
    return allStops.find((stop) => stop.id === stationId) ?? null
  }, [allStops, stationId])

  const matchingStops = useMemo<StopCandidate[]>(
    () => (sourceStop ? allStops.filter((stop) => stop.name === sourceStop.name) : []),
    [allStops, sourceStop]
  )

  const selectedStop = useMemo<StopCandidate | null>(() => {
    const selectedId = selectedStopId[0]
    if (typeof selectedId !== 'string') return null
    return matchingStops.find((stop) => stop.id === selectedId) ?? null
  }, [matchingStops, selectedStopId])

  async function handleRegister(): Promise<void> {
    if (!user || !selectedStop) return

    setSubmitting(true)
    try {
      const payload: UserRegistrationRequest = {
        provider: 'line',
        provider_uid: user.userId,
        display_name: user.displayName,
        picture_url: user.pictureUrl,
        route_id: selectedStop.routeId,
        station_id: selectedStop.id,
      }

      const response = await fetch('/api/v1/user-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) throw new Error()

      Toast.show({ content: copy.common.saveSuccess, icon: 'success' })
      await router.push('/')
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
        <>
          <div
            style={{
              margin: '8px 16px 0',
              padding: '12px 14px',
              borderRadius: 14,
              background: '#f8fafc',
              border: '1px solid #e5e7eb',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>
              {copy.stopDetail.chooseRouteSectionTitle}
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: '#6b7280' }}>
              {copy.stopDetail.chooseRouteSectionHint}
            </div>
          </div>

          <CheckList value={selectedStopId} onChange={setSelectedStopId}>
            {matchingStops.map((stop) => (
              <CheckList.Item key={`${stop.routeId}-${stop.id}`} value={stop.id}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#111827' }}>{stop.routeLabel}</div>
                  <div style={{ fontSize: 13, color: '#4b5563' }}>
                    {copy.stopDetail.stopOrder} {stop.stopOrder}
                    {stop.pickup_time ? ` · ${copy.stopDetail.boardAt} ${stop.pickup_time}` : ''}
                  </div>
                </div>
              </CheckList.Item>
            ))}
          </CheckList>
        </>
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
          onClick={() => {
            void handleRegister()
          }}
        >
          {selectedStop ? copy.stopDetail.registerButton : copy.stopDetail.noSelection}
        </Button>
      </div>
    </div>
  )
}
