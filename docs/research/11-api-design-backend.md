# API Design & Backend Research

> Next.js API routes and backend patterns for voice meeting agents

## 1. Overview

Backend architecture for the meeting agent:
- Next.js API Routes (App Router)
- Convex for real-time data
- External API integrations (STT, TTS, LLM)
- WebSocket connections for streaming

## 2. API Route Structure

### Directory Organisation

```
app/
├── api/
│   ├── rooms/
│   │   ├── route.ts              # GET (list), POST (create)
│   │   └── [id]/
│   │       ├── route.ts          # GET, PATCH, DELETE
│   │       ├── documents/
│   │       │   └── route.ts      # POST (upload)
│   │       └── meetings/
│   │           └── route.ts      # POST (start meeting)
│   ├── meetings/
│   │   └── [id]/
│   │       ├── route.ts          # GET, PATCH
│   │       ├── transcribe/
│   │       │   └── route.ts      # POST (audio chunk)
│   │       └── summary/
│   │           └── route.ts      # POST (generate)
│   ├── transcribe/
│   │   └── stream/
│   │       └── route.ts          # POST (SSE stream)
│   ├── tts/
│   │   └── route.ts              # POST (text to speech)
│   └── webhooks/
│       ├── clerk/
│       │   └── route.ts
│       └── assemblyai/
│           └── route.ts
```

## 3. Route Handler Patterns

### Basic CRUD Routes

```typescript
// app/api/rooms/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rooms = await convex.query(api.rooms.list);
    return NextResponse.json(rooms);
  } catch (error) {
    console.error('Failed to fetch rooms:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rooms' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const roomId = await convex.mutation(api.rooms.create, {
      name: body.name,
      description: body.description
    });

    return NextResponse.json({ id: roomId }, { status: 201 });
  } catch (error) {
    console.error('Failed to create room:', error);
    return NextResponse.json(
      { error: 'Failed to create room' },
      { status: 500 }
    );
  }
}
```

### Dynamic Route Parameters

```typescript
// app/api/rooms/[id]/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const room = await convex.query(api.rooms.get, { id: params.id });

  if (!room) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(room);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  await convex.mutation(api.rooms.update, {
    id: params.id,
    ...body
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await convex.mutation(api.rooms.remove, { id: params.id });

  return NextResponse.json({ success: true });
}
```

## 4. Streaming Responses

### Server-Sent Events (SSE)

```typescript
// app/api/transcribe/stream/route.ts
import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const formData = await request.formData();
  const audioFile = formData.get('audio') as File;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Connect to AssemblyAI real-time
        const ws = new WebSocket('wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000');

        ws.onopen = async () => {
          // Send audio data
          const buffer = await audioFile.arrayBuffer();
          ws.send(buffer);
          ws.send(JSON.stringify({ terminate_session: true }));
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);

          if (data.message_type === 'PartialTranscript') {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'partial', text: data.text })}\n\n`
            ));
          } else if (data.message_type === 'FinalTranscript') {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'final', text: data.text })}\n\n`
            ));
          }
        };

        ws.onclose = () => {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        };

        ws.onerror = (error) => {
          controller.error(error);
        };
      } catch (error) {
        controller.error(error);
      }
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

### LLM Streaming with Vercel AI SDK

```typescript
// app/api/summary/stream/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { transcript } = await request.json();

  const result = await streamText({
    model: openai('gpt-4o'),
    system: `You are a meeting analyst. Generate a comprehensive summary including:
- Key discussion points
- Decisions made
- Action items with owners
- Risks identified
- Next steps`,
    messages: [{ role: 'user', content: transcript }]
  });

  return result.toDataStreamResponse();
}
```

## 5. File Upload Handling

```typescript
// app/api/rooms/[id]/documents/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { processDocument } from '@/lib/document-processor';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // Validate file type
  const allowedTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ];

  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type' },
      { status: 400 }
    );
  }

  // Validate file size (10MB limit)
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'File too large' },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const processed = await processDocument(buffer, file.name);

    // Store in Convex
    const documentId = await convex.mutation(api.documents.create, {
      roomId: params.id,
      filename: file.name,
      fileType: file.type,
      extractedText: processed.text,
      chunks: processed.chunks
    });

    return NextResponse.json({ id: documentId }, { status: 201 });
  } catch (error) {
    console.error('Document processing failed:', error);
    return NextResponse.json(
      { error: 'Failed to process document' },
      { status: 500 }
    );
  }
}

export const config = {
  api: {
    bodyParser: false
  }
};
```

## 6. External API Integration

### TTS Route

```typescript
// app/api/tts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID!;

