# Testing Strategy Research

> Comprehensive testing for voice meeting agents

## 1. Overview

Testing layers for the meeting agent:
- Unit tests for utilities and hooks
- Integration tests for API routes
- Component tests for React components
- End-to-end tests for critical flows
- Mocking strategies for external APIs

## 2. Testing Stack

```json
// package.json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@testing-library/jest-dom": "^6.0.0",
    "playwright": "^1.40.0",
    "@playwright/test": "^1.40.0",
    "msw": "^2.0.0",
    "happy-dom": "^12.0.0"
  }
}
```

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    setupFiles: ['./test/setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules', 'test']
    },
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

### Test Setup

```typescript
// test/setup.ts
import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers';

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## 3. Unit Testing

### Testing Utilities

```typescript
// lib/utils.test.ts
import { describe, it, expect } from 'vitest';
import { formatDuration, chunkText, sanitiseInput } from './utils';

describe('formatDuration', () => {
  it('formats seconds to mm:ss', () => {
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(3661)).toBe('61:01');
  });

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('00:00');
  });
});

describe('chunkText', () => {
  it('splits text into chunks', () => {
    const text = 'a'.repeat(1000);
    const chunks = chunkText(text, 500);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(500);
  });

  it('handles empty text', () => {
    expect(chunkText('')).toEqual([]);
  });
});

describe('sanitiseInput', () => {
  it('removes HTML tags', () => {
    expect(sanitiseInput('<script>alert("xss")</script>')).toBe('');
  });

  it('preserves plain text', () => {
    expect(sanitiseInput('Hello world')).toBe('Hello world');
  });
});
```

### Testing Custom Hooks

```typescript
// hooks/useAudioRecorder.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAudioRecorder } from './useAudioRecorder';

// Mock MediaRecorder
const mockMediaRecorder = {
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  ondataavailable: null as any,
  onstop: null as any,
  state: 'inactive'
};

vi.stubGlobal('MediaRecorder', vi.fn(() => mockMediaRecorder));

vi.stubGlobal('navigator', {
  mediaDevices: {
    getUserMedia: vi.fn(() =>
      Promise.resolve({
        getTracks: () => [{ stop: vi.fn() }]
      })
    )
  }
});

describe('useAudioRecorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts recording', async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    expect(result.current.isRecording).toBe(true);
    expect(mockMediaRecorder.start).toHaveBeenCalled();
  });

  it('stops recording and returns blob', async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.startRecording();
    });

    const stopPromise = result.current.stopRecording();

    // Simulate onstop callback
    act(() => {
      mockMediaRecorder.onstop?.();
    });

    const blob = await stopPromise;
    expect(result.current.isRecording).toBe(false);
  });
});
```

## 4. Component Testing

### Testing React Components

```typescript
// components/SpeakerSelector.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpeakerSelector } from './SpeakerSelector';

describe('SpeakerSelector', () => {
  const participants = [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' }
  ];

  it('renders all participants', () => {
    render(
      <SpeakerSelector
        participants={participants}
        onSpeakerChange={() => {}}
      />
    );

    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('calls onSpeakerChange when participant selected', () => {
    const onSpeakerChange = vi.fn();

    render(
      <SpeakerSelector
        participants={participants}
        onSpeakerChange={onSpeakerChange}
      />
    );

    fireEvent.click(screen.getByText('Alice'));

    expect(onSpeakerChange).toHaveBeenCalledWith('1');
  });

  it('highlights active speaker', () => {
    render(
      <SpeakerSelector
        participants={participants}
        currentSpeaker="1"
        onSpeakerChange={() => {}}
      />
    );

    const aliceButton = screen.getByText('Alice').closest('button');
    expect(aliceButton).toHaveClass('active');
  });
});
```

### Testing with Providers

```typescript
// test/utils.tsx
import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ClerkProvider } from '@clerk/nextjs';

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <ConvexProvider client={convex}>
        {children}
      </ConvexProvider>
    </ClerkProvider>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options });
}
```

### Testing Async Components

```typescript
// components/RoomList.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { RoomList } from './RoomList';

// Mock Convex query
vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => [
    { _id: '1', name: 'Room 1' },
    { _id: '2', name: 'Room 2' }
  ])
}));

