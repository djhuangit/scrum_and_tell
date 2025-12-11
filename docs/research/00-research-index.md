# Ops Room Companion - Research Index

> Research documentation for building a doc-aware voice meeting agent

## Research Documents

| # | Topic | Description | Status |
|---|-------|-------------|--------|
| 01 | [Anam Avatar SDK](./01-anam-avatar-sdk.md) | Avatar integration, lip-sync, ElevenLabs audio | Complete |
| 02 | [ElevenLabs TTS](./02-elevenlabs-tts.md) | Text-to-speech API, streaming, voice selection | Complete |
| 03 | [Speech-to-Text Services](./03-speech-to-text-services.md) | STT comparison: Whisper, Deepgram, AssemblyAI | Complete |
| 04 | [Browser Audio APIs](./04-browser-audio-apis.md) | Web Audio API, MediaRecorder, React hooks | Complete |
| 05 | [LLM Integration](./05-llm-integration.md) | OpenAI/Anthropic APIs, structured outputs, streaming | Complete |
| 06 | [Document Processing](./06-document-processing.md) | PDF/DOCX/PPTX extraction, chunking strategies | Complete |
| 07 | [Convex Database](./07-convex-database.md) | Schema design, real-time subscriptions, Clerk auth | Complete |
| 08 | [Clerk Authentication](./08-clerk-authentication.md) | Next.js App Router integration, protected routes | Complete |
| 09 | [Next.js App Router](./09-nextjs-app-router.md) | Server/Client components, streaming, state management | Complete |
| 10 | [Meeting Flow UX](./10-meeting-flow-ux.md) | State machines, turn-taking, accessibility | Complete |
| 11 | [API Design Backend](./11-api-design-backend.md) | Route design, audio pipeline, streaming responses | Complete |
| 12 | [Vercel Deployment](./12-vercel-deployment.md) | Functions, limits, environment variables, CI/CD | Complete |
| 13 | [Latency Optimisation](./13-latency-optimisation.md) | End-to-end latency, streaming, caching strategies | Complete |
| 14 | [Security & Privacy](./14-security-privacy.md) | Clerk security, GDPR, audio data handling | Complete |
| 15 | [Testing Strategy](./15-testing-strategy.md) | Vitest, Playwright, mocking external APIs | Complete |
| 16 | [Future Integrations](./16-future-integrations.md) | Slack, Email, Notion, Linear, GitHub Issues | Complete |

## Tech Stack Summary

- **Frontend**: Next.js 14+ (App Router), React, Tailwind CSS
- **Backend**: Next.js API Routes, Vercel Serverless
- **Database**: Convex (real-time)
- **Auth**: Clerk
- **Avatar**: Anam AI
- **Voice**: ElevenLabs (TTS), Deepgram/AssemblyAI (STT)
- **LLM**: OpenAI GPT-4o, Anthropic Claude

## Quick Start

1. Read [07-convex-database.md](./07-convex-database.md) for schema design
2. Read [08-clerk-authentication.md](./08-clerk-authentication.md) for auth setup
3. Read [01-anam-avatar-sdk.md](./01-anam-avatar-sdk.md) for avatar integration
4. Read [05-llm-integration.md](./05-llm-integration.md) for AI processing

## Key Recommendations

### STT Service
**AssemblyAI Universal-Streaming** - Sub-300ms latency, best for conversational UX

### TTS Service
**ElevenLabs Flash v2.5** - Low latency streaming with lip-sync support

### LLM Strategy
- **GPT-4o** for structured outputs (JSON mode)
- **Claude Sonnet 4.5** for complex reasoning
- Use **Vercel AI SDK** for streaming

### Target Latency
- Total end-to-end: **500-800ms** (P50)
- STT: 150-300ms
- LLM TTFT: 320-400ms
- TTS: 75-180ms

---

*Research completed: December 2025*
