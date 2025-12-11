# Ops Room Companion - Implementation Plan

> Doc-aware voice meeting agent - from zero to MVP

---

## Current Status

**Phase 1: COMPLETE** - Project foundation set up with Next.js 14+, Clerk auth, Convex database, and basic UI.

**Next: Phase 2** - Room Management (CRUD, document upload, context summarisation)

### What's Done
- Next.js app with TypeScript, Tailwind, App Router
- Clerk authentication with sign-in/sign-up pages and redirect to dashboard
- Convex schema deployed with user sync on login
- Landing page, dashboard layout, room pages (list, lobby, meeting shells)
- Environment config with Zod validation

### Key Files
- `src/app/dashboard/` - authenticated pages
- `convex/schema.ts` - database schema
- `convex/users.ts` - user sync mutation
- `src/hooks/use-sync-user.ts` - auto-sync user on dashboard load

---

## Overview

This plan outlines the implementation of **Ops Room Companion**, a voice-first meeting facilitator that reads attached documents, facilitates meetings via an avatar, listens to participants, and produces structured action plans.

## Tech Stack (Confirmed from Research)

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 14+ (App Router) | React framework with SSR |
| Styling | Tailwind CSS | Utility-first CSS |
| Backend | Next.js API Routes | Serverless functions |
| Database | Convex | Real-time data with subscriptions |
| Auth | Clerk | Authentication & user management |
| Avatar | Anam AI | Photorealistic avatar rendering |
| TTS | ElevenLabs | Text-to-speech (Turbo v2.5) |
| STT | ElevenLabs Scribe / AssemblyAI | Speech-to-text streaming |
| LLM | OpenAI GPT-4o | Structured outputs, summarisation |
| Deployment | Vercel | Hosting & serverless |
| Package Manager | uv | Python dependencies (if needed) |

## Target Latency Goals

- **Total end-to-end**: 500-800ms (P50)
- **STT**: 150-300ms
- **LLM TTFT**: 320-400ms
- **TTS**: 75-180ms

---

## Phase 1: Project Foundation

### Overview
Set up the base Next.js project with authentication, database, and deployment pipeline.

### Changes Required

#### 1. Project Initialisation
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

#### 2. Dependencies
```bash
npm install @clerk/nextjs convex @anam-ai/js-sdk elevenlabs ai @ai-sdk/openai zod
npm install -D @types/node typescript tailwindcss postcss autoprefixer
```

#### 3. Project Structure
```
src/
├── app/
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Home - Create/Join Room
│   │   └── rooms/
│   │       ├── page.tsx          # Room list
│   │       └── [id]/
│   │           ├── page.tsx      # Room lobby
│   │           └── meeting/
│   │               └── page.tsx  # Active meeting
│   ├── api/
│   │   ├── rooms/
│   │   ├── meetings/
│   │   ├── documents/
│   │   ├── transcribe/
│   │   ├── tts/
│   │   └── webhooks/
│   ├── layout.tsx
│   ├── page.tsx
│   └── providers.tsx
├── components/
│   ├── ui/                       # Reusable UI components
│   ├── avatar/                   # Anam avatar components
│   ├── meeting/                  # Meeting-specific components
│   └── rooms/                    # Room management components
├── lib/
│   ├── env.ts                    # Environment validation
│   ├── api-error.ts              # Error handling
│   ├── document-processor.ts     # PDF/DOCX/PPTX extraction
│   └── validations.ts            # Zod schemas
├── hooks/
│   ├── use-tts.ts
│   ├── use-stt.ts
│   └── use-meeting-state.ts
└── types/
    └── index.ts
convex/
├── schema.ts
├── rooms.ts
├── meetings.ts
├── documents.ts
├── transcripts.ts
├── actionItems.ts
├── summaries.ts
└── auth.config.ts
```

#### 4. Environment Configuration
Create `.env.local`:
```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Convex
NEXT_PUBLIC_CONVEX_URL=
CONVEX_DEPLOY_KEY=

# ElevenLabs
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# STT (choose one)
ASSEMBLYAI_API_KEY=
# or NEXT_PUBLIC_ELEVENLABS_API_KEY= (for Scribe)

# LLM
OPENAI_API_KEY=

# Anam
ANAM_API_KEY=
```