export async function POST(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { text } = await request.json();

  if (!text || text.length > 5000) {
    return NextResponse.json(
      { error: 'Invalid text' },
      { status: 400 }
    );
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    }
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: 'TTS generation failed' },
      { status: 500 }
    );
  }

  return new Response(response.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-cache'
    }
  });
}
```

### STT Webhook

```typescript
// app/api/webhooks/assemblyai/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Verify webhook signature
  const signature = request.headers.get('x-assemblyai-signature');
  if (!verifyWebhookSignature(signature, body)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const { transcript_id, status, text, words } = body;

  if (status === 'completed') {
    // Store transcript
    await convex.mutation(api.transcripts.createFromWebhook, {
      externalId: transcript_id,
      text,
      words
    });
  } else if (status === 'error') {
    console.error('Transcription failed:', body.error);
  }

  return NextResponse.json({ received: true });
}

function verifyWebhookSignature(signature: string | null, body: any): boolean {
  // Implement signature verification
  return true;
}
```

## 7. Request Validation

### Zod Schema Validation

```typescript
// lib/validations.ts
import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional()
});

export const updateRoomSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['draft', 'active', 'completed', 'archived']).optional()
});

export const transcribeRequestSchema = z.object({
  meetingId: z.string(),
  speakerId: z.string(),
  speakerName: z.string()
});

// Usage in route
import { createRoomSchema } from '@/lib/validations';

export async function POST(request: NextRequest) {
  const body = await request.json();

  const result = createRoomSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: result.error.issues },
      { status: 400 }
    );
  }

  // Use result.data which is now typed
  const { name, description } = result.data;
  // ...
}
```

## 8. Error Handling

### Centralised Error Handler

```typescript
// lib/api-error.ts
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function handleApiError(error: unknown) {
  console.error('API Error:', error);

  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: 'Validation failed', issues: error.issues },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}

// Usage
export async function POST(request: NextRequest) {
  try {
    // ... route logic
  } catch (error) {
    return handleApiError(error);
  }
}
```

### Route Wrapper

```typescript
// lib/api-wrapper.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { handleApiError, ApiError } from './api-error';

type RouteHandler = (
  request: NextRequest,
  context: { params: Record<string, string> }
) => Promise<NextResponse>;

export function withAuth(handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    try {
      const { userId } = await auth();

      if (!userId) {
        throw new ApiError(401, 'Unauthorized');
      }

      return handler(request, context);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

// Usage
export const POST = withAuth(async (request, { params }) => {
  const body = await request.json();
  // ... handler logic
  return NextResponse.json({ success: true });
});
```

## 9. Rate Limiting

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!
});

export const rateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '10 s'),
  analytics: true
});

// Usage in route
export async function POST(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { success, limit, remaining, reset } = await rateLimiter.limit(userId);

  if (!success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString()
        }
      }
    );
  }

  // ... route logic
}
```

## 10. API Response Types

```typescript
// types/api.ts
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}

export interface Room {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  createdAt: number;
  updatedAt: number;
}

export interface Meeting {
  id: string;
  roomId: string;
  status: 'lobby' | 'active' | 'paused' | 'ended';
  startedAt?: number;
  endedAt?: number;
}

export interface Transcript {
  id: string;
  meetingId: string;
  speakerId: string;
  speakerName: string;
  text: string;
  startTime: number;
  endTime: number;
}

export interface ActionItem {
  id: string;
  meetingId: string;
  task: string;
  owner: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
}
```

## 11. Testing API Routes

```typescript
// __tests__/api/rooms.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from '@/app/api/rooms/route';
import { NextRequest } from 'next/server';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(() => ({ userId: 'test-user' }))
}));

describe('/api/rooms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST', () => {
    it('creates a room successfully', async () => {
      const request = new NextRequest('http://localhost/api/rooms', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Room' })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toHaveProperty('id');
    });

    it('returns 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce({ userId: null });

      const request = new NextRequest('http://localhost/api/rooms', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Room' })
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });
  });
});
```

## 12. Best Practices

1. **Always authenticate**: Check auth on every route
2. **Validate input**: Use Zod schemas for request validation
3. **Handle errors**: Use centralised error handling
4. **Rate limit**: Protect expensive operations
5. **Type responses**: Define TypeScript interfaces
6. **Log appropriately**: Log errors but not sensitive data
7. **Use streaming**: For real-time features like transcription
8. **Cache when possible**: Use appropriate cache headers

## 13. Sources

- [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Upstash Rate Limiting](https://upstash.com/docs/redis/sdks/ratelimit-ts/overview)
- [Zod Documentation](https://zod.dev/)
