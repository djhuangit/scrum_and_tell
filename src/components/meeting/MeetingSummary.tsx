'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Doc } from '../../../convex/_generated/dataModel';

interface MeetingSummaryProps {
  summary: {
    overview: string;
    decisions: string[];
    risks: string[];
    nextSteps: string[];
    generatedAt: number;
  } | null | undefined;
  actionItems?: Doc<'actionItems'>[];
  roomName?: string;
  roomGoal?: string;
  meetingStartedAt?: number;
  meetingEndedAt?: number;
  isLoading?: boolean;
}

/**
 * Component displaying meeting summary with export to clipboard functionality.
 * Shows overview, decisions, risks, and next steps in a structured format.
 */
export function MeetingSummary({
  summary,
  actionItems = [],
  roomName,
  roomGoal,
  meetingStartedAt,
  meetingEndedAt,
  isLoading = false,
}: MeetingSummaryProps) {
  const [copied, setCopied] = useState(false);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const generateMarkdown = useCallback(() => {
    if (!summary) return '';

    const parts: string[] = [];

    parts.push(`# Meeting Summary${roomName ? `: ${roomName}` : ''}`);
    parts.push('');

    if (roomGoal) {
      parts.push(`**Goal:** ${roomGoal}`);
      parts.push('');
    }

    if (meetingStartedAt || meetingEndedAt) {
      const dateStr = meetingStartedAt
        ? formatDate(meetingStartedAt)
        : meetingEndedAt
          ? formatDate(meetingEndedAt)
          : '';
      parts.push(`**Date:** ${dateStr}`);
      parts.push('');
    }

    parts.push('## Overview');
    parts.push('');
    parts.push(summary.overview);
    parts.push('');

    if (summary.decisions.length > 0) {
      parts.push('## Decisions');
      parts.push('');
      summary.decisions.forEach((decision) => {
        parts.push(`- ${decision}`);
      });
      parts.push('');
    }

    if (summary.risks.length > 0) {
      parts.push('## Risks');
      parts.push('');
      summary.risks.forEach((risk) => {
        parts.push(`- ${risk}`);
      });
      parts.push('');
    }

    if (summary.nextSteps.length > 0) {
      parts.push('## Next Steps');
      parts.push('');
      summary.nextSteps.forEach((step) => {
        parts.push(`- ${step}`);
      });
      parts.push('');
    }

    if (actionItems.length > 0) {
      parts.push('## Action Items');
      parts.push('');
      parts.push('| Status | Task | Owner |');
      parts.push('|--------|------|-------|');
      actionItems.forEach((item) => {
        const status = item.status === 'completed' ? 'Done' : 'Pending';
        parts.push(`| ${status} | ${item.task} | ${item.owner} |`);
      });
      parts.push('');
    }

    parts.push('---');
    parts.push(
      `*Generated on ${formatDate(summary.generatedAt)} by Scrum & Tell*`
    );

    return parts.join('\n');
  }, [
    summary,
    actionItems,
    roomName,
    roomGoal,
    meetingStartedAt,
    meetingEndedAt,
  ]);

  const handleCopyToClipboard = async () => {
    const markdown = generateMarkdown();
    if (!markdown) return;

    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col items-center justify-center space-y-4 py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-500" />
          <p className="text-sm text-zinc-500">Generating meeting summary...</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-center text-sm text-zinc-500">
          No summary available. End the meeting to generate a summary.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex items-center justify-between border-b border-zinc-200 p-4 dark:border-zinc-800">
        <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
          Meeting Summary
        </h3>
        <button
          onClick={handleCopyToClipboard}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.span
                key="copied"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-2 text-green-600 dark:text-green-400"
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
                    d="M4.5 12.75l6 6 9-13.5"
                  />
                </svg>
                Copied
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-2"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                  />
                </svg>
                Copy Markdown
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      <div className="space-y-6 p-4">
        <section>
          <h4 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Overview
          </h4>
          <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {summary.overview}
          </p>
        </section>

        {summary.decisions.length > 0 && (
          <section>
            <h4 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Decisions
            </h4>
            <ul className="space-y-1.5">
              {summary.decisions.map((decision, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                  {decision}
                </li>
              ))}
            </ul>
          </section>
        )}

        {summary.risks.length > 0 && (
          <section>
            <h4 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Risks
            </h4>
            <ul className="space-y-1.5">
              {summary.risks.map((risk, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  {risk}
                </li>
              ))}
            </ul>
          </section>
        )}

        {summary.nextSteps.length > 0 && (
          <section>
            <h4 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Next Steps
            </h4>
            <ul className="space-y-1.5">
              {summary.nextSteps.map((step, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                  {step}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Generated {formatDate(summary.generatedAt)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
