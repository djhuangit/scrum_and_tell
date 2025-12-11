import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorised');
    }

    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    roomId: v.id('rooms'),
    filename: v.string(),
    fileType: v.string(),
    storageId: v.id('_storage'),
    extractedText: v.string(),
    chunks: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorised');
    }

    const room = await ctx.db.get(args.roomId);
    if (!room || room.creatorId !== identity.subject) {
      throw new Error('Room not found');
    }

    return await ctx.db.insert('documents', {
      roomId: args.roomId,
      filename: args.filename,
      fileType: args.fileType,
      storageId: args.storageId,
      extractedText: args.extractedText,
      chunks: args.chunks,
      createdAt: Date.now(),
    });
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
      .query('documents')
      .withIndex('by_room', (q) => q.eq('roomId', args.roomId))
      .collect();
  },
});

export const get = query({
  args: { id: v.id('documents') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const document = await ctx.db.get(args.id);
    if (!document) {
      return null;
    }

    const room = await ctx.db.get(document.roomId);
    if (!room || room.creatorId !== identity.subject) {
      return null;
    }

    return document;
  },
});

export const remove = mutation({
  args: { id: v.id('documents') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorised');
    }

    const document = await ctx.db.get(args.id);
    if (!document) {
      throw new Error('Document not found');
    }

    const room = await ctx.db.get(document.roomId);
    if (!room || room.creatorId !== identity.subject) {
      throw new Error('Document not found');
    }

    await ctx.storage.delete(document.storageId);
    await ctx.db.delete(args.id);

    return args.id;
  },
});

export const getUrl = query({
  args: { storageId: v.id('_storage') },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
