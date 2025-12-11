import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const getByMeeting = query({
  args: { meetingId: v.id('meetings') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const meeting = await ctx.db.get(args.meetingId);
    if (!meeting) {
      return null;
    }

    const room = await ctx.db.get(meeting.roomId);
    if (!room || room.creatorId !== identity.subject) {
      return null;
    }

    const summaries = await ctx.db
      .query('summaries')
      .withIndex('by_meeting', (q) => q.eq('meetingId', args.meetingId))
      .collect();

    return summaries[0] ?? null;
  },
});

export const listByRoom = query({
  args: { roomId: v.id('rooms') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const room = await ctx.db.get(args.roomId);
    if (!room || room.creatorId !== identity.subject) {
      return [];
    }

    const meetings = await ctx.db
      .query('meetings')
      .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
      .collect();

    const summaries = await Promise.all(
      meetings.map(async (meeting) => {
        const summary = await ctx.db
          .query('summaries')
          .withIndex('by_meeting', (q) => q.eq('meetingId', meeting._id))
          .first();

        if (!summary) {
          return null;
        }

        return {
          ...summary,
          meeting: {
            _id: meeting._id,
            status: meeting.status,
            startedAt: meeting.startedAt,
            endedAt: meeting.endedAt,
          },
        };
      })
    );

    return summaries
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => b.generatedAt - a.generatedAt);
  },
});

export const getLatestByRoom = query({
  args: { roomId: v.id('rooms') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const room = await ctx.db.get(args.roomId);
    if (!room || room.creatorId !== identity.subject) {
      return null;
    }

    const meetings = await ctx.db
      .query('meetings')
      .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
      .filter((q) => q.eq(q.field('status'), 'ended'))
      .collect();

    if (meetings.length === 0) {
      return null;
    }

    const sortedMeetings = meetings.sort(
      (a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0)
    );

    for (const meeting of sortedMeetings) {
      const summary = await ctx.db
        .query('summaries')
        .withIndex('by_meeting', (q) => q.eq('meetingId', meeting._id))
        .first();

      if (summary) {
        return {
          ...summary,
          meeting: {
            _id: meeting._id,
            status: meeting.status,
            startedAt: meeting.startedAt,
            endedAt: meeting.endedAt,
          },
        };
      }
    }

    return null;
  },
});

export const create = mutation({
  args: {
    meetingId: v.id('meetings'),
    overview: v.string(),
    decisions: v.array(v.string()),
    risks: v.array(v.string()),
    nextSteps: v.array(v.string()),
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

    const existing = await ctx.db
      .query('summaries')
      .withIndex('by_meeting', (q) => q.eq('meetingId', args.meetingId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        overview: args.overview,
        decisions: args.decisions,
        risks: args.risks,
        nextSteps: args.nextSteps,
        generatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert('summaries', {
      meetingId: args.meetingId,
      roomId: meeting.roomId,
      overview: args.overview,
      decisions: args.decisions,
      risks: args.risks,
      nextSteps: args.nextSteps,
      generatedAt: Date.now(),
    });
  },
});
