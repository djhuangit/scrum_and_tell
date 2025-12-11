# Security & Privacy Research

> Protecting sensitive meeting data in voice meeting agents

## 1. Overview

Security considerations for voice meeting agents:
- Audio recording and storage
- Transcript data protection
- API key management
- User authentication
- GDPR and data privacy compliance

## 2. Authentication & Authorisation

### Clerk Authentication Flow

```typescript
// middleware.ts
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
```

### Role-Based Access Control

```typescript
// lib/permissions.ts
type Role = 'owner' | 'admin' | 'member' | 'viewer';

interface Permission {
  canCreateRoom: boolean;
  canDeleteRoom: boolean;
  canInviteMembers: boolean;
  canStartMeeting: boolean;
  canViewTranscripts: boolean;
  canExportData: boolean;
}

const rolePermissions: Record<Role, Permission> = {
  owner: {
    canCreateRoom: true,
    canDeleteRoom: true,
    canInviteMembers: true,
    canStartMeeting: true,
    canViewTranscripts: true,
    canExportData: true
  },
  admin: {
    canCreateRoom: true,
    canDeleteRoom: false,
    canInviteMembers: true,
    canStartMeeting: true,
    canViewTranscripts: true,
    canExportData: true
  },
  member: {
    canCreateRoom: false,
    canDeleteRoom: false,
    canInviteMembers: false,
    canStartMeeting: true,
    canViewTranscripts: true,
    canExportData: false
  },
  viewer: {
    canCreateRoom: false,
    canDeleteRoom: false,
    canInviteMembers: false,
    canStartMeeting: false,
    canViewTranscripts: true,
    canExportData: false
  }
};

export function hasPermission(role: Role, action: keyof Permission): boolean {
  return rolePermissions[role][action];
}
```

### Resource-Level Authorisation

```typescript
// convex/rooms.ts
export const get = query({
  args: { id: v.id('rooms') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    const room = await ctx.db.get(args.id);
    if (!room) return null;

    // Check ownership
    if (room.creatorId === identity.subject) {
      return room;
    }

    // Check membership
    const membership = await ctx.db
      .query('participants')
      .withIndex('by_room', q => q.eq('roomId', args.id))
      .filter(q => q.eq(q.field('userId'), identity.subject))
      .first();

    if (!membership) {
      throw new Error('Access denied');
    }

    return room;
  }
});
```

## 3. Data Encryption

### Encryption at Rest

```typescript
// lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!; // 32 bytes

export function encrypt(text: string): { encrypted: string; iv: string; tag: string } {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex')
  };
}

export function decrypt(encrypted: string, iv: string, tag: string): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(iv, 'hex')
  );

  decipher.setAuthTag(Buffer.from(tag, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
```

### Encrypt Sensitive Fields

```typescript
// convex/transcripts.ts
import { mutation } from './_generated/server';
import { encrypt, decrypt } from '@/lib/encryption';

export const create = mutation({
  args: {
    meetingId: v.id('meetings'),
    speakerId: v.string(),
    text: v.string()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    // Encrypt transcript text
    const { encrypted, iv, tag } = encrypt(args.text);

    return ctx.db.insert('transcripts', {
      meetingId: args.meetingId,
      speakerId: args.speakerId,
      encryptedText: encrypted,
      iv,
      tag,
      createdAt: Date.now()
    });
  }
});
```

### Transport Security

```typescript
// Ensure HTTPS in production
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          }
        ]
      }
    ];
  }
};
```

## 4. API Security

### API Key Management

```typescript
// lib/env.ts - Never expose server-side keys to client
const serverOnlyKeys = [
  'CLERK_SECRET_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'ELEVENLABS_API_KEY',
  'ASSEMBLYAI_API_KEY',
  'ENCRYPTION_KEY'
];

// Validate server-side only
if (typeof window !== 'undefined') {
  for (const key of serverOnlyKeys) {
    if (process.env[key]) {
      throw new Error(`${key} should not be exposed to client`);
    }
  }
}
```

### Rate Limiting

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!
});

// Different limits for different operations
export const rateLimiters = {
  api: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    prefix: 'ratelimit:api'
  }),

  transcription: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    prefix: 'ratelimit:transcription'
  }),

  llm: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 m'),
    prefix: 'ratelimit:llm'
  })
};

// Usage in API route
export async function POST(request: Request) {
  const { userId } = await auth();

  const { success, limit, remaining } = await rateLimiters.api.limit(userId!);

  if (!success) {
    return Response.json(
      { error: 'Rate limit exceeded' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString()
        }
      }
    );
  }

  // Process request...
}
```

### Input Validation

```typescript
// lib/validation.ts
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

// Sanitise user input
export function sanitiseInput(input: string): string {
  return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
}

// Validate transcript input
export const transcriptSchema = z.object({
  meetingId: z.string().uuid(),
  speakerId: z.string().uuid(),
  text: z.string()
    .min(1)
    .max(10000)
    .transform(sanitiseInput)
});

// Validate file upload
export const fileUploadSchema = z.object({
  filename: z.string()
    .regex(/^[\w\-. ]+$/, 'Invalid filename')
    .max(255),
  mimeType: z.enum([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]),
  size: z.number().max(10 * 1024 * 1024) // 10MB
});
```

### CSRF Protection

```typescript
// Already handled by Clerk, but for custom endpoints:
// app/api/protected/route.ts
import { headers } from 'next/headers';

