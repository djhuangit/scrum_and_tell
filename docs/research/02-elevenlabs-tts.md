# ElevenLabs TTS Research

> Text-to-speech integration for voice meeting agents

## 1. Overview

ElevenLabs provides high-quality, low-latency text-to-speech with streaming capabilities ideal for conversational AI applications.

**Key Features:**
- Real-time streaming TTS
- Professional voice library
- Custom voice cloning
- WebSocket and HTTP streaming APIs
- Multiple audio formats

## 2. API Architecture

### Authentication

```typescript
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

const headers = {
  'xi-api-key': ELEVENLABS_API_KEY,
  'Content-Type': 'application/json'
};
```

### Endpoints

| Endpoint | Method | Use Case |
|----------|--------|----------|
| `/v1/text-to-speech/{voice_id}` | POST | Standard TTS |
| `/v1/text-to-speech/{voice_id}/stream` | POST | HTTP streaming |
| `wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input` | WebSocket | Real-time streaming |

## 3. Voice Selection

### Recommended Voices for Meetings

| Voice ID | Name | Style | Best For |
|----------|------|-------|----------|
| `21m00Tcm4TlvDq8ikWAM` | Rachel | Professional | Business meetings |
| `AZnzlk1XvdvUeBnXmlld` | Domi | Confident | Presentations |
| `EXAVITQu4vr4xnSDxMaL` | Bella | Warm | Casual meetings |
| `ErXwobaYiN019PkySvjV` | Antoni | Authoritative | Executive briefings |

### Voice Settings

```typescript
interface VoiceSettings {
  stability: number;        // 0-1, higher = more consistent
  similarity_boost: number; // 0-1, higher = more similar to original
  style: number;           // 0-1, style exaggeration
  use_speaker_boost: boolean;
}

const professionalSettings: VoiceSettings = {
  stability: 0.75,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true
};
```

## 4. HTTP Streaming Implementation

### Basic Streaming

```typescript
async function streamTTS(
  text: string,
  voiceId: string = '21m00Tcm4TlvDq8ikWAM'
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.75
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`ElevenLabs error: ${response.status}`);
  }

  return response.body!;
}
```

### Next.js API Route

```typescript
// app/api/tts/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const { text, voiceId } = await request.json();

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.75
        },
        output_format: 'mp3_44100_128'
      })
    }
  );

  return new NextResponse(response.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Transfer-Encoding': 'chunked'
    }
  });
}
```

## 5. WebSocket Streaming

For lowest latency real-time TTS:

```typescript
class ElevenLabsWebSocket {
  private ws: WebSocket | null = null;
  private voiceId: string;
  private apiKey: string;

  constructor(voiceId: string, apiKey: string) {
    this.voiceId = voiceId;
    this.apiKey = apiKey;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `wss://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}/stream-input?model_id=eleven_turbo_v2_5`;

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        // Send initial config
        this.ws!.send(JSON.stringify({
          text: ' ',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75
          },
          xi_api_key: this.apiKey
        }));
        resolve();
      };

      this.ws.onerror = reject;
    });
  }

  sendText(text: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ text }));
    }
  }

  endStream(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ text: '' }));
    }
  }

  onAudio(callback: (audio: ArrayBuffer) => void): void {
    if (this.ws) {
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.audio) {
          const audioData = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
          callback(audioData.buffer);
        }
      };
    }
  }

  close(): void {
    this.ws?.close();
  }
}
```

## 6. Audio Formats

| Format | Use Case | Quality |
|--------|----------|---------|
| `mp3_44100_128` | Web playback | Good |
| `pcm_16000` | Processing/STT | Raw |
| `pcm_44100` | High-quality processing | Raw |
| `ulaw_8000` | Telephony | Low |

### Format Selection

```typescript
// For web playback
const outputFormat = 'mp3_44100_128';

// For Anam avatar integration
const outputFormat = 'pcm_16000';

