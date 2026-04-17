import { env } from './env';

function sanitizeLineError(details: string): string {
  return details.replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"***"');
}

interface ShuttleLiffUrls {
  scanUrl: string;
}

function buildShuttleLiffUrls(): ShuttleLiffUrls | null {
  const liffId = env.NEXT_PUBLIC_LIFF_ID?.trim();
  if (liffId) {
    return {
      scanUrl: `https://liff.line.me/${liffId}/scan`,
    };
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    const normalized = appUrl.replace(/\/$/, '');
    return {
      scanUrl: `${normalized}/scan`,
    };
  }

  return null;
}


function truncateForLine(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

export async function sendLinePushShuttleCarousel(params: {
  to: string;
  language: 'ko' | 'en';
  title: string;
  body: string;
}): Promise<void> {
  const accessToken = env.MESSAGING_API_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('MESSAGING_API_CHANNEL_ACCESS_TOKEN is not configured');
  }

  const liffUrls = buildShuttleLiffUrls();
  if (!liffUrls) {
    throw new Error('NEXT_PUBLIC_LIFF_ID or NEXT_PUBLIC_APP_URL is required');
  }

  const i18n =
    params.language === 'en'
      ? {
          altPrefix: 'Shuttle notice',
          heroLabel: 'Arrival Alert',
          buttonLabel: 'Board Now',
        }
      : {
          altPrefix: '셔틀 알림',
          heroLabel: '도착 알림',
          buttonLabel: '탑승하기',
        };

  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: params.to,
      messages: [
        {
          type: 'flex',
          altText: truncateForLine(`${i18n.altPrefix}: ${params.title} - ${params.body}`, 400),
          contents: {
            type: 'carousel',
            contents: [
              {
                type: 'bubble',
                size: 'mega',
                styles: {
                  body: {
                    backgroundColor: '#F5F8FF',
                  },
                  footer: {
                    separator: true,
                  },
                },
                body: {
                  type: 'box',
                  layout: 'vertical',
                  spacing: 'md',
                  contents: [
                    {
                      type: 'box',
                      layout: 'vertical',
                      backgroundColor: '#2D5BFF',
                      cornerRadius: '12px',
                      paddingAll: '12px',
                      contents: [
                        {
                          type: 'text',
                          text: i18n.heroLabel,
                          color: '#FFFFFF',
                          weight: 'bold',
                          size: 'sm',
                        },
                      ],
                    },
                    {
                      type: 'text',
                      text: params.body,
                      wrap: true,
                      size: 'md',
                      color: '#111827',
                    },
                  ],
                },
                footer: {
                  type: 'box',
                  layout: 'vertical',
                  spacing: 'sm',
                  contents: [
                    {
                      type: 'button',
                      style: 'primary',
                      color: '#2D5BFF',
                      action: {
                        type: 'uri',
                        label: i18n.buttonLabel,
                        uri: liffUrls.scanUrl,
                      },
                    },
                  ],
                  flex: 0,
                },
              },
            ],
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(
      `LINE push failed: ${response.status}${details ? ` ${sanitizeLineError(details)}` : ''}`,
    );
  }
}

export async function sendLineReplyTemplate(params: {
  replyToken: string;
  liffUrl: string;
}): Promise<void> {
  const accessToken = env.MESSAGING_API_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('MESSAGING_API_CHANNEL_ACCESS_TOKEN is not configured');
  }

  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      replyToken: params.replyToken,
      messages: [
        {
          type: 'template',
          altText: '셔틀버스 탑승 링크 안내',
          template: {
            type: 'buttons',
            title: '셔틀버스 이용',
            text: '아래 버튼을 눌러 셔틀버스 탑승 화면으로 이동하세요.',
            actions: [
              {
                type: 'uri',
                label: '탑승하기',
                uri: params.liffUrl,
              },
            ],
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(
      `LINE reply failed: ${response.status}${details ? ` ${sanitizeLineError(details)}` : ''}`,
    );
  }
}