export async function POST(request: Request) {
  const headersList = headers();
  const origin = headersList.get('origin');

  // Verify origin
  const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL,
    'https://your-domain.com'
  ];

  if (!origin || !allowedOrigins.includes(origin)) {
    return Response.json({ error: 'Invalid origin' }, { status: 403 });
  }

  // Process request...
}
```

## 5. Audio Data Security

### Secure Audio Streaming

```typescript
// Use authenticated WebSocket for audio
class SecureAudioStream {
  private ws: WebSocket | null = null;

  async connect(meetingId: string) {
    // Get authenticated token
    const { token } = await fetch('/api/audio/token', {
      method: 'POST',
      body: JSON.stringify({ meetingId })
    }).then(r => r.json());

    this.ws = new WebSocket(
      `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`
    );
  }
}
```

### Audio Retention Policy

```typescript
// convex/crons.ts
import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Delete audio recordings after retention period
crons.daily(
  'cleanup-audio',
  { hourUTC: 3, minuteUTC: 0 },
  internal.cleanup.deleteExpiredAudio
);

export default crons;

// convex/cleanup.ts
export const deleteExpiredAudio = internalMutation({
  handler: async (ctx) => {
    const retentionDays = 30;
    const cutoff = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    const expiredMeetings = await ctx.db
      .query('meetings')
      .filter(q => q.lt(q.field('endedAt'), cutoff))
      .filter(q => q.neq(q.field('recordingUrl'), undefined))
      .collect();

    for (const meeting of expiredMeetings) {
      // Delete from storage
      if (meeting.recordingStorageId) {
        await ctx.storage.delete(meeting.recordingStorageId);
      }

      // Clear reference
      await ctx.db.patch(meeting._id, {
        recordingUrl: undefined,
        recordingStorageId: undefined
      });
    }
  }
});
```

## 6. GDPR Compliance

### Data Subject Rights

```typescript
// app/api/gdpr/export/route.ts
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Collect all user data
  const userData = await collectUserData(userId);

  return Response.json({
    exportedAt: new Date().toISOString(),
    data: userData
  });
}

async function collectUserData(userId: string) {
  const [user, rooms, meetings, transcripts] = await Promise.all([
    convex.query(api.users.get, { userId }),
    convex.query(api.rooms.listByUser, { userId }),
    convex.query(api.meetings.listByUser, { userId }),
    convex.query(api.transcripts.listByUser, { userId })
  ]);

  return { user, rooms, meetings, transcripts };
}
```

### Right to Deletion

```typescript
// app/api/gdpr/delete/route.ts
export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Soft delete - mark for deletion
  await convex.mutation(api.users.markForDeletion, { userId });

  // Queue actual deletion (allows for grace period)
  await convex.action(api.gdpr.scheduleDeletion, {
    userId,
    deleteAfter: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
  });

  return Response.json({ message: 'Deletion scheduled' });
}
```

### Consent Management

```typescript
// convex/schema.ts
userConsents: defineTable({
  userId: v.string(),
  consentType: v.union(
    v.literal('recording'),
    v.literal('transcription'),
    v.literal('ai_processing'),
    v.literal('data_sharing')
  ),
  granted: v.boolean(),
  grantedAt: v.number(),
  ipAddress: v.string(),
  userAgent: v.string()
}).index('by_user', ['userId'])

// Component
export function ConsentBanner() {
  const grantConsent = useMutation(api.consents.grant);

  const handleAccept = async () => {
    await grantConsent({
      consentType: 'recording',
      granted: true
    });
  };

  return (
    <div className="consent-banner">
      <p>This meeting will be recorded and transcribed.</p>
      <button onClick={handleAccept}>I Consent</button>
      <button onClick={() => router.push('/')}>Decline</button>
    </div>
  );
}
```

## 7. Audit Logging

```typescript
// convex/schema.ts
auditLogs: defineTable({
  userId: v.string(),
  action: v.string(),
  resourceType: v.string(),
  resourceId: v.string(),
  metadata: v.object({}),
  ipAddress: v.optional(v.string()),
  timestamp: v.number()
})
  .index('by_user', ['userId'])
  .index('by_resource', ['resourceType', 'resourceId'])
  .index('by_timestamp', ['timestamp'])

// lib/audit.ts
export async function logAuditEvent(
  userId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, any> = {}
) {
  await convex.mutation(api.audit.log, {
    userId,
    action,
    resourceType,
    resourceId,
    metadata,
    timestamp: Date.now()
  });
}

// Usage
await logAuditEvent(userId, 'meeting.start', 'meeting', meetingId, {
  roomId,
  participantCount: 5
});

await logAuditEvent(userId, 'transcript.export', 'meeting', meetingId, {
  format: 'pdf'
});
```

## 8. Security Headers

```typescript
// next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://clerk.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self'",
      "connect-src 'self' https://*.convex.cloud https://api.clerk.com wss://*.assemblyai.com",
      "media-src 'self' blob:",
      "frame-ancestors 'none'"
    ].join('; ')
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
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

## 9. Security Checklist

### Pre-Launch

- [ ] All API keys stored in environment variables
- [ ] No secrets in client-side code
- [ ] HTTPS enforced everywhere
- [ ] Authentication on all protected routes
- [ ] Input validation on all endpoints
- [ ] Rate limiting configured
- [ ] CSRF protection enabled
- [ ] Security headers configured
- [ ] Audit logging implemented

### Ongoing

- [ ] Regular dependency updates
- [ ] Security vulnerability scanning
- [ ] Access logs reviewed
- [ ] API key rotation scheduled
- [ ] Backup and recovery tested
- [ ] Incident response plan documented

## 10. Sources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Clerk Security](https://clerk.com/docs/security/overview)
- [Convex Security](https://docs.convex.dev/production/security)
- [GDPR Guidelines](https://gdpr.eu/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
