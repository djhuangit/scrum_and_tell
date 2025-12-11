# LLM Integration Research

> OpenAI and Anthropic APIs for voice meeting agents

## 1. Overview

Voice meeting agents require LLM integration for:
- Document summarisation
- Transcript structuring (extracting risks, actions, summaries)
- Cross-speaker synthesis
- Final meeting summary generation

## 2. OpenAI Structured Outputs

### JSON Mode with Response Format

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface MeetingSummary {
  title: string;
  duration_minutes: number;
  participants: string[];
  key_decisions: string[];
  action_items: Array<{
    task: string;
    owner: string;
    due_date: string;
  }>;
  next_steps: string;
}

async function extractMeetingSummary(transcript: string): Promise<MeetingSummary> {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-2024-08-06',
    messages: [{
      role: 'user',
      content: `Extract a structured summary from this transcript:\n\n${transcript}`
    }],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'meeting_summary',
        schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            duration_minutes: { type: 'number' },
            participants: { type: 'array', items: { type: 'string' } },
            key_decisions: { type: 'array', items: { type: 'string' } },
            action_items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  task: { type: 'string' },
                  owner: { type: 'string' },
                  due_date: { type: 'string' }
                },
                required: ['task', 'owner', 'due_date'],
                additionalProperties: false
              }
            },
            next_steps: { type: 'string' }
          },
          required: ['title', 'duration_minutes', 'participants', 'key_decisions', 'action_items', 'next_steps'],
          additionalProperties: false
        },
        strict: true
      }
    }
  });

  return JSON.parse(response.choices[0].message.content!);
}
```

### Function Calling

```typescript
const response = await client.chat.completions.create({
  model: 'gpt-4o-2024-08-06',
  messages: [{ role: 'user', content: 'Extract action items from transcript' }],
  tools: [{
    type: 'function',
    function: {
      name: 'create_action_item',
      description: 'Create an action item from the discussion',
      strict: true,
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'The action item description' },
          owner: { type: 'string', description: 'Person responsible' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] },
          due_date: { type: 'string', description: 'ISO date string' }
        },
        required: ['task', 'owner'],
        additionalProperties: false
      }
    }
  }]
});
```

## 3. Anthropic Claude API

### Structured Outputs

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

async function extractWithClaude(transcript: string) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20241022',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `Analyse this transcript and return JSON with summary, action_items, and risks:\n\n${transcript}`
    }],
    system: `You are a meeting analyst. Always respond with valid JSON.`
  });

  const content = response.content[0];
  if (content.type === 'text') {
    return JSON.parse(content.text);
  }
}
```

### Tool Use for Structured Output

```typescript
const response = await client.messages.create({
  model: 'claude-sonnet-4-5-20241022',
  max_tokens: 4096,
  messages: [{
    role: 'user',
    content: 'Extract action items from the meeting'
  }],
  tools: [{
    name: 'record_action_item',
    description: 'Record an action item from the meeting',
    input_schema: {
      type: 'object',
      properties: {
        task: { type: 'string' },
        owner: { type: 'string' },
        due_date: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'medium', 'high'] }
      },
      required: ['task', 'owner']
    }
  }]
});
```

## 4. Prompt Templates

### Document Summarisation

```typescript
const DOCUMENT_SUMMARY_PROMPT = `
You are an expert document analyst. Summarise the following document for a meeting context.

Focus on:
- Main goals and objectives
- Key constraints and deadlines
- Important stakeholders mentioned
- Critical requirements

Document:
{document_text}

Return JSON:
{
  "summary": "2-3 sentence overview",
  "goals": ["list of goals"],
  "constraints": ["list of constraints"],
  "deadlines": ["list of deadlines with dates"],
  "stakeholders": ["list of key people/teams"]
}
`;
```

### Transcript Structuring

```typescript
const TRANSCRIPT_STRUCTURE_PROMPT = `
Analyse this meeting transcript and extract structured information.

Transcript:
{transcript}

Return JSON:
{
  "speaker": "speaker name",
  "summary": "1-2 sentence summary of their update",
  "risks": ["identified risks"],
  "gaps": ["knowledge gaps or missing information"],
  "proposed_actions": ["suggested next steps"]
}
`;
```

### Meeting Summary

```typescript
const MEETING_SUMMARY_PROMPT = `
Generate a comprehensive meeting summary.

Meeting Context:
- Title: {title}
- Duration: {duration}
- Participants: {participants}

Speaker Updates:
{speaker_updates}

Document Context:
{document_summary}

