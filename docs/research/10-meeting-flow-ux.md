# Meeting Flow & UX Research

> State machines, turn-taking, and conversational UX for voice meeting agents

## 1. State Machine Design

### Meeting Phases

```
LOBBY → ACTIVE → ENDED
         ↓
       PAUSED
```

### XState Implementation

```typescript
import { createMachine, assign } from 'xstate';

interface MeetingContext {
  meetingId: string;
  participants: string[];
  currentSpeaker: string | null;
  transcript: string;
  actionItems: ActionItem[];
}

type MeetingEvent =
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'END' }
  | { type: 'SPEAKER_START'; speakerId: string }
  | { type: 'SPEAKER_END' }
  | { type: 'TRANSCRIPT_UPDATE'; text: string }
  | { type: 'ADD_ACTION_ITEM'; item: ActionItem };

const meetingMachine = createMachine({
  id: 'meeting',
  initial: 'lobby',
  context: {
    meetingId: '',
    participants: [],
    currentSpeaker: null,
    transcript: '',
    actionItems: []
  },
  states: {
    lobby: {
      on: {
        START: {
          target: 'active',
          actions: 'notifyMeetingStarted'
        }
      }
    },
    active: {
      initial: 'listening',
      states: {
        listening: {
          on: {
            SPEAKER_START: {
              target: 'speaking',
              actions: assign({
                currentSpeaker: (_, event) => event.speakerId
              })
            }
          }
        },
        speaking: {
          on: {
            SPEAKER_END: {
              target: 'processing',
              actions: assign({ currentSpeaker: null })
            },
            TRANSCRIPT_UPDATE: {
              actions: assign({
                transcript: (ctx, event) => ctx.transcript + ' ' + event.text
              })
            }
          }
        },
        processing: {
          invoke: {
            src: 'processTranscript',
            onDone: {
              target: 'listening',
              actions: 'updateActionItems'
            },
            onError: 'listening'
          }
        }
      },
      on: {
        PAUSE: 'paused',
        END: 'ended'
      }
    },
    paused: {
      on: {
        RESUME: 'active',
        END: 'ended'
      }
    },
    ended: {
      type: 'final',
      entry: 'generateSummary'
    }
  }
});
```

### useReducer Alternative

```typescript
type MeetingState = 'lobby' | 'active' | 'paused' | 'ended';

interface State {
  phase: MeetingState;
  currentSpeaker: string | null;
  transcript: string[];
  actionItems: ActionItem[];
}

type Action =
  | { type: 'START_MEETING' }
  | { type: 'END_MEETING' }
  | { type: 'PAUSE_MEETING' }
  | { type: 'RESUME_MEETING' }
  | { type: 'SET_SPEAKER'; speaker: string | null }
  | { type: 'ADD_TRANSCRIPT'; text: string }
  | { type: 'ADD_ACTION_ITEM'; item: ActionItem };

function meetingReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START_MEETING':
      return { ...state, phase: 'active' };
    case 'END_MEETING':
      return { ...state, phase: 'ended' };
    case 'PAUSE_MEETING':
      return { ...state, phase: 'paused' };
    case 'RESUME_MEETING':
      return { ...state, phase: 'active' };
    case 'SET_SPEAKER':
      return { ...state, currentSpeaker: action.speaker };
    case 'ADD_TRANSCRIPT':
      return { ...state, transcript: [...state.transcript, action.text] };
    case 'ADD_ACTION_ITEM':
      return { ...state, actionItems: [...state.actionItems, action.item] };
    default:
      return state;
  }
}
```

## 2. Turn-Taking Patterns

### Manual Speaker Selection

