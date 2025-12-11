import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';

const requestSchema = z.object({
  transcript: z.string().min(1),
  speakerId: z.string().min(1),
  speakerName: z.string().min(1),
  roomContext: z.string().optional(),
  roomGoal: z.string().optional(),
});

const PROCESS_TURN_SYSTEM_PROMPT = `You are a meeting facilitator assistant. Your task is to analyse a speaker's update and extract structured information.

Given a transcript of what the speaker said, extract:
1. A brief summary of their update (1-2 sentences)
2. Any risks or blockers they mentioned (even implied ones)
3. Any gaps or uncertainties identified
4. Action items - be proactive about identifying these!

IMPORTANT for action items: Extract action items whenever someone mentions:
- Tasks they need to do ("I need to...", "I'll...", "I have to...")
- Tasks for others ("We should...", "Someone needs to...", "The team will...")
- Work in progress that needs completion ("Still working on...", "Need to finish...")
- Commitments or promises ("I'll have that done by...", "Will send that over...")
- Any implied work or follow-ups from the discussion

If a name is mentioned with the task, use that as the owner. Otherwise, use the speaker's name or "Team" for group tasks.

Respond in JSON format with this structure:
{
  "summary": "Brief summary of what was said",
  "risks": ["Risk 1", "Risk 2"],
  "gaps": ["Gap or uncertainty 1"],
  "proposedActions": [
    { "task": "Action item description", "owner": "Owner name or speaker name" }
  ],
  "agentResponse": "A natural response the facilitator should say to acknowledge and follow up"
}

Keep the summary concise. Be proactive about extracting action items - it's better to capture potential tasks than miss them. The agentResponse should be conversational and either:
- Acknowledge what was said and ask a follow-up question
- Confirm understanding and summarise key points
- Ask for clarification if the update was unclear`;

interface ProcessedTurn {
  summary: string;
  risks: string[];
  gaps: string[];
  proposedActions: Array<{ task: string; owner: string }>;
  agentResponse: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { id: meetingId } = await params;
    if (!meetingId) {
      return NextResponse.json(
        { error: 'Meeting ID required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validationResult = requestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { transcript, speakerId, speakerName, roomContext, roomGoal } =
      validationResult.data;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const userPrompt = `Meeting Context: ${roomContext || 'Not provided'}
Meeting Goal: ${roomGoal || 'General discussion'}

Speaker: ${speakerName}
Transcript:
"${transcript}"

Analyse this update and provide structured output.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: PROCESS_TURN_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 800,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      return NextResponse.json(
        { error: 'Failed to process turn' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: 'No response from LLM' },
        { status: 500 }
      );
    }

    let processed: ProcessedTurn;
    try {
      processed = JSON.parse(content);
    } catch {
      console.error('Failed to parse LLM response:', content);
      return NextResponse.json(
        { error: 'Invalid response format from LLM' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      meetingId,
      speakerId,
      speakerName,
      ...processed,
    });
  } catch (error) {
    console.error('Process turn error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
