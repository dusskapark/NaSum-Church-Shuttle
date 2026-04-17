import { env } from './env';

function sanitizeLineError(details: string): string {
  return details.replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"***"');
}

interface ShuttleLiffUrls {
  scanUrl: string;
  homeUrl: string;
}

function buildShuttleLiffUrls(): ShuttleLiffUrls | null {
  const liffId = env.NEXT_PUBLIC_LIFF_ID?.trim();
  if (liffId) {
    return {
      scanUrl: `https://liff.line.me/${liffId}/scan`,
      homeUrl: `https://liff.line.me/${liffId}`,
    };
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    const normalized = appUrl.replace(/\/$/, '');
    return {
      scanUrl: `${normalized}/scan`,
      homeUrl: normalized,
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
          qrCardTitle: 'QR Scan',
          qrCardText: 'Open the QR page to complete shuttle boarding.',
          qrButtonLabel: 'Open QR Scan',
          routeCardTitle: 'View Route',
          routeCardText: 'Check route and stop information in the LIFF app.',
          routeButtonLabel: 'Open Routes',
        }
      : {
          altPrefix: '셔틀 알림',
          qrCardTitle: 'QR 스캔',
          qrCardText: '탑승 QR 스캔 페이지로 이동합니다.',
          qrButtonLabel: 'QR 스캔하기',
          routeCardTitle: '노선 보기',
          routeCardText: 'LIFF에서 노선과 정류장을 확인합니다.',
          routeButtonLabel: '노선보기',
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
          type: 'template',
          altText: truncateForLine(`${i18n.altPrefix}: ${params.title} - ${params.body}`, 400),
          template: {
            type: 'carousel',
            columns: [
              {
                title: i18n.qrCardTitle,
                text: i18n.qrCardText,
                actions: [
                  {
                    type: 'uri',
                    label: i18n.qrButtonLabel,
                    uri: liffUrls.scanUrl,
                  },
                ],
              },
              {
                title: i18n.routeCardTitle,
                text: i18n.routeCardText,
                actions: [
                  {
                    type: 'uri',
                    label: i18n.routeButtonLabel,
                    uri: liffUrls.homeUrl,
                  },
                ],
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
