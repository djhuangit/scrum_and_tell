# Convex Database Research

> Real-time database for voice meeting agents

## 1. Overview

Convex provides:
- Real-time subscriptions out of the box
- TypeScript-first with auto-generated types
- Serverless functions (queries, mutations, actions)
- Built-in file storage
- Clerk authentication integration
- Automatic caching and optimistic updates

## 2. Project Setup

### Installation

```bash
npm install convex
npx convex dev
```

### Environment Variables

```env
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
CONVEX_DEPLOY_KEY=prod:your-deploy-key
```

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

## 3. Schema Design

### Meeting Agent Schema

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // Users (synced from Clerk)
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    createdAt: v.number()
  })
    .index('by_clerk_id', ['clerkId'])
    .index('by_email', ['email']),

  // Meeting rooms
  rooms: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    creatorId: v.string(),
    status: v.union(
      v.literal('draft'),
      v.literal('active'),
      v.literal('completed'),
      v.literal('archived')
    ),
    settings: v.object({
      maxParticipants: v.number(),
      recordingEnabled: v.boolean(),
      transcriptionEnabled: v.boolean()
    }),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_creator', ['creatorId'])
    .index('by_status', ['status']),

  // Room participants
  participants: defineTable({
    roomId: v.id('rooms'),
    userId: v.string(),
    role: v.union(v.literal('host'), v.literal('participant'), v.literal('observer')),
    joinedAt: v.number(),
    leftAt: v.optional(v.number())
  })
    .index('by_room', ['roomId'])
    .index('by_user', ['userId']),

  // Uploaded documents
  documents: defineTable({
    roomId: v.id('rooms'),
    uploaderId: v.string(),
    filename: v.string(),
    fileType: v.string(),
    storageId: v.id('_storage'),
    extractedText: v.string(),
    chunks: v.array(v.string()),
    summary: v.optional(v.string()),
    createdAt: v.number()
  }).index('by_room', ['roomId']),

  // Meeting sessions
  meetings: defineTable({
    roomId: v.id('rooms'),
    status: v.union(
      v.literal('lobby'),
      v.literal('active'),
      v.literal('paused'),
      v.literal('ended')
    ),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    recordingUrl: v.optional(v.string())
  })
    .index('by_room', ['roomId'])
    .index('by_status', ['status']),

  // Transcript segments
  transcripts: defineTable({
    meetingId: v.id('meetings'),
    speakerId: v.string(),
    speakerName: v.string(),
    text: v.string(),
    startTime: v.number(),
    endTime: v.number(),
    confidence: v.number()
  })
    .index('by_meeting', ['meetingId'])
    .index('by_speaker', ['meetingId', 'speakerId']),

  // Action items extracted from meetings
  actionItems: defineTable({
    meetingId: v.id('meetings'),
    roomId: v.id('rooms'),
    task: v.string(),
    owner: v.string(),
    ownerId: v.optional(v.string()),
    dueDate: v.optional(v.string()),
    priority: v.union(v.literal('low'), v.literal('medium'), v.literal('high')),
    status: v.union(v.literal('pending'), v.literal('in_progress'), v.literal('completed')),
    sourceTranscriptId: v.optional(v.id('transcripts')),
    createdAt: v.number()
  })
    .index('by_meeting', ['meetingId'])
    .index('by_room', ['roomId'])
    .index('by_owner', ['ownerId']),

  // Meeting summaries
  summaries: defineTable({
    meetingId: v.id('meetings'),
    roomId: v.id('rooms'),
    title: v.string(),
    overview: v.string(),
    keyDecisions: v.array(v.string()),
    risks: v.array(v.string()),
    nextSteps: v.array(v.string()),
    generatedAt: v.number()
  })
    .index('by_meeting', ['meetingId'])
    .index('by_room', ['roomId'])
});
```

## 4. Queries

### Basic Queries

```typescript
// convex/rooms.ts
import { query } from './_generated/server';
import { v } from 'convex/values';

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    return ctx.db
      .query('rooms')
      .withIndex('by_creator', q => q.eq('creatorId', identity.subject))
      .order('desc')
      .collect();
  }
});

export const get = query({
  args: { id: v.id('rooms') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const room = await ctx.db.get(args.id);
    if (!room) return null;

    // Check access
    if (room.creatorId !== identity.subject) {
      const participant = await ctx.db
        .query('participants')
        .withIndex('by_room', q => q.eq('roomId', args.id))
        .filter(q => q.eq(q.field('userId'), identity.subject))
        .first();

      if (!participant) return null;
    }

    return room;
  }
});
```

### Queries with Joins

```typescript
// convex/meetings.ts
import { query } from './_generated/server';
import { v } from 'convex/values';

