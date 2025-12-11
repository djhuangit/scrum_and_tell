'use client';

import { useMutation } from 'convex/react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../../convex/_generated/api';
import { Id, Doc } from '../../../convex/_generated/dataModel';

interface ActionItemsPanelProps {
  actionItems: Doc<'actionItems'>[];
  meetingId: Id<'meetings'> | null;
  isReadOnly?: boolean;
}

/**
 * Panel displaying action items with animated additions and status toggles.
 * Uses framer-motion for smooth entry/exit animations.
 */
export function ActionItemsPanel({
  actionItems,
  meetingId,
  isReadOnly = false,
}: ActionItemsPanelProps) {
  const updateStatus = useMutation(api.actionItems.updateStatus);

  const handleToggleStatus = async (item: Doc<'actionItems'>) => {
    if (isReadOnly) return;

    await updateStatus({
      id: item._id,
      status: item.status === 'pending' ? 'completed' : 'pending',
    });
  };

  const pendingItems = actionItems.filter((item) => item.status === 'pending');
  const completedItems = actionItems.filter(
    (item) => item.status === 'completed'
  );

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
          Action Items
        </h3>
        {actionItems.length > 0 && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            {pendingItems.length} pending
          </span>
        )}
      </div>

      <div className="mt-4 max-h-[400px] space-y-2 overflow-y-auto">
        {actionItems.length === 0 ? (
          <p className="text-center text-sm text-zinc-500">
            {meetingId
              ? 'Action items will appear here as the meeting progresses.'
              : 'Start a meeting to track action items.'}
          </p>
        ) : (
          <AnimatePresence mode="popLayout">
            {pendingItems.map((item) => (
              <motion.div
                key={item._id}
                layout
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="group flex items-start gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <button
                  onClick={() => handleToggleStatus(item)}
                  disabled={isReadOnly}
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-300 transition-colors hover:border-zinc-400 disabled:cursor-not-allowed dark:border-zinc-600 dark:hover:border-zinc-500"
                >
                  <span className="sr-only">Mark as completed</span>
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-900 dark:text-zinc-100">
                    {item.task}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Owner: {item.owner}
                  </p>
                </div>
              </motion.div>
            ))}

            {completedItems.length > 0 && pendingItems.length > 0 && (
              <div className="my-3 border-t border-zinc-200 dark:border-zinc-700" />
            )}

            {completedItems.map((item) => (
              <motion.div
                key={item._id}
                layout
                initial={{ opacity: 0, y: -10, scale: 0.95 }}
                animate={{ opacity: 0.6, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="group flex items-start gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <button
                  onClick={() => handleToggleStatus(item)}
                  disabled={isReadOnly}
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-green-500 bg-green-500 text-white transition-colors disabled:cursor-not-allowed"
                >
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={3}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-500 line-through dark:text-zinc-400">
                    {item.task}
                  </p>
                  <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                    Owner: {item.owner}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
