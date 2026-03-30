import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Button, Toast } from 'antd-mobile'
import Layout from '../components/Layout'
import { useLiff } from '../hooks/useLiff'
import { useAppSettings } from '../lib/app-settings'
import { getCopy } from '../lib/copy'

function getScannedUrl(value: string): URL | null {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

export default function ScanPage() {
  const router = useRouter()
  const { loading: liffLoading, isInClient, isReady } = useLiff()
  const { lang } = useAppSettings()
  const copy = getCopy(lang)
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const hasAutoStartedRef = useRef(false)

  const scannedUrl = useMemo(() => {
    if (!scanResult) return null
    return getScannedUrl(scanResult)
  }, [scanResult])

  const isInternalUrl = useMemo(() => {
    if (!scannedUrl || typeof window === 'undefined') return false
    return scannedUrl.origin === window.location.origin
  }, [scannedUrl])

  const availabilityMessage = useMemo(() => {
    if (liffLoading) return copy.scan.availabilityLoading
    if (!isInClient) return copy.scan.availabilityExternal
    if (!isReady) return copy.scan.availabilityLoading
    return copy.scan.availabilityReady
  }, [copy.scan.availabilityExternal, copy.scan.availabilityLoading, copy.scan.availabilityReady, isInClient, isReady, liffLoading])

  const handleScan = useCallback(async (): Promise<void> => {
    setIsScanning(true)
    setScanError(null)

    try {
      const liff = (await import('@line/liff')).default

      if (!isInClient) {
        setScanError(copy.scan.availabilityLineOnly)
        return
      }

      if (!liff.isApiAvailable('scanCodeV2')) {
        setScanError(copy.scan.availabilityUnsupported)
        return
      }

      const result = await liff.scanCodeV2()

      if (!result.value) {
        setScanError(copy.scan.scanCancelled)
        return
      }

      setScanResult(result.value)
    } catch (error) {
      const message = error instanceof Error && error.message
        ? `${copy.scan.scanFailed} ${error.message}`
        : copy.scan.scanFailed

      setScanError(message)
    } finally {
      setIsScanning(false)
    }
  }, [copy.scan.availabilityLineOnly, copy.scan.availabilityUnsupported, copy.scan.scanCancelled, copy.scan.scanFailed, isInClient])

  async function handleCopy(): Promise<void> {
    if (!scanResult) return

    try {
      await navigator.clipboard.writeText(scanResult)
      Toast.show({ content: copy.scan.copied, icon: 'success' })
    } catch {
      Toast.show({ content: copy.common.serverError, icon: 'fail' })
    }
  }

  function handleOpen(): void {
    if (!scannedUrl) return

    if (isInternalUrl) {
      void router.push(`${scannedUrl.pathname}${scannedUrl.search}${scannedUrl.hash}`)
      return
    }

    window.open(scannedUrl.toString(), '_blank', 'noopener,noreferrer')
  }

  useEffect(() => {
    if (hasAutoStartedRef.current) return
    if (liffLoading || !isReady || !isInClient) return

    hasAutoStartedRef.current = true
    void handleScan()
  }, [handleScan, isInClient, isReady, liffLoading])

  return (
    <>
      <Head>
        <title>{copy.scan.title}</title>
      </Head>
      <Layout>
        <div
          style={{
            minHeight: 'calc(var(--app-content-height) - 45px)',
            padding: 20,
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--adm-color-primary) 10%, white) 0%, var(--adm-color-background) 45%)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              margin: '0 auto',
              display: 'grid',
              gap: 16,
            }}
          >
            <div
              style={{
                padding: 24,
                borderRadius: 28,
                background: 'var(--app-color-surface)',
                boxShadow: 'var(--app-shadow-raised)',
              }}
            >
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--app-color-title)' }}>
                {copy.scan.title}
              </div>
              <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.7, color: 'var(--app-color-subtle-text)' }}>
                {copy.scan.description}
              </div>

              <div
                style={{
                  marginTop: 18,
                  padding: '12px 14px',
                  borderRadius: 16,
                  background: 'color-mix(in srgb, var(--adm-color-primary) 8%, white)',
                  color: 'var(--app-color-title)',
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                {availabilityMessage}
              </div>

              {scanError ? (
                <div
                  style={{
                    marginTop: 12,
                    padding: '12px 14px',
                    borderRadius: 16,
                    background: 'color-mix(in srgb, #ff4d4f 10%, white)',
                    color: '#b42318',
                    fontSize: 13,
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {scanError}
                </div>
              ) : null}

              <div style={{ marginTop: 18 }}>
                <Button
                  block
                  size='large'
                  color='primary'
                  loading={isScanning}
                  disabled={liffLoading || isScanning || !isInClient}
                  style={{ borderRadius: 999 }}
                  onClick={() => {
                    void handleScan()
                  }}
                >
                  {isScanning
                    ? copy.scan.scanning
                    : scanResult
                      ? copy.scan.scanAgainButton
                      : copy.scan.scanButton}
                </Button>
              </div>
            </div>

            <div
              style={{
                padding: 20,
                borderRadius: 24,
                background: 'var(--app-color-surface)',
                boxShadow: 'var(--app-shadow-raised)',
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--app-color-title)' }}>
                {copy.scan.lastResult}
              </div>
              <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6, color: 'var(--app-color-subtle-text)' }}>
                {copy.scan.resultHint}
              </div>
              <div
                style={{
                  marginTop: 16,
                  minHeight: 96,
                  padding: 16,
                  borderRadius: 18,
                  border: '1px solid var(--app-color-border)',
                  background: 'var(--adm-color-background)',
                  color: 'var(--app-color-title)',
                  fontSize: 14,
                  lineHeight: 1.6,
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {scanResult ?? copy.scan.emptyResult}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <Button
                  block
                  fill='outline'
                  disabled={!scanResult}
                  style={{ borderRadius: 999 }}
                  onClick={() => {
                    void handleCopy()
                  }}
                >
                  {copy.scan.copyResult}
                </Button>
                <Button
                  block
                  color='primary'
                  disabled={!scannedUrl}
                  style={{ borderRadius: 999 }}
                  onClick={handleOpen}
                >
                  {isInternalUrl ? copy.scan.openInApp : copy.scan.openResult}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </>
  )
}
