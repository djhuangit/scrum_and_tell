# Speech-to-Text Services Research

> STT service comparison for voice meeting agents

## 1. Executive Summary

### Recommendation

**ElevenLabs Scribe** is recommended if you have a Pro account:
- Best-in-class accuracy (3.1% WER vs 6.68% AssemblyAI)
- ~150ms latency (fastest)
- ~320 hours included with Pro ($99/mo)
- Unified platform if using ElevenLabs TTS
- **Limitation**: No real-time speaker diarisation

**AssemblyAI Universal-Streaming** is the budget option:
- Sub-300ms latency (307ms P50)
- Cheapest at $0.0025/min ($0.15/hr)
- Good accuracy (6.68% WER)
- **Limitation**: Async-only diarisation

**Deepgram Nova-3** is best for real-time diarisation:
- Only provider with real-time speaker identification
- Sub-300ms latency
- $0.0077/min for streaming

**OpenAI Whisper API is NOT suitable** for real-time:
- No native streaming
- 1-5 second latency
- Hallucination concerns (1.4-10% in some studies)

## 2. Free Tier & Pro Account Comparison

| Feature | ElevenLabs | AssemblyAI | Deepgram |
|---------|------------|------------|----------|
| **Free tier** | 2.5 hours | $50 (~333 hrs) | $200 (~40 hrs) |
| **Pro account** | $99/mo (320 hrs) | Pay-as-you-go | Pay-as-you-go |
| **Effective rate (Pro)** | ~$0.31/hr | $0.15/hr | $0.46/hr |
| **Concurrent streams** | Not specified | 5 max (free) | 50 max |
| **Credit expiry** | Monthly | Never | Never |

### ElevenLabs Pro Account ($99/mo)

- **~320 hours STT via API** included monthly
- Effective rate: $0.31/hr if using full allocation
- Also includes: 500 mins TTS, 1,100 mins Conversational AI
- Overage: ~$3.50/hr after allocation
- Best value if already using ElevenLabs TTS

### AssemblyAI Free Tier Details

- **$50 one-time credit** (not monthly recurring)
- 5 concurrent streaming sessions maximum
- 5 new sessions per minute rate limit
- All features included (Audio Intelligence, etc.)
- Once depleted, moves to pay-as-you-go

### Deepgram Free Tier Details

- **$200 one-time credit** (more generous for prototyping)
- Real-time speaker diarisation included
- Voice Agent API access
- Pay-as-you-go after credits exhausted

### Development Recommendation

For prototyping a voice meeting agent:
1. **If you have ElevenLabs Pro**: Use ElevenLabs Scribe (320 hrs/mo included, best accuracy)
2. **Budget option**: AssemblyAI ($50 free) for testing
3. **Need real-time diarisation**: Deepgram ($200 free)

## 3. Service Comparison

| Feature | ElevenLabs Scribe | AssemblyAI | Deepgram | Whisper API |
|---------|------------------|------------|----------|-------------|
| **Streaming** | Yes (v2) | Yes | Yes | No |
| **Latency** | **~150ms** | ~300ms | <300ms | 1-5s |
| **WER (accuracy)** | **3.1%** | 6.68% | 6.84% | ~5% |
| **Languages** | 99 (batch), 90 (RT) | 99+ | 36 | 99+ |
| **Price (streaming)** | $0.0067/min | **$0.0025/min** | $0.0077/min | $0.006/min |
| **Speaker diarisation** | Batch only (v1) | Async only | **Real-time** | Via WhisperX |
| **Real-time ready** | Yes | Yes | Yes | No |
| **Audio events** | Yes (laughter, etc.) | No | No | No |
| **Free/included** | 320 hrs (Pro) | $50 | $200 | None |

### Critical Note: Speaker Diarisation

**ElevenLabs**: Speaker diarisation is **only available in Scribe v1 (batch)**, not Scribe v2 (real-time). Supports up to 32 speakers in batch mode.

**AssemblyAI**: Speaker diarisation is **only available for async transcription**, not real-time streaming.

**Deepgram**: **Only provider with real-time speaker diarisation.**

### Workarounds for Real-Time Diarisation

If using ElevenLabs or AssemblyAI for real-time STT:
- Use multichannel audio (separate stream per speaker)
- Post-process with batch transcription after each turn
- Implement manual speaker selection in UI (recommended for meeting agents)

## 4. AssemblyAI Implementation

### Installation

```bash
npm install assemblyai
```

### Streaming Transcription

