'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

/**
 * Meeting status from Convex database
 */
export type MeetingStatus = 'lobby' | 'active' | 'paused' | 'ended';

/**
 * Sub-states for when meeting is active
 */
export type ActiveSubState = 'listening' | 'speaking' | 'processing';

/**
 * Combined meeting state for UI
 */
export interface MeetingState {
  status: MeetingStatus;
  activeSubState: ActiveSubState | null;
  meetingId: Id<'meetings'> | null;
  startedAt: number | null;
  endedAt: number | null;
}

interface UseMeetingStateOptions {
  roomId: Id<'rooms'>;
  onStateChange?: (state: MeetingState) => void;
}

interface UseMeetingStateReturn {
  state: MeetingState;
  createMeeting: () => Promise<Id<'meetings'>>;
  startMeeting: () => Promise<void>;
  pauseMeeting: () => Promise<void>;
  endMeeting: () => Promise<void>;
  setActiveSubState: (subState: ActiveSubState | null) => void;
  isLoading: boolean;
}

/**
 * Hook for managing meeting state machine.
 *
 * States: lobby -> active -> ended
 * Sub-states for active: listening -> speaking -> processing
 *
 * @param options - Configuration options including roomId
 * @returns Meeting state and control methods
 */
export function useMeetingState(
  options: UseMeetingStateOptions
): UseMeetingStateReturn {
  const { roomId, onStateChange } = options;

  const [activeSubState, setActiveSubStateInternal] =
    useState<ActiveSubState | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const activeMeeting = useQuery(api.meetings.getActive, { roomId });
  const createMeetingMutation = useMutation(api.meetings.create);
  const startMeetingMutation = useMutation(api.meetings.start);
  const pauseMeetingMutation = useMutation(api.meetings.pause);
  const endMeetingMutation = useMutation(api.meetings.end);

  const previousStateRef = useRef<MeetingState | null>(null);

  const state: MeetingState = useMemo(
    () => ({
      status: activeMeeting?.status ?? 'lobby',
      activeSubState: activeMeeting?.status === 'active' ? activeSubState : null,
      meetingId: activeMeeting?._id ?? null,
      startedAt: activeMeeting?.startedAt ?? null,
      endedAt: activeMeeting?.endedAt ?? null,
    }),
    [activeMeeting?.status, activeMeeting?._id, activeMeeting?.startedAt, activeMeeting?.endedAt, activeSubState]
  );

  useEffect(() => {
    const prevState = previousStateRef.current;
    const hasChanged =
      !prevState ||
      prevState.status !== state.status ||
      prevState.activeSubState !== state.activeSubState ||
      prevState.meetingId !== state.meetingId;

    if (hasChanged) {
      previousStateRef.current = state;
      onStateChange?.(state);
    }
  }, [state, onStateChange]);

  const createMeeting = useCallback(async (): Promise<Id<'meetings'>> => {
    setIsLoading(true);
    try {
      const meetingId = await createMeetingMutation({ roomId });
      return meetingId;
    } finally {
      setIsLoading(false);
    }
  }, [createMeetingMutation, roomId]);

  const startMeeting = useCallback(async (): Promise<void> => {
    if (!activeMeeting?._id) {
      throw new Error('No meeting to start');
    }

    setIsLoading(true);
    try {
      await startMeetingMutation({ id: activeMeeting._id });
      setActiveSubStateInternal('listening');
    } finally {
      setIsLoading(false);
    }
  }, [startMeetingMutation, activeMeeting?._id]);

  const pauseMeeting = useCallback(async (): Promise<void> => {
    if (!activeMeeting?._id) {
      throw new Error('No meeting to pause');
    }

    setIsLoading(true);
    try {
      await pauseMeetingMutation({ id: activeMeeting._id });
      setActiveSubStateInternal(null);
    } finally {
      setIsLoading(false);
    }
  }, [pauseMeetingMutation, activeMeeting?._id]);

  const endMeeting = useCallback(async (): Promise<void> => {
    if (!activeMeeting?._id) {
      throw new Error('No meeting to end');
    }

    setIsLoading(true);
    try {
      await endMeetingMutation({ id: activeMeeting._id });
      setActiveSubStateInternal(null);
    } finally {
      setIsLoading(false);
    }
  }, [endMeetingMutation, activeMeeting?._id]);

  const setActiveSubState = useCallback(
    (subState: ActiveSubState | null): void => {
      if (activeMeeting?.status === 'active') {
        setActiveSubStateInternal(subState);
      }
    },
    [activeMeeting?.status]
  );

  return {
    state,
    createMeeting,
    startMeeting,
    pauseMeeting,
    endMeeting,
    setActiveSubState,
    isLoading,
  };
}
