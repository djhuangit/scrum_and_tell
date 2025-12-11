# Next.js App Router Research

> Patterns for voice meeting agents with Next.js 14+

## 1. Server vs Client Components

### Server Components (Default)

```typescript
// app/rooms/page.tsx (Server Component by default)
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export default async function RoomsPage() {
  const { userId } = await auth();
  const rooms = await db.rooms.findMany({ where: { creatorId: userId } });

  return (
    <div>
      <h1>Your Rooms</h1>
      <RoomList rooms={rooms} />
    </div>
  );
}
```

### Client Components

```typescript
'use client';

// components/RecordingControls.tsx
import { useState } from 'react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

export function RecordingControls() {
  const [isRecording, setIsRecording] = useState(false);
  const { startRecording, stopRecording } = useAudioRecorder();

  return (
    <button onClick={() => isRecording ? stopRecording() : startRecording()}>
      {isRecording ? 'Stop' : 'Record'}
    </button>
  );
}
```

### When to Use Each

| Server Components | Client Components |
|-------------------|-------------------|
| Data fetching | Interactivity (onClick, onChange) |
| Direct DB access | Browser APIs (audio, video) |
| Sensitive operations | useState, useEffect |
| Static content | Real-time updates |

## 2. Data Fetching Patterns

### Server-Side Fetching

```typescript
// app/meetings/[id]/page.tsx
import { notFound } from 'next/navigation';

interface PageProps {
  params: { id: string };
}

export default async function MeetingPage({ params }: PageProps) {
  const meeting = await fetchMeeting(params.id);

  if (!meeting) {
    notFound();
  }

  return <MeetingDetails meeting={meeting} />;
}

async function fetchMeeting(id: string) {
  const res = await fetch(`${process.env.API_URL}/meetings/${id}`, {
    cache: 'no-store' // Dynamic data
  });

  if (!res.ok) return null;
  return res.json();
}
```

### Parallel Data Fetching

```typescript
export default async function DashboardPage() {
  // Fetch in parallel
  const [rooms, meetings, stats] = await Promise.all([
    fetchRooms(),
    fetchMeetings(),
    fetchStats()
  ]);

  return (
    <div>
      <RoomList rooms={rooms} />
      <MeetingList meetings={meetings} />
      <StatsPanel stats={stats} />
    </div>
  );
}
```

### Suspense for Loading States

```typescript
import { Suspense } from 'react';

export default function MeetingPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <Suspense fallback={<TranscriptSkeleton />}>
        <Transcript meetingId={params.id} />
      </Suspense>

      <Suspense fallback={<ActionItemsSkeleton />}>
        <ActionItems meetingId={params.id} />
      </Suspense>
    </div>
  );
}
```

## 3. API Route Handlers

### Basic Route

```typescript
// app/api/rooms/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rooms = await db.rooms.findMany({
    where: { creatorId: userId }
  });

  return NextResponse.json(rooms);
}

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const room = await db.rooms.create({
    data: { ...body, creatorId: userId }
  });

  return NextResponse.json(room, { status: 201 });
}
```

### Dynamic Routes

```typescript
// app/api/meetings/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const meeting = await db.meetings.findUnique({
    where: { id: params.id }
  });

  if (!meeting) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(meeting);
}
```

## 4. Streaming Responses

### Server-Sent Events

```typescript
// app/api/transcribe/stream/route.ts
export async function POST(request: Request) {
  const { audioUrl } = await request.json();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Simulate streaming transcription
      const words = ['Hello', 'this', 'is', 'a', 'test'];

      for (const word of words) {
        const data = `data: ${JSON.stringify({ word })}\n\n`;
        controller.enqueue(encoder.encode(data));
        await new Promise(r => setTimeout(r, 500));
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
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

### Consuming SSE Client-Side

```typescript
'use client';

import { useEffect, useState } from 'react';

