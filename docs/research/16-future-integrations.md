# Future Integrations Research

> Extending voice meeting agents with third-party services

## 1. Overview

Potential integrations for enhanced meeting workflows:
- Communication: Slack, Email
- Project Management: Linear, GitHub Issues, Jira
- Documentation: Notion, Confluence
- Calendar: Google Calendar, Outlook
- CRM: Salesforce, HubSpot

## 2. Slack Integration

### Slack App Setup

```typescript
// lib/integrations/slack.ts
import { WebClient } from '@slack/web-api';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

interface SlackMessage {
  channel: string;
  text: string;
  blocks?: any[];
  thread_ts?: string;
}

export async function postMessage(message: SlackMessage) {
  return slack.chat.postMessage(message);
}

export async function postMeetingSummary(
  channelId: string,
  meeting: MeetingSummary
) {
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `Meeting Summary: ${meeting.title}`
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: meeting.summary
      }
    },
    {
      type: 'divider'
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Action Items*'
      }
    },
    ...meeting.actionItems.map(item => ({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `• ${item.task} - *${item.owner}*${item.dueDate ? ` (Due: ${item.dueDate})` : ''}`
      }
    }))
  ];

  return postMessage({
    channel: channelId,
    text: `Meeting Summary: ${meeting.title}`,
    blocks
  });
}
```

### Slack Slash Command

```typescript
// app/api/slack/commands/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  // Verify Slack signature
  const body = await request.text();
  const signature = request.headers.get('x-slack-signature');
  const timestamp = request.headers.get('x-slack-request-timestamp');

  if (!verifySlackSignature(body, signature!, timestamp!)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const params = new URLSearchParams(body);
  const command = params.get('command');
  const text = params.get('text');
  const userId = params.get('user_id');

  switch (command) {
    case '/meeting-summary':
      const summary = await getLatestMeetingSummary(userId!);
      return NextResponse.json({
        response_type: 'in_channel',
        text: summary
      });

    case '/action-items':
      const items = await getActionItems(userId!);
      return NextResponse.json({
        response_type: 'ephemeral',
        text: formatActionItems(items)
      });

    default:
      return NextResponse.json({
        response_type: 'ephemeral',
        text: 'Unknown command'
      });
  }
}

function verifySlackSignature(body: string, signature: string, timestamp: string): boolean {
  const sigBaseString = `v0:${timestamp}:${body}`;
  const mySignature = 'v0=' + crypto
    .createHmac('sha256', process.env.SLACK_SIGNING_SECRET!)
    .update(sigBaseString)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(signature)
  );
}
```

### Slack Event Handling

```typescript
// app/api/slack/events/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json();

  // URL verification
  if (body.type === 'url_verification') {
    return NextResponse.json({ challenge: body.challenge });
  }

  // Handle events
  if (body.type === 'event_callback') {
    const event = body.event;

    switch (event.type) {
      case 'app_mention':
        await handleMention(event);
        break;

      case 'message':
        if (event.channel_type === 'im') {
          await handleDirectMessage(event);
        }
        break;
    }
  }

  return NextResponse.json({ ok: true });
}
```

## 3. Email Integration

### SendGrid for Email

