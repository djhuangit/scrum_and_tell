import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    return await ctx.db
      .query('rooms')
      .withIndex('by_creator', (q) => q.eq('creatorId', identity.subject))
      .order('desc')
      .collect();
  },
});

export const get = query({
  args: { id: v.id('rooms') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const room = await ctx.db.get(args.id);
    if (!room || room.creatorId !== identity.subject) {
      return null;
    }

    return room;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    goal: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorised');
    }

    const now = Date.now();
    return await ctx.db.insert('rooms', {
      name: args.name,
      goal: args.goal,
      creatorId: identity.subject,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id('rooms'),
    name: v.optional(v.string()),
    goal: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal('draft'), v.literal('active'), v.literal('completed'))
    ),
    contextSummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorised');
    }

    const room = await ctx.db.get(args.id);
    if (!room || room.creatorId !== identity.subject) {
      throw new Error('Room not found');
    }

    const { id, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );

    await ctx.db.patch(id, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });

    return id;
  },
});

export const remove = mutation({
  args: { id: v.id('rooms') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorised');
    }

    const room = await ctx.db.get(args.id);
    if (!room || room.creatorId !== identity.subject) {
      throw new Error('Room not found');
    }

    // Delete associated documents
    const documents = await ctx.db
      .query('documents')
      .withIndex('by_room', (q) => q.eq('roomId', args.id))
      .collect();

    for (const doc of documents) {
      await ctx.storage.delete(doc.storageId);
      await ctx.db.delete(doc._id);
    }

    // Delete associated meetings and their data
    const meetings = await ctx.db
      .query('meetings')
      .withIndex('by_room', (q) => q.eq('roomId', args.id))
      .collect();

    for (const meeting of meetings) {
      const transcripts = await ctx.db
        .query('transcripts')
        .withIndex('by_meeting', (q) => q.eq('meetingId', meeting._id))
        .collect();
      for (const transcript of transcripts) {
        await ctx.db.delete(transcript._id);
      }

      const speakerUpdates = await ctx.db
        .query('speakerUpdates')
        .withIndex('by_meeting', (q) => q.eq('meetingId', meeting._id))
        .collect();
      for (const update of speakerUpdates) {
        await ctx.db.delete(update._id);
      }

      const actionItems = await ctx.db
        .query('actionItems')
        .withIndex('by_meeting', (q) => q.eq('meetingId', meeting._id))
        .collect();
      for (const item of actionItems) {
        await ctx.db.delete(item._id);
      }

      const summaries = await ctx.db
        .query('summaries')
        .withIndex('by_meeting', (q) => q.eq('meetingId', meeting._id))
        .collect();
      for (const summary of summaries) {
        await ctx.db.delete(summary._id);
      }

      await ctx.db.delete(meeting._id);
    }

    await ctx.db.delete(args.id);
    return args.id;
  },
});