```typescript
import { AssemblyAI, RealtimeTranscript } from 'assemblyai';

const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY
});

async function startRealtimeTranscription(
  onTranscript: (text: string, isFinal: boolean) => void
) {
  const transcriber = client.realtime.transcriber({
    sampleRate: 16000,
    encoding: 'pcm_s16le'
  });

  transcriber.on('open', ({ sessionId }) => {
    console.log('Session opened:', sessionId);
  });

  transcriber.on('transcript', (transcript: RealtimeTranscript) => {
    if (transcript.text) {
      onTranscript(
        transcript.text,
        transcript.message_type === 'FinalTranscript'
      );
    }
  });

  transcriber.on('error', (error) => {
    console.error('Transcription error:', error);
  });

  transcriber.on('close', (code, reason) => {
    console.log('Session closed:', code, reason);
  });

  await transcriber.connect();
  return transcriber;
}

// Send audio chunks
function sendAudio(transcriber: any, audioChunk: ArrayBuffer) {
  transcriber.sendAudio(audioChunk);
}

// End session
async function endTranscription(transcriber: any) {
  await transcriber.close();
}
```

### React Hook

```typescript
import { useState, useRef, useCallback } from 'react';
import { AssemblyAI } from 'assemblyai';

export function useAssemblyAI() {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const transcriberRef = useRef<any>(null);

  const startListening = useCallback(async () => {
    const client = new AssemblyAI({
      apiKey: process.env.NEXT_PUBLIC_ASSEMBLYAI_API_KEY!
    });

    const transcriber = client.realtime.transcriber({
      sampleRate: 16000
    });

    transcriber.on('transcript', (t) => {
      if (t.message_type === 'FinalTranscript') {
        setTranscript(prev => prev + ' ' + t.text);
      }
    });

    await transcriber.connect();
    transcriberRef.current = transcriber;
    setIsListening(true);
  }, []);

  const stopListening = useCallback(async () => {
    await transcriberRef.current?.close();
    setIsListening(false);
  }, []);

  const sendAudio = useCallback((audio: ArrayBuffer) => {
    transcriberRef.current?.sendAudio(audio);
  }, []);

  return {
    transcript,
    isListening,
    startListening,
    stopListening,
    sendAudio
  };
}
```

## 5. Deepgram Implementation

### Installation

```bash
npm install @deepgram/sdk
```

### Streaming Transcription

```typescript
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

async function startDeepgramTranscription(
  onTranscript: (text: string, isFinal: boolean) => void
) {
  const connection = deepgram.listen.live({
    model: 'nova-3',
    language: 'en',
    smart_format: true,
    interim_results: true,
    utterance_end_ms: 1000,
    vad_events: true
  });

  connection.on(LiveTranscriptionEvents.Open, () => {
    console.log('Deepgram connection opened');
  });

  connection.on(LiveTranscriptionEvents.Transcript, (data) => {
    const transcript = data.channel.alternatives[0].transcript;
    if (transcript) {
      onTranscript(transcript, data.is_final);
    }
  });

  connection.on(LiveTranscriptionEvents.Error, (error) => {
    console.error('Deepgram error:', error);
  });

  connection.on(LiveTranscriptionEvents.Close, () => {
    console.log('Deepgram connection closed');
  });

  return connection;
}

// Send audio
function sendAudio(connection: any, audioChunk: ArrayBuffer) {
  connection.send(audioChunk);
}

// Close connection
function closeConnection(connection: any) {
  connection.finish();
}
```

### With Speaker Diarisation

```typescript
const connection = deepgram.listen.live({
  model: 'nova-3',
  language: 'en',
  diarize: true,
  diarize_version: '2021-07-14.0',
  smart_format: true
});

connection.on(LiveTranscriptionEvents.Transcript, (data) => {
  const words = data.channel.alternatives[0].words;

  words?.forEach(word => {
    console.log(`Speaker ${word.speaker}: ${word.word}`);
  });
});
```

## 6. ElevenLabs Scribe Implementation

### Installation

```bash
npm install elevenlabs
```

### Streaming Transcription (Scribe v2)

```typescript
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY!;

interface ScribeMessage {
  type: 'transcript' | 'speech_started' | 'speech_stopped' | 'error';
  transcript?: {
    text: string;
    is_final: boolean;
    language?: string;
  };
}

async function startElevenLabsTranscription(
  onTranscript: (text: string, isFinal: boolean) => void
) {
  const ws = new WebSocket(
    `wss://api.elevenlabs.io/v1/speech-to-text/realtime?xi-api-key=${ELEVENLABS_API_KEY}`
  );

  ws.onopen = () => {
    // Configure the session
    ws.send(JSON.stringify({
      type: 'configure',
      language: 'en',
      sample_rate: 16000,
      encoding: 'pcm_s16le'
    }));
    console.log('ElevenLabs STT connected');
  };

  ws.onmessage = (event) => {
    const message: ScribeMessage = JSON.parse(event.data);

    switch (message.type) {
      case 'transcript':
        if (message.transcript?.text) {
          onTranscript(
            message.transcript.text,
            message.transcript.is_final
          );
        }
        break;
      case 'speech_started':
        console.log('Speech detected');
        break;
      case 'speech_stopped':
        console.log('Speech ended');
        break;
      case 'error':
        console.error('Scribe error:', message);
        break;
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  ws.onclose = () => {
    console.log('ElevenLabs STT disconnected');
  };

  return ws;
}

// Send audio chunks
function sendAudio(ws: WebSocket, audioChunk: ArrayBuffer) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(audioChunk);
  }
}