Return JSON:
{
  "meeting_title": "descriptive title",
  "summary": "2-3 paragraph summary",
  "decisions": [
    { "decision": "what was decided", "rationale": "why" }
  ],
  "action_items": [
    { "task": "description", "owner": "name", "due_date": "YYYY-MM-DD" }
  ],
  "risks": ["identified risks"],
  "follow_ups": ["topics for next meeting"]
}
`;
```

## 5. Streaming Responses

### Next.js API Route with Vercel AI SDK

```typescript
// app/api/summarise/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(request: Request) {
  const { transcript } = await request.json();

  const result = await streamText({
    model: openai('gpt-4o-2024-08-06'),
    system: 'You are a professional meeting analyst.',
    messages: [{
      role: 'user',
      content: `Summarise this meeting:\n\n${transcript}`
    }]
  });

  return result.toDataStreamResponse();
}
```

### Streaming Structured Objects

```typescript
import { streamObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const MeetingSummarySchema = z.object({
  title: z.string(),
  summary: z.string(),
  action_items: z.array(z.object({
    task: z.string(),
    owner: z.string(),
    due_date: z.string()
  }))
});

export async function POST(request: Request) {
  const { transcript } = await request.json();

  const result = await streamObject({
    model: openai('gpt-4o-2024-08-06'),
    schema: MeetingSummarySchema,
    prompt: `Extract meeting details:\n\n${transcript}`
  });

  return result.toTextStreamResponse();
}
```

### Client-Side Consumption

```typescript
'use client';

import { useChat } from 'ai/react';

export function MeetingAnalyser() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/summarise'
  });

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={handleInputChange}
          placeholder="Paste transcript..."
        />
        <button disabled={isLoading}>
          {isLoading ? 'Analysing...' : 'Summarise'}
        </button>
      </form>

      {messages.map(msg => (
        <div key={msg.id} className={msg.role}>
          {msg.content}
        </div>
      ))}
    </div>
  );
}
```

## 6. Error Handling & Retries

### Exponential Backoff

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry client errors (4xx except 429)
      if ((error as any).status >= 400 && (error as any).status < 500 && (error as any).status !== 429) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        const jitter = Math.random() * 0.1 * delay;
        await new Promise(r => setTimeout(r, delay + jitter));
      }
    }
  }

  throw lastError!;
}

// Usage
const summary = await withRetry(() =>
  extractMeetingSummary(transcript)
);
```

### Rate Limit Handling

```typescript
async function handleRateLimits(fn: () => Promise<any>) {
  try {
    return await fn();
  } catch (error) {
    if ((error as any).status === 429) {
      const retryAfter = (error as any).headers?.['retry-after'] || 60;
      console.log(`Rate limited. Retrying after ${retryAfter}s`);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      return fn();
    }
    throw error;
  }
}
```

## 7. Provider Abstraction

```typescript
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';

type Provider = 'openai' | 'anthropic';

const models = {
  openai: openai('gpt-4o-2024-08-06'),
  anthropic: anthropic('claude-sonnet-4-5-20241022')
};

export async function generateSummary(
  transcript: string,
  provider: Provider = 'openai'
) {
  try {
    return await streamText({
      model: models[provider],
      messages: [{ role: 'user', content: transcript }]
    });
  } catch (error) {
    // Fallback to other provider
    const fallback = provider === 'openai' ? 'anthropic' : 'openai';
    console.log(`Falling back to ${fallback}`);
    return streamText({
      model: models[fallback],
      messages: [{ role: 'user', content: transcript }]
    });
  }
}
```

## 8. Cost Optimisation

### Token Counting

```typescript
import { encoding_for_model } from 'tiktoken';

function countTokens(text: string, model: string = 'gpt-4o'): number {
  const encoder = encoding_for_model(model as any);
  const tokens = encoder.encode(text);
  encoder.free();
  return tokens.length;
}

function estimateCost(inputTokens: number, outputTokens: number): number {
  // GPT-4o pricing (as of 2024)
  const inputCost = inputTokens * (2.50 / 1_000_000);
  const outputCost = outputTokens * (10.00 / 1_000_000);
  return inputCost + outputCost;
}
```

### Model Selection by Task

| Task | Recommended Model | Reason |
|------|-------------------|--------|
| Quick extraction | gpt-4o-mini | Fast, cheap |
| Complex reasoning | gpt-4o | Best quality |
| Long documents | claude-3-sonnet | 200k context |
| Structured output | gpt-4o | Best JSON mode |

## 9. Sources

- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
- [Anthropic Tool Use](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [OpenAI Streaming](https://platform.openai.com/docs/api-reference/streaming)