#### 5. Clerk Middleware
**File**: `src/middleware.ts`
```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)'
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)']
};
```

#### 6. Convex Schema
**File**: `convex/schema.ts`
```typescript
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    createdAt: v.number()
  })
    .index('by_clerk_id', ['clerkId']),

  rooms: defineTable({
    name: v.string(),
    goal: v.optional(v.string()),
    creatorId: v.string(),
    status: v.union(
      v.literal('draft'),
      v.literal('active'),
      v.literal('completed')
    ),
    contextSummary: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_creator', ['creatorId']),

  documents: defineTable({
    roomId: v.id('rooms'),
    filename: v.string(),
    fileType: v.string(),
    storageId: v.id('_storage'),
    extractedText: v.string(),
    chunks: v.array(v.string()),
    createdAt: v.number()
  })
    .index('by_room', ['roomId']),

  meetings: defineTable({
    roomId: v.id('rooms'),
    status: v.union(
      v.literal('lobby'),
      v.literal('active'),
      v.literal('paused'),
      v.literal('ended')
    ),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number())
  })
    .index('by_room', ['roomId']),

  transcripts: defineTable({
    meetingId: v.id('meetings'),
    speakerId: v.string(),
    speakerName: v.string(),
    text: v.string(),
    startTime: v.number(),
    endTime: v.number()
  })
    .index('by_meeting', ['meetingId']),

  speakerUpdates: defineTable({
    meetingId: v.id('meetings'),
    speakerId: v.string(),
    speakerName: v.string(),
    summary: v.string(),
    risks: v.array(v.string()),
    gaps: v.array(v.string()),
    proposedActions: v.array(v.string()),
    createdAt: v.number()
  })
    .index('by_meeting', ['meetingId']),

  actionItems: defineTable({
    meetingId: v.id('meetings'),
    roomId: v.id('rooms'),
    task: v.string(),
    owner: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('completed')
    ),
    createdAt: v.number()
  })
    .index('by_meeting', ['meetingId'])
    .index('by_room', ['roomId']),

  summaries: defineTable({
    meetingId: v.id('meetings'),
    roomId: v.id('rooms'),
    overview: v.string(),
    decisions: v.array(v.string()),
    risks: v.array(v.string()),
    nextSteps: v.array(v.string()),
    generatedAt: v.number()
  })
    .index('by_meeting', ['meetingId'])
});
```

### Success Criteria

#### Automated Verification:
- [x] `npm run dev` starts without errors
- [x] `npm run build` completes successfully
- [x] `npm run lint` passes
- [x] `npx convex dev` connects and syncs schema
- [x] Clerk authentication flow works (sign-in/sign-up)

#### Manual Verification:
- [x] Landing page renders correctly
- [x] Sign in redirects to dashboard
- [x] Convex dashboard shows tables

---

## Phase 2: Room Management

### Overview
Implement room creation, document upload, and context summarisation.

### Changes Required

#### 1. Room CRUD Operations
**File**: `convex/rooms.ts`

Implement:
- `list` - Get rooms for current user
- `get` - Get single room by ID
- `create` - Create new room with name and goal
- `update` - Update room details
- `delete` - Remove room

#### 2. Document Processing API
**File**: `src/app/api/documents/process/route.ts`

- Accept file uploads (PDF, DOCX, PPTX, TXT)
- Extract text using pdf-parse and mammoth
- Chunk text for LLM context
- Return extracted text and chunks

**File**: `src/lib/document-processor.ts`
- Unified processor for all file types
- Sentence-aware chunking

#### 3. Context Summarisation
**File**: `convex/ai.ts` (action)

- Call OpenAI to summarise uploaded documents
- Extract goals, constraints, deadlines
- Store summary in room

#### 4. UI Components

**File**: `src/app/(dashboard)/page.tsx`
- Home page with Create Room / Join Room buttons

**File**: `src/app/(dashboard)/rooms/[id]/page.tsx`
- Room lobby showing context summary
- Document upload area
- Participants list
- Start Meeting button

### Success Criteria

#### Automated Verification:
- [ ] `npm run build` passes
- [ ] API routes return correct status codes
- [ ] Convex mutations execute without errors