```typescript
// lib/integrations/email.ts
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    content: string;
    filename: string;
    type: string;
  }>;
}

export async function sendEmail(options: EmailOptions) {
  return sgMail.send({
    from: process.env.EMAIL_FROM!,
    ...options
  });
}

export async function sendMeetingSummaryEmail(
  recipient: string,
  meeting: MeetingSummary
) {
  const html = generateSummaryEmailHtml(meeting);

  return sendEmail({
    to: recipient,
    subject: `Meeting Summary: ${meeting.title}`,
    html
  });
}

function generateSummaryEmailHtml(meeting: MeetingSummary): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: sans-serif; max-width: 600px; margin: 0 auto; }
          .header { background: #2563eb; color: white; padding: 20px; }
          .content { padding: 20px; }
          .action-item { padding: 10px; border-left: 3px solid #2563eb; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${meeting.title}</h1>
          <p>${new Date(meeting.date).toLocaleDateString()}</p>
        </div>
        <div class="content">
          <h2>Summary</h2>
          <p>${meeting.summary}</p>

          <h2>Action Items</h2>
          ${meeting.actionItems.map(item => `
            <div class="action-item">
              <strong>${item.task}</strong><br>
              Owner: ${item.owner}
              ${item.dueDate ? `<br>Due: ${item.dueDate}` : ''}
            </div>
          `).join('')}

          <h2>Decisions Made</h2>
          <ul>
            ${meeting.decisions.map(d => `<li>${d}</li>`).join('')}
          </ul>
        </div>
      </body>
    </html>
  `;
}
```

### Scheduled Email Digests

```typescript
// convex/crons.ts
crons.daily(
  'send-daily-digest',
  { hourUTC: 8, minuteUTC: 0 },
  internal.email.sendDailyDigest
);

// convex/email.ts
export const sendDailyDigest = internalAction({
  handler: async (ctx) => {
    const users = await ctx.runQuery(internal.users.getDigestSubscribers);

    for (const user of users) {
      const actionItems = await ctx.runQuery(internal.actionItems.getForUser, {
        userId: user._id
      });

      const upcomingMeetings = await ctx.runQuery(internal.meetings.getUpcoming, {
        userId: user._id
      });

      await sendDigestEmail(user.email, { actionItems, upcomingMeetings });
    }
  }
});
```

## 4. Linear Integration

### Linear API Client

```typescript
// lib/integrations/linear.ts
import { LinearClient } from '@linear/sdk';

const linear = new LinearClient({
  apiKey: process.env.LINEAR_API_KEY
});

export async function createIssue(
  teamId: string,
  title: string,
  description: string,
  options?: {
    assigneeId?: string;
    priority?: number;
    dueDate?: string;
    labels?: string[];
  }
) {
  return linear.createIssue({
    teamId,
    title,
    description,
    ...options
  });
}

export async function createIssuesFromActionItems(
  teamId: string,
  actionItems: ActionItem[],
  userMapping: Map<string, string> // name -> Linear user ID
) {
  const issues = await Promise.all(
    actionItems.map(async (item) => {
      const assigneeId = userMapping.get(item.owner);

      return createIssue(teamId, item.task, '', {
        assigneeId,
        dueDate: item.dueDate,
        priority: getPriority(item.priority)
      });
    })
  );

  return issues;
}

function getPriority(priority: 'low' | 'medium' | 'high'): number {
  const priorities = { low: 4, medium: 3, high: 1 };
  return priorities[priority];
}
```

### Linear Webhook Handler

```typescript
// app/api/webhooks/linear/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('linear-signature');

  if (!verifyLinearSignature(body, signature!)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(body);

  switch (payload.action) {
    case 'update':
      if (payload.data.state?.name === 'Done') {
        await markActionItemComplete(payload.data.id);
      }
      break;
  }

  return NextResponse.json({ ok: true });
}
```

## 5. GitHub Issues Integration

### GitHub API Client

```typescript
// lib/integrations/github.ts
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

export async function createIssue(
  owner: string,
  repo: string,
  title: string,
  body: string,
  options?: {
    assignees?: string[];
    labels?: string[];
    milestone?: number;
  }
) {
  return octokit.issues.create({
    owner,
    repo,
    title,
    body,
    ...options
  });
}

export async function createIssuesFromActionItems(
  owner: string,
  repo: string,
  actionItems: ActionItem[],
  userMapping: Map<string, string>
) {
  const issues = await Promise.all(
    actionItems.map(async (item) => {
      const assignee = userMapping.get(item.owner);

      return createIssue(
        owner,
        repo,
        item.task,
        `Created from meeting action item.\n\nOwner: ${item.owner}${item.dueDate ? `\nDue: ${item.dueDate}` : ''}`,
        {
          assignees: assignee ? [assignee] : [],
          labels: ['meeting-action-item']
        }
      );
    })
  );

  return issues;
}
```

## 6. Notion Integration

### Notion API Client

```typescript
// lib/integrations/notion.ts
import { Client } from '@notionhq/client';

