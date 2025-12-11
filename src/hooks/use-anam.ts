'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  createClient,
  AnamEvent,
  MessageRole,
  type MessageStreamEvent,
  type AnamClient,
} from '@anam-ai/js-sdk';

export type AnamConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'disconnected';

export interface AnamMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
  endOfSpeech: boolean;
}

interface UseAnamOptions {
  onMessage?: (message: AnamMessage) => void;
  onConnectionChange?: (state: AnamConnectionState) => void;
  onError?: (error: Error) => void;
}

interface SessionTokenResponse {
  sessionToken: string;
  personaConfig: {
    name: string;
    avatarId: string;
    voiceId: string;
  };
}

/**
 * Hook for managing Anam AI avatar connection lifecycle.
 * Provides methods to connect, disconnect, and interact with the avatar.
 */
export function useAnam(options: UseAnamOptions = {}) {
  const { onMessage, onConnectionChange, onError } = options;

  const [connectionState, setConnectionState] =
    useState<AnamConnectionState>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const clientRef = useRef<AnamClient | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const updateConnectionState = useCallback(
    (state: AnamConnectionState) => {
      setConnectionState(state);
      onConnectionChange?.(state);
    },
    [onConnectionChange]
  );

  const handleError = useCallback(
    (error: Error) => {
      console.error('Anam error:', error);
      updateConnectionState('error');
      onError?.(error);
    },
    [updateConnectionState, onError]
  );

  const fetchSessionToken = useCallback(
    async (roomContext?: string): Promise<SessionTokenResponse> => {
      const response = await fetch('/api/anam/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomContext }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to get session token');
      }

      return response.json();
    },
    []
  );

  const connect = useCallback(
    async (
      videoElement: HTMLVideoElement,
      roomContext?: string
    ): Promise<void> => {
      if (clientRef.current) {
        console.warn('Anam client already exists');
        return;
      }

      try {
        updateConnectionState('connecting');
        videoRef.current = videoElement;

        const { sessionToken } = await fetchSessionToken(roomContext);
        const client = createClient(sessionToken);
        clientRef.current = client;

        client.addListener(AnamEvent.CONNECTION_ESTABLISHED, () => {
          updateConnectionState('connected');
        });

        client.addListener(AnamEvent.CONNECTION_CLOSED, (reason, details) => {
          console.log('Connection closed:', reason, details);
          updateConnectionState('disconnected');
          clientRef.current = null;
        });

        client.addListener(AnamEvent.SESSION_READY, (id) => {
          setSessionId(id);
        });

        client.addListener(
          AnamEvent.MESSAGE_STREAM_EVENT_RECEIVED,
          (event: MessageStreamEvent) => {
            const message: AnamMessage = {
              id: event.id,
              content: event.content,
              role: event.role === MessageRole.PERSONA ? 'assistant' : 'user',
              timestamp: Date.now(),
              endOfSpeech: event.endOfSpeech,
            };
            onMessage?.(message);
          }
        );

        client.addListener(AnamEvent.MIC_PERMISSION_DENIED, (error) => {
          handleError(new Error(`Microphone permission denied: ${error}`));
        });

        const videoId = videoElement.id || 'anam-video';
        if (!videoElement.id) {
          videoElement.id = videoId;
        }

        await client.streamToVideoElement(videoId);
      } catch (error) {
        handleError(
          error instanceof Error ? error : new Error('Connection failed')
        );
        throw error;
      }
    },
    [
      fetchSessionToken,
      updateConnectionState,
      handleError,
      onMessage,
    ]
  );

  const disconnect = useCallback(async (): Promise<void> => {
    if (!clientRef.current) return;

    try {
      await clientRef.current.stopStreaming();
    } catch (error) {
      console.error('Error stopping stream:', error);
    } finally {
      clientRef.current = null;
      videoRef.current = null;
      setSessionId(null);
      updateConnectionState('idle');
    }
  }, [updateConnectionState]);

  const talk = useCallback(async (content: string): Promise<void> => {
    if (!clientRef.current) {
      throw new Error('Not connected to avatar');
    }

    await clientRef.current.talk(content);
  }, []);

  const sendMessage = useCallback((content: string): void => {
    if (!clientRef.current) {
      throw new Error('Not connected to avatar');
    }

    clientRef.current.sendUserMessage(content);
  }, []);

  const interrupt = useCallback((): void => {
    if (!clientRef.current) return;
    clientRef.current.interruptPersona();
  }, []);

  const mute = useCallback((): void => {
    if (!clientRef.current) return;
    clientRef.current.muteInputAudio();
    setIsMuted(true);
  }, []);

  const unmute = useCallback((): void => {
    if (!clientRef.current) return;
    clientRef.current.unmuteInputAudio();
    setIsMuted(false);
  }, []);

  const toggleMute = useCallback((): void => {
    if (isMuted) {
      unmute();
    } else {
      mute();
    }
  }, [isMuted, mute, unmute]);

  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.stopStreaming().catch(console.error);
      }
    };
  }, []);

  return {
    connectionState,
    sessionId,
    isMuted,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting',
    connect,
    disconnect,
    talk,
    sendMessage,
    interrupt,
    mute,
    unmute,
    toggleMute,
  };
}