describe('RoomList', () => {
  it('renders rooms from query', async () => {
    renderWithProviders(<RoomList />);

    await waitFor(() => {
      expect(screen.getByText('Room 1')).toBeInTheDocument();
      expect(screen.getByText('Room 2')).toBeInTheDocument();
    });
  });

  it('shows loading state', () => {
    vi.mocked(useQuery).mockReturnValueOnce(undefined);

    renderWithProviders(<RoomList />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
```

## 5. API Route Testing

```typescript
// app/api/rooms/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from './route';
import { NextRequest } from 'next/server';

// Mock Clerk auth
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(() => ({ userId: 'test-user-123' }))
}));

// Mock Convex
vi.mock('convex/browser', () => ({
  ConvexHttpClient: vi.fn(() => ({
    query: vi.fn(),
    mutation: vi.fn()
  }))
}));

describe('/api/rooms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET', () => {
    it('returns rooms for authenticated user', async () => {
      const mockRooms = [{ _id: '1', name: 'Test Room' }];
      vi.mocked(convex.query).mockResolvedValue(mockRooms);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockRooms);
    });

    it('returns 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce({ userId: null });

      const response = await GET();

      expect(response.status).toBe(401);
    });
  });

  describe('POST', () => {
    it('creates a room', async () => {
      vi.mocked(convex.mutation).mockResolvedValue('new-room-id');

      const request = new NextRequest('http://localhost/api/rooms', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Room' })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data).toEqual({ id: 'new-room-id' });
    });

    it('validates input', async () => {
      const request = new NextRequest('http://localhost/api/rooms', {
        method: 'POST',
        body: JSON.stringify({ name: '' }) // Invalid: empty name
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });
});
```

## 6. Mocking External APIs

### MSW Handlers

```typescript
// test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Mock ElevenLabs TTS
  http.post('https://api.elevenlabs.io/v1/text-to-speech/*', () => {
    return new HttpResponse(new ArrayBuffer(1024), {
      headers: { 'Content-Type': 'audio/mpeg' }
    });
  }),

  // Mock AssemblyAI
  http.post('https://api.assemblyai.com/v2/transcript', () => {
    return HttpResponse.json({ id: 'transcript-123', status: 'queued' });
  }),

  http.get('https://api.assemblyai.com/v2/transcript/:id', ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      status: 'completed',
      text: 'This is a test transcript.'
    });
  }),

  // Mock OpenAI
  http.post('https://api.openai.com/v1/chat/completions', () => {
    return HttpResponse.json({
      choices: [{
        message: {
          content: JSON.stringify({
            summary: 'Test summary',
            action_items: []
          })
        }
      }]
    });
  })
];
```

### Mocking Convex

```typescript
// test/mocks/convex.ts
import { vi } from 'vitest';

export const mockConvexClient = {
  query: vi.fn(),
  mutation: vi.fn(),
  action: vi.fn()
};

export const createMockQuery = <T>(data: T) => {
  return vi.fn().mockResolvedValue(data);
};

export const createMockMutation = <T>(returnValue: T) => {
  return vi.fn().mockResolvedValue(returnValue);
};

// Usage in tests
import { mockConvexClient, createMockQuery } from '@/test/mocks/convex';

mockConvexClient.query.mockImplementation(
  createMockQuery([{ _id: '1', name: 'Room' }])
);
```

### Mocking Audio APIs

```typescript
// test/mocks/audio.ts
export const mockAudioContext = {
  createMediaStreamSource: vi.fn(() => ({
    connect: vi.fn()
  })),
  createAnalyser: vi.fn(() => ({
    fftSize: 256,
    frequencyBinCount: 128,
    getByteFrequencyData: vi.fn()
  })),
  createGain: vi.fn(() => ({
    connect: vi.fn(),
    gain: { value: 1 }
  })),
  destination: {},
  resume: vi.fn(),
  state: 'running'
};

vi.stubGlobal('AudioContext', vi.fn(() => mockAudioContext));
```

## 7. End-to-End Testing

### Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI
  }
});
```

### E2E Test Examples