#### Manual Verification:
- [ ] Can create a new room with name and goal
- [ ] Can upload PDF/DOCX and see extracted text
- [ ] Context summary appears after document processing
- [ ] Room persists across page reloads

---

## Phase 3: Avatar Integration

### Overview
Integrate Anam AI avatar for meeting facilitation.

### Changes Required

#### 1. Anam Session API
**File**: `src/app/api/anam/session/route.ts`

- Generate session token for Anam client
- Associate with meeting ID

#### 2. Avatar Component
**File**: `src/components/avatar/AnamAvatar.tsx`

```typescript
'use client';

import { useEffect, useRef } from 'react';
import { AnamClient } from '@anam-ai/js-sdk';

interface AnamAvatarProps {
  sessionToken: string;
  personaId: string;
  onMessage?: (message: string) => void;
}

export function AnamAvatar({ sessionToken, personaId, onMessage }: AnamAvatarProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const clientRef = useRef<AnamClient | null>(null);

  useEffect(() => {
    const client = new AnamClient(sessionToken, { personaId });
    clientRef.current = client;

    if (videoRef.current && audioRef.current) {
      client.streamToVideoAndAudioElements(videoRef.current, audioRef.current);
    }

    client.addListener('MESSAGE_STREAM_EVENT', (event) => {
      if (event.role === 'assistant' && onMessage) {
        onMessage(event.content);
      }
    });

    return () => {
      client.stopStreaming();
    };
  }, [sessionToken, personaId, onMessage]);

  return (
    <div className="avatar-container relative aspect-video bg-black rounded-lg overflow-hidden">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      <audio ref={audioRef} autoPlay />
    </div>
  );
}
```

#### 3. Avatar Hooks
**File**: `src/hooks/use-anam.ts`

- Manage avatar connection lifecycle
- Handle errors and reconnection
- Expose talk() method for custom speech

### Success Criteria

#### Automated Verification:
- [ ] Anam SDK imports without errors
- [ ] Session API returns valid token

#### Manual Verification:
- [ ] Avatar renders in meeting screen
- [ ] Avatar responds to voice input
- [ ] Avatar speaks meeting context on start

---

## Phase 4: Speech-to-Text Pipeline

### Overview
Implement real-time speech transcription for meeting participants.

### Changes Required

#### 1. STT Service Abstraction
**File**: `src/lib/stt/index.ts`

- Abstract interface for STT providers
- ElevenLabs Scribe implementation
- AssemblyAI fallback implementation

#### 2. Audio Capture Hook
**File**: `src/hooks/use-audio-capture.ts`

```typescript
async function getAudioStream() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      sampleRate: 16000,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true
    }
  });
  return stream;
}
```

#### 3. STT Hook
**File**: `src/hooks/use-stt.ts`

- Connect to STT WebSocket
- Stream audio chunks
- Return partial and final transcripts
- Handle reconnection

#### 4. Streaming API Route
**File**: `src/app/api/transcribe/stream/route.ts`

- Server-side proxy for STT (if needed)
- Handle authentication

### Success Criteria

#### Automated Verification:
- [ ] STT WebSocket connects successfully
- [ ] Audio permission request works

#### Manual Verification:
- [ ] Microphone captures audio
- [ ] Partial transcripts appear in real-time
- [ ] Final transcripts are accurate

---

## Phase 5: Meeting Flow & State Machine

### Overview
Implement the core meeting flow with state management.

### Changes Required

#### 1. Meeting State Machine
**File**: `src/hooks/use-meeting-state.ts`

States: `lobby` -> `active` -> `ended`
Sub-states for active: `listening` -> `speaking` -> `processing`

#### 2. Meeting Screen
**File**: `src/app/(dashboard)/rooms/[id]/meeting/page.tsx`

Components:
- Avatar display
- Current speaker panel
- Record button
- Live action board
- Transcript view

#### 3. Speaker Turn Processing
**File**: `src/app/api/meetings/[id]/process-turn/route.ts`

Pipeline:
1. Receive transcript
2. Call LLM to structure (summary, risks, actions)
3. Store speaker update in Convex
4. Generate agent response
5. Return TTS text

#### 4. Real-time Updates
- Use Convex subscriptions for live action items
- Animate new items with framer-motion

### Success Criteria

