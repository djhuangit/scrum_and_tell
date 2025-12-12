'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { useState, useCallback, useRef } from 'react';
import { api } from '../../../../../../convex/_generated/api';
import { Id } from '../../../../../../convex/_generated/dataModel';
import { AnamAvatar } from '@/components/avatar/AnamAvatar';
import { ActionItemsPanel } from '@/components/meeting/ActionItemsPanel';
import { TranscriptPanel } from '@/components/meeting/TranscriptPanel';
import { MeetingSummary } from '@/components/meeting/MeetingSummary';
import { useMeetingState } from '@/hooks/use-meeting-state';
import { useToast } from '@/components/ui/toast';
import { type AnamMessage, type AnamConnectionState } from '@/hooks/use-anam';

export default function MeetingPage() {
  const params = useParams();
  const roomId = params.id as Id<'rooms'>;
  const { addToast } = useToast();

  const room = useQuery(api.rooms.get, { id: roomId });
  const [messages, setMessages] = useState<AnamMessage[]>([]);
  const [connectionState, setConnectionState] =
    useState<AnamConnectionState>('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const meetingState = useMeetingState({ roomId });
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [meetingEnded, setMeetingEnded] = useState(false);
  const endedMeetingIdRef = useRef<Id<'meetings'> | null>(null);

  // Use the ended meeting ID if available, otherwise use the active meeting ID
  const effectiveMeetingId = endedMeetingIdRef.current ?? meetingState.state.meetingId;

  const actionItems = useQuery(
    api.actionItems.listByMeeting,
    effectiveMeetingId
      ? { meetingId: effectiveMeetingId }
      : 'skip'
  );
  const transcripts = useQuery(
    api.transcripts.listByMeeting,
    effectiveMeetingId
      ? { meetingId: effectiveMeetingId }
      : 'skip'
  );
  const speakerUpdates = useQuery(
    api.speakerUpdates.listByMeeting,
    effectiveMeetingId
      ? { meetingId: effectiveMeetingId }
      : 'skip'
  );
  const meetingSummary = useQuery(
    api.summaries.getByMeeting,
    effectiveMeetingId
      ? { meetingId: effectiveMeetingId }
      : 'skip'
  );

  const createActionItems = useMutation(api.actionItems.createBatch);
  const createSpeakerUpdate = useMutation(api.speakerUpdates.create);
  const createTranscript = useMutation(api.transcripts.create);
  const createSummary = useMutation(api.summaries.create);
  const endMeetingMutation = useMutation(api.meetings.end);
  const createMeetingMutation = useMutation(api.meetings.create);
  const startMeetingMutation = useMutation(api.meetings.start);

  const processingRef = useRef(false);

  // Use refs to access latest values in stable callbacks
  const meetingStateRef = useRef(meetingState);
  meetingStateRef.current = meetingState;
  const roomRef = useRef(room);
  roomRef.current = room;

  const handleMessage = useCallback((message: AnamMessage) => {
    setMessages((prev) => {
      const existing = prev.find((m) => m.id === message.id);
      if (existing) {
        // Accumulate content for streaming messages (SDK sends incremental text)
        // Concatenate directly - SDK includes proper spacing in chunks
        const accumulatedContent = existing.content + (message.content || '');
        return prev.map((m) =>
          m.id === message.id
            ? { ...message, content: accumulatedContent }
            : m
        );
      }
      return [...prev, message];
    });

    if (message.role === 'assistant') {
      setIsSpeaking(!message.endOfSpeech);
    }

    const currentMeetingState = meetingStateRef.current;

    console.log('[handleMessage] Received:', {
      role: message.role,
      endOfSpeech: message.endOfSpeech,
      content: message.content.substring(0, 50),
      meetingStatus: currentMeetingState.state.status,
      meetingId: currentMeetingState.state.meetingId,
      isProcessing: processingRef.current,
    });

    if (
      message.endOfSpeech &&
      message.role === 'user' &&
      currentMeetingState.state.status === 'active' &&
      !processingRef.current
    ) {
      console.log('[handleMessage] All conditions met, calling processUserTurn');
      processUserTurn(message);
    } else {
      console.log('[handleMessage] Conditions not met:', {
        endOfSpeech: message.endOfSpeech,
        isUser: message.role === 'user',
        isActive: currentMeetingState.state.status === 'active',
        notProcessing: !processingRef.current,
      });
    }
  }, []); // Stable - uses refs

  const handleTextSend = useCallback((content: string) => {
    const textMessage: AnamMessage = {
      id: `text-${Date.now()}`,
      content,
      role: 'user',
      timestamp: Date.now(),
      endOfSpeech: true,
    };

    setMessages((prev) => [...prev, textMessage]);

    const currentMeetingState = meetingStateRef.current;
    if (currentMeetingState.state.status === 'active' && !processingRef.current) {
      processUserTurn(textMessage);
    }
  }, []);

  const handleConnectionChange = useCallback(async (state: AnamConnectionState) => {
    setConnectionState(state);
    const currentMeetingState = meetingStateRef.current;

    console.log('[handleConnectionChange] State changed to:', state);

    // Auto-start meeting when avatar connects
    if (state === 'connected') {
      console.log('[handleConnectionChange] Connected, checking meeting state:', {
        meetingId: currentMeetingState.state.meetingId,
        status: currentMeetingState.state.status,
      });

      let meetingId = currentMeetingState.state.meetingId;

      if (!meetingId) {
        console.log('[handleConnectionChange] Creating meeting...');
        // Use direct mutation to get the meeting ID immediately
        meetingId = await createMeetingMutation({ roomId });
        console.log('[handleConnectionChange] Meeting created with ID:', meetingId);
      }

      // Always start the meeting using direct mutation with the ID we have
      if (meetingId) {
        console.log('[handleConnectionChange] Starting meeting...');
        await startMeetingMutation({ id: meetingId });
        console.log('[handleConnectionChange] Meeting started');
        currentMeetingState.setActiveSubState('listening');
        console.log('[handleConnectionChange] Set to listening state');
      }
    }
  }, [createMeetingMutation, startMeetingMutation, roomId]);

  async function processUserTurn(message: AnamMessage) {
    const currentMeetingState = meetingStateRef.current;
    const currentRoom = roomRef.current;
    const meetingId = currentMeetingState.state.meetingId;

    console.log('[processUserTurn] Starting with meetingId:', meetingId);

    if (!meetingId || processingRef.current) {
      console.log('[processUserTurn] Early return - no meetingId or already processing');
      return;
    }

    processingRef.current = true;
    currentMeetingState.setActiveSubState('processing');

    try {
      console.log('[processUserTurn] Creating transcript...');
      await createTranscript({
        meetingId,
        speakerId: 'user',
        speakerName: 'Participant',
        text: message.content,
        startTime: message.timestamp,
        endTime: Date.now(),
      });
      console.log('[processUserTurn] Transcript created');

      console.log('[processUserTurn] Calling process-turn API...');
      const response = await fetch(
        `/api/meetings/${meetingId}/process-turn`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: message.content,
            speakerId: 'user',
            speakerName: 'Participant',
            roomContext: currentRoom?.contextSummary,
            roomGoal: currentRoom?.goal,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[processUserTurn] API error:', response.status, errorText);
        throw new Error('Failed to process turn');
      }

      const processed = await response.json();
      console.log('[processUserTurn] API response:', processed);

      console.log('[processUserTurn] Creating speaker update...');
      await createSpeakerUpdate({
        meetingId,
        speakerId: processed.speakerId,
        speakerName: processed.speakerName,
        summary: processed.summary,
        risks: processed.risks || [],
        gaps: processed.gaps || [],
        proposedActions: processed.proposedActions?.map(
          (a: { task: string }) => a.task
        ) || [],
      });
      console.log('[processUserTurn] Speaker update created');

      console.log('[processUserTurn] proposedActions:', processed.proposedActions);
      if (processed.proposedActions?.length > 0) {
        console.log('[processUserTurn] Creating action items...');
        await createActionItems({
          meetingId,
          items: processed.proposedActions.map(
            (a: { task: string; owner: string }) => ({
              task: a.task,
              owner: a.owner || 'Unassigned',
            })
          ),
        });
        console.log('[processUserTurn] Action items created');
      } else {
        console.log('[processUserTurn] No action items to create');
      }

      currentMeetingState.setActiveSubState('listening');
    } catch (error) {
      console.error('[processUserTurn] Error:', error);
      addToast('Failed to process your message. Please try again.', 'error');
      currentMeetingState.setActiveSubState('listening');
    } finally {
      processingRef.current = false;
    }
  }

  const handleEndMeeting = useCallback(async () => {
    console.log('[handleEndMeeting] Called');
    const currentMeetingId = meetingStateRef.current.state.meetingId;
    const currentRoom = roomRef.current;

    console.log('[handleEndMeeting] Meeting ID:', currentMeetingId);
    console.log('[handleEndMeeting] Room:', currentRoom?.name);

    if (!currentMeetingId) {
      console.error('[handleEndMeeting] No meeting ID available');
      return;
    }

    console.log('[handleEndMeeting] Setting isGeneratingSummary to true');
    setIsGeneratingSummary(true);

    try {
      console.log('[handleEndMeeting] Calling summary API...');
      const response = await fetch(
        `/api/meetings/${currentMeetingId}/summary`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcripts:
              transcripts?.map((t) => ({
                speakerName: t.speakerName,
                text: t.text,
              })) ?? [],
            speakerUpdates:
              speakerUpdates?.map((u) => ({
                speakerName: u.speakerName,
                summary: u.summary,
                risks: u.risks,
                gaps: u.gaps,
                proposedActions: u.proposedActions,
              })) ?? [],
            actionItems:
              actionItems?.map((a) => ({
                task: a.task,
                owner: a.owner,
                status: a.status,
              })) ?? [],
            roomGoal: currentRoom?.goal,
            roomContext: currentRoom?.contextSummary,
          }),
        }
      );

      console.log('[handleEndMeeting] Summary API response status:', response.status);

      if (response.ok) {
        const summaryData = await response.json();
        console.log('[handleEndMeeting] Summary data received:', summaryData);
        await createSummary({
          meetingId: currentMeetingId,
          overview: summaryData.overview,
          decisions: summaryData.decisions || [],
          risks: summaryData.risks || [],
          nextSteps: summaryData.nextSteps || [],
        });
        console.log('[handleEndMeeting] Summary saved to Convex');
      } else {
        const errorText = await response.text();
        console.error('[handleEndMeeting] Summary API error:', errorText);
      }
    } catch (error) {
      console.error('[handleEndMeeting] Failed to generate summary:', error);
      addToast('Failed to generate meeting summary', 'warning');
    } finally {
      setIsGeneratingSummary(false);
    }

    console.log('[handleEndMeeting] Ending meeting...');
    endedMeetingIdRef.current = currentMeetingId;
    await endMeetingMutation({ id: currentMeetingId });
    setMeetingEnded(true);
    setIsSpeaking(false);
    addToast('Meeting ended successfully', 'success');
    console.log('[handleEndMeeting] Meeting ended');
  }, [
    transcripts,
    speakerUpdates,
    actionItems,
    createSummary,
    endMeetingMutation,
    addToast,
  ]);

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

  const getStatusText = () => {
    if (meetingEnded) return 'Meeting ended';
    if (meetingState.state.status === 'active') {
      switch (meetingState.state.activeSubState) {
        case 'listening': return 'Listening...';
        case 'processing': return 'Processing response...';
        case 'speaking': return 'Avatar speaking...';
        default: return 'Meeting in progress';
      }
    }
    if (connectionState === 'connected') return 'Connected - Ready to start';
    if (connectionState === 'connecting') return 'Connecting to avatar...';
    return 'Connect to start the meeting';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {room.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {getStatusText()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connectionState === 'connected' && !meetingEnded && (
            <button
              onClick={handleEndMeeting}
              disabled={meetingState.isLoading || isGeneratingSummary}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              {isGeneratingSummary ? 'Generating Summary...' : 'End Meeting'}
            </button>
          )}
          <Link
            href={`/dashboard/rooms/${roomId}`}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Back to Lobby
          </Link>
        </div>
      </div>

      {meetingEnded ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <MeetingSummary
              summary={meetingSummary}
              actionItems={actionItems ?? []}
              roomName={room.name}
              roomGoal={room.goal}
              isLoading={isGeneratingSummary}
            />
          </div>

          <div className="space-y-6">
            <ActionItemsPanel
              actionItems={actionItems ?? []}
              meetingId={effectiveMeetingId}
              isReadOnly
            />

            <TranscriptPanel
              messages={messages}
              isConnected={false}
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <AnamAvatar
              roomContext={roomContext}
              onMessage={handleMessage}
              onConnectionChange={handleConnectionChange}
              onSendMessage={handleTextSend}
              isSpeaking={isSpeaking}
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
            <ActionItemsPanel
              actionItems={actionItems ?? []}
              meetingId={meetingState.state.meetingId}
            />

            <TranscriptPanel
              messages={messages}
              isConnected={connectionState === 'connected'}
            />
          </div>
        </div>
      )}
    </div>
  );
}
