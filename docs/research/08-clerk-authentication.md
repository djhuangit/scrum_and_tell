# Clerk Authentication Research

> Next.js App Router integration for voice meeting agents

## 1. Overview

Clerk provides authentication with:
- Email/password and social login
- Multi-factor authentication
- Session management
- Organisation support
- Next.js App Router native integration

## 2. Installation & Setup

### Install Packages

```bash
npm install @clerk/nextjs
```

### Environment Variables

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

### Middleware Configuration

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

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)']
};
```

### Provider Setup

```typescript
// app/layout.tsx
import { ClerkProvider } from '@clerk/nextjs';

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

## 3. Authentication Components

### Sign In/Up Pages

```typescript
// app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}

// app/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  );
}
```

### User Button

```typescript
import { UserButton } from '@clerk/nextjs';

export function Header() {
  return (
    <header className="flex justify-between p-4">
      <h1>Ops Room</h1>
      <UserButton afterSignOutUrl="/" />
    </header>
  );
}
```

## 4. Server-Side Authentication

### Server Components

```typescript
// app/dashboard/page.tsx
import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const user = await currentUser();

  return (
    <div>
      <h1>Welcome, {user?.firstName}</h1>
    </div>
  );
}
```

### API Routes

```typescript
// app/api/rooms/route.ts
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fetch rooms for user
  const rooms = await getRoomsForUser(userId);

  return NextResponse.json(rooms);
}
```

### Server Actions

```typescript
'use server';

import { auth } from '@clerk/nextjs/server';

export async function createRoom(formData: FormData) {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  const name = formData.get('name') as string;

  // Create room in database
  const room = await db.rooms.create({
    name,
    creatorId: userId
  });

  return room;
}
```

## 5. Client-Side Authentication

### useUser Hook

```typescript
'use client';

import { useUser } from '@clerk/nextjs';

export function Profile() {
  const { isLoaded, isSignedIn, user } = useUser();

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  if (!isSignedIn) {
    return <div>Please sign in</div>;
  }

  return (
    <div>
      <h2>{user.fullName}</h2>
      <p>{user.primaryEmailAddress?.emailAddress}</p>
    </div>
  );
}
```

### useAuth Hook

```typescript
'use client';

import { useAuth } from '@clerk/nextjs';

export function AuthStatus() {
  const { isLoaded, userId, sessionId, getToken } = useAuth();

  if (!isLoaded) return null;

  if (!userId) {
    return <div>Not signed in</div>;
  }

  return <div>Signed in as {userId}</div>;
}
```

## 6. Convex Integration

### Setup Convex with Clerk

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
```

### Provider Configuration

```typescript
// app/providers.tsx
'use client';

import { ClerkProvider, useAuth } from '@clerk/nextjs';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { ConvexReactClient } from 'convex/react';

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

### Using Auth in Convex

```typescript
// convex/rooms.ts
import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    return ctx.db
      .query('rooms')
      .withIndex('by_creator', (q) => q.eq('creatorId', identity.subject))
      .collect();
  }
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');

    return ctx.db.insert('rooms', {
      name: args.name,
      creatorId: identity.subject,
      createdAt: Date.now()
    });
  }
});
```

## 7. Protected Routes

### Using Authenticated/Unauthenticated

```typescript
'use client';

import { Authenticated, Unauthenticated, AuthLoading } from 'convex/react';

export function ProtectedContent() {
  return (
    <>
      <AuthLoading>
        <div>Loading...</div>
      </AuthLoading>

      <Unauthenticated>
        <div>Please sign in to continue</div>
      </Unauthenticated>

      <Authenticated>
        <Dashboard />
      </Authenticated>
    </>
  );
}
```

## 8. User Metadata

### Storing Custom Data

```typescript
import { clerkClient } from '@clerk/nextjs/server';

// Update user metadata
await clerkClient.users.updateUserMetadata(userId, {
  publicMetadata: {
    role: 'admin',
    organisation: 'Acme Inc'
  },
  privateMetadata: {
    stripeCustomerId: 'cus_...'
  }
});
```

### Accessing Metadata

```typescript
const user = await currentUser();
const role = user?.publicMetadata?.role;
```

## 9. Webhooks

### Setup Webhook Endpoint

```typescript
// app/api/webhooks/clerk/route.ts
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Missing CLERK_WEBHOOK_SECRET');
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Missing svix headers', { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature
    }) as WebhookEvent;
  } catch (err) {
    return new Response('Invalid signature', { status: 400 });
  }

  switch (evt.type) {
    case 'user.created':
      await handleUserCreated(evt.data);
      break;
    case 'user.updated':
      await handleUserUpdated(evt.data);
      break;
    case 'user.deleted':
      await handleUserDeleted(evt.data);
      break;
  }

  return new Response('OK', { status: 200 });
}
```

## 10. Security Best Practices

1. **Always verify auth server-side** - Never trust client-only auth checks
2. **Use middleware for route protection** - Centralised auth logic
3. **Validate webhook signatures** - Prevent spoofed events
4. **Store sensitive data in privateMetadata** - Not visible to clients
5. **Enable MFA for admin accounts** - Extra security layer
6. **Set appropriate session timeouts** - Balance security and UX

## 11. Sources

- [Clerk Next.js Documentation](https://clerk.com/docs/quickstarts/nextjs)
- [Clerk + Convex Integration](https://docs.convex.dev/auth/clerk)
- [Clerk Middleware](https://clerk.com/docs/references/nextjs/clerk-middleware)
- [Clerk Webhooks](https://clerk.com/docs/webhooks/overview)
