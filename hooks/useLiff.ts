import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react'
import type { LiffUser, Nullable } from '../lib/types'

/**
 * LIFF 공식 가이드 기반 Hook
 *
 * 참고: https://developers.line.biz/en/docs/liff/developing-liff-apps/
 *
 * 기본 플로우:
 * 1. liff.init() - LIFF 초기화 (모든 환경에서 필수)
 * 2. liff.isInClient() - LINE 앱 내부/외부 브라우저 구분
 * 3. liff.isLoggedIn() - 로그인 상태 확인
 * 4. liff.login() - 로그인 (앱 내부: 자동, 외부: LINE 로그인 페이지)
 * 5. liff.getProfile() - 사용자 정보 획득
 */

interface LiffProfile {
  userId: string
  displayName: string
  pictureUrl?: string | null
}

interface UseLiffResult {
  user: Nullable<LiffUser>
  loading: boolean
  error: Nullable<unknown>
  debugInfo: string
  isInClient: boolean
  isReady: boolean
}

const LIFF_CONTEXT_DEFAULT: UseLiffResult = {
  user: null,
  loading: true,
  error: null,
  debugInfo: '',
  isInClient: false,
  isReady: false,
}

const LiffContext = createContext<UseLiffResult>(LIFF_CONTEXT_DEFAULT)

function useProvideLiff(): UseLiffResult {
  const [user, setUser] = useState<Nullable<LiffUser>>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Nullable<unknown>>(null)
  const [debugInfo, setDebugInfo] = useState<string>('')
  const [isInClient, setIsInClient] = useState(false)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    async function initializeLiff() {
      const logs: string[] = []

      try {
        logs.push('🚀 LIFF 초기화 시작')
        logs.push(`Environment: ${process.env.NODE_ENV}`)
        logs.push(`URL: ${window.location.href}`)
        logs.push(`User Agent: ${navigator.userAgent}`)

        // 1. LIFF SDK 동적 로드
        const liff = (await import('@line/liff')).default

        // 2. LIFF ID 설정
        const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname)
        const liffId = (isLocalhost
          ? process.env.NEXT_PUBLIC_LIFF_ID_DEV || process.env.NEXT_PUBLIC_LIFF_ID
          : process.env.NEXT_PUBLIC_LIFF_ID) as string

        if (!liffId) {
          throw new Error('LIFF ID가 설정되지 않았습니다')
        }

        logs.push(`LIFF ID: ${liffId}`)

        if (process.env.NODE_ENV === 'development' && isLocalhost) {
          logs.push('🧪 localhost 개발 환경: LIFF 초기화를 건너뛰고 테스트 사용자 사용')
          setIsInClient(false)
          setIsReady(false)
          setUser({
            userId: 'dev-user-001',
            displayName: 'Developer (Browser)',
            pictureUrl: null,
          })
          setDebugInfo(logs.join('\n'))
          return
        }

        // 3. LIFF 초기화 (공식 가이드 기본 패턴)
        await liff.init({ liffId })
        logs.push('✅ LIFF 초기화 완료')

        // 4. 환경 정보 수집 (초기화 완료 후)
        const inClient = liff.isInClient()
        const loggedIn = liff.isLoggedIn()

        setIsInClient(inClient)
        setIsReady(true)

        logs.push(`📱 실행 환경: ${inClient ? 'LINE 앱 내부' : '외부 브라우저'}`)
        logs.push(`🔐 로그인 상태: ${loggedIn ? '로그인됨' : '로그인 필요'}`)

        // 5. 추가 환경 정보 (가능한 경우)
        if (liff.getOS) {
          logs.push(`💻 OS: ${liff.getOS()}`)
        }
        if (liff.getLanguage) {
          logs.push(`🌍 Language: ${liff.getLanguage()}`)
        }
        if (liff.getVersion) {
          logs.push(`📦 LIFF Version: ${liff.getVersion()}`)
        }

        // 6. 로그인 처리
        if (!loggedIn) {
          logs.push('🚪 로그인이 필요합니다')

          // 개발 환경에서만 로그인 건너뛰기 (옵션)
          if (process.env.NODE_ENV === 'development') {
            logs.push('⚠️ 개발 환경: 로그인 건너뛰고 테스트 사용자 사용')

            setUser({
              userId: 'dev-user-001',
              displayName: `Developer ${inClient ? '(LINE App)' : '(Browser)'}`,
              pictureUrl: null,
            })

            setDebugInfo(logs.join('\n'))
            return
          }

          // 프로덕션: 실제 로그인 실행
          logs.push('🔑 LINE 로그인 시작...')
          liff.login()
          return
        }

        // 7. 사용자 프로필 획득
        logs.push('👤 사용자 프로필 요청 중...')

        const profile = (await liff.getProfile()) as LiffProfile

        logs.push(`✅ 로그인 성공: ${profile.displayName}`)
        logs.push(`User ID: ${profile.userId}`)

        // 8. 사용자 정보 설정
        setUser({
          userId: profile.userId,
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl ?? null,
        })

        logs.push('🎉 LIFF 설정 완료')
        setDebugInfo(logs.join('\n'))

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        const errorCode = (err as any)?.code || 'UNKNOWN'

        logs.push(`❌ LIFF 초기화 실패`)
        logs.push(`Error: ${errorMsg}`)
        logs.push(`Code: ${errorCode}`)

        setError(err)
        setDebugInfo(logs.join('\n'))

        console.error('LIFF Error:', err)

        // 에러 발생 시 Guest 사용자 제공
        logs.push('🔄 Guest 사용자로 계속...')
        setUser({
          userId: 'guest-user',
          displayName: 'Guest User',
          pictureUrl: null,
        })

      } finally {
        setLoading(false)
      }
    }

    // LIFF 초기화 실행
    void initializeLiff()

  }, [])

  return {
    user,
    loading,
    error,
    debugInfo,
    isInClient,
    isReady
  }
}

export function LiffProvider({ children }: { children: ReactNode }) {
  const value = useProvideLiff()

  return createElement(LiffContext.Provider, { value }, children)
}

export function useLiff(): UseLiffResult {
  return useContext(LiffContext)
}
