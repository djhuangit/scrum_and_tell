# Browser Audio APIs Research

> Web Audio API and MediaRecorder for voice meeting agents

## 1. Overview

Modern browsers provide robust APIs for audio capture and processing:
- **Web Audio API**: Low-level audio processing and analysis
- **MediaRecorder API**: High-level recording interface
- **getUserMedia**: Microphone access

## 2. Web Audio API Basics

### AudioContext

```typescript
const audioContext = new AudioContext({ sampleRate: 16000 });

// Resume after user interaction (required by browsers)
if (audioContext.state === 'suspended') {
  await audioContext.resume();
}
```

### getUserMedia for Microphone

```typescript
async function getMicrophoneStream(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 16000,
      channelCount: 1
    }
  });
  return stream;
}
```

### Audio Processing Pipeline

```typescript
async function setupAudioProcessing() {
  const audioContext = new AudioContext({ sampleRate: 16000 });
  const stream = await getMicrophoneStream();

  // Create nodes
  const sourceNode = audioContext.createMediaStreamSource(stream);
  const gainNode = audioContext.createGain();
  const analyserNode = audioContext.createAnalyser();

  // Connect: source -> gain -> analyser -> destination
  sourceNode.connect(gainNode);
  gainNode.connect(analyserNode);
  analyserNode.connect(audioContext.destination);

  return { audioContext, sourceNode, gainNode, analyserNode, stream };
}
```

## 3. MediaRecorder API

### Basic Recording

```typescript
class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const mimeType = this.getSupportedMimeType();
    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
    this.chunks = [];

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.mediaRecorder.start();
  }

  stop(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) return;

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mediaRecorder!.mimeType });
        this.stream?.getTracks().forEach(track => track.stop());
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  private getSupportedMimeType(): string {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ];
    return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
  }
}
```

### Streaming Chunks for Real-Time STT

```typescript
class StreamingRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;

  async start(onChunk: (chunk: Blob) => void): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: 'audio/webm;codecs=opus'
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        onChunk(event.data);
      }
    };

    // Request data every 100ms for low-latency streaming
    this.mediaRecorder.start(100);
  }

  stop(): void {
    this.mediaRecorder?.stop();
    this.stream?.getTracks().forEach(track => track.stop());
  }
}
```

## 4. Browser Compatibility

### Support Matrix

| API | Chrome | Firefox | Safari | Edge |
|-----|--------|---------|--------|------|
| Web Audio API | 14+ | 25+ | 6.1+ | All |
| getUserMedia | 53+ | 36+ | 11+ | 12+ |
| MediaRecorder | 47+ | 25+ | 14.1+ | 79+ |
| AudioWorklet | 66+ | 76+ | 14.1+ | 79+ |

### Safari Quirks

```typescript
// Safari requires webkit prefix for older versions
const AudioContext = window.AudioContext || (window as any).webkitAudioContext;

// Safari MediaRecorder limited MIME type support
function getSafariCompatibleMimeType(): string {
  if (MediaRecorder.isTypeSupported('audio/mp4')) {
    return 'audio/mp4';
  }
  return ''; // Use browser default
}
```

## 5. Audio Formats

| Format | Size | Quality | Browser Support |
|--------|------|---------|-----------------|
| WebM/Opus | Smallest | Excellent | Chrome, Firefox, Safari 14.1+, Edge |
| MP3 | Medium | Good | All |
| WAV | Largest | Lossless | All |

### Format Recommendation

Use WebM/Opus for modern apps:
- Best compression (6% of MP3 size)
- Excellent voice quality
- Native browser support

## 6. React Hook Implementation

```typescript
import { useState, useRef, useCallback, useEffect } from 'react';

interface UseAudioRecorderOptions {
  onDataAvailable?: (blob: Blob) => void;
  timeslice?: number; // ms between chunks
}

interface UseAudioRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
}

export function useAudioRecorder(
  options: UseAudioRecorderOptions = {}
): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      streamRef.current = stream;

      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
        .find(t => MediaRecorder.isTypeSupported(t)) || '';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          options.onDataAvailable?.(event.data);
        }
      };

      mediaRecorder.start(options.timeslice || 1000);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }, [options]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mediaRecorderRef.current?.mimeType || 'audio/webm'
        });

        streamRef.current?.getTracks().forEach(track => track.stop());
        setIsRecording(false);
        setIsPaused(false);

        if (timerRef.current) {
          clearInterval(timerRef.current);
        }

        resolve(blob);
      };

      mediaRecorderRef.current.stop();
    });
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(track => track.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return {
    isRecording,
    isPaused,
    recordingTime,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording
  };
}
```

## 7. Error Handling

### getUserMedia Errors

```typescript
async function requestMicrophone() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return stream;
  } catch (error) {
    if (error instanceof DOMException) {
      switch (error.name) {
        case 'NotAllowedError':
          throw new Error('Microphone permission denied');
        case 'NotFoundError':
          throw new Error('No microphone found');
        case 'NotReadableError':
          throw new Error('Microphone in use by another application');
        case 'OverconstrainedError':
          throw new Error('Audio constraints cannot be satisfied');
        case 'SecurityError':
          throw new Error('Microphone access requires HTTPS');
        default:
          throw new Error(`Microphone error: ${error.message}`);
      }
    }
    throw error;
  }
}
```

### Permission Check

```typescript
async function checkMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt'> {
  try {
    const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return result.state;
  } catch {
    // Permissions API not supported
    return 'prompt';
  }
}
```

## 8. Audio Visualisation

```typescript
function createAudioVisualiser(
  analyserNode: AnalyserNode,
  canvas: HTMLCanvasElement
) {
  const canvasCtx = canvas.getContext('2d')!;
  analyserNode.fftSize = 256;
  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function draw() {
    requestAnimationFrame(draw);

    analyserNode.getByteFrequencyData(dataArray);

    canvasCtx.fillStyle = '#1a1a1a';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / bufferLength) * 2.5;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height;

      canvasCtx.fillStyle = `rgb(50, ${dataArray[i] + 100}, 150)`;
      canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

      x += barWidth + 1;
    }
  }

  draw();
}
```

## 9. Best Practices

1. **Always request user interaction** before creating AudioContext
2. **Handle permission denials** gracefully with fallback UI
3. **Use appropriate sample rates** (16kHz for STT, 44.1kHz for music)
4. **Clean up resources** when component unmounts
5. **Test across browsers** especially Safari
6. **Provide visual feedback** during recording

## 10. Sources

- [Web Audio API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [MediaRecorder API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API)
- [getUserMedia - MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [Can I Use - Audio API](https://caniuse.com/audio-api)
