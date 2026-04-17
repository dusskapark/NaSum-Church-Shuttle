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
  routeLabel: string;
  arrivedStopName: string;
  targetStopName: string;
  intermediateStopName?: string | null;
  stopsAway: 1 | 2;
}): Promise<void> {
  const accessToken = env.MESSAGING_API_CHANNEL_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error('MESSAGING_API_CHANNEL_ACCESS_TOKEN is not configured');
  }

  const scanUrl = buildShuttleLiffUrl('/scan');
  const homeUrl = buildShuttleLiffUrl('/');
  if (!scanUrl || !homeUrl) {
    throw new Error('NEXT_PUBLIC_LIFF_ID or NEXT_PUBLIC_APP_URL is required');
  }

  const i18n =
    params.language === 'en'
      ? {
          altPrefix: 'Shuttle notice',
          heroLabel: 'Arrival Alert',
          currentLabel: 'Current',
          nextLabel: 'Next',
          targetLabel: 'My Stop',
          primaryButtonLabel: 'Scan QR',
          secondaryButtonLabel: 'Open App',
          oneStopLead: `Shuttle has arrived at ${params.arrivedStopName}.`,
          oneStopSummary: `Next stop is ${params.targetStopName}.`,
          oneStopHint: 'It is almost here. Get ready to board.',
          twoStopLead: `Shuttle has arrived at ${params.arrivedStopName}.`,
          twoStopSummary: `${params.targetStopName} is 2 stops away.`,
          twoStopHint: 'One more stop after the next stop.',
          altText:
            params.stopsAway === 1
              ? `Shuttle reached ${params.arrivedStopName}. Next stop is ${params.targetStopName}.`
              : `Shuttle reached ${params.arrivedStopName}. ${params.targetStopName} is 2 stops away.`,
        }
      : {
          altPrefix: '셔틀 알림',
          heroLabel: '도착 알림',
          currentLabel: '현재',
          nextLabel: '다음',
          targetLabel: '내 정류장',
          primaryButtonLabel: '탑승 스캔',
          secondaryButtonLabel: '경로보기',
          oneStopLead: `셔틀이 ${params.arrivedStopName}에 도착했습니다.`,
          oneStopSummary: `다음 정류장은 ${params.targetStopName}입니다.`,
          oneStopHint: '곧 도착합니다. 탑승을 준비하세요.',
          twoStopLead: `셔틀이 ${params.arrivedStopName}에 도착했습니다.`,
          twoStopSummary: `${params.targetStopName}까지 2정거장 남았습니다.`,
          twoStopHint: '다음 정류장을 지나면 곧 도착합니다.',
          altText:
            params.stopsAway === 1
              ? `셔틀이 ${params.arrivedStopName}에 도착했습니다. 다음 정류장은 ${params.targetStopName}입니다.`
              : `셔틀이 ${params.arrivedStopName}에 도착했습니다. ${params.targetStopName}까지 2정거장 남았습니다.`,
        };

  const palette =
    params.stopsAway === 1
      ? {
          header: '#D95D0F',
          chip: '#FFF1E8',
          chipText: '#D95D0F',
          active: '#D95D0F',
          target: '#FF8A00',
          muted: '#D9DEE8',
          targetBackground: '#FFF7ED',
        }
      : {
          header: '#0367D3',
          chip: '#EAF2FF',
          chipText: '#0367D3',
          active: '#3B82F6',
          target: '#94A3B8',
          muted: '#D9DEE8',
          targetBackground: '#F8FAFC',
        };

  function buildNode(label: string, stopName: string, options: {
    fillColor?: string;
    borderColor: string;
    textColor?: string;
    labelColor?: string;
  }) {
    return {
      type: 'box',
      layout: 'horizontal',
      spacing: 'md',
      alignItems: 'center',
      width: '100%',
      contents: [
        buildStopMarker(options.fillColor ?? '#FFFFFF', options.borderColor),
        {
          type: 'box',
          layout: 'vertical',
          spacing: '2px',
          flex: 1,
          contents: [
            {
              type: 'text',
              text: label,
              size: 'xs',
              weight: 'bold',
              color: options.labelColor ?? '#6B7280',
            },
            {
              type: 'text',
              text: stopName,
              size: 'sm',
              weight: 'bold',
              wrap: true,
              color: options.textColor ?? '#111827',
              maxLines: 3,
            },
          ],
        },
      ],
    };
  }

  function buildStopMarker(fillColor: string, borderColor: string) {
    return {
      type: 'box',
      layout: 'vertical',
      width: '14px',
      height: '14px',
      cornerRadius: '999px',
      backgroundColor: fillColor,
      borderWidth: '2px',
      borderColor,
      contents: [],
    };
  }

  function buildVerticalConnector(color: string) {
    return {
      type: 'box',
      layout: 'horizontal',
      width: '100%',
      paddingStart: '6px',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          width: '2px',
          height: '18px',
          cornerRadius: '999px',
          backgroundColor: color,
          margin: 'none',
          contents: [],
        },
      ],
    };
  }

  function buildNodeList(nodes: unknown[], connectors: unknown[]) {
    const contents: unknown[] = [];
    nodes.forEach((node, index) => {
      contents.push(node);
      if (index < connectors.length) {
        contents.push(connectors[index]);
      }
    });
    return {
      type: 'box',
      layout: 'vertical',
      margin: 'md',
      spacing: 'none',
      contents: [
        ...contents,
      ],
    };
  }

  const routeStrip =
    params.stopsAway === 1
      ? buildNodeList(
          [
            buildNode(i18n.currentLabel, params.arrivedStopName, {
              fillColor: palette.active,
              borderColor: palette.active,
              textColor: '#111827',
              labelColor: palette.active,
            }),
            buildNode(i18n.targetLabel, params.targetStopName, {
              fillColor: palette.target,
              borderColor: palette.target,
              textColor: palette.target,
              labelColor: palette.target,
            }),
          ],
          [buildVerticalConnector(palette.active)],
        )
      : buildNodeList(
          [
            buildNode(i18n.currentLabel, params.arrivedStopName, {
              fillColor: palette.active,
              borderColor: palette.active,
              textColor: '#111827',
              labelColor: palette.active,
            }),
            buildNode(
              i18n.nextLabel,
              params.intermediateStopName ?? i18n.nextLabel,
              {
                borderColor: palette.active,
                textColor: '#111827',
                labelColor: palette.active,
              },
            ),
            buildNode(i18n.targetLabel, params.targetStopName, {
              borderColor: palette.target,
              fillColor: palette.targetBackground,
              textColor: '#475569',
              labelColor: '#64748B',
            }),
          ],
          [
            buildVerticalConnector(palette.active),
            buildVerticalConnector(palette.muted),
          ],
        );

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
          altText: truncateForLine(`${i18n.altPrefix}: ${i18n.altText}`, 400),
          contents: {
            type: 'bubble',
            size: 'mega',
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
              paddingAll: '20px',
              paddingTop: '22px',
              height: '154px',
              spacing: 'md',
              backgroundColor: palette.header,
              contents: [
                {
                  type: 'text',
                  text: i18n.heroLabel,
                  size: 'sm',
                  color: '#FFFFFFB3',
                  weight: 'bold',
                },
                {
                  type: 'text',
                  text: params.routeLabel,
                  size: 'xl',
                  weight: 'bold',
                  color: '#FFFFFF',
                  wrap: true,
                  maxLines: 2,
                },
              ],
            },
            body: {
              type: 'box',
              layout: 'vertical',
              spacing: 'md',
              paddingAll: '20px',
              contents: [
                {
                  type: 'text',
                  text:
                    params.stopsAway === 1
                      ? i18n.oneStopLead
                      : i18n.twoStopLead,
                  wrap: true,
                  size: 'md',
                  color: '#111827',
                  weight: 'bold',
                },
                {
                  type: 'box',
                  layout: 'vertical',
                  cornerRadius: '14px',
                  backgroundColor: params.stopsAway === 1 ? '#FFF7ED' : '#F8FAFC',
                  paddingAll: '14px',
                  spacing: 'sm',
                  contents: [
                    {
                      type: 'text',
                      text:
                        params.stopsAway === 1
                          ? i18n.oneStopSummary
                          : i18n.twoStopSummary,
                      wrap: true,
                      size: 'sm',
                      color: '#374151',
                    },
                    routeStrip,
                  ],
                },
                {
                  type: 'box',
                  layout: 'vertical',
                  spacing: 'sm',
                  cornerRadius: '12px',
                  paddingAll: '14px',
                  backgroundColor: palette.chip,
                  contents: [
                    {
                      type: 'text',
                      text: i18n.targetLabel,
                      size: 'xs',
                      weight: 'bold',
                      color: palette.chipText,
                    },
                    {
                      type: 'text',
                      text: params.targetStopName,
                      size: 'md',
                      weight: 'bold',
                      wrap: true,
                      color: '#111827',
                    },
                    {
                      type: 'text',
                      text:
                        params.stopsAway === 1
                          ? i18n.oneStopHint
                          : i18n.twoStopHint,
                      size: 'sm',
                      wrap: true,
                      color: '#475569',
                    },
                  ],
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
                  color: palette.header,
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
                    uri: homeUrl,
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