export const getWithDetails = query({
  args: { meetingId: v.id('meetings') },
  handler: async (ctx, args) => {
    const meeting = await ctx.db.get(args.meetingId);
    if (!meeting) return null;

    const [room, transcripts, actionItems, summary] = await Promise.all([
      ctx.db.get(meeting.roomId),
      ctx.db
        .query('transcripts')
        .withIndex('by_meeting', q => q.eq('meetingId', args.meetingId))
        .order('asc')
        .collect(),
      ctx.db
        .query('actionItems')
        .withIndex('by_meeting', q => q.eq('meetingId', args.meetingId))
        .collect(),
      ctx.db
        .query('summaries')
        .withIndex('by_meeting', q => q.eq('meetingId', args.meetingId))
        .first()
    ]);

    return {
      meeting,
      room,
      transcripts,
      actionItems,
      summary
    };
  }
});
```

### Paginated Queries

```typescript
export const listPaginated = query({
  args: {
    paginationOpts: v.object({
      cursor: v.optional(v.string()),
      numItems: v.number()
    })
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    return ctx.db
      .query('rooms')
      .withIndex('by_creator', q => q.eq('creatorId', identity.subject))
      .order('desc')
      .paginate(args.paginationOpts);
  }
});
```

## 5. Mutations

### Basic Mutations

```typescript
// convex/rooms.ts
import { mutation } from './_generated/server';
import { v } from 'convex/values';

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const now = Date.now();

    return ctx.db.insert('rooms', {
      name: args.name,
      description: args.description,
      creatorId: identity.subject,
      status: 'draft',
      settings: {
        maxParticipants: 10,
        recordingEnabled: true,
        transcriptionEnabled: true
      },
      createdAt: now,
      updatedAt: now
    });
  }
});

export const update = mutation({
  args: {
    id: v.id('rooms'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal('draft'),
      v.literal('active'),
      v.literal('completed'),
      v.literal('archived')
    ))
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const room = await ctx.db.get(args.id);
    if (!room || room.creatorId !== identity.subject) {
      throw new Error('Room not found or access denied');
    }

    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(args.id, {
      ...filteredUpdates,
      updatedAt: Date.now()
    });
  }
});

export const remove = mutation({
  args: { id: v.id('rooms') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const room = await ctx.db.get(args.id);
    if (!room || room.creatorId !== identity.subject) {
      throw new Error('Room not found or access denied');
    }

    await ctx.db.delete(args.id);
  }
});
```

### Transcript Mutations

```typescript
// convex/transcripts.ts
import { mutation } from './_generated/server';
import { v } from 'convex/values';

export const add = mutation({
  args: {
    meetingId: v.id('meetings'),
    speakerId: v.string(),
    speakerName: v.string(),
    text: v.string(),
    startTime: v.number(),
    endTime: v.number(),
    confidence: v.number()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    return ctx.db.insert('transcripts', args);
  }
});

export const appendToLast = mutation({
  args: {
    meetingId: v.id('meetings'),
    speakerId: v.string(),
    text: v.string()
  },
  handler: async (ctx, args) => {
    const lastTranscript = await ctx.db
      .query('transcripts')
      .withIndex('by_speaker', q =>
        q.eq('meetingId', args.meetingId).eq('speakerId', args.speakerId)
      )
      .order('desc')
      .first();

    if (lastTranscript) {
      await ctx.db.patch(lastTranscript._id, {
        text: lastTranscript.text + ' ' + args.text,
        endTime: Date.now()
      });
    }
  }
});
```

## 6. Actions (External API Calls)

```typescript
// convex/ai.ts
import { action } from './_generated/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';

export const generateSummary = action({
  args: { meetingId: v.id('meetings') },
  handler: async (ctx, args) => {
    // Fetch meeting data
    const meetingData = await ctx.runQuery(internal.meetings.getTranscripts, {
      meetingId: args.meetingId
    });

    if (!meetingData) {
      throw new Error('Meeting not found');
    }

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: `Summarise this meeting transcript:\n\n${meetingData.transcript}`
        }],
        response_format: { type: 'json_object' }
      })
    });

    const result = await response.json();
    const summary = JSON.parse(result.choices[0].message.content);

    // Store summary in database
    await ctx.runMutation(internal.summaries.create, {
      meetingId: args.meetingId,
      roomId: meetingData.roomId,
      ...summary
    });

    return summary;
  }
});
```

### Scheduling Actions

```typescript
// convex/crons.ts
import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Clean up old meetings daily
crons.daily(
  'cleanup-old-meetings',
  { hourUTC: 3, minuteUTC: 0 },
  internal.cleanup.oldMeetings
);

