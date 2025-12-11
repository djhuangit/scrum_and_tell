import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const listByMeeting = query({
  args: { meetingId: v.id('meetings') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const meeting = await ctx.db.get(args.meetingId);
    if (!meeting) {
      return [];
    }

    const room = await ctx.db.get(meeting.roomId);
    if (!room || room.creatorId !== identity.subject) {
      return [];
    }

    return await ctx.db
      .query('speakerUpdates')
      .withIndex('by_meeting', (q) => q.eq('meetingId', args.meetingId))
      .order('asc')
      .collect();
  },
});

export const create = mutation({
  args: {
    meetingId: v.id('meetings'),
    speakerId: v.string(),
    speakerName: v.string(),
    summary: v.string(),
    risks: v.array(v.string()),
    gaps: v.array(v.string()),
    proposedActions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorised');
    }

    const meeting = await ctx.db.get(args.meetingId);
    if (!meeting) {
      throw new Error('Meeting not found');
    }

    const room = await ctx.db.get(meeting.roomId);
    if (!room || room.creatorId !== identity.subject) {
      throw new Error('Unauthorised');
    }

    return await ctx.db.insert('speakerUpdates', {
      meetingId: args.meetingId,
      speakerId: args.speakerId,
      speakerName: args.speakerName,
      summary: args.summary,
      risks: args.risks,
      gaps: args.gaps,
      proposedActions: args.proposedActions,
      createdAt: Date.now(),
    });
  },
});
