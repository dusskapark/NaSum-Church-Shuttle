import { z } from 'zod';

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
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  NEON_DATABASE_URL: process.env.NEON_DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_LIFF_ID: process.env.NEXT_PUBLIC_LIFF_ID,
  NEXT_PUBLIC_LIFF_ID_DEV: process.env.NEXT_PUBLIC_LIFF_ID_DEV,
  LINE_LOGIN_CHANNEL_ID: process.env.LINE_LOGIN_CHANNEL_ID,
  LINE_LOGIN_CHANNEL_SECRET: process.env.LINE_LOGIN_CHANNEL_SECRET,
  MESSAGING_API_CHANNEL_ACCESS_TOKEN:
    process.env.MESSAGING_API_CHANNEL_ACCESS_TOKEN,
  MESSAGING_API_CHANNEL_ID: process.env.MESSAGING_API_CHANNEL_ID,
  MESSAGING_API_CHANNEL_SECRET: process.env.MESSAGING_API_CHANNEL_SECRET,
  SESSION_SECRET: process.env.SESSION_SECRET,
});
