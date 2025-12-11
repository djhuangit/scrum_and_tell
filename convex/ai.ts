import { action, internalMutation } from './_generated/server';
import { v } from 'convex/values';
import { api, internal } from './_generated/api';

const SUMMARISE_SYSTEM_PROMPT = `You are a meeting preparation assistant. Your task is to analyse documents and extract key information that will be useful for a meeting discussion.

Given the document text and the meeting goal, create a concise summary that includes:
1. Main topics and themes from the documents
2. Key facts, figures, and deadlines mentioned
3. Any constraints or requirements identified
4. Open questions or areas that need discussion
5. Relevant context for the meeting goal

Keep the summary focused and actionable. Use bullet points where appropriate.
Maximum length: 500 words.`;

export const summariseDocuments = action({
  args: {
    roomId: v.id('rooms'),
  },
  handler: async (ctx, args): Promise<string | null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error('Unauthorised');
    }

    const room = await ctx.runQuery(api.rooms.get, { id: args.roomId });
    if (!room) {
      throw new Error('Room not found');
    }

    const documents = await ctx.runQuery(api.documents.listByRoom, {
      roomId: args.roomId,
    });

    if (documents.length === 0) {
      return null;
    }

    const documentTexts = documents
      .map((doc) => `--- ${doc.filename} ---\n${doc.extractedText}`)
      .join('\n\n');

    const userPrompt = `Meeting Goal: ${room.goal || 'General discussion'}

Documents:
${documentTexts}

Please provide a concise summary of the key information from these documents that is relevant to the meeting goal.`;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SUMMARISE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    const summary = data.choices[0]?.message?.content;

    if (!summary) {
      throw new Error('No summary generated');
    }

    await ctx.runMutation(internal.ai.updateRoomSummary, {
      roomId: args.roomId,
      summary,
    });

    return summary;
  },
});

export const updateRoomSummary = internalMutation({
  args: {
    roomId: v.id('rooms'),
    summary: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.roomId, {
      contextSummary: args.summary,
      updatedAt: Date.now(),
    });
  },
});
