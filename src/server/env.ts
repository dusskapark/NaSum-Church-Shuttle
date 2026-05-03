import { z } from 'zod';

function optionalEnvValue(value: string | undefined) {
  if (value === undefined) return undefined;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  NEON_DATABASE_URL: z.string().min(1).optional(),
  DIRECT_URL: z.string().min(1).optional(),
  GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_LIFF_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_LIFF_ID_DEV: z.string().min(1).optional(),
  LINE_LOGIN_CHANNEL_ID: z.string().min(1).optional(),
  LINE_LOGIN_CHANNEL_SECRET: z.string().min(1).optional(),
  MESSAGING_API_CHANNEL_ACCESS_TOKEN: z.string().min(1).optional(),
  MESSAGING_API_CHANNEL_ID: z.string().min(1).optional(),
  MESSAGING_API_CHANNEL_SECRET: z.string().min(1).optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  APNS_BUNDLE_ID: z.string().min(1).optional(),
  APNS_ENVIRONMENT: z.enum(['sandbox', 'production']).optional(),
  APNS_TEAM_ID: z.string().min(1).optional(),
  APNS_KEY_ID: z.string().min(1).optional(),
  APNS_PRIVATE_KEY_BASE64: z.string().min(1).optional(),
  APPLE_CLIENT_ID: z.string().min(1).optional(),
  APPLE_BUNDLE_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_SERVER_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_IOS_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_ANDROID_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_AUTH_CLIENT_IDS: z.string().min(1).optional(),
  APPLE_REVIEW_ADMIN_EMAIL: z.string().email().optional(),
  APPLE_REVIEW_ADMIN_PASSWORD: z.string().min(8).optional(),
  APPLE_REVIEW_ADMIN_NAME: z.string().min(1).optional(),
});

export const env = envSchema.parse({
  DATABASE_URL: optionalEnvValue(process.env.DATABASE_URL),
  NEON_DATABASE_URL: optionalEnvValue(process.env.NEON_DATABASE_URL),
  DIRECT_URL: optionalEnvValue(process.env.DIRECT_URL),
  GOOGLE_MAPS_API_KEY: optionalEnvValue(process.env.GOOGLE_MAPS_API_KEY),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: optionalEnvValue(
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  ),
  NEXT_PUBLIC_APP_URL: optionalEnvValue(process.env.NEXT_PUBLIC_APP_URL),
  NEXT_PUBLIC_LIFF_ID: optionalEnvValue(process.env.NEXT_PUBLIC_LIFF_ID),
  NEXT_PUBLIC_LIFF_ID_DEV: optionalEnvValue(process.env.NEXT_PUBLIC_LIFF_ID_DEV),
  LINE_LOGIN_CHANNEL_ID: optionalEnvValue(process.env.LINE_LOGIN_CHANNEL_ID),
  LINE_LOGIN_CHANNEL_SECRET: optionalEnvValue(
    process.env.LINE_LOGIN_CHANNEL_SECRET,
  ),
  MESSAGING_API_CHANNEL_ACCESS_TOKEN:
    optionalEnvValue(process.env.MESSAGING_API_CHANNEL_ACCESS_TOKEN),
  MESSAGING_API_CHANNEL_ID: optionalEnvValue(process.env.MESSAGING_API_CHANNEL_ID),
  MESSAGING_API_CHANNEL_SECRET: optionalEnvValue(
    process.env.MESSAGING_API_CHANNEL_SECRET,
  ),
  SESSION_SECRET: optionalEnvValue(process.env.SESSION_SECRET),
  APNS_BUNDLE_ID: optionalEnvValue(process.env.APNS_BUNDLE_ID),
  APNS_ENVIRONMENT: optionalEnvValue(process.env.APNS_ENVIRONMENT) as
    | 'sandbox'
    | 'production'
    | undefined,
  APNS_TEAM_ID: optionalEnvValue(process.env.APNS_TEAM_ID),
  APNS_KEY_ID: optionalEnvValue(process.env.APNS_KEY_ID),
  APNS_PRIVATE_KEY_BASE64: optionalEnvValue(process.env.APNS_PRIVATE_KEY_BASE64),
  APPLE_CLIENT_ID: optionalEnvValue(process.env.APPLE_CLIENT_ID),
  APPLE_BUNDLE_ID: optionalEnvValue(process.env.APPLE_BUNDLE_ID),
  GOOGLE_CLIENT_ID: optionalEnvValue(process.env.GOOGLE_CLIENT_ID),
  GOOGLE_SERVER_CLIENT_ID: optionalEnvValue(process.env.GOOGLE_SERVER_CLIENT_ID),
  GOOGLE_IOS_CLIENT_ID: optionalEnvValue(process.env.GOOGLE_IOS_CLIENT_ID),
  GOOGLE_ANDROID_CLIENT_ID: optionalEnvValue(process.env.GOOGLE_ANDROID_CLIENT_ID),
  GOOGLE_AUTH_CLIENT_IDS: optionalEnvValue(process.env.GOOGLE_AUTH_CLIENT_IDS),
  APPLE_REVIEW_ADMIN_EMAIL: optionalEnvValue(
    process.env.APPLE_REVIEW_ADMIN_EMAIL,
  ),
  APPLE_REVIEW_ADMIN_PASSWORD: optionalEnvValue(
    process.env.APPLE_REVIEW_ADMIN_PASSWORD,
  ),
  APPLE_REVIEW_ADMIN_NAME: optionalEnvValue(
    process.env.APPLE_REVIEW_ADMIN_NAME,
  ),
});