// Process pending summaries every 5 minutes
crons.interval(
  'process-summaries',
  { minutes: 5 },
  internal.ai.processPendingSummaries
);

export default crons;
```

## 7. File Storage

```typescript
// convex/files.ts
import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    return ctx.storage.generateUploadUrl();
  }
});

export const getUrl = query({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    return ctx.storage.getUrl(args.storageId);
  }
});

export const saveFile = mutation({
  args: {
    storageId: v.id('_storage'),
    roomId: v.id('rooms'),
    filename: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    return ctx.db.insert('documents', {
      roomId: args.roomId,
      uploaderId: identity.subject,
      filename: args.filename,
      fileType: args.filename.split('.').pop() || '',
      storageId: args.storageId,
      extractedText: '',
      chunks: [],
      createdAt: Date.now()
    });
  }
});
```

## 8. React Hooks Usage

### useQuery

```typescript
'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

export function RoomList() {
  const rooms = useQuery(api.rooms.list);

  if (rooms === undefined) {
    return <div>Loading...</div>;
  }

  return (
    <ul>
      {rooms.map(room => (
        <li key={room._id}>{room.name}</li>
      ))}
    </ul>
  );
}
```

### useMutation

```typescript
'use client';

import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useState } from 'react';

export function CreateRoomForm() {
  const [name, setName] = useState('');
  const createRoom = useMutation(api.rooms.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createRoom({ name });
    setName('');
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Room name"
      />
      <button type="submit">Create</button>
    </form>
  );
}
```

### useAction

```typescript
'use client';

import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useState } from 'react';

export function GenerateSummaryButton({ meetingId }: { meetingId: string }) {
  const [loading, setLoading] = useState(false);
  const generateSummary = useAction(api.ai.generateSummary);

  const handleClick = async () => {
    setLoading(true);
    try {
      await generateSummary({ meetingId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleClick} disabled={loading}>
      {loading ? 'Generating...' : 'Generate Summary'}
    </button>
  );
}
```

### Real-Time Subscription

```typescript
'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { useEffect, useRef } from 'react';

export function LiveTranscript({ meetingId }: { meetingId: string }) {
  const transcripts = useQuery(api.transcripts.byMeeting, { meetingId });
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new transcripts
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  if (transcripts === undefined) {
    return <div>Loading...</div>;
  }

  return (
    <div className="transcript-container">
      {transcripts.map(t => (
        <div key={t._id} className="transcript-entry">
          <span className="speaker">{t.speakerName}:</span>
          <span className="text">{t.text}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
```

## 9. Server Component Preloading

```typescript
// app/rooms/[id]/page.tsx
import { preloadQuery } from 'convex/nextjs';
import { api } from '@/convex/_generated/api';
import { RoomDetails } from './RoomDetails';

export default async function RoomPage({
  params
}: {
  params: { id: string }
}) {
  const preloadedRoom = await preloadQuery(api.rooms.get, { id: params.id });

  return <RoomDetails preloadedRoom={preloadedRoom} />;
}

// RoomDetails.tsx
'use client';

import { usePreloadedQuery } from 'convex/react';

export function RoomDetails({ preloadedRoom }) {
  const room = usePreloadedQuery(preloadedRoom);

  if (!room) return <div>Room not found</div>;

  return <div>{room.name}</div>;
}
```

## 10. Authentication with Clerk

```typescript
// convex/auth.config.ts
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: 'convex'
    }
  ]
};

// convex/users.ts
import { internalMutation, query } from './_generated/server';
import { v } from 'convex/values';

export const getOrCreate = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerk_id', q => q.eq('clerkId', args.clerkId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        imageUrl: args.imageUrl
      });
      return existing._id;
    }

    return ctx.db.insert('users', {
      ...args,
      createdAt: Date.now()
    });
  }
});

export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return ctx.db
      .query('users')
      .withIndex('by_clerk_id', q => q.eq('clerkId', identity.subject))
      .first();
  }
});
```

## 11. Best Practices

1. **Use Indexes**: Always create indexes for fields you query by
2. **Batch Operations**: Group related mutations to reduce round trips
3. **Optimistic Updates**: Convex handles these automatically
4. **Error Handling**: Use try-catch in mutations and actions
5. **Type Safety**: Let TypeScript infer types from schema
6. **Pagination**: Use pagination for large datasets
7. **Internal Functions**: Use `internal` for functions called only by other functions

## 12. Sources

- [Convex Documentation](https://docs.convex.dev/)
- [Convex + Next.js](https://docs.convex.dev/client/react/nextjs)
- [Convex + Clerk](https://docs.convex.dev/auth/clerk)
- [Convex Schema](https://docs.convex.dev/database/schemas)
