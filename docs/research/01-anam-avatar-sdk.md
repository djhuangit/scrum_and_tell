# Anam Avatar SDK Research

> Integration guide for Anam AI avatars in voice meeting agents

## 1. Overview

Anam AI provides real-time conversational AI avatars with photorealistic rendering and sub-second response times. The CARA II technology delivers median latency under 1 second with 25fps video.

**Key Capabilities:**
- Photorealistic avatar rendering
- Real-time lip-sync with audio
- Natural interruption handling
- Knowledge Base (RAG) for document-aware responses
- Client tools for meeting control

## 2. SDK Architecture

### Installation

```bash
npm install @anam-ai/js-sdk
```

### Basic Setup

```typescript
import { AnamClient } from '@anam-ai/js-sdk';

const anamClient = new AnamClient('your-session-token', {
  personaId: 'your-persona-id',
  disableFillerPhrases: false,
  disableBrains: false
});

// Connect avatar to video element
const videoElement = document.getElementById('avatar-video');
const audioElement = document.getElementById('avatar-audio');

await anamClient.streamToVideoAndAudioElements(
  videoElement,
  audioElement
);
```

### React Integration

```tsx
import { useEffect, useRef } from 'react';
import { AnamClient } from '@anam-ai/js-sdk';

export function AvatarComponent({ sessionToken, personaId }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const clientRef = useRef<AnamClient | null>(null);

  useEffect(() => {
    const client = new AnamClient(sessionToken, { personaId });
    clientRef.current = client;

    if (videoRef.current && audioRef.current) {
      client.streamToVideoAndAudioElements(
        videoRef.current,
        audioRef.current
      );
    }

    return () => {
      client.stopStreaming();
    };
  }, [sessionToken, personaId]);

  return (
    <div className="avatar-container">
      <video ref={videoRef} autoPlay playsInline />
      <audio ref={audioRef} autoPlay />
    </div>
  );
}
```

## 3. Audio Integration

### Microphone Control

```typescript
// Start listening to user
anamClient.startMic();

// Stop listening
anamClient.stopMic();

// Check microphone state
const isMicOn = anamClient.isMicOn();
```

### Custom Audio Stream (for ElevenLabs TTS)

For integrating external TTS like ElevenLabs:

```typescript
// Option 1: Use Anam's built-in TTS (simpler)
// Anam handles TTS internally with persona voice

// Option 2: Custom LLM mode for external TTS
const client = new AnamClient(token, {
  personaId: 'persona-id',
  disableBrains: true  // Use custom LLM
});

// Send text for avatar to speak
client.talk('Hello, welcome to the meeting.');
```

### Audio Format Requirements

- Sample rate: 16kHz or 48kHz
- Format: PCM or WebM/Opus
- WebRTC-based streaming

## 4. Events & Lifecycle

### Connection Events

```typescript
client.addListener('CONNECTION_ESTABLISHED', () => {
  console.log('Avatar connected');
});

client.addListener('CONNECTION_CLOSED', (event) => {
  console.log('Connection closed:', event.reason);
});

client.addListener('ERROR', (error) => {
  console.error('Anam error:', error);
});
```

### Message Events

```typescript
client.addListener('MESSAGE_HISTORY_UPDATED', (messages) => {
  // Access conversation history
  console.log('Messages:', messages);
});

client.addListener('MESSAGE_STREAM_EVENT', (event) => {
  // Real-time message streaming
  if (event.role === 'assistant') {
    console.log('Avatar speaking:', event.content);
  }
});
```

### State Events

```typescript
client.addListener('AVATAR_TALKING_STATE_CHANGED', (isTalking) => {
  // Avatar started/stopped speaking
  updateUI(isTalking);
});

client.addListener('USER_TALKING_STATE_CHANGED', (isTalking) => {
  // User started/stopped speaking
  showSpeakingIndicator(isTalking);
});
```

## 5. Performance

### Latency Characteristics

| Metric | Value |
|--------|-------|
| Median response time | < 1 second |
| Average response time | < 400ms |
| Video frame rate | 25 fps |
| Audio latency | < 100ms |

### Browser Compatibility

| Browser | Support |
|---------|---------|
| Chrome | Full |
| Safari | Full |
| Edge | Full |
| Firefox | Not supported |

### Hardware Requirements

- Modern GPU recommended for smooth rendering
- Minimum 4GB RAM
- Stable internet connection (WebRTC)

## 6. Best Practices

### Authentication

```typescript
// Generate session token server-side
// POST /api/anam/session
const response = await fetch('/api/anam/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId, meetingId })
});

const { sessionToken } = await response.json();
```

### System Prompts

```typescript
const personaConfig = {
  systemPrompt: `You are a professional meeting facilitator named Alex.
Your role is to:
- Guide participants through the agenda
- Summarise key points
- Capture action items
- Keep discussions on track

Tone: Professional but friendly
Response length: Concise (2-3 sentences max)
`,
  name: 'Alex',
  voice: 'professional-female'
};
```

### Error Handling

```typescript
client.addListener('ERROR', (error) => {
  switch (error.code) {
    case 'CONNECTION_FAILED':
      // Retry connection
      setTimeout(() => client.connect(), 2000);
      break;
    case 'AUDIO_PERMISSION_DENIED':
      // Show permission request UI
      showMicrophonePermissionDialog();
      break;
    case 'SESSION_EXPIRED':
      // Refresh session token
      refreshSessionToken();
      break;
    default:
      console.error('Unhandled error:', error);
  }
});
```

### Interruption Handling

Anam handles interruptions naturally:

```typescript
// User can interrupt avatar at any time
// Avatar will stop speaking and listen
// No additional code needed - built into SDK
```

## 7. Knowledge Base (RAG)

For document-aware meetings:

```typescript
// Configure knowledge base in Anam dashboard
// Upload meeting documents
// Avatar will reference documents in responses

const client = new AnamClient(token, {
  personaId: 'persona-with-knowledge-base',
  knowledgeBaseId: 'meeting-docs-kb'
});
```

## 8. Client Tools

Define tools the avatar can trigger:

```typescript
const tools = [
  {
    name: 'create_action_item',
    description: 'Create an action item from discussion',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        assignee: { type: 'string' },
        dueDate: { type: 'string' }
      },
      required: ['title']
    }
  },
  {
    name: 'end_meeting',
    description: 'End the current meeting',
    parameters: { type: 'object', properties: {} }
  }
];

client.addListener('TOOL_CALL', (toolCall) => {
  if (toolCall.name === 'create_action_item') {
    createActionItem(toolCall.parameters);
  }
});
```

## 9. Limitations

- **Firefox not supported** - Use Chrome, Safari, or Edge
- **No native mobile SDKs** - Use mobile web
- **Session limits** vary by plan
- **Custom LLM mode** required for ElevenLabs integration

## 10. Sources

- [Anam AI Documentation](https://docs.anam.ai)
- [Anam JavaScript SDK](https://github.com/anam-ai/anam-js-sdk)
- [Anam React Examples](https://github.com/anam-ai/anam-examples)