const notion = new Client({
  auth: process.env.NOTION_TOKEN
});

export async function createMeetingPage(
  databaseId: string,
  meeting: MeetingSummary
) {
  return notion.pages.create({
    parent: { database_id: databaseId },
    properties: {
      Title: {
        title: [{ text: { content: meeting.title } }]
      },
      Date: {
        date: { start: meeting.date }
      },
      Status: {
        select: { name: 'Completed' }
      }
    },
    children: [
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ text: { content: 'Summary' } }]
        }
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ text: { content: meeting.summary } }]
        }
      },
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ text: { content: 'Action Items' } }]
        }
      },
      {
        object: 'block',
        type: 'to_do',
        to_do: {
          rich_text: meeting.actionItems.map(item => ({
            text: { content: `${item.task} - ${item.owner}` }
          })),
          checked: false
        }
      }
    ]
  });
}

export async function appendToMeetingLog(
  pageId: string,
  content: string
) {
  return notion.blocks.children.append({
    block_id: pageId,
    children: [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ text: { content } }]
        }
      }
    ]
  });
}
```

## 7. Calendar Integration

### Google Calendar

```typescript
// lib/integrations/calendar.ts
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

export async function createCalendarEvent(
  accessToken: string,
  event: {
    summary: string;
    description: string;
    start: Date;
    end: Date;
    attendees?: string[];
  }
) {
  oauth2Client.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  return calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: event.summary,
      description: event.description,
      start: {
        dateTime: event.start.toISOString(),
        timeZone: 'UTC'
      },
      end: {
        dateTime: event.end.toISOString(),
        timeZone: 'UTC'
      },
      attendees: event.attendees?.map(email => ({ email }))
    }
  });
}

export async function scheduleFollowUpMeeting(
  accessToken: string,
  meeting: MeetingSummary,
  followUpDate: Date
) {
  const attendees = meeting.participants.map(p => p.email);

  return createCalendarEvent(accessToken, {
    summary: `Follow-up: ${meeting.title}`,
    description: `Follow-up meeting to discuss:\n${meeting.nextSteps.join('\n')}`,
    start: followUpDate,
    end: new Date(followUpDate.getTime() + 30 * 60 * 1000), // 30 minutes
    attendees
  });
}
```

## 8. Integration Settings UI

```typescript
// components/IntegrationSettings.tsx
'use client';

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

export function IntegrationSettings() {
  const integrations = useQuery(api.integrations.list);
  const updateIntegration = useMutation(api.integrations.update);

  const availableIntegrations = [
    {
      id: 'slack',
      name: 'Slack',
      description: 'Post meeting summaries to Slack channels',
      icon: '/icons/slack.svg'
    },
    {
      id: 'linear',
      name: 'Linear',
      description: 'Create issues from action items',
      icon: '/icons/linear.svg'
    },
    {
      id: 'notion',
      name: 'Notion',
      description: 'Save meeting notes to Notion',
      icon: '/icons/notion.svg'
    },
    {
      id: 'github',
      name: 'GitHub',
      description: 'Create issues from action items',
      icon: '/icons/github.svg'
    }
  ];

  return (
    <div className="integration-settings">
      <h2>Integrations</h2>

      {availableIntegrations.map(integration => {
        const connected = integrations?.find(i => i.type === integration.id);

        return (
          <div key={integration.id} className="integration-card">
            <img src={integration.icon} alt={integration.name} />
            <div className="integration-info">
              <h3>{integration.name}</h3>
              <p>{integration.description}</p>
            </div>
            <div className="integration-actions">
              {connected ? (
                <>
                  <span className="connected">Connected</span>
                  <button onClick={() => disconnect(integration.id)}>
                    Disconnect
                  </button>
                </>
              ) : (
                <button onClick={() => connect(integration.id)}>
                  Connect
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

## 9. OAuth Flow

```typescript
// app/api/integrations/[provider]/connect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

const oauthConfigs = {
  slack: {
    authUrl: 'https://slack.com/oauth/v2/authorize',
    clientId: process.env.SLACK_CLIENT_ID,
    scopes: ['chat:write', 'channels:read']
  },
  notion: {
    authUrl: 'https://api.notion.com/v1/oauth/authorize',
    clientId: process.env.NOTION_CLIENT_ID,
    scopes: []
  },
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    clientId: process.env.GOOGLE_CLIENT_ID,
    scopes: ['https://www.googleapis.com/auth/calendar']
  }
};

export async function GET(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect('/sign-in');
  }

  const config = oauthConfigs[params.provider as keyof typeof oauthConfigs];
  if (!config) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
  }

  const state = crypto.randomUUID();
  // Store state for verification

  const authUrl = new URL(config.authUrl);
  authUrl.searchParams.set('client_id', config.clientId!);
  authUrl.searchParams.set('redirect_uri', `${process.env.APP_URL}/api/integrations/${params.provider}/callback`);
  authUrl.searchParams.set('scope', config.scopes.join(' '));
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('response_type', 'code');

  return NextResponse.redirect(authUrl.toString());
}
```

## 10. Convex Schema for Integrations

```typescript
// convex/schema.ts
integrations: defineTable({
  userId: v.string(),
  type: v.union(
    v.literal('slack'),
    v.literal('linear'),
    v.literal('notion'),
    v.literal('github'),
    v.literal('google')
  ),
  accessToken: v.string(),
  refreshToken: v.optional(v.string()),
  expiresAt: v.optional(v.number()),
  metadata: v.object({
    teamId: v.optional(v.string()),
    workspaceId: v.optional(v.string()),
    channelId: v.optional(v.string())
  }),
  createdAt: v.number()
})
  .index('by_user', ['userId'])
  .index('by_user_type', ['userId', 'type'])
```

## 11. Integration Workflow

```typescript
// convex/workflows/postMeetingSummary.ts
import { action } from './_generated/server';
import { api, internal } from './_generated/api';

export const postMeetingSummary = action({
  args: { meetingId: v.id('meetings') },
  handler: async (ctx, args) => {
    const meeting = await ctx.runQuery(api.meetings.get, { id: args.meetingId });
    const summary = await ctx.runQuery(api.summaries.getByMeeting, {
      meetingId: args.meetingId
    });

    // Get user integrations
    const integrations = await ctx.runQuery(internal.integrations.getForUser, {
      userId: meeting.creatorId
    });

    const results = [];

    // Post to Slack if connected
    const slackIntegration = integrations.find(i => i.type === 'slack');
    if (slackIntegration) {
      const result = await postToSlack(slackIntegration, summary);
      results.push({ type: 'slack', success: true, result });
    }

    // Create Linear issues if connected
    const linearIntegration = integrations.find(i => i.type === 'linear');
    if (linearIntegration && summary.actionItems.length > 0) {
      const result = await createLinearIssues(linearIntegration, summary.actionItems);
      results.push({ type: 'linear', success: true, result });
    }

    // Save to Notion if connected
    const notionIntegration = integrations.find(i => i.type === 'notion');
    if (notionIntegration) {
      const result = await saveToNotion(notionIntegration, summary);
      results.push({ type: 'notion', success: true, result });
    }

    return results;
  }
});
```

## 12. Best Practices

1. **Secure token storage**: Encrypt OAuth tokens at rest
2. **Token refresh**: Implement automatic token refresh
3. **Error handling**: Gracefully handle API failures
4. **Rate limiting**: Respect third-party API limits
5. **Webhook verification**: Always verify webhook signatures
6. **User preferences**: Let users choose which integrations to use
7. **Audit logging**: Log all integration actions
8. **Fallback behaviour**: App should work without integrations

## 13. Sources

- [Slack API Documentation](https://api.slack.com/)
- [Linear API Documentation](https://developers.linear.app/)
- [Notion API Documentation](https://developers.notion.com/)
- [GitHub REST API](https://docs.github.com/en/rest)
- [Google Calendar API](https://developers.google.com/calendar)
