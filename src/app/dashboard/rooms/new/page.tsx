'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation } from 'convex/react';
import { api } from '../../../../../convex/_generated/api';

export default function NewRoomPage() {
  const router = useRouter();
  const createRoom = useMutation(api.rooms.create);

  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Room name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const roomId = await createRoom({
        name: name.trim(),
        goal: goal.trim() || undefined,
      });
      router.push(`/dashboard/rooms/${roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create room');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/rooms"
          className="inline-flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
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
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
          Back to rooms
        </Link>
      </div>

      <div className="max-w-xl">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Create New Room
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Set up a new meeting room with context for your discussions.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-zinc-900 dark:text-zinc-50"
            >
              Room Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Sprint Planning, Design Review"
              className="mt-2 block w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
              maxLength={100}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label
              htmlFor="goal"
              className="block text-sm font-medium text-zinc-900 dark:text-zinc-50"
            >
              Meeting Goal{' '}
              <span className="text-zinc-500 dark:text-zinc-400">
                (optional)
              </span>
            </label>
            <textarea
              id="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g., Define tasks for the next sprint and assign owners"
              rows={3}
              className="mt-2 block w-full resize-none rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
              maxLength={500}
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              The goal helps the AI facilitator guide the discussion.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Creating...
                </>
              ) : (
                'Create Room'
              )}
            </button>
            <Link
              href="/dashboard/rooms"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
