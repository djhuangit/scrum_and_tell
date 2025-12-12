'use client';

import Link from 'next/link';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Id } from '../../../../convex/_generated/dataModel';
import { useState } from 'react';
import { useToast } from '@/components/ui/toast';

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: 'draft' | 'active' | 'completed' }) {
  const styles = {
    draft: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

interface RoomCardProps {
  id: Id<'rooms'>;
  name: string;
  goal?: string;
  status: 'draft' | 'active' | 'completed';
  createdAt: number;
  onDelete: (id: Id<'rooms'>) => void;
  isDeleting: boolean;
}

function RoomCard({
  id,
  name,
  goal,
  status,
  createdAt,
  onDelete,
  isDeleting,
}: RoomCardProps) {
  return (
    <div className="group relative rounded-xl border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700">
      <div className="flex items-start justify-between gap-4">
        <Link href={`/dashboard/rooms/${id}`} className="flex-1">
          <h3 className="font-semibold text-zinc-900 group-hover:text-blue-600 dark:text-zinc-50 dark:group-hover:text-blue-400">
            {name}
          </h3>
          {goal && (
            <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
              {goal}
            </p>
          )}
        </Link>
        <StatusBadge status={status} />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-zinc-500 dark:text-zinc-500">
          Created {formatDate(createdAt)}
        </span>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/rooms/${id}`}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            Open
          </Link>
          <button
            onClick={() => onDelete(id)}
            disabled={isDeleting}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20"
            aria-label={`Delete room ${name}`}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RoomsPage() {
  const rooms = useQuery(api.rooms.list);
  const deleteRoom = useMutation(api.rooms.remove);
  const [deletingId, setDeletingId] = useState<Id<'rooms'> | null>(null);
  const { addToast } = useToast();

  const handleDelete = async (id: Id<'rooms'>) => {
    if (!confirm('Are you sure you want to delete this room? This action cannot be undone.')) {
      return;
    }

    setDeletingId(id);
    try {
      await deleteRoom({ id });
      addToast('Room deleted successfully', 'success');
    } catch (error) {
      console.error('Failed to delete room:', error);
      addToast('Failed to delete room. Please try again.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const isLoading = rooms === undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Rooms
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Manage your meeting rooms.
          </p>
        </div>
        <Link
          href="/dashboard/rooms/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
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
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          New Room
        </Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="h-5 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="mt-2 h-4 w-48 rounded bg-zinc-100 dark:bg-zinc-900" />
                </div>
                <div className="h-5 w-16 rounded-full bg-zinc-100 dark:bg-zinc-900" />
              </div>
              <div className="mt-4 h-4 w-24 rounded bg-zinc-100 dark:bg-zinc-900" />
            </div>
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-12 text-center dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
            <svg
              className="h-6 w-6 text-zinc-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            No rooms yet
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Create your first room to get started.
          </p>
          <Link
            href="/dashboard/rooms/new"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Create a room
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
                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
              />
            </svg>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <RoomCard
              key={room._id}
              id={room._id}
              name={room.name}
              goal={room.goal}
              status={room.status}
              createdAt={room.createdAt}
              onDelete={handleDelete}
              isDeleting={deletingId === room._id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
