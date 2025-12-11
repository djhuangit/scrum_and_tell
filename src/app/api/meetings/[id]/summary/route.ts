import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';

const requestSchema = z.object({
  transcripts: z.array(
    z.object({
      speakerName: z.string(),
      text: z.string(),
    })
  ),
  speakerUpdates: z.array(
    z.object({
      speakerName: z.string(),
      summary: z.string(),
      risks: z.array(z.string()),
      gaps: z.array(z.string()),
      proposedActions: z.array(z.string()),
    })
  ),
  actionItems: z.array(
    z.object({
      task: z.string(),
      owner: z.string(),
      status: z.string(),
    })
  ),
  roomGoal: z.string().optional(),
  roomContext: z.string().optional(),
});

const SUMMARY_SYSTEM_PROMPT = `You are a meeting summarisation assistant. Your task is to generate a comprehensive meeting summary from the provided transcripts, speaker updates, and action items.

Generate a structured summary with:
1. Overview: A concise 2-3 paragraph summary of what was discussed and accomplished
2. Decisions: Key decisions that were made during the meeting
3. Risks: Any risks or concerns that were identified
4. Next Steps: Clear next steps and follow-up items

Respond in JSON format with this structure:
{
  "overview": "Comprehensive meeting summary...",
  "decisions": ["Decision 1", "Decision 2"],
  "risks": ["Risk 1", "Risk 2"],
  "nextSteps": ["Next step 1", "Next step 2"]
}

Focus on extracting actionable insights. Be concise but thorough. Only include items that were actually discussed.`;

interface MeetingSummary {
  overview: string;
  decisions: string[];
  risks: string[];
  nextSteps: string[];
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

    const { transcripts, speakerUpdates, actionItems, roomGoal, roomContext } =
      validationResult.data;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const transcriptText = transcripts
      .map((t) => `${t.speakerName}: "${t.text}"`)
      .join('\n');

    const updatesText = speakerUpdates
      .map(
        (u) =>
          `${u.speakerName}:
  Summary: ${u.summary}
  Risks: ${u.risks.join(', ') || 'None'}
  Gaps: ${u.gaps.join(', ') || 'None'}
  Proposed Actions: ${u.proposedActions.join(', ') || 'None'}`
      )
      .join('\n\n');

    const actionItemsText = actionItems
      .map((a) => `- [${a.status}] ${a.task} (Owner: ${a.owner})`)
      .join('\n');

    const userPrompt = `Meeting Goal: ${roomGoal || 'General discussion'}

Meeting Context: ${roomContext || 'Not provided'}

Transcripts:
${transcriptText || 'No transcripts available'}

Speaker Updates:
${updatesText || 'No speaker updates available'}

Action Items:
${actionItemsText || 'No action items recorded'}

Please generate a comprehensive meeting summary.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1500,
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      return NextResponse.json(
        { error: 'Failed to generate summary' },
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

    let summary: MeetingSummary;
    try {
      summary = JSON.parse(content);
    } catch {
      console.error('Failed to parse LLM response:', content);
      return NextResponse.json(
        { error: 'Invalid response format from LLM' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      meetingId,
      ...summary,
    });
  } catch (error) {
    console.error('Generate summary error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
