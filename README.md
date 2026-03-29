# NaSum Church Shuttle

NaSum Church Shuttle is the fresh Next.js foundation for LIFF-based shuttle check-in, route visibility, operations tooling, and LINE Messaging API workflows.

## Stack

- Next.js App Router
- React
- Tailwind CSS
- TypeScript
- LINE LIFF + LINE Messaging API
- Supabase

## Getting Started

1. Copy `.env.example` values into your local `.env`.
2. Install dependencies.
3. Start the development server.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Starter Routes

- `GET /api/health`
- `GET /api/ready`
- `POST /api/webhooks/line`
- `POST /api/internal/notifications/line/push`

## Environment Notes

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is the preferred key name.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` is still accepted as a legacy alias for compatibility with existing local `.env` files.
- `MESSAGING_API_CHANNEL_ACCESS_TOKEN` is required before readiness and LINE push tests can pass.

## Repository

- GitHub: `https://github.com/dusskapark/NaSum-Church-Shuttle`
