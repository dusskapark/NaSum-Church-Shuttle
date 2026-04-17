import { env } from './env';

function sanitizeLineError(details: string): string {
  return details.replace(/"access_token"\s*:\s*"[^"]+"/gi, '"access_token":"***"');
}

export async function sendLinePushText(
  to: string,
  text: string,
): Promise<void> {
  const accessToken = env.MESSAGING_API_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('MESSAGING_API_CHANNEL_ACCESS_TOKEN is not configured');
  }

  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to,
      messages: [{ type: 'text', text }],
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
  scanUrl: string;
  homeUrl: string;
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
          altText: '셔틀버스 이용 메뉴',
          template: {
            type: 'carousel',
            columns: [
              {
                title: 'QR 스캔',
                text: '탑승 QR을 스캔하려면 아래 버튼을 눌러주세요.',
                actions: [
                  {
                    type: 'uri',
                    label: 'QR 스캔하기',
                    uri: params.scanUrl,
                  },
                ],
              },
              {
                title: '노선 보기',
                text: '셔틀 노선과 정류장을 확인하려면 이동하세요.',
                actions: [
                  {
                    type: 'uri',
                    label: '노선보기',
                    uri: params.homeUrl,
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
      `LINE reply failed: ${response.status}${details ? ` ${sanitizeLineError(details)}` : ''}`,
    );
  }
}
