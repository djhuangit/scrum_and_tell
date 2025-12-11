'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function MeetingPage() {
  const params = useParams();
  const roomId = params.id as string;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Active Meeting
        </h1>
        <Link
          href={`/dashboard/rooms/${roomId}`}
          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-400 dark:hover:bg-red-900"
        >
          End Meeting
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="aspect-video rounded-xl border border-zinc-200 bg-zinc-900 dark:border-zinc-800">
            <div className="flex h-full items-center justify-center text-zinc-500">
              Avatar will appear here
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
              Your Turn
            </h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Press and hold to record your update.
            </p>
            <button className="mt-4 w-full rounded-lg bg-blue-600 py-4 text-white transition-colors hover:bg-blue-700 active:bg-blue-800">
              Hold to Record
            </button>
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
            <div className="mt-4 max-h-64 overflow-y-auto text-sm text-zinc-500">
              Live transcript will appear here.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