export function TranscriptStream({ meetingId }: { meetingId: string }) {
  const [transcript, setTranscript] = useState('');

  useEffect(() => {
    const eventSource = new EventSource(`/api/transcribe/stream?meetingId=${meetingId}`);

    eventSource.onmessage = (event) => {
      if (event.data === '[DONE]') {
        eventSource.close();
        return;
      }

      const data = JSON.parse(event.data);
      setTranscript(prev => prev + ' ' + data.word);
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }, [meetingId]);

  return <div>{transcript}</div>;
}
```

### LLM Streaming with Vercel AI SDK

```typescript
// app/api/summarise/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(request: Request) {
  const { transcript } = await request.json();

  const result = await streamText({
    model: openai('gpt-4o'),
    messages: [
      { role: 'user', content: `Summarise:\n\n${transcript}` }
    ]
  });

  return result.toDataStreamResponse();
}
```

## 5. Convex Integration

### Provider Setup

```typescript
// app/providers.tsx
'use client';

import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { ConvexProviderWithClerk } from 'convex/react-clerk';

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    </ClerkProvider>
  );
}
```

### Real-Time Queries

```typescript
'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';

export function RoomList() {
  const rooms = useQuery(api.rooms.list);
  const createRoom = useMutation(api.rooms.create);

  if (rooms === undefined) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {rooms.map(room => (
        <div key={room._id}>{room.name}</div>
      ))}
      <button onClick={() => createRoom({ name: 'New Room' })}>
        Create Room
      </button>
    </div>
  );
}
```

### Server Component Preloading

```typescript
// app/rooms/page.tsx
import { preloadQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { RoomList } from './RoomList';

export default async function RoomsPage() {
  const preloadedRooms = await preloadQuery(api.rooms.list);

  return <RoomList preloadedRooms={preloadedRooms} />;
}

// RoomList.tsx
'use client';

import { usePreloadedQuery } from 'convex/react';

export function RoomList({ preloadedRooms }) {
  const rooms = usePreloadedQuery(preloadedRooms);

  return (
    <div>
      {rooms.map(room => (
        <div key={room._id}>{room.name}</div>
      ))}
    </div>
  );
}
```

## 6. State Management

### URL State

```typescript
'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export function FilterControls() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <select onChange={(e) => updateFilter('status', e.target.value)}>
      <option value="all">All</option>
      <option value="active">Active</option>
      <option value="completed">Completed</option>
    </select>
  );
}
```

### Zustand for Client State

```typescript
// stores/meeting.ts
import { create } from 'zustand';

interface MeetingState {
  isRecording: boolean;
  transcript: string;
  setRecording: (recording: boolean) => void;
  appendTranscript: (text: string) => void;
}

export const useMeetingStore = create<MeetingState>((set) => ({
  isRecording: false,
  transcript: '',
  setRecording: (recording) => set({ isRecording: recording }),
  appendTranscript: (text) =>
    set((state) => ({ transcript: state.transcript + ' ' + text }))
}));
```

### Context for Component Trees

```typescript
'use client';

import { createContext, useContext, useState } from 'react';

interface MeetingContextType {
  currentSpeaker: string | null;
  setCurrentSpeaker: (speaker: string | null) => void;
}

const MeetingContext = createContext<MeetingContextType | null>(null);

export function MeetingProvider({ children }: { children: React.ReactNode }) {
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);

  return (
    <MeetingContext.Provider value={{ currentSpeaker, setCurrentSpeaker }}>
      {children}
    </MeetingContext.Provider>
  );
}

export function useMeeting() {
  const context = useContext(MeetingContext);
  if (!context) throw new Error('useMeeting must be used within MeetingProvider');
  return context;
}
```

## 7. Error Handling

### Error Boundaries

```typescript
// app/meetings/[id]/error.tsx
'use client';

export default function Error({
  error,
  reset
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div>
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

### Not Found

```typescript
// app/meetings/[id]/not-found.tsx
export default function NotFound() {
  return (
    <div>
      <h2>Meeting Not Found</h2>
      <p>The meeting you're looking for doesn't exist.</p>
    </div>
  );
}
```

## 8. Sources

- [Next.js App Router Documentation](https://nextjs.org/docs/app)
- [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Convex Next.js Integration](https://docs.convex.dev/client/react/nextjs)
