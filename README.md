# Scrum & Tell

A document-aware voice meeting facilitator powered by AI. Upload context documents, run voice meetings with an AI avatar, and get real-time action item extraction and meeting summaries.

## Features

- **Document Upload & Summarisation** - Upload DOCX, PPTX, or TXT files to provide meeting context
- **AI Avatar Meetings** - Voice-based meetings facilitated by an Anam AI avatar
- **Real-time Action Items** - Automatic extraction of action items during conversation
- **Meeting Summaries** - AI-generated summaries with decisions, risks, and next steps
- **Export to Markdown** - Copy meeting summaries to clipboard for easy sharing

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Authentication**: Clerk
- **Database**: Convex
- **AI Avatar**: Anam AI with ElevenLabs voice synthesis
- **LLM**: OpenAI GPT-4o-mini
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Accounts with: [Clerk](https://clerk.com), [Convex](https://convex.dev), [Anam AI](https://anam.ai), [OpenAI](https://openai.com)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/djhuangit/scrum_and_tell.git
   cd scrum_and_tell
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file with your credentials:
   ```env
   # Clerk
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
   CLERK_SECRET_KEY=sk_...
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

   # Convex
   NEXT_PUBLIC_CONVEX_URL=https://...convex.cloud
   CONVEX_DEPLOY_KEY=prod:...

   # Anam AI
   ANAM_API_KEY=...

   # ElevenLabs (optional - uses Anam default voice if not set)
   ELEVENLABS_VOICE_ID=...

   # OpenAI
   OPENAI_API_KEY=sk-...
   ```

4. Set up Convex environment variables:
   ```bash
   npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-clerk-domain.clerk.accounts.dev
   npx convex env set OPENAI_API_KEY sk-...
   ```

5. Configure Clerk JWT Template:
   - Create a JWT template named "convex" in Clerk dashboard
   - Set claims to: `{"aud": "convex"}`

6. Start the development servers:
   ```bash
   # Terminal 1: Convex
   npx convex dev

   # Terminal 2: Next.js
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── api/                    # API routes
│   │   ├── anam/session/       # Anam session token
│   │   ├── documents/process/  # Document text extraction
│   │   └── meetings/[id]/      # Meeting processing & summary
│   └── dashboard/              # Authenticated pages
│       └── rooms/              # Room management & meetings
├── components/
│   ├── avatar/                 # Anam avatar component
│   ├── meeting/                # Meeting UI components
│   └── ui/                     # Shared UI components
├── hooks/                      # Custom React hooks
└── lib/                        # Utilities

convex/
├── schema.ts                   # Database schema
├── rooms.ts                    # Room CRUD
├── meetings.ts                 # Meeting lifecycle
├── documents.ts                # Document storage
├── actionItems.ts              # Action items
├── transcripts.ts              # Meeting transcripts
├── summaries.ts                # Meeting summaries
└── ai.ts                       # OpenAI integration
```

## Usage

1. **Create a Room** - Set a name and goal for your meeting
2. **Upload Documents** - Add context documents (optional)
3. **Generate Summary** - Create an AI summary of uploaded documents
4. **Start Meeting** - Connect to the AI avatar and begin your voice meeting
5. **Review Results** - View action items and meeting summary when done

## Deployment

The app is deployed on Vercel at [scrum-and-tell.vercel.app](https://scrum-and-tell.vercel.app)

To deploy your own instance:

1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy Convex to production: `npx convex deploy`

## Licence

All Rights Reserved. Copyright 2025.
