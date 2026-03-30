import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { Button, CheckList, NavBar, SafeArea, Skeleton, Toast } from 'antd-mobile'
import type { CheckListValue } from 'antd-mobile/es/components/check-list'
import { useRoutes } from '../hooks/useRoutes'
import { useLiff } from '../hooks/useLiff'
import { useAppSettings } from '../lib/app-settings'
import { getCopy } from '../lib/copy'
import {
  getMatchingStops,
  getSourceStop,
  getStopCandidates,
} from '../lib/routeSelectors'
import type { StopCandidate, UserRegistrationRequest } from '../lib/types'

const StopPreviewMap = dynamic(() => import('../components/maps/StopPreviewMap'), { ssr: false })
const STOP_DETAIL_ACTION_BAR_HEIGHT = 88

export default function StopDetailPage() {
  const router = useRouter()
  const { stationId } = router.query
  const { user, loading: liffLoading } = useLiff()
  const { lang } = useAppSettings()
  const copy = getCopy(lang)
  const { routes, loading: routesLoading } = useRoutes(copy.common.routeLoadError)

  const [selectedStopId, setSelectedStopId] = useState<CheckListValue[]>([])
  const [submitting, setSubmitting] = useState(false)

  const allStops = useMemo<StopCandidate[]>(
    () => getStopCandidates(routes),
    [routes]
  )

  const sourceStop = useMemo<StopCandidate | null>(() => {
    return getSourceStop(allStops, typeof stationId === 'string' ? stationId : null)
  }, [allStops, stationId])

  const matchingStops = useMemo<StopCandidate[]>(
    () => getMatchingStops(allStops, sourceStop),
    [allStops, sourceStop]
  )

  const selectedStop = useMemo<StopCandidate | null>(() => {
    const selectedId = selectedStopId[0]

    if (typeof selectedId !== 'string') {
      return null
    }

    return matchingStops.find(stop => stop.id === selectedId) ?? null
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
    <div
      style={{
        minHeight: '100dvh',
        background: 'var(--adm-color-background)',
      }}
    >
      <NavBar
        onBack={() => {
          router.back()
        }}
      >
        {copy.stopDetail.title}
      </NavBar>

      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--app-color-border)' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--app-color-title)' }}>
          {sourceStop?.name ?? '...'}
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--app-color-subtle-text)' }}>
          {copy.stopDetail.chooseRoute}
        </div>
      </div>

      {!routesLoading && sourceStop ? (
        <StopPreviewMap
          stop={selectedStop ?? sourceStop}
          previewLabel={copy.stopDetail.stopPreview}
          routeMapLabel={copy.stopDetail.routeMap}
          googleMapsLabel={copy.common.openInGoogleMaps}
        />
      ) : null}

      {routesLoading ? (
        <div style={{ padding: 16 }}>
          <Skeleton.Title animated />
          <Skeleton.Paragraph lineCount={6} animated />
        </div>
      ) : matchingStops.length === 0 ? (
        <div style={{ padding: 16, fontSize: 14, color: 'var(--app-color-subtle-text)' }}>
          {copy.stopDetail.noResults}
        </div>
      ) : (
        <>
          <div style={{ padding: '10px 16px 8px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--app-color-subtle-text)' }}>
              {copy.stopDetail.chooseRouteSectionTitle}
            </div>
          </div>

          <CheckList value={selectedStopId} onChange={setSelectedStopId}>
            {matchingStops.map(stop => (
              <CheckList.Item key={`${stop.routeId}-${stop.id}`} value={stop.id}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--app-color-title)' }}>
                    {stop.routeLabel}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--app-color-secondary-text)' }}>
                    {copy.stopDetail.stopOrder} {stop.stopOrder}
                    {stop.pickup_time ? ` · ${copy.stopDetail.boardAt} ${stop.pickup_time}` : ''}
                  </div>
                </div>
              </CheckList.Item>
            ))}
          </CheckList>
        </>
      )}

      <div style={{ height: STOP_DETAIL_ACTION_BAR_HEIGHT }} />
      <SafeArea position='bottom' />

      <div
        style={{
          position: 'fixed',
          right: 0,
          bottom: 0,
          left: 0,
          padding: '12px 16px',
          background: 'var(--app-color-surface)',
          borderTop: '1px solid var(--app-color-border)',
        }}
      >
        <Button
          block
          size='large'
          color='primary'
          style={{ borderRadius: 999 }}
          disabled={!selectedStop || liffLoading}
          loading={submitting}
          onClick={() => {
            void handleRegister()
          }}
        >
          {selectedStop ? copy.stopDetail.registerButton : copy.stopDetail.noSelection}
        </Button>
        <SafeArea position='bottom' />
      </div>
    </div>
  )
}
