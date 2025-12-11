# Vercel Deployment Research

> Deployment patterns for voice meeting agents on Vercel

## 1. Overview

Vercel provides:
- Edge and serverless function runtimes
- Automatic CI/CD from Git
- Preview deployments
- Environment variable management
- Analytics and monitoring

## 2. Project Configuration

### vercel.json

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "regions": ["iad1"],
  "functions": {
    "app/api/transcribe/**": {
      "maxDuration": 60
    },
    "app/api/summary/**": {
      "maxDuration": 120
    },
    "app/api/tts/**": {
      "maxDuration": 30
    }
  },
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 3 * * *"
    }
  ]
}
```

### next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth']
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com'
      },
      {
        protocol: 'https',
        hostname: '*.convex.cloud'
      }
    ]
  },
  headers: async () => [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Credentials', value: 'true' },
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' }
      ]
    }
  ]
};

module.exports = nextConfig;
```

## 3. Environment Variables

### Required Variables

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...

# Convex
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
CONVEX_DEPLOY_KEY=prod:...

# ElevenLabs
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...

# AssemblyAI
ASSEMBLYAI_API_KEY=...

# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Anam
ANAM_API_KEY=...

# Optional: Rate limiting
UPSTASH_REDIS_URL=...
UPSTASH_REDIS_TOKEN=...
```

### Environment Configuration

```typescript
// lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string(),
  CLERK_SECRET_KEY: z.string(),
  NEXT_PUBLIC_CONVEX_URL: z.string().url(),
  ELEVENLABS_API_KEY: z.string(),
  ELEVENLABS_VOICE_ID: z.string(),
  ASSEMBLYAI_API_KEY: z.string(),
  OPENAI_API_KEY: z.string(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANAM_API_KEY: z.string()
});

export const env = envSchema.parse(process.env);
```

## 4. Function Configuration

### Serverless Function Limits

| Plan | Duration | Memory | Payload |
|------|----------|--------|---------|
| Hobby | 10s | 1024MB | 4.5MB |
| Pro | 60s | 3008MB | 4.5MB |
| Enterprise | 900s | 3008MB | 4.5MB |

### Streaming Functions

```typescript
// app/api/stream/route.ts
export const runtime = 'edge';
export const preferredRegion = 'iad1';

export async function POST(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < 10; i++) {
        controller.enqueue(encoder.encode(`data: ${i}\n\n`));
        await new Promise(r => setTimeout(r, 100));
      }
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  });
}
```

### Long-Running Functions

```typescript
// app/api/summary/route.ts
export const maxDuration = 120; // 2 minutes for Pro plan

export async function POST(request: Request) {
  // Long-running LLM processing
  const result = await generateDetailedSummary();
  return Response.json(result);
}
```

## 5. Edge vs Serverless

### Edge Runtime

```typescript
// For low-latency, geographically distributed endpoints
export const runtime = 'edge';

// Limitations:
// - No native Node.js APIs (fs, path, etc.)
// - Limited npm package support
// - 25ms CPU time limit

export async function GET() {
  return Response.json({ timestamp: Date.now() });
}
```

### Node.js Runtime (Default)

```typescript
// For full Node.js API access
export const runtime = 'nodejs';

// Benefits:
// - Full npm package support
// - Native Node.js APIs
// - Longer execution time

import pdf from 'pdf-parse';

export async function POST(request: Request) {
  const buffer = await request.arrayBuffer();
  const data = await pdf(Buffer.from(buffer));
  return Response.json({ text: data.text });
}
```

## 6. Cron Jobs

### Vercel Cron Configuration

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/cron/process-summaries",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

### Cron Route Handler

```typescript
// app/api/cron/cleanup/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Cleanup logic
  await cleanupOldMeetings();

  return NextResponse.json({ success: true });
}
```

## 7. Middleware

```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)'
]);

export default clerkMiddleware(async (auth, req) => {
  // Rate limiting header
  const response = NextResponse.next();
  response.headers.set('X-Request-Id', crypto.randomUUID());

  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  return response;
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)']
};
```

## 8. Preview Deployments

### Branch Previews

```yaml
# .github/workflows/preview.yml
name: Preview Deployment

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

### Preview Environment Variables

```bash
# Set preview-specific env vars
vercel env add NEXT_PUBLIC_API_URL preview
```

## 9. Monitoring & Analytics

### Vercel Analytics

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

### Custom Logging

```typescript
// lib/logger.ts
export function log(level: 'info' | 'warn' | 'error', message: string, data?: object) {
  const logEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...data
  };

  if (process.env.NODE_ENV === 'production') {
    // Structured logging for Vercel
    console.log(JSON.stringify(logEntry));
  } else {
    console.log(`[${level.toUpperCase()}] ${message}`, data);
  }
}

// Usage
log('info', 'Meeting started', { meetingId: '123', userId: 'abc' });
log('error', 'Transcription failed', { error: error.message });
```

## 10. Performance Optimisation

### Image Optimisation

```typescript
// next.config.js
module.exports = {
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60
  }
};
```

### ISR (Incremental Static Regeneration)

```typescript
// app/rooms/page.tsx
export const revalidate = 60; // Revalidate every 60 seconds

export default async function RoomsPage() {
  const rooms = await fetchRooms();
  return <RoomList rooms={rooms} />;
}
```

### Dynamic Imports

```typescript
// Lazy load heavy components
import dynamic from 'next/dynamic';

const AudioVisualiser = dynamic(
  () => import('@/components/AudioVisualiser'),
  {
    ssr: false,
    loading: () => <div>Loading visualiser...</div>
  }
);
```

## 11. Error Handling

### Error Boundary

```typescript
// app/error.tsx
'use client';

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="error-container">
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

### Global Error Handler

```typescript
// app/global-error.tsx
'use client';

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
```

## 12. Security Headers

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(self), geolocation=()'
  }
];

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders
      }
    ];
  }
};
```

## 13. Deployment Checklist

1. **Environment Variables**: All secrets configured in Vercel dashboard
2. **Domain**: Custom domain configured with SSL
3. **Regions**: Function regions optimised for user base
4. **Timeouts**: Long-running functions configured appropriately
5. **Analytics**: Vercel Analytics enabled
6. **Error Tracking**: Error boundaries and logging configured
7. **Preview Deployments**: Working for PRs
8. **Cron Jobs**: Scheduled tasks configured
9. **Security Headers**: All headers applied
10. **Performance**: ISR and dynamic imports where appropriate

## 14. Sources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)
- [Vercel Functions](https://vercel.com/docs/functions)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