```typescript
'use client';

import { useState } from 'react';

interface Participant {
  id: string;
  name: string;
}

export function SpeakerSelector({
  participants,
  onSpeakerChange
}: {
  participants: Participant[];
  onSpeakerChange: (speakerId: string | null) => void;
}) {
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);

  const selectSpeaker = (speakerId: string) => {
    setCurrentSpeaker(speakerId);
    onSpeakerChange(speakerId);
  };

  return (
    <div className="speaker-selector">
      <h3>Current Speaker</h3>
      <div className="participants">
        {participants.map(p => (
          <button
            key={p.id}
            className={currentSpeaker === p.id ? 'active' : ''}
            onClick={() => selectSpeaker(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}
```

### Voice Activity Detection (VAD)

```typescript
interface VADOptions {
  threshold: number; // dB threshold for speech detection
  silenceMs: number; // ms of silence before end of speech
}

export function useVoiceActivityDetection(
  audioContext: AudioContext,
  options: VADOptions = { threshold: -50, silenceMs: 500 }
) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    const dataArray = new Float32Array(analyser.frequencyBinCount);
    let silenceStart: number | null = null;

    function checkAudio() {
      analyser.getFloatFrequencyData(dataArray);

      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const speaking = average > options.threshold;

      if (speaking) {
        silenceStart = null;
        if (!isSpeaking) setIsSpeaking(true);
      } else {
        if (!silenceStart) {
          silenceStart = Date.now();
        } else if (Date.now() - silenceStart > options.silenceMs) {
          if (isSpeaking) setIsSpeaking(false);
        }
      }

      requestAnimationFrame(checkAudio);
    }

    checkAudio();
  }, [audioContext, options]);

  return isSpeaking;
}
```

## 3. Conversational UX Best Practices

### Agent Response Timing

- **Don't respond too fast**: 200-500ms pause feels natural
- **Don't respond too slow**: >2s feels broken
- **Use filler phrases** during processing: "Let me think about that..."

```typescript
async function agentRespond(text: string, minDelay: number = 300) {
  const startTime = Date.now();

  // Process response
  const response = await generateResponse(text);

  // Ensure minimum delay for natural feel
  const elapsed = Date.now() - startTime;
  if (elapsed < minDelay) {
    await new Promise(r => setTimeout(r, minDelay - elapsed));
  }

  return response;
}
```

### Confirmation Patterns

```typescript
// Voice confirmation
const confirmationPhrases = [
  "I've noted that as an action item for {owner}. Is that correct?",
  "Just to confirm, you'd like to {action}. Does that sound right?",
  "I heard {summary}. Should I add that to the notes?"
];

// UI confirmation
interface ConfirmationProps {
  message: string;
  onConfirm: () => void;
  onReject: () => void;
}

export function ConfirmationCard({ message, onConfirm, onReject }: ConfirmationProps) {
  return (
    <div className="confirmation-card">
      <p>{message}</p>
      <div className="actions">
        <button onClick={onConfirm}>Yes</button>
        <button onClick={onReject}>No</button>
      </div>
    </div>
  );
}
```

### Error Recovery

```typescript
const errorRecoveryPhrases = {
  transcription_failed: "I didn't quite catch that. Could you repeat?",
  processing_error: "I had trouble processing that. Let me try again.",
  network_error: "We lost connection briefly. I'm reconnecting now.",
  timeout: "That took longer than expected. Let's continue."
};

function handleAgentError(error: Error, type: keyof typeof errorRecoveryPhrases) {
  const phrase = errorRecoveryPhrases[type];
  speakPhrase(phrase);

  // Log for debugging
  console.error(`Agent error (${type}):`, error);
}
```

## 4. Visual Feedback Patterns

### Speaking Indicator

```typescript
interface SpeakingIndicatorProps {
  isSpeaking: boolean;
  speakerName: string;
}

export function SpeakingIndicator({ isSpeaking, speakerName }: SpeakingIndicatorProps) {
  return (
    <div className={`speaking-indicator ${isSpeaking ? 'active' : ''}`}>
      <div className="avatar">
        <div className="pulse-ring" />
        <span>{speakerName[0]}</span>
      </div>
      <span className="name">{speakerName}</span>
      {isSpeaking && <span className="status">Speaking...</span>}
    </div>
  );
}

// CSS
const styles = `
  .speaking-indicator.active .pulse-ring {
    animation: pulse 1.5s ease-out infinite;
  }

  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    100% { transform: scale(1.5); opacity: 0; }
  }
