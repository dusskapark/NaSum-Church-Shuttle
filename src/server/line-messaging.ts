import { env } from './env';

function sanitizeLineError(details: string): string {
  return details.replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"***"');
}

function buildShuttleLiffUrl(
  pathname: '/' | '/scan',
  searchParams?: Record<string, string>,
): string | null {
  const liffId = env.NEXT_PUBLIC_LIFF_ID?.trim();
  if (liffId) {
    const suffix = pathname === '/' ? '' : pathname;
    const url = new URL(`https://liff.line.me/${liffId}${suffix}`);
    Object.entries(searchParams ?? {}).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
    return url.toString();
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    const normalized = appUrl.replace(/\/$/, '');
    const url = new URL(`${normalized}${pathname}`);
    Object.entries(searchParams ?? {}).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
    return url.toString();
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
  routeCode: string;
  stopsAway: 1 | 2;
}): Promise<void> {
  const accessToken = env.MESSAGING_API_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('MESSAGING_API_CHANNEL_ACCESS_TOKEN is not configured');
  }

  const scanUrl = buildShuttleLiffUrl('/scan');
  const routeUrl = buildShuttleLiffUrl('/', { route: params.routeCode });
  if (!scanUrl || !routeUrl) {
    throw new Error('NEXT_PUBLIC_LIFF_ID or NEXT_PUBLIC_APP_URL is required');
  }

  const i18n =
    params.language === 'en'
      ? {
          altPrefix: 'Arrival alert',
          title: 'Arrival Alert',
          body: `Shuttle is ${params.stopsAway} stop${params.stopsAway > 1 ? 's' : ''} away. Please get ready to board.`,
          distanceLabel: `${params.stopsAway} stop${params.stopsAway > 1 ? 's' : ''} away`,
          primaryButtonLabel: 'QR Scan',
          secondaryButtonLabel: 'View Route',
        }
      : {
          altPrefix: '도착 알림',
          title: '도착 알림',
          body: `${params.stopsAway} 정거장 전에 셔틀 버스가 도착했습니다. 탑승을 준비하세요.`,
          distanceLabel: `${params.stopsAway} 정거장 전`,
          primaryButtonLabel: 'QR스캔',
          secondaryButtonLabel: '루트보기',
        };

  const accentColor = params.stopsAway === 1 ? '#D95D0F' : '#0F766E';

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
          altText: truncateForLine(`${i18n.altPrefix}: ${i18n.body}`, 400),
          contents: {
            type: 'bubble',
            size: 'kilo',
            styles: {
              body: {
                backgroundColor: '#FFFFFF',
              },
              footer: {
                separator: true,
              },
            },
            header: {
              type: 'box',
              layout: 'vertical',
              paddingAll: '18px',
              backgroundColor: accentColor,
              contents: [
                {
                  type: 'text',
                  text: i18n.title,
                  size: 'lg',
                  weight: 'bold',
                  color: '#FFFFFF',
                },
              ],
            },
            body: {
              type: 'box',
              layout: 'vertical',
              spacing: 'sm',
              paddingAll: '18px',
              contents: [
                {
                  type: 'box',
                  layout: 'vertical',
                  backgroundColor: '#F3F4F6',
                  cornerRadius: '999px',
                  paddingStart: '10px',
                  paddingEnd: '10px',
                  paddingTop: '6px',
                  paddingBottom: '6px',
                  contents: [
                    {
                      type: 'text',
                      text: i18n.distanceLabel,
                      size: 'xs',
                      weight: 'bold',
                      color: accentColor,
                    },
                  ],
                },
                {
                  type: 'text',
                  text: i18n.body,
                  wrap: true,
                  size: 'md',
                  color: '#111827',
                },
              ],
            },
            footer: {
              type: 'box',
              layout: 'horizontal',
              spacing: 'sm',
              paddingAll: '16px',
              contents: [
                {
                  type: 'button',
                  style: 'primary',
                  color: accentColor,
                  action: {
                    type: 'uri',
                    label: i18n.primaryButtonLabel,
                    uri: scanUrl,
                  },
                },
                {
                  type: 'button',
                  style: 'secondary',
                  action: {
                    type: 'uri',
                    label: i18n.secondaryButtonLabel,
                    uri: routeUrl,
                  },
                },
              ],
              flex: 0,
            },
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