// For high-quality archival
const outputFormat = 'mp3_44100_192';
```

## 7. Client-Side Playback

### React Hook

```typescript
import { useState, useRef, useCallback } from 'react';

export function useTTS() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const speak = useCallback(async (text: string) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceId: '21m00Tcm4TlvDq8ikWAM' })
    });

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

    sourceRef.current = audioContextRef.current.createBufferSource();
    sourceRef.current.buffer = audioBuffer;
    sourceRef.current.connect(audioContextRef.current.destination);

    sourceRef.current.onended = () => setIsPlaying(false);

    setIsPlaying(true);
    sourceRef.current.start();
  }, []);

  const stop = useCallback(() => {
    sourceRef.current?.stop();
    setIsPlaying(false);
  }, []);

  return { speak, stop, isPlaying };
}
```

### Streaming Playback

```typescript
async function playStreamingAudio(stream: ReadableStream<Uint8Array>) {
  const audioContext = new AudioContext();
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const audioData = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    audioData.set(chunk, offset);
    offset += chunk.length;
  }

  const audioBuffer = await audioContext.decodeAudioData(audioData.buffer);
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start();
}
```

## 8. Rate Limits

| Plan | Characters/month | Concurrent requests |
|------|------------------|---------------------|
| Free | 10,000 | 2 |
| Starter | 30,000 | 3 |
| Creator | 100,000 | 5 |
| Pro | 500,000 | 10 |

### Handling Rate Limits

```typescript
async function ttsWithRetry(
  text: string,
  maxRetries: number = 3
): Promise<ArrayBuffer> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        body: JSON.stringify({ text })
      });

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || '1';
        await new Promise(r => setTimeout(r, parseInt(retryAfter) * 1000));
        continue;
      }

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.arrayBuffer();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
  throw new Error('Max retries exceeded');
}
```

## 9. Latency Optimisation

### Best Practices

1. **Use Turbo models**: `eleven_turbo_v2_5` for lowest latency
2. **Stream responses**: Don't wait for full audio generation
3. **Pre-warm connections**: Establish WebSocket before needed
4. **Chunk text**: Send smaller segments for faster TTFB
5. **Regional endpoints**: Use closest data centre

### Latency Benchmarks

| Model | TTFB | Total (100 chars) |
|-------|------|-------------------|
| eleven_turbo_v2_5 | ~150ms | ~400ms |
| eleven_multilingual_v2 | ~300ms | ~800ms |
| eleven_monolingual_v1 | ~200ms | ~500ms |

## 10. Anam Integration

When using ElevenLabs with Anam avatar:

```typescript
// Option 1: Let Anam handle TTS (recommended for simplicity)
const client = new AnamClient(token, {
  personaId: 'persona-id'
  // Anam uses its own TTS
});

// Option 2: Custom TTS integration
// Requires custom LLM mode and audio synchronisation
// More complex, only if specific voice needed
```

## 11. Error Handling

```typescript
interface ElevenLabsError {
  detail: {
    status: string;
    message: string;
  };
}

async function handleTTSRequest(text: string) {
  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      const error: ElevenLabsError = await response.json();

      switch (response.status) {
        case 401:
          throw new Error('Invalid API key');
        case 422:
          throw new Error(`Invalid request: ${error.detail.message}`);
        case 429:
          throw new Error('Rate limit exceeded');
        default:
          throw new Error(`TTS failed: ${error.detail.message}`);
      }
    }

    return response;
  } catch (error) {
    console.error('TTS error:', error);
    throw error;
  }
}
```

## 12. Sources

- [ElevenLabs API Documentation](https://docs.elevenlabs.io/api-reference)
- [ElevenLabs Python SDK](https://github.com/elevenlabs/elevenlabs-python)
- [Streaming Guide](https://docs.elevenlabs.io/api-reference/streaming)
- [Voice Library](https://elevenlabs.io/voice-library)
