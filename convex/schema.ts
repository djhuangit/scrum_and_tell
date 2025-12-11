import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index('by_clerk_id', ['clerkId']),

  rooms: defineTable({
    name: v.string(),
    goal: v.optional(v.string()),
    creatorId: v.string(),
    status: v.union(
      v.literal('draft'),
      v.literal('active'),
      v.literal('completed')
    ),
    contextSummary: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_creator', ['creatorId']),

  documents: defineTable({
    roomId: v.id('rooms'),
    filename: v.string(),
    fileType: v.string(),
    storageId: v.id('_storage'),
    extractedText: v.string(),
    chunks: v.array(v.string()),
    createdAt: v.number(),
  }).index('by_room', ['roomId']),

  meetings: defineTable({
    roomId: v.id('rooms'),
    status: v.union(
      v.literal('lobby'),
      v.literal('active'),
      v.literal('paused'),
      v.literal('ended')
    ),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
  }).index('by_room', ['roomId']),

  transcripts: defineTable({
    meetingId: v.id('meetings'),
    speakerId: v.string(),
    speakerName: v.string(),
    text: v.string(),
    startTime: v.number(),
    endTime: v.number(),
  }).index('by_meeting', ['meetingId']),

  speakerUpdates: defineTable({
    meetingId: v.id('meetings'),
    speakerId: v.string(),
    speakerName: v.string(),
    summary: v.string(),
    risks: v.array(v.string()),
    gaps: v.array(v.string()),
    proposedActions: v.array(v.string()),
    createdAt: v.number(),
  }).index('by_meeting', ['meetingId']),

  actionItems: defineTable({
    meetingId: v.id('meetings'),
    roomId: v.id('rooms'),
    task: v.string(),
    owner: v.string(),
    status: v.union(v.literal('pending'), v.literal('completed')),
    createdAt: v.number(),
  })
    .index('by_meeting', ['meetingId'])
    .index('by_room', ['roomId']),

  summaries: defineTable({
    meetingId: v.id('meetings'),
    roomId: v.id('rooms'),
    overview: v.string(),
    decisions: v.array(v.string()),
    risks: v.array(v.string()),
    nextSteps: v.array(v.string()),
    generatedAt: v.number(),
  }).index('by_meeting', ['meetingId']),
});
