'use client';

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type AnamMessage } from '@/hooks/use-anam';

interface TranscriptPanelProps {
  messages: AnamMessage[];
  isConnected: boolean;
}

/**
 * Panel displaying the meeting transcript with animated message entries.
 * Shows both completed and in-progress messages. Auto-scrolls to latest.
 */
export function TranscriptPanel({ messages, isConnected }: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const displayMessages = messages.filter((m) => m.content.trim().length > 0);
  const completedCount = displayMessages.filter((m) => m.endOfSpeech).length;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [displayMessages.length, displayMessages[displayMessages.length - 1]?.content]);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
          Transcript
        </h3>
        {completedCount > 0 && (
          <span className="text-xs text-zinc-500">
            {completedCount} messages
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="mt-4 max-h-96 space-y-3 overflow-y-auto scroll-smooth"
      >
        {displayMessages.length === 0 ? (
          <p className="text-center text-sm text-zinc-500">
            {isConnected
              ? 'Conversation will appear here...'
              : 'Connect to see the transcript.'}
          </p>
        ) : (
          <AnimatePresence mode="popLayout">
            {displayMessages.map((message) => (
              <motion.div
                key={message.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={`rounded-lg p-3 text-sm ${
                  message.role === 'assistant'
                    ? 'bg-blue-50 text-blue-900 dark:bg-blue-900/20 dark:text-blue-200'
                    : 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-200'
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <p className="text-xs font-medium uppercase opacity-60">
                    {message.role === 'assistant' ? 'Facilitator' : 'You'}
                  </p>
                  {!message.endOfSpeech && (
                    <span className="flex items-center gap-1 text-xs opacity-60">
                      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                      speaking
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
