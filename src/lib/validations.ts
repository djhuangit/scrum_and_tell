import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z.string().min(1, 'Room name is required').max(100),
  goal: z.string().max(500).optional(),
});

export const updateRoomSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  goal: z.string().max(500).optional(),
  status: z.enum(['draft', 'active', 'completed']).optional(),
});

export const createMeetingSchema = z.object({
  roomId: z.string().min(1, 'Room ID is required'),
});

export const updateMeetingSchema = z.object({
  status: z.enum(['lobby', 'active', 'paused', 'ended']),
});

export const transcriptSchema = z.object({
  meetingId: z.string().min(1),
  speakerId: z.string().min(1),
  speakerName: z.string().min(1),
  text: z.string().min(1),
  startTime: z.number(),
  endTime: z.number(),
});

export const actionItemSchema = z.object({
  task: z.string().min(1, 'Task description is required'),
  owner: z.string().min(1, 'Owner is required'),
  status: z.enum(['pending', 'completed']).default('pending'),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type UpdateRoomInput = z.infer<typeof updateRoomSchema>;
export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export type UpdateMeetingInput = z.infer<typeof updateMeetingSchema>;
export type TranscriptInput = z.infer<typeof transcriptSchema>;
export type ActionItemInput = z.infer<typeof actionItemSchema>;
