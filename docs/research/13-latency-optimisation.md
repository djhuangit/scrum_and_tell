# Latency Optimisation Research

> Achieving sub-second response times for voice meeting agents

## 1. Overview

Target latency budget for conversational UX:
- **Total end-to-end**: 500-800ms
- **Speech-to-text**: 100-300ms
- **LLM processing**: 200-400ms
- **Text-to-speech**: 100-200ms
- **Network overhead**: 50-100ms

## 2. Latency Budget Breakdown

```
User speaks → [100-300ms] → STT
                              ↓
                         Transcript
                              ↓
                         [200-400ms] → LLM
                              ↓
                         Response text
                              ↓
                         [100-200ms] → TTS
                              ↓
                         Audio plays
```

## 3. Speech-to-Text Optimisation

### Use Real-Time Streaming APIs

```typescript
// Real-time STT with AssemblyAI
class RealTimeTranscription {
  private ws: WebSocket | null = null;

  async connect(onTranscript: (text: string, isFinal: boolean) => void) {
    const response = await fetch('https://api.assemblyai.com/v2/realtime/token', {
      method: 'POST',
      headers: {
        'Authorization': process.env.ASSEMBLYAI_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expires_in: 3600 })
    });

    const { token } = await response.json();

    this.ws = new WebSocket(
      `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`
    );

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.message_type === 'PartialTranscript') {
        onTranscript(data.text, false);
      } else if (data.message_type === 'FinalTranscript') {
        onTranscript(data.text, true);
      }
    };
  }

  sendAudio(audioData: ArrayBuffer) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(audioData);
    }
  }
}
```

### Optimise Audio Settings

```typescript
const audioConstraints = {
  audio: {
    sampleRate: 16000,        // 16kHz optimal for speech
    channelCount: 1,          // Mono reduces data
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
};

// Small chunks for low latency (100ms)
mediaRecorder.start(100);
```

### Partial Transcript Processing

```typescript
// Process partial transcripts for faster response
function handleTranscript(text: string, isFinal: boolean) {
  if (isFinal) {
    // Full processing on final
    processFullTranscript(text);
  } else {
    // Quick intent detection on partial
    const intent = detectIntent(text);
    if (intent && intent.confidence > 0.9) {
      prepareResponse(intent); // Start preparing early
    }
  }
}
```

## 4. LLM Response Optimisation

### Streaming Responses

```typescript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

async function streamResponse(prompt: string) {
  const result = await streamText({
    model: openai('gpt-4o'),
    messages: [{ role: 'user', content: prompt }],
    // Start TTS as soon as first sentence is complete
    onChunk: ({ chunk }) => {
      if (chunk.type === 'text-delta') {
        bufferForTTS(chunk.text);
      }
    }
  });

  return result;
}
```

### Use Faster Models

```typescript
const modelConfig = {
  // Fast responses (action items, simple queries)
  fast: openai('gpt-4o-mini'),

  // Quality responses (summaries, complex analysis)
  quality: openai('gpt-4o'),

  // Very fast (intent detection, classification)
  instant: openai('gpt-3.5-turbo')
};

function selectModel(task: string) {
  switch (task) {
    case 'intent':
      return modelConfig.instant;
    case 'action_item':
      return modelConfig.fast;
    case 'summary':
      return modelConfig.quality;
    default:
      return modelConfig.fast;
  }
}
```

### Prompt Optimisation

```typescript
// Short, focused prompts reduce token processing time
const optimisedPrompts = {
  // Bad: Long, verbose prompt
  bad: `You are an AI assistant that helps with meetings. When given a transcript, please carefully analyze it and identify any action items that were mentioned. For each action item, determine who is responsible and when it should be completed...`,

  // Good: Concise, structured prompt
  good: `Extract action items from transcript. Format: {"task": string, "owner": string, "due": string}[]

Transcript:
{transcript}

JSON:`
};
```

### Parallel Processing

```typescript
// Process multiple aspects in parallel
async function analyseTranscript(transcript: string) {
  const [actionItems, risks, summary] = await Promise.all([
    extractActionItems(transcript),
    identifyRisks(transcript),
    generateSummary(transcript)
  ]);

  return { actionItems, risks, summary };
}
```

## 5. Text-to-Speech Optimisation

### Streaming TTS

