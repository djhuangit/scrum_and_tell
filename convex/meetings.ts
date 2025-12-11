import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const list = query({
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
      .query('meetings')
      .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
      .order('desc')
      .collect();
  },
});

export const get = query({
  args: { id: v.id('meetings') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const meeting = await ctx.db.get(args.id);
    if (!meeting) {
      return null;
    }

    const room = await ctx.db.get(meeting.roomId);
    if (!room || room.creatorId !== identity.subject) {
      return null;
    }

    return meeting;
  },
});

export const getActive = query({
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
      .collect();

    return meetings.find(
      (m) => m.status === 'active' || m.status === 'lobby' || m.status === 'paused'
    ) ?? null;
  },
});

export const create = mutation({
  args: { roomId: v.id('rooms') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorised');
    }

    const room = await ctx.db.get(args.roomId);
    if (!room || room.creatorId !== identity.subject) {
      throw new Error('Room not found');
    }

    const existingActive = await ctx.db
      .query('meetings')
      .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
      .collect();

    const hasActive = existingActive.some(
      (m) => m.status === 'active' || m.status === 'lobby' || m.status === 'paused'
    );

    if (hasActive) {
      throw new Error('Room already has an active meeting');
    }

    return await ctx.db.insert('meetings', {
      roomId: args.roomId,
      status: 'lobby',
    });
  },
});

export const start = mutation({
  args: { id: v.id('meetings') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorised');
    }

    const meeting = await ctx.db.get(args.id);
    if (!meeting) {
      throw new Error('Meeting not found');
    }

    const room = await ctx.db.get(meeting.roomId);
    if (!room || room.creatorId !== identity.subject) {
      throw new Error('Unauthorised');
    }

    if (meeting.status !== 'lobby' && meeting.status !== 'paused') {
      throw new Error('Meeting cannot be started from current state');
    }

    await ctx.db.patch(args.id, {
      status: 'active',
      startedAt: meeting.startedAt ?? Date.now(),
    });

    return args.id;
  },
});

export const pause = mutation({
  args: { id: v.id('meetings') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorised');
    }

    const meeting = await ctx.db.get(args.id);
    if (!meeting) {
      throw new Error('Meeting not found');
    }

    const room = await ctx.db.get(meeting.roomId);
    if (!room || room.creatorId !== identity.subject) {
      throw new Error('Unauthorised');
    }

    if (meeting.status !== 'active') {
      throw new Error('Meeting is not active');
    }

    await ctx.db.patch(args.id, {
      status: 'paused',
    });

    return args.id;
  },
});

export const end = mutation({
  args: { id: v.id('meetings') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorised');
    }

    const meeting = await ctx.db.get(args.id);
    if (!meeting) {
      throw new Error('Meeting not found');
    }

    const room = await ctx.db.get(meeting.roomId);
    if (!room || room.creatorId !== identity.subject) {
      throw new Error('Unauthorised');
    }

    if (meeting.status === 'ended') {
      return args.id;
    }

    await ctx.db.patch(args.id, {
      status: 'ended',
      endedAt: Date.now(),
    });

    return args.id;
  },
});
