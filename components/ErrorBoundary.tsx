import React, { Component } from 'react'
import { Toast } from 'antd-mobile'
import { logError } from '../lib/logger'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

interface ErrorBoundaryProps {
  children: React.ReactNode
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ error, errorInfo })

    // 에러 정보 수집
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    }

    logError('React Error Boundary:', errorDetails)

    // Toast로 에러 표시
    const shortMessage = error.message.length > 80
      ? error.message.substring(0, 80) + '...'
      : error.message

    Toast.show({
      content: `⚛️ React Error: ${shortMessage}`,
      icon: 'fail',
      duration: 6000
    })

    // 에러 정보 복사 기능
    const fullError = `
=== React Error Boundary ===
Message: ${error.message}
Stack: ${error.stack || 'No stack trace'}
Component Stack: ${errorInfo.componentStack}
URL: ${errorDetails.url}
Timestamp: ${errorDetails.timestamp}
UserAgent: ${errorDetails.userAgent}
`.trim()

    // 자동으로 에러 정보 복사 (선택사항)
    if (navigator.clipboard && navigator.clipboard.writeText) {
      setTimeout(() => {
        navigator.clipboard.writeText(fullError).then(() => {
          Toast.show({ content: 'React 에러 정보 복사됨!', icon: 'success', duration: 2000 })
        }).catch(() => {
          logError('Copy failed')
        })
      }, 2000)
    }
  }

  render() {
    if (this.state.hasError) {
      // 에러 발생 시 보여줄 UI
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh',
            padding: 20,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: 'var(--adm-color-danger)' }}>
            앱에 오류가 발생했습니다
          </div>
          <div style={{ fontSize: 14, color: 'var(--app-color-subtle-text)', marginBottom: 16 }}>
            에러 정보가 자동으로 복사되었습니다
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--app-color-subtle-text)',
              fontFamily: 'monospace',
              backgroundColor: 'var(--app-color-surface-muted)',
              padding: 8,
              borderRadius: 4,
              maxWidth: '100%',
              overflow: 'auto'
            }}
          >
            {this.state.error?.message}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