`;
```

### Processing States

```typescript
type ProcessingState = 'idle' | 'listening' | 'processing' | 'speaking';

export function AgentStatus({ state }: { state: ProcessingState }) {
  const statusConfig = {
    idle: { text: 'Ready', icon: '●', color: 'gray' },
    listening: { text: 'Listening', icon: '◉', color: 'green' },
    processing: { text: 'Thinking', icon: '◐', color: 'blue' },
    speaking: { text: 'Speaking', icon: '◆', color: 'purple' }
  };

  const config = statusConfig[state];

  return (
    <div className="agent-status" style={{ color: config.color }}>
      <span className="icon">{config.icon}</span>
      <span className="text">{config.text}</span>
    </div>
  );
}
```

### Action Items Live Update

```typescript
'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface ActionItem {
  id: string;
  task: string;
  owner: string;
  isNew: boolean;
}

export function ActionItemsPanel({ items }: { items: ActionItem[] }) {
  return (
    <div className="action-items-panel">
      <h3>Action Items</h3>
      <AnimatePresence>
        {items.map(item => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className={`action-item ${item.isNew ? 'new' : ''}`}
          >
            <span className="task">{item.task}</span>
            <span className="owner">{item.owner}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
```

## 5. Accessibility Considerations

### Keyboard Navigation

```typescript
export function MeetingControls() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ':
          e.preventDefault();
          toggleRecording();
          break;
        case 'Escape':
          endMeeting();
          break;
        case 'm':
          toggleMute();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div role="toolbar" aria-label="Meeting controls">
      <button aria-label="Toggle recording (Space)">Record</button>
      <button aria-label="Toggle mute (M)">Mute</button>
      <button aria-label="End meeting (Escape)">End</button>
    </div>
  );
}
```

### Screen Reader Announcements

```typescript
function announceToScreenReader(message: string) {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);
  setTimeout(() => announcement.remove(), 1000);
}

// Usage
announceToScreenReader('New action item added: Review documentation');
announceToScreenReader('Sarah is now speaking');
```

### Non-Voice Fallbacks

```typescript
export function TranscriptInput({
  onSubmit
}: {
  onSubmit: (text: string) => void;
}) {
  const [text, setText] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(text);
        setText('');
      }}
    >
      <label htmlFor="transcript-input" className="sr-only">
        Type your update instead of speaking
      </label>
      <input
        id="transcript-input"
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type your update..."
      />
      <button type="submit">Submit</button>
    </form>
  );
}
```

## 6. Mobile Considerations

### Touch-Friendly Controls

```typescript
export function MobileMeetingControls() {
  return (
    <div className="mobile-controls">
      {/* Large touch targets (min 44x44px) */}
      <button className="control-btn record">
        <MicIcon />
        <span>Record</span>
      </button>

      <button className="control-btn end">
        <EndCallIcon />
        <span>End</span>
      </button>
    </div>
  );
}

// CSS
const styles = `
  .control-btn {
    min-width: 64px;
    min-height: 64px;
    padding: 16px;
    border-radius: 50%;
  }
`;
```

### Responsive Layout

```typescript
export function MeetingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="meeting-layout">
      <main className="meeting-main">
        {/* Avatar/video takes priority on mobile */}
        <div className="avatar-section">{/* Avatar component */}</div>

        {/* Transcript collapses on mobile */}
        <div className="transcript-section">{/* Transcript component */}</div>
      </main>

      {/* Controls always visible */}
      <footer className="meeting-controls">{/* Control buttons */}</footer>
    </div>
  );
}
```

## 7. Sources

- [XState Documentation](https://xstate.js.org/docs/)
- [Google Voice UI Design Guidelines](https://developers.google.com/assistant/conversational/design)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Web Speech API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
