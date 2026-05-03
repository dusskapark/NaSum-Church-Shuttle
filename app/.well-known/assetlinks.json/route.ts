import { NextResponse } from 'next/server';
import { env } from '@/server/env';

const DEFAULT_ANDROID_PACKAGE_NAME = 'sg.nasumchurch.shuttle';

function csv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function GET() {
  const fingerprints = csv(env.ANDROID_SHA256_CERT_FINGERPRINTS);
  const statements = fingerprints.length
    ? [
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: {
            namespace: 'android_app',
            package_name:
              env.ANDROID_APP_PACKAGE_NAME ?? DEFAULT_ANDROID_PACKAGE_NAME,
            sha256_cert_fingerprints: fingerprints,
          },
        },
      ]
    : [];

  return NextResponse.json(statements, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'application/json',
    },
  });
}