```typescript
// e2e/meeting.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Meeting Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login via Clerk test mode
    await page.goto('/sign-in');
    await page.fill('[name="identifier"]', 'test@example.com');
    await page.fill('[name="password"]', 'testpassword');
    await page.click('[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('creates a new room', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('[data-testid="create-room-button"]');

    await page.fill('[name="roomName"]', 'Test Meeting');
    await page.click('[data-testid="create-room-submit"]');

    await expect(page.locator('[data-testid="room-card"]')).toContainText('Test Meeting');
  });

  test('starts a meeting', async ({ page }) => {
    await page.goto('/rooms/test-room-id');
    await page.click('[data-testid="start-meeting-button"]');

    await expect(page.locator('[data-testid="meeting-status"]')).toHaveText('Active');
  });

  test('uploads a document', async ({ page }) => {
    await page.goto('/rooms/test-room-id');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('./test/fixtures/test-document.pdf');

    await expect(page.locator('[data-testid="document-list"]')).toContainText('test-document.pdf');
  });
});
```

### Testing with Microphone

```typescript
// e2e/audio.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Audio Recording', () => {
  test('grants microphone permission', async ({ page, context }) => {
    // Grant microphone permission
    await context.grantPermissions(['microphone']);

    await page.goto('/rooms/test-room-id/meeting');

    await page.click('[data-testid="record-button"]');

    await expect(page.locator('[data-testid="recording-indicator"]')).toBeVisible();
  });
});
```

## 8. Convex Testing

```typescript
// convex/rooms.test.ts
import { describe, it, expect } from 'vitest';
import { convexTest } from 'convex-test';
import { api } from './_generated/api';
import schema from './schema';

describe('rooms', () => {
  it('creates a room', async () => {
    const t = convexTest(schema);

    await t.run(async (ctx) => {
      // Set up authenticated user
      const identity = { subject: 'user-123' };
      ctx.auth.getUserIdentity = async () => identity;

      const roomId = await ctx.mutation(api.rooms.create, {
        name: 'Test Room'
      });

      expect(roomId).toBeDefined();

      const room = await ctx.query(api.rooms.get, { id: roomId });
      expect(room?.name).toBe('Test Room');
      expect(room?.creatorId).toBe('user-123');
    });
  });

  it('prevents unauthorized access', async () => {
    const t = convexTest(schema);

    await t.run(async (ctx) => {
      ctx.auth.getUserIdentity = async () => null;

      await expect(
        ctx.mutation(api.rooms.create, { name: 'Test' })
      ).rejects.toThrow('Not authenticated');
    });
  });
});
```

## 9. Test Fixtures

```typescript
// test/fixtures/index.ts
export const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User'
};

export const mockRoom = {
  _id: 'room-123',
  name: 'Test Room',
  creatorId: 'user-123',
  status: 'active' as const,
  createdAt: Date.now()
};

export const mockMeeting = {
  _id: 'meeting-123',
  roomId: 'room-123',
  status: 'active' as const,
  startedAt: Date.now()
};

export const mockTranscript = {
  _id: 'transcript-123',
  meetingId: 'meeting-123',
  speakerId: 'user-123',
  speakerName: 'Test User',
  text: 'This is a test transcript.',
  startTime: 0,
  endTime: 5000
};

export const mockActionItem = {
  _id: 'action-123',
  meetingId: 'meeting-123',
  task: 'Complete the test',
  owner: 'Test User',
  priority: 'high' as const,
  status: 'pending' as const
};
```

## 10. CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npm run test:unit

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci
      - run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: ${{ secrets.CLERK_PUBLISHABLE_KEY }}
          CLERK_SECRET_KEY: ${{ secrets.CLERK_SECRET_KEY }}

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

## 11. Test Scripts

```json
// package.json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run",
    "test:watch": "vitest watch",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

## 12. Best Practices

1. **Test behaviour, not implementation**: Focus on what the code does, not how
2. **Use realistic test data**: Fixtures should mirror production data
3. **Mock at boundaries**: Mock external APIs, not internal modules
4. **Keep tests fast**: Unit tests should run in milliseconds
5. **Test error cases**: Cover error handling paths
6. **Use test IDs**: Add `data-testid` for reliable E2E selectors
7. **Run tests in CI**: Every PR should pass tests
8. **Maintain coverage**: Aim for 80%+ coverage on critical paths

## 13. Sources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Playwright Documentation](https://playwright.dev/)
- [MSW Documentation](https://mswjs.io/)
- [Convex Testing](https://docs.convex.dev/functions/testing)
