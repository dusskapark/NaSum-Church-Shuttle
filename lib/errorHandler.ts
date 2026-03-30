import { Toast } from 'antd-mobile'

interface ErrorInfo {
  message: string
  stack?: string
  source?: string
  line?: number
  column?: number
  timestamp: string
  url: string
  userAgent: string
}

let errorQueue: ErrorInfo[] = []
const MAX_ERRORS = 10

function formatError(error: ErrorInfo): string {
  return `
=== Error Details ===
Message: ${error.message}
Source: ${error.source || 'Unknown'}
Line: ${error.line || 'Unknown'}
Column: ${error.column || 'Unknown'}
URL: ${error.url}
Timestamp: ${error.timestamp}
UserAgent: ${error.userAgent}
Stack: ${error.stack || 'No stack trace'}
`.trim()
}

function logErrorQuietly(error: ErrorInfo) {
  // 조용히 로그만 남기고 에러 큐에 저장
  console.error('🚨 Global Error:', error)

  // 개발 환경에서만 간단한 알림 (프로덕션에서는 조용히)
  if (process.env.NODE_ENV === 'development') {
    // 작은 알림만 표시 (덜 방해가 되도록)
    console.warn(`⚠️ Error logged: ${error.message}`)
  }
}

function collectError(
  message: string,
  source?: string,
  line?: number,
  column?: number,
  error?: Error
): ErrorInfo {
  const errorInfo: ErrorInfo = {
    message,
    source,
    line,
    column,
    stack: error?.stack,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent
  }

  // 에러 큐에 추가 (최대 개수 제한)
  errorQueue.push(errorInfo)
  if (errorQueue.length > MAX_ERRORS) {
    errorQueue.shift()
  }

  return errorInfo
}

export function initGlobalErrorHandler() {
  // JavaScript 런타임 에러 처리
  window.onerror = (message, source, line, column, error) => {
    const errorInfo = collectError(
      typeof message === 'string' ? message : 'Unknown error',
      source,
      line,
      column,
      error
    )

    logErrorQuietly(errorInfo)

    return false // 기본 에러 처리도 실행
  }

  // Promise rejection 에러 처리
  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.message || event.reason || 'Unhandled Promise Rejection'

    const errorInfo = collectError(
      `Promise Rejection: ${message}`,
      'Promise',
      undefined,
      undefined,
      event.reason instanceof Error ? event.reason : undefined
    )

    logErrorQuietly(errorInfo)
  })

  // Resource loading 에러 처리
  window.addEventListener('error', (event) => {
    if (event.target && event.target !== window) {
      const target = event.target as HTMLElement
      const errorInfo = collectError(
        `Resource loading failed: ${target.tagName}`,
        target.getAttribute('src') || target.getAttribute('href') || 'Unknown',
        undefined,
        undefined
      )

      logErrorQuietly(errorInfo)
    }
  }, true)

  console.log('✅ Global error handler initialized')
}

export function getErrorQueue(): ErrorInfo[] {
  return [...errorQueue]
}

export function clearErrorQueue(): void {
  errorQueue = []
}

export function copyAllErrors(): void {
  if (errorQueue.length === 0) {
    Toast.show({ content: '에러 기록이 없습니다', icon: 'success' })
    return
  }

  const allErrors = errorQueue
    .map((error, index) => `\n=== Error ${index + 1} ===\n${formatError(error)}`)
    .join('\n\n')

  const fullReport = `
=== Error Report ===
Total Errors: ${errorQueue.length}
Generated: ${new Date().toISOString()}

${allErrors}
`.trim()

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(fullReport).then(() => {
      Toast.show({ content: `${errorQueue.length}개 에러 정보 복사됨!`, icon: 'success' })
    }).catch(() => {
      Toast.show({ content: '복사 실패', icon: 'fail' })
    })
  }
}