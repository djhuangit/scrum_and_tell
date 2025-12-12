import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

interface PersonaConfig {
  personaId?: string;
  name: string;
  avatarId: string;
  voiceId: string;
  llmId?: string;
  systemPrompt?: string;
  maxSessionLengthSeconds?: number;
}

interface SessionTokenRequest {
  personaConfig?: Partial<PersonaConfig>;
  roomContext?: string;
}

interface AnamSessionResponse {
  sessionToken: string;
}

const DEFAULT_PERSONA: PersonaConfig = {
  name: 'Scrum & Tell Facilitator',
  avatarId: '30fa96d0-26c4-4e55-94a0-517025942e18',
  voiceId: '6bfbe25a-979d-40f3-a92b-5394170af54b',
  llmId: 'ANAM_GPT_4O_MINI_V1',
  maxSessionLengthSeconds: 3600,
};

/**
 * Generates an Anam session token for secure client-side avatar streaming.
 * This endpoint exchanges the server-side API key for a short-lived session token.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const apiKey = process.env.ANAM_API_KEY;
    if (!apiKey) {
      console.error('ANAM_API_KEY not configured');
      return NextResponse.json(
        { error: 'Avatar service not configured' },
        { status: 500 }
      );
    }

    const body: SessionTokenRequest = await request.json().catch(() => ({}));
    const { personaConfig: customConfig, roomContext } = body;

    const systemPrompt = buildSystemPrompt(roomContext);

    const personaConfig: PersonaConfig = {
      ...DEFAULT_PERSONA,
      ...customConfig,
      systemPrompt,
    };

    const response = await fetch('https://api.anam.ai/v1/auth/session-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ personaConfig }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anam API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to create avatar session' },
        { status: response.status }
      );
    }

    const data: AnamSessionResponse = await response.json();

    return NextResponse.json({
      sessionToken: data.sessionToken,
      personaConfig: {
        name: personaConfig.name,
        avatarId: personaConfig.avatarId,
        voiceId: personaConfig.voiceId,
      },
    });
  } catch (error) {
    console.error('Session token error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function buildSystemPrompt(roomContext?: string): string {
  const basePrompt = `[STYLE] Reply in natural speech without formatting. Add pauses using '...' and occasionally a thoughtful pause. Keep responses concise and action-oriented.

[PERSONALITY] You are the Scrum & Tell Facilitator, a professional meeting facilitator who helps teams run efficient standups and project updates. You:
- Listen actively and summarise key points
- Identify action items and owners
- Flag risks and blockers
- Keep discussions focused and on-track
- Encourage participation from all team members

[BEHAVIOUR]
- When a participant finishes speaking, briefly summarise their update
- Extract any action items mentioned and confirm the owner
- If someone mentions a blocker or risk, acknowledge it and ask if help is needed
- Keep track of time and gently guide the conversation forward`;

  if (roomContext) {
    return `${basePrompt}

[MEETING CONTEXT]
The following context has been provided for this meeting:
${roomContext}

Use this context to ask relevant questions and provide informed feedback.`;
  }

  return basePrompt;
}
