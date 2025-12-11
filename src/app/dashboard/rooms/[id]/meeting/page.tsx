'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { useState, useCallback } from 'react';
import { api } from '../../../../../../convex/_generated/api';
import { Id } from '../../../../../../convex/_generated/dataModel';
import { AnamAvatar } from '@/components/avatar/AnamAvatar';
import { type AnamMessage, type AnamConnectionState } from '@/hooks/use-anam';

export default function MeetingPage() {
  const params = useParams();
  const roomId = params.id as Id<'rooms'>;

  const room = useQuery(api.rooms.get, { id: roomId });
  const [messages, setMessages] = useState<AnamMessage[]>([]);
  const [connectionState, setConnectionState] =
    useState<AnamConnectionState>('idle');

  const handleMessage = useCallback((message: AnamMessage) => {
    setMessages((prev) => {
      const existing = prev.find((m) => m.id === message.id);
      if (existing) {
        return prev.map((m) => (m.id === message.id ? message : m));
      }
      return [...prev, message];
    });
  }, []);

  const handleConnectionChange = useCallback((state: AnamConnectionState) => {
    setConnectionState(state);
  }, []);

  if (room === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-50" />
      </div>
    );
  }

  if (room === null) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Room not found
          </h2>
          <Link
            href="/dashboard/rooms"
            className="mt-4 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Back to rooms
          </Link>
        </div>
      </div>
    );
  }

  const roomContext = room.contextSummary
    ? `Meeting: ${room.name}\nGoal: ${room.goal || 'Not specified'}\n\nContext:\n${room.contextSummary}`
    : `Meeting: ${room.name}\nGoal: ${room.goal || 'Not specified'}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {room.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {connectionState === 'connected'
              ? 'Meeting in progress'
              : connectionState === 'connecting'
                ? 'Connecting to avatar...'
                : 'Connect to start the meeting'}
          </p>
        </div>
        <Link
          href={`/dashboard/rooms/${roomId}`}
          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900"
        >
          End Meeting
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <AnamAvatar
            roomContext={roomContext}
            onMessage={handleMessage}
            onConnectionChange={handleConnectionChange}
          />

          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
              Voice Input
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {connectionState === 'connected'
                ? 'Speak to the avatar - your microphone is active when unmuted.'
                : 'Connect to the avatar to start voice interaction.'}
            </p>
            {connectionState === 'connected' && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
                <svg
                  className="h-4 w-4"
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
                Voice input active - speak naturally to interact
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
              Action Items
            </h3>
            <div className="mt-4 text-center text-sm text-zinc-500">
              Action items will appear here as the meeting progresses.
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
              Transcript
            </h3>
            <div className="mt-4 max-h-96 space-y-3 overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-center text-sm text-zinc-500">
                  {connectionState === 'connected'
                    ? 'Conversation will appear here...'
                    : 'Connect to see the transcript.'}
                </p>
              ) : (
                messages
                  .filter((m) => m.endOfSpeech)
                  .map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-lg p-3 text-sm ${
                        message.role === 'assistant'
                          ? 'bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-200'
                          : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-200'
                      }`}
                    >
                      <p className="mb-1 text-xs font-medium uppercase opacity-60">
                        {message.role === 'assistant' ? 'Facilitator' : 'You'}
                      </p>
                      {message.content}
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
