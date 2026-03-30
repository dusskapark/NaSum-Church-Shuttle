import { useMemo } from 'react'
import { useLiff } from '../hooks/useLiff'

type LiffBannerStatus = 'idle' | 'ready' | 'error'

function LineMark() {
  return (
    <svg
      viewBox='0 0 24 24'
      width='14'
      height='14'
      fill='currentColor'
      xmlns='http://www.w3.org/2000/svg'
      aria-hidden='true'
    >
      <path d='M19.952 10.357C19.952 5.944 15.513 2.38 10.056 2.38S.16 5.944.16 10.357c0 3.977 3.527 7.313 8.293 7.944.323.07.763.213.874.49.1.25.065.643.032.896l-.142.85c-.043.25-.2.977.856.533 1.057-.444 5.706-3.36 7.782-5.753 1.435-1.576 2.097-3.17 2.097-4.96z' />
    </svg>
  )
}

export default function LiffBanner() {
  const { loading, error, isReady, isInClient } = useLiff()

  const status = useMemo<LiffBannerStatus>(() => {
    if (loading) return 'idle'
    if (error || !isReady || !isInClient) return 'error'
    return 'ready'
  }, [error, isInClient, isReady, loading])

  const label = status === 'ready'
    ? 'LIFF initialized'
    : status === 'error'
    ? 'Browser mode'
    : 'Initializing'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        background: '#06C755',
        color: '#fff',
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      <LineMark />
      LINE LIFF
      <span style={{ opacity: 0.8, marginLeft: 4 }}>· {label}</span>
    </div>
  )
}
