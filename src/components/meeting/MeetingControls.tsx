'use client';

import { type MeetingState, type ActiveSubState } from '@/hooks/use-meeting-state';
import { type AnamConnectionState } from '@/hooks/use-anam';

interface MeetingControlsProps {
  meetingState: MeetingState;
  connectionState: AnamConnectionState;
  isLoading: boolean;
  isMuted: boolean;
  onCreateMeeting: () => Promise<void>;
  onStartMeeting: () => Promise<void>;
  onPauseMeeting: () => Promise<void>;
  onEndMeeting: () => Promise<void>;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onToggleMute: () => void;
  onInterrupt: () => void;
}

/**
 * Meeting control panel with start/pause/end buttons and connection controls.
 */
export function MeetingControls({
  meetingState,
  connectionState,
  isLoading,
  isMuted,
  onCreateMeeting,
  onStartMeeting,
  onPauseMeeting,
  onEndMeeting,
  onConnect,
  onDisconnect,
  onToggleMute,
  onInterrupt,
}: MeetingControlsProps) {
  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';

  const getStatusMessage = (): string => {
    if (meetingState.status === 'ended') {
      return 'Meeting ended';
    }
    if (meetingState.status === 'lobby') {
      if (isConnected) {
        return 'Ready to start meeting';
      }
      if (isConnecting) {
        return 'Connecting to avatar...';
      }
      return 'Connect to avatar to start';
    }
    if (meetingState.status === 'active') {
      return getActiveSubStateMessage(meetingState.activeSubState);
    }
    if (meetingState.status === 'paused') {
      return 'Meeting paused';
    }
    return 'Unknown state';
  };

  const getActiveSubStateMessage = (subState: ActiveSubState | null): string => {
    switch (subState) {
      case 'listening':
        return 'Listening to participants...';
      case 'speaking':
        return 'Facilitator is speaking...';
      case 'processing':
        return 'Processing response...';
      default:
        return 'Meeting in progress';
    }
  };

  const handleStartOrCreate = async () => {
    if (!meetingState.meetingId) {
      await onCreateMeeting();
    }
    await onStartMeeting();
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
          Meeting Controls
        </h3>
        <StatusIndicator state={meetingState} connectionState={connectionState} />
      </div>

      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {getStatusMessage()}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {!isConnected && meetingState.status !== 'ended' && (
          <button
            onClick={onConnect}
            disabled={isConnecting || isLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isConnecting ? (
              <>
                <LoadingSpinner />
                Connecting...
              </>
            ) : (
              'Connect Avatar'
            )}
          </button>
        )}

        {isConnected && meetingState.status === 'lobby' && (
          <button
            onClick={handleStartOrCreate}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? <LoadingSpinner /> : null}
            Start Meeting
          </button>
        )}

        {isConnected && meetingState.status === 'active' && (
          <>
            <button
              onClick={onPauseMeeting}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Pause
            </button>
            <button
              onClick={onEndMeeting}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              End Meeting
            </button>
          </>
        )}

        {isConnected && meetingState.status === 'paused' && (
          <>
            <button
              onClick={onStartMeeting}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Resume
            </button>
            <button
              onClick={onEndMeeting}
              disabled={isLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              End Meeting
            </button>
          </>
        )}

        {isConnected && (
          <>
            <button
              onClick={onToggleMute}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isMuted
                  ? 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
              }`}
            >
              {isMuted ? (
                <MicOffIcon className="h-4 w-4" />
              ) : (
                <MicIcon className="h-4 w-4" />
              )}
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
            <button
              onClick={onInterrupt}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Interrupt
            </button>
            <button
              onClick={onDisconnect}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Disconnect
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function StatusIndicator({
  state,
  connectionState,
}: {
  state: MeetingState;
  connectionState: AnamConnectionState;
}) {
  const getStatusColour = (): string => {
    if (state.status === 'ended') return 'bg-zinc-400';
    if (connectionState !== 'connected') return 'bg-zinc-400';
    if (state.status === 'active') return 'bg-green-500';
    if (state.status === 'paused') return 'bg-amber-500';
    return 'bg-blue-500';
  };

  const getStatusText = (): string => {
    if (state.status === 'ended') return 'Ended';
    if (connectionState !== 'connected') return 'Disconnected';
    if (state.status === 'active') return 'Active';
    if (state.status === 'paused') return 'Paused';
    return 'Ready';
  };

  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${getStatusColour()}`} />
      <span className="text-xs text-zinc-500 dark:text-zinc-400">
        {getStatusText()}
      </span>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
      />
    </svg>
  );
}

function MicOffIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3zM19 6.75L5 17.25"
      />
    </svg>
  );
}