```typescript
class StreamingTTS {
  private audioContext: AudioContext;
  private audioQueue: AudioBuffer[] = [];
  private isPlaying = false;

  constructor() {
    this.audioContext = new AudioContext();
  }

  async streamSpeak(text: string) {
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
          model_id: 'eleven_turbo_v2_5', // Fastest model
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      }
    );

    const reader = response.body?.getReader();
    if (!reader) return;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const audioBuffer = await this.decodeAudio(value);
      this.queueAudio(audioBuffer);
    }
  }

  private async decodeAudio(data: Uint8Array): Promise<AudioBuffer> {
    return this.audioContext.decodeAudioData(data.buffer);
  }

  private queueAudio(buffer: AudioBuffer) {
    this.audioQueue.push(buffer);
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  private playNext() {
    const buffer = this.audioQueue.shift();
    if (!buffer) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.onended = () => this.playNext();
    source.start();
  }
}
```

### Sentence-Level Streaming

```typescript
// Start TTS as soon as first sentence is ready
class SentenceStreamer {
  private buffer = '';
  private tts: StreamingTTS;

  constructor(tts: StreamingTTS) {
    this.tts = tts;
  }

  addChunk(text: string) {
    this.buffer += text;

    // Check for complete sentences
    const sentenceEnd = /[.!?]\s/;
    const match = this.buffer.match(sentenceEnd);

    if (match) {
      const sentence = this.buffer.slice(0, match.index! + 1);
      this.buffer = this.buffer.slice(match.index! + 2);

      // Start TTS immediately
      this.tts.streamSpeak(sentence);
    }
  }

  flush() {
    if (this.buffer.trim()) {
      this.tts.streamSpeak(this.buffer);
      this.buffer = '';
    }
  }
}
```

## 6. Network Optimisation

### Edge Functions

```typescript
// Deploy latency-sensitive functions to edge
// app/api/intent/route.ts
export const runtime = 'edge';
export const preferredRegion = ['iad1', 'sfo1', 'lhr1'];

export async function POST(request: Request) {
  const { text } = await request.json();

  // Quick intent classification at edge
  const intent = await classifyIntent(text);

  return Response.json({ intent });
}
```

### Connection Pooling

```typescript
// Reuse HTTP connections
const agent = new (require('http').Agent)({
  keepAlive: true,
  maxSockets: 10
});

const fetchWithKeepAlive = (url: string, options: RequestInit) =>
  fetch(url, { ...options, agent });
```

### WebSocket vs HTTP

```typescript
// Use WebSocket for real-time, HTTP for one-off requests
const connectionStrategy = {
  // WebSocket: continuous audio streaming
  audio: 'websocket',

  // HTTP: document upload, summary generation
  documents: 'http',

  // WebSocket: live transcript updates
  transcript: 'websocket',

  // HTTP: action item creation
  actionItems: 'http'
};
```

## 7. Caching Strategies

### LLM Response Caching

```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!
});

async function cachedLLMCall(prompt: string, ttl: number = 3600) {
  const cacheKey = `llm:${hashPrompt(prompt)}`;

  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  // Generate response
  const response = await generateResponse(prompt);

  // Cache result
  await redis.setex(cacheKey, ttl, response);

  return response;
}

function hashPrompt(prompt: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 16);
}
```

### Document Summary Caching

```typescript
// Cache document summaries to avoid reprocessing
async function getDocumentSummary(documentId: string): Promise<string> {
  const cacheKey = `doc-summary:${documentId}`;

  const cached = await redis.get(cacheKey);
  if (cached) return cached as string;

  const document = await fetchDocument(documentId);
  const summary = await generateSummary(document.text);

  // Cache for 24 hours
  await redis.setex(cacheKey, 86400, summary);

  return summary;
}
```

## 8. Precomputation

### Precompute Document Context

```typescript
// When document is uploaded, precompute embeddings and summary
async function onDocumentUpload(document: Document) {
  // Generate summary immediately
  const summary = await generateSummary(document.text);

  // Generate embeddings for semantic search
  const embeddings = await generateEmbeddings(document.chunks);

  // Store for instant access during meeting
  await convex.mutation(api.documents.updateProcessed, {
    id: document.id,
    summary,
    embeddings
  });
}
```

### Preload Responses

```typescript
// Preload common response patterns
const preloadedResponses = {
  greeting: "Hello, I'm ready to help facilitate this meeting.",
  endMeeting: "Let me summarise what we discussed today.",
  confirmAction: "I've noted that as an action item.",
  askClarification: "Could you clarify what you mean by that?"
};

// Pre-generate TTS for common phrases
async function preloadTTS() {
  for (const [key, text] of Object.entries(preloadedResponses)) {
    const audio = await generateTTS(text);
    audioCache.set(key, audio);
  }
}
```