// End session
function closeConnection(ws: WebSocket) {
  ws.close();
}
```

### React Hook

```typescript
import { useState, useRef, useCallback } from 'react';

export function useElevenLabsSTT() {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const startListening = useCallback(async () => {
    const ws = new WebSocket(
      `wss://api.elevenlabs.io/v1/speech-to-text/realtime?xi-api-key=${process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY}`
    );

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'configure',
        language: 'en',
        sample_rate: 16000,
        encoding: 'pcm_s16le'
      }));
      setIsListening(true);
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'transcript' && message.transcript?.is_final) {
        setTranscript(prev => prev + ' ' + message.transcript.text);
      }
    };

    ws.onclose = () => setIsListening(false);

    wsRef.current = ws;
  }, []);

  const stopListening = useCallback(() => {
    wsRef.current?.close();
    setIsListening(false);
  }, []);

  const sendAudio = useCallback((audio: ArrayBuffer) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(audio);
    }
  }, []);

  return {
    transcript,
    isListening,
    startListening,
    stopListening,
    sendAudio
  };
}
```

### Batch Transcription with Diarisation (Scribe v1)

```typescript
import { ElevenLabs } from 'elevenlabs';

const client = new ElevenLabs({
  apiKey: process.env.ELEVENLABS_API_KEY
});

async function transcribeWithDiarisation(audioUrl: string) {
  const result = await client.speechToText.convert({
    audio_url: audioUrl,
    model_id: 'scribe_v1',
    diarize: true,
    language_code: 'en'
  });

  // Process diarised segments
  const segments = result.words?.map(word => ({
    speaker: word.speaker_id,
    text: word.text,
    start: word.start,
    end: word.end
  }));

  return {
    text: result.text,
    segments,
    language: result.language_code
  };
}
```

## 7. Audio Format Requirements

### ElevenLabs Scribe

| Parameter | Requirement |
|-----------|-------------|
| Sample rate | 8000-48000 Hz (16kHz recommended) |
| Encoding | PCM (s16le), μ-law |
| Channels | Mono only |
| Chunk size | 100ms-1s recommended |

### AssemblyAI

| Parameter | Requirement |
|-----------|-------------|
| Sample rate | 8000-48000 Hz |
| Encoding | PCM (s16le), μ-law |
| Channels | Mono recommended |
| Chunk size | 100-250ms |

### Deepgram

| Parameter | Requirement |
|-----------|-------------|
| Sample rate | 8000-48000 Hz |
| Encoding | Linear16, Opus, FLAC, MP3 |
| Channels | Mono or stereo |
| Chunk size | Flexible |

### Browser Audio Capture

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

  const audioContext = new AudioContext({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);

  source.connect(processor);
  processor.connect(audioContext.destination);

  processor.onaudioprocess = (event) => {
    const audioData = event.inputBuffer.getChannelData(0);
    // Convert Float32Array to Int16Array for STT
    const int16Data = float32ToInt16(audioData);
    sendToSTT(int16Data.buffer);
  };

  return { stream, audioContext, processor };
}

function float32ToInt16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16Array;
}
```

## 8. Latency Comparison

### Test Results (2025)

| Service | P50 Latency | P95 Latency |
|---------|-------------|-------------|
| **ElevenLabs Scribe v2** | **~150ms** | ~250ms |
| AssemblyAI Streaming | 307ms | 450ms |
| Deepgram Nova-3 | 300ms | 500ms |
| Whisper API | 2000ms | 5000ms |

### Factors Affecting Latency

1. **Audio chunk size**: Smaller = faster interim results
2. **Network latency**: Use regional endpoints
3. **Audio quality**: Better quality = faster processing
4. **Model selection**: Smaller models = faster

## 9. Pricing Comparison

### Per-Minute Costs (USD)

| Service | Streaming | Batch |
|---------|-----------|-------|
| AssemblyAI | **$0.0025** | $0.00025 |
| ElevenLabs Scribe | $0.0067 | $0.0067 |
| Deepgram Nova-3 | $0.0077 | $0.0043 |
| Whisper API | N/A | $0.006 |

### Monthly Cost Estimates (Pay-as-you-go)

| Usage | AssemblyAI | ElevenLabs | Deepgram |
|-------|------------|------------|----------|
| 100 hours | $15 | $40 | $46.20 |
| 500 hours | $75 | $200 | $231 |
| 1000 hours | $150 | $400 | $462 |

