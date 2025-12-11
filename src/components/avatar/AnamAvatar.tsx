'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useAnam, type AnamConnectionState, type AnamMessage } from '@/hooks/use-anam';

interface AnamAvatarProps {
  roomContext?: string;
  onMessage?: (message: AnamMessage) => void;
  onConnectionChange?: (state: AnamConnectionState) => void;
  autoConnect?: boolean;
  className?: string;
}

/**
 * Renders an Anam AI avatar with video display and connection controls.
 * Handles the avatar lifecycle including connection, streaming, and cleanup.
 */
export function AnamAvatar({
  roomContext,
  onMessage,
  onConnectionChange,
  autoConnect = false,
  className = '',
}: AnamAvatarProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const hasConnectedRef = useRef(false);

  const {
    connectionState,
    isConnected,
    isConnecting,
    isMuted,
    connect,
    disconnect,
    toggleMute,
    interrupt,
  } = useAnam({
    onMessage,
    onConnectionChange,
    onError: (err) => setError(err.message),
  });

  const handleConnect = useCallback(async () => {
    if (!videoRef.current) {
      setError('Video element not ready');
      return;
    }

    setError(null);
    try {
      await connect(videoRef.current, roomContext);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    }
  }, [connect, roomContext]);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
  }, [disconnect]);

  useEffect(() => {
    if (autoConnect && !hasConnectedRef.current && videoRef.current) {
      hasConnectedRef.current = true;
      // Defer to avoid synchronous setState in effect body
      queueMicrotask(() => {
        handleConnect();
      });
    }
  }, [autoConnect, handleConnect]);

  useEffect(() => {
    return () => {
      if (isConnected) {
        disconnect();
      }
    };
  }, [isConnected, disconnect]);

  return (
    <div className={`relative ${className}`}>
      <div className="aspect-video overflow-hidden rounded-xl bg-zinc-900">
        <video
          ref={videoRef}
          id="anam-avatar-video"
          autoPlay
          playsInline
          className="h-full w-full object-cover"
        />

        {!isConnected && !isConnecting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/80">
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-zinc-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
              <p className="mt-2 text-sm text-zinc-400">
                {error || 'Avatar not connected'}
              </p>
              <button
                onClick={handleConnect}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Connect Avatar
              </button>
            </div>
          </div>
        )}

        {isConnecting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/80">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-600 border-t-blue-500" />
            <p className="mt-3 text-sm text-zinc-400">Connecting to avatar...</p>
          </div>
        )}
      </div>

      {isConnected && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2">
          <button
            onClick={toggleMute}
            className={`rounded-full p-3 transition-colors ${
              isMuted
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-zinc-800/80 text-white hover:bg-zinc-700/80'
            }`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 19L5 5m14 0v4a2 2 0 01-2 2H7m0 0v2a4 4 0 008 0v-2m-8 0H5a2 2 0 01-2-2V9a2 2 0 012-2h2m10 10v2a4 4 0 01-8 0v-2m8 0H7"
                />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                />
              </svg>
            )}
          </button>

          <button
            onClick={interrupt}
            className="rounded-full bg-zinc-800/80 p-3 text-white transition-colors hover:bg-zinc-700/80"
            title="Interrupt avatar"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z"
              />
            </svg>
          </button>

          <button
            onClick={handleDisconnect}
            className="rounded-full bg-red-600/80 p-3 text-white transition-colors hover:bg-red-500/80"
            title="Disconnect avatar"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
              />
            </svg>
          </button>
        </div>
      )}

      {connectionState === 'error' && error && (
        <div className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