## 9. Measurement & Monitoring

### Latency Tracking

```typescript
class LatencyTracker {
  private timings: Map<string, number[]> = new Map();

  startTimer(operation: string): () => void {
    const start = performance.now();

    return () => {
      const duration = performance.now() - start;
      this.record(operation, duration);
    };
  }

  record(operation: string, duration: number) {
    if (!this.timings.has(operation)) {
      this.timings.set(operation, []);
    }
    this.timings.get(operation)!.push(duration);

    // Log if exceeds threshold
    if (duration > this.getThreshold(operation)) {
      console.warn(`Slow ${operation}: ${duration.toFixed(2)}ms`);
    }
  }

  getStats(operation: string) {
    const times = this.timings.get(operation) || [];
    if (times.length === 0) return null;

    const sorted = [...times].sort((a, b) => a - b);
    return {
      count: times.length,
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      p50: sorted[Math.floor(times.length * 0.5)],
      p95: sorted[Math.floor(times.length * 0.95)],
      p99: sorted[Math.floor(times.length * 0.99)]
    };
  }

  private getThreshold(operation: string): number {
    const thresholds: Record<string, number> = {
      stt: 300,
      llm: 400,
      tts: 200,
      total: 800
    };
    return thresholds[operation] || 1000;
  }
}

// Usage
const tracker = new LatencyTracker();

async function processVoiceInput(audio: ArrayBuffer) {
  const endTotal = tracker.startTimer('total');

  const endSTT = tracker.startTimer('stt');
  const transcript = await transcribe(audio);
  endSTT();

  const endLLM = tracker.startTimer('llm');
  const response = await generateResponse(transcript);
  endLLM();

  const endTTS = tracker.startTimer('tts');
  await speak(response);
  endTTS();

  endTotal();
}
```

### Real User Monitoring

```typescript
// Track real user latency
function trackUserLatency(event: string, duration: number) {
  // Send to analytics
  if (typeof window !== 'undefined') {
    window.gtag?.('event', 'latency', {
      event_category: 'performance',
      event_label: event,
      value: Math.round(duration)
    });
  }

  // Log to server
  fetch('/api/metrics', {
    method: 'POST',
    body: JSON.stringify({ event, duration, timestamp: Date.now() })
  });
}
```

## 10. Fallback Strategies

### Graceful Degradation

```typescript
async function getResponse(transcript: string): Promise<string> {
  try {
    // Try fast model first
    return await withTimeout(
      generateResponse(transcript, 'gpt-4o-mini'),
      2000
    );
  } catch {
    // Fallback to cached response
    const cached = await getCachedSimilarResponse(transcript);
    if (cached) return cached;

    // Final fallback
    return "I'm having trouble processing that. Could you repeat?";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    )
  ]);
}
```

## 11. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Client                                │
├─────────────────────────────────────────────────────────────┤
│  Audio Input → WebSocket → [STT Stream] → Partial Text      │
│                                              ↓               │
│                              Intent Detection (Edge)         │
│                                              ↓               │
│                              [LLM Stream] → Sentence Buffer  │
│                                              ↓               │
│                              [TTS Stream] → Audio Queue      │
│                                              ↓               │
│                              Audio Output ← Play Queue       │
└─────────────────────────────────────────────────────────────┘
```

## 12. Best Practices Summary

1. **Stream everything**: STT, LLM, TTS all support streaming
2. **Process in parallel**: Don't wait for one operation to complete
3. **Use edge functions**: For latency-sensitive operations
4. **Cache aggressively**: Document summaries, common responses
5. **Precompute**: Process documents on upload, not during meeting
6. **Monitor constantly**: Track p50, p95, p99 latencies
7. **Degrade gracefully**: Have fallbacks for slow operations
8. **Optimise prompts**: Shorter prompts = faster responses
9. **Choose models wisely**: Use fast models for simple tasks
10. **Minimise network**: Use WebSockets for continuous data

## 13. Sources

- [AssemblyAI Real-Time Docs](https://www.assemblyai.com/docs/speech-to-text/real-time)
- [ElevenLabs Streaming](https://elevenlabs.io/docs/api-reference/streaming)
- [OpenAI Streaming](https://platform.openai.com/docs/api-reference/streaming)
- [Vercel Edge Functions](https://vercel.com/docs/functions/edge-functions)
