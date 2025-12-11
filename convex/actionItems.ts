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
      .query('actionItems')
      .withIndex('by_meeting', (q) => q.eq('meetingId', args.meetingId))
      .order('desc')
      .collect();
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

    return await ctx.db
      .query('actionItems')
      .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
      .order('desc')
      .collect();
  },
});

export const create = mutation({
  args: {
    meetingId: v.id('meetings'),
    task: v.string(),
    owner: v.string(),
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

    return await ctx.db.insert('actionItems', {
      meetingId: args.meetingId,
      roomId: meeting.roomId,
      task: args.task,
      owner: args.owner,
      status: 'pending',
      createdAt: Date.now(),
    });
  },
});

export const createBatch = mutation({
  args: {
    meetingId: v.id('meetings'),
    items: v.array(
      v.object({
        task: v.string(),
        owner: v.string(),
      })
    ),
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

    const now = Date.now();
    const ids = await Promise.all(
      args.items.map((item) =>
        ctx.db.insert('actionItems', {
          meetingId: args.meetingId,
          roomId: meeting.roomId,
          task: item.task,
          owner: item.owner,
          status: 'pending',
          createdAt: now,
        })
      )
    );

    return ids;
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id('actionItems'),
    status: v.union(v.literal('pending'), v.literal('completed')),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorised');
    }

    const actionItem = await ctx.db.get(args.id);
    if (!actionItem) {
      throw new Error('Action item not found');
    }

    const room = await ctx.db.get(actionItem.roomId);
    if (!room || room.creatorId !== identity.subject) {
      throw new Error('Unauthorised');
    }

    await ctx.db.patch(args.id, {
      status: args.status,
    });

    return args.id;
  },
});

export const remove = mutation({
  args: { id: v.id('actionItems') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorised');
    }

    const actionItem = await ctx.db.get(args.id);
    if (!actionItem) {
      throw new Error('Action item not found');
    }

    const room = await ctx.db.get(actionItem.roomId);
    if (!room || room.creatorId !== identity.subject) {
      throw new Error('Unauthorised');
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});