### With ElevenLabs Pro Account ($99/mo)

| Usage | Effective Cost | Notes |
|-------|---------------|-------|
| 100 hours | $99 ($0.99/hr) | Using 31% of allocation |
| 320 hours | $99 ($0.31/hr) | Full allocation used |
| 500 hours | $162 ($0.32/hr) | 180 hrs overage @ $3.50/hr |

## 10. Advanced Features

### Custom Vocabulary

```typescript
// AssemblyAI
const transcriber = client.realtime.transcriber({
  word_boost: ['Convex', 'Clerk', 'Anam', 'ElevenLabs'],
  boost_param: 'high'
});

// Deepgram
const connection = deepgram.listen.live({
  keywords: ['Convex:2', 'Clerk:2', 'Anam:2']
});
```

### Punctuation & Formatting

```typescript
// Both services support smart formatting
// AssemblyAI
const transcriber = client.realtime.transcriber({
  punctuate: true,
  format_text: true
});

// Deepgram
const connection = deepgram.listen.live({
  smart_format: true,
  punctuate: true
});
```

## 11. Error Handling

```typescript
class STTService {
  private reconnectAttempts = 0;
  private maxReconnects = 5;

  async handleError(error: Error) {
    console.error('STT Error:', error);

    if (this.reconnectAttempts < this.maxReconnects) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000;

      console.log(`Reconnecting in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));

      await this.reconnect();
    } else {
      throw new Error('Max reconnection attempts exceeded');
    }
  }

  resetReconnectCount() {
    this.reconnectAttempts = 0;
  }
}
```

## 12. Best Practices

1. **Use streaming** for real-time applications
2. **Handle interim results** for responsive UI
3. **Implement reconnection** logic
4. **Buffer audio** during brief disconnections
5. **Use VAD** (Voice Activity Detection) to reduce costs
6. **Choose regional endpoints** for lower latency

## 13. Development Gotchas

### ElevenLabs Scribe

1. **No real-time diarisation**: Scribe v2 (streaming) doesn't support speaker identification
2. **Mono audio only**: Stereo not supported for real-time streaming
3. **Pro allocation is monthly**: Unused hours don't roll over
4. **Newer service**: Launched Feb 2025, less production-proven than competitors
5. **Commit strategy**: Must manually commit segments every 20-30s or use VAD

### AssemblyAI

1. **One-time credits**: $50 is not monthly - plan your testing budget
2. **5 concurrent streams**: Will hit limits quickly if testing multiple conversations
3. **Error code 1008**: "Too many concurrent sessions" - implement retry logic
4. **Speaker diarisation needs 15+ seconds**: Speakers need sufficient talk time to be identified
5. **Audio Intelligence is English-only**: Sentiment, summarisation, etc. don't work with other languages
6. **No SLA on free/standard accounts**: Performance can vary

### Deepgram

1. **Higher per-minute cost**: 3x more expensive than AssemblyAI for streaming
2. **Concurrency limits**: 50 WSS API connections, 15 Voice Agent API
3. **Credit tracking**: Monitor usage to avoid unexpected charges
4. **Fewer languages**: Only 36 languages vs 99+ for others

### General

1. **Test with representative audio**: Accuracy varies with accents, background noise
2. **Budget for iteration**: Plan 2-4 weeks of free tier for thorough testing
3. **Implement graceful degradation**: Have fallback for STT failures

## 14. Sources

- [ElevenLabs Speech to Text](https://elevenlabs.io/speech-to-text)
- [ElevenLabs STT Documentation](https://elevenlabs.io/docs/capabilities/speech-to-text)
- [ElevenLabs Realtime Streaming](https://elevenlabs.io/docs/cookbooks/speech-to-text/streaming)
- [ElevenLabs Pricing](https://elevenlabs.io/pricing)
- [ElevenLabs Scribe Launch](https://elevenlabs.io/blog/meet-scribe)
- [AssemblyAI Real-Time Docs](https://www.assemblyai.com/docs/getting-started/transcribe-streaming-audio)
- [AssemblyAI Pricing](https://www.assemblyai.com/pricing)
- [AssemblyAI Concurrency Limits](https://www.assemblyai.com/docs/faq/what-are-my-concurrency-limits)
- [AssemblyAI Speaker Diarisation](https://www.assemblyai.com/docs/speech-to-text/pre-recorded-audio/speaker-diarization)
- [Deepgram Live Streaming](https://developers.deepgram.com/docs/getting-started-with-live-streaming-audio)
- [Deepgram Pricing](https://deepgram.com/pricing)
- [STT Benchmark Comparison](https://www.assemblyai.com/blog/best-api-models-for-real-time-speech-recognition-and-transcription)
- [Whisper Limitations](https://www.healthcare-brew.com/stories/2024/11/18/openai-transcription-tool-whisper-hallucinations)
