'use client';

import { Button, ErrorBlock, Space } from 'antd-mobile';

type ErrorStatus = 'default' | 'disconnected' | 'empty' | 'busy';

interface ErrorBlockPageProps {
  status?: ErrorStatus;
  title: string;
  description: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
}

export default function ErrorBlockPage({
  status = 'default',
  title,
  description,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}: ErrorBlockPageProps) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'var(--app-color-background)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        <ErrorBlock
          fullPage
          status={status}
          title={title}
          description={description}
        />

        {(primaryLabel || secondaryLabel) && (
          <Space block direction="vertical" style={{ marginTop: 16 }}>
            {primaryLabel && onPrimary && (
              <Button color="primary" block onClick={onPrimary}>
                {primaryLabel}
              </Button>
            )}
            {secondaryLabel && onSecondary && (
              <Button block onClick={onSecondary}>
                {secondaryLabel}
              </Button>
            )}
          </Space>
        )}
      </div>
    </div>
  );
}