#### Automated Verification:
- [ ] State transitions work correctly
- [ ] API processes transcripts and returns structured data

#### Manual Verification:
- [ ] Meeting starts with avatar greeting
- [ ] Record button captures speech
- [ ] Avatar responds with confirmation
- [ ] Action items appear in real-time

---

## Phase 6: Meeting Summary & Export

### Overview
Generate comprehensive meeting summaries and export options.

### Changes Required

#### 1. Summary Generation
**File**: `src/app/api/meetings/[id]/summary/route.ts`

- Aggregate all speaker updates
- Call LLM for final summary
- Extract decisions, actions, risks
- Store in Convex

#### 2. Summary UI
**File**: `src/components/meeting/MeetingSummary.tsx`

- Overview text
- Decisions list
- Action items table (Owner | Task | Status)
- Risks section

#### 3. Export Features
- Copy to clipboard (Markdown)
- Download as PDF (future)

#### 4. Room Return View
- Show latest meeting summary
- Outstanding action items
- Option to start new meeting

### Success Criteria

#### Automated Verification:
- [ ] Summary API returns structured JSON
- [ ] Convex stores summary correctly

#### Manual Verification:
- [ ] End meeting triggers summary generation
- [ ] Avatar reads summary aloud
- [ ] Copy to clipboard works
- [ ] Returning to room shows previous summary

---

## Phase 7: Polish & Deployment

### Overview
Final polish, error handling, and production deployment.

### Changes Required

#### 1. Error Handling
- Add error boundaries
- Implement retry logic for API calls
- Add toast notifications

#### 2. Loading States
- Skeleton loaders for rooms list
- Processing indicators for document upload
- Speaking indicator for avatar

#### 3. Accessibility
- Keyboard navigation
- Screen reader announcements
- Text input fallback for voice

#### 4. Vercel Configuration
**File**: `vercel.json`
```json
{
  "framework": "nextjs",
  "regions": ["iad1"],
  "functions": {
    "app/api/meetings/**/summary/**": { "maxDuration": 120 },
    "app/api/documents/**": { "maxDuration": 60 }
  }
}
```

#### 5. Environment Setup
- Configure production env vars in Vercel
- Set up Convex production deployment
- Configure Clerk production keys

### Success Criteria

#### Automated Verification:
- [ ] `npm run build` succeeds
- [ ] Vercel deployment succeeds
- [ ] All API routes respond correctly in production

#### Manual Verification:
- [ ] Full meeting flow works end-to-end
- [ ] No console errors in production
- [ ] Latency within target (500-800ms)
- [ ] Mobile responsive design works

---

## What We're NOT Doing (MVP Scope)

1. **Multi-participant real-time audio** - Single speaker at a time via record button
2. **Real-time speaker diarisation** - Manual speaker selection
3. **Video conferencing** - Not a video call tool
4. **Slack/Email/Notion integrations** - Future enhancement
5. **Custom voice cloning** - Use ElevenLabs preset voices
6. **Multi-language support** - English only for MVP
7. **Mobile native apps** - Web only
8. **Organisation/team management** - Single user per room initially

---

## Dependencies Summary

```json
{
  "dependencies": {
    "@clerk/nextjs": "^5.x",
    "convex": "^1.x",
    "@anam-ai/js-sdk": "latest",
    "elevenlabs": "latest",
    "ai": "^3.x",
    "@ai-sdk/openai": "latest",
    "zod": "^3.x",
    "pdf-parse": "^1.x",
    "mammoth": "^1.x",
    "framer-motion": "^11.x"
  }
}
```

---

## Estimated API Costs (Monthly, Light Usage)

| Service | Usage | Est. Cost |
|---------|-------|-----------|
| ElevenLabs Pro | TTS + STT | $99/mo (included) |
| OpenAI GPT-4o | ~100k tokens | ~$5/mo |
| Convex | Free tier | $0 |
| Clerk | Free tier | $0 |
| Vercel | Pro tier | $20/mo |
| Anam | Free tier / Pay-as-you-go | TBD |

---

## References

- Research docs: `docs/research/00-research-index.md`
- Main spec: `docs/research/ops-room-companion.md`
- Tech details in individual research files (01-16)

---

*Plan created: December 2025*
