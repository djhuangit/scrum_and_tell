# Ops Room Companion – Doc-Aware Voice Meeting Agent

> A voice-first meeting facilitator that uses your documents and live discussion to propose concrete action plans.

## 1. Problem & Vision

Teams spend a lot of time in meetings **repeating context**, **forgetting decisions**, and **losing action items** in scattered notes or chats.

Existing tools either:
- passively transcribe meetings,
- or run rigid text-based stand-ups in chat tools.

They rarely **understand the documents behind the meeting** (specs, roadmaps, briefs) and almost never **drive the meeting forward** like a good project manager would.

**Ops Room Companion** is a **doc-aware voice agent** that:

- Reads your attached documents for context.
- Facilitates the meeting by voice (as an avatar).
- Listens to each participant’s update.
- Grounds that information in your docs.
- Produces a **clear, structured plan** of decisions, risks, and action items.

The experience is designed for small teams in a “war room” or online huddle who want a lightweight, voice-first assistant without setting up heavy meeting infrastructure.

---

## 2. High-Level User Flow

### 2.1 Login & Home

1. User signs in via **Clerk**.
2. Home screen shows:
   - App name/logo.
   - Two primary actions:
     - **Create Room**
     - **Join Room** (via room code or recent rooms list).

### 2.2 Create Room (Attach Context)

When the user clicks **Create Room**, they see:

- **Room Name** 
  e.g. `Sprint 14 Planning`, `Infra Ops Check-in`.

- **Meeting Goal** (short free-text) 
  e.g. `Decide on priorities for next sprint`, `Create rollout plan for feature X`.

- **Attach Context Documents**
  - Upload PDFs / slides / text files.
  - Optional: paste a text brief or link to a spec.

- **Meeting Type (optional tag)**
  - `Stand-up`, `Planning`, `Retro`, etc. (used to bias prompts, not required).

On **Create**, the backend:

1. Stores room metadata in **Convex**.
2. Extracts text from the uploaded documents.
3. Runs an LLM call to generate a **short context summary**, capturing:
   - Main goals.
   - Key constraints / deadlines (if detectable).
4. Stores both raw text and the summary for later use.

User is then redirected to the **Room Lobby**.

---

### 2.3 Room Lobby

The lobby shows:

- **Room Title** and **Meeting Goal**.
- A **Context Summary** card, e.g.:

  > “This room is about Sprint 14 planning for the checkout revamp. Main goal: reduce cart drop-off and ship an A/B test for a one-page checkout by 31 January. Constraints: limited backend capacity, analytics schema is fixed.”

- **Participants List** (live from Convex).
- A prominent **Start Meeting** button.

The avatar (generated with **Anam**) is visible on screen, ready to “come to life” when the meeting starts.

---

### 2.4 Start Meeting

When the organiser clicks **Start Meeting**:

1. The agent (via **ElevenLabs** voice, rendered as an **Anam avatar**) says:

   > “Hi everyone. This meeting is about Sprint 14 planning for the checkout revamp. Based on your documents, the main goal is to reduce cart drop-off and ship an A/B test for the new checkout by 31 January. 
   > 
   > Let’s go around. Please share what you’re working on, any risks or blockers, and what you propose as next steps.”

2. The Meeting screen shows:
   - Current **agenda** (high-level).
   - **Current Speaker** panel.
   - A **Record** button for the person speaking.
   - A live **Action Board** for emerging action items and risks.

---

### 2.5 In-Meeting Flow (Per Speaker)

**Step 1 – Speaker Talks**

- Speaker clicks **Record**, then speaks, e.g.:

  > “I’ve been working on the new checkout layout. I think the current design might confuse mobile users because the shipping options are hidden. We also don’t have tracking for the second step yet. My suggestion is to run a quick unmoderated test on the prototype and add events before we ship the A/B test.”

- Browser captures audio using the Web Audio API and sends it to a Next.js API route.

**Step 2 – STT + LLM Reasoning**

Backend pipeline:

1. **Speech-to-Text (STT)** 
   - Audio → transcript using an external STT service.

2. **LLM: Structure & Grounding**
   - Prompt the LLM with:
     - Transcript.
     - Room context summary.
   - It returns structured JSON, for example:

   ```json
   {
     "speaker": "Brian",
     "summary": "Working on the new checkout layout.",
     "risks": ["current design may confuse mobile users"],
     "gaps": ["no tracking for second checkout step"],
     "proposed_actions": [
       "run unmoderated usability test on the checkout prototype",
       "add analytics events for the second step before the A/B test"
     ]
   }
   ```

3. The backend stores this in **Convex** as part of the current meeting session.

**Step 3 – Agent Feedback & Confirmation**

- The LLM (or simple templating) generates a concise spoken response:

  > “You’re focusing on the new checkout layout. You flagged potential confusion for mobile users and missing tracking on the second step. 
  > 
  > Given the goal of reducing drop-off, running a quick unmoderated test and adding events before the A/B test is a good plan. 
  > 
  > I’ll log two action items for you: ‘Run an unmoderated usability test on the checkout prototype’ and ‘Work with the data team to add tracking for step two’. Does that sound right?”

- This text is sent to **ElevenLabs** and rendered via the **Anam avatar** on the frontend.
- The **Action Board** UI updates with:
  - Owner (speaker).
  - Action item descriptions.
  - Optional tags (`risk`, `analytics`, etc.).

User can confirm via a simple **Yes/No** voice or button.

---

### 2.6 Building the Plan Across Speakers

As each participant speaks, the system accumulates:

- Person-level:
  - Short summary.
  - Risks.
  - Proposed actions.

- Meeting-level:
  - A list of all action items (with owners).
  - A list of overall risks / dependencies.

The LLM can generate lightweight cross-speaker observations, for example:

- “Three action items depend on the data team this week.”
- “Two people flagged analytics tracking as a gap.”

These appear as a **“Meeting Insight”** section on the UI and can be read out by the agent if desired.

---

### 2.7 End Meeting: Summary & Action Plan

When the organiser clicks **End Meeting**:

1. Backend fetches all meeting data from Convex.
2. LLM generates a structured summary:

   - **Meeting Goal** (refreshed from context + discussion).
   - **Decisions Made**.
   - **Action Items** (Owner, Task, Suggested Timeframe).
   - **Risks / Open Questions**.

3. The agent (ElevenLabs voice, Anam avatar) reads out:

   > “Here’s the plan I’ve assembled: 
   > – Goal: ship the one-page checkout A/B test by 31 January and reduce cart drop-off. 
   > – Decisions: we’ll run an unmoderated usability test before launch and we’ll keep the current payment provider this sprint. 
   > – Action items: 
   >   1) Brian – run the unmoderated usability test by Friday; 
   >   2) Alex – coordinate with the data team to add tracking for step two; 
   >   3) Mei – update release notes with the new funnel changes. 
   > – Main risk: data team bandwidth for analytics changes.”

4. On the UI, a **Meeting Summary** section shows:
   - Text summary.
   - A table of action items: `Owner | Action | When | Status`.

5. Utility buttons:
   - **Copy Summary** (markdown to clipboard).
   - **Save & Exit** (already persisted in Convex).
   - Future extension: “Send to Slack/Email/Notion”.

---

### 2.8 Returning to a Room

Next time users open the same room, they see:

- The **latest meeting summary**.
- **Outstanding action items** not marked complete.

The agent can optionally start by recapping:

> “Last time, we agreed on three action items. Would you like to review them before starting a new discussion?”

(For the hackathon MVP this can be a simple text view, even if follow-up questions are not fully implemented.)

---

## 3. Tech Stack

### 3.1 Frontend

- **Framework:** Next.js (App Router) on **Vercel**.
- **UI:**
  - React components for:
    - Home (Create/Join Room).
    - Room Lobby (context + participants).
    - Meeting Screen (avatar, controls, action board, summary).
  - Web Audio API (`MediaRecorder`) for recording participant audio.
- **Avatar:** **Anam** 
  - Used to render a live, expressive agent avatar in the meeting view.
  - Avatar lip-syncs / reacts to ElevenLabs audio playback (implementation detail can be tuned based on available SDK).

### 3.2 Backend (Serverless on Vercel)

- Implemented as **Next.js API routes** or server actions:
  - `POST /api/room/create`
    - Handles room creation, document upload, context summarisation.
  - `POST /api/standup/update`
    - Handles audio upload, STT, LLM structuring, Convex write, ElevenLabs TTS.
  - `POST /api/standup/summary`
    - Aggregates session data from Convex, generates final summary, calls ElevenLabs TTS.
- Uses secure environment variables for:
  - LLM API key.
  - STT service key.
  - ElevenLabs API key.
  - Convex and Clerk configuration.

### 3.3 Auth: Clerk

- **Clerk** for authentication and user management:
  - `SignIn`, `SignUp`, `UserButton` components in the frontend.
  - Server-side helpers to access the current user in API routes.
- Room and meeting data in Convex is **scoped per user/team** via Clerk user IDs.

### 3.4 Database & Realtime: Convex

Convex stores:

- **Users / Profiles** (linked to Clerk IDs).
- **Rooms**
  - `id`, `name`, `goal`, `creatorId`, timestamps.
- **Documents / Context**
  - Raw extracted text.
  - LLM-generated context summary.
- **Meetings**
  - Linked to a room.
  - Start/end time.
- **Speaker Updates**
  - Per meeting, per speaker:
    - Summary, risks, proposed actions.
- **Action Items**
  - Owner, description, status, optional due date.
- **Meeting Summaries**
  - Final summary text.
  - Derived insights.

Convex’s realtime hooks allow the UI to update as new actions and risks are generated.

### 3.5 AI & Voice Layer

- **STT (Speech-to-Text)**
  - Any external provider (e.g. Whisper API or equivalent).
  - Converts short audio clips into text transcripts for each speaker turn.

- **LLM**
  - External provider (e.g. OpenAI / Anthropic).
  - Used for:
    - Document summarisation on room creation.
    - Per-speaker structuring of transcripts into JSON (summary, risks, actions).
    - Cross-speaker observations and final meeting summaries.

- **TTS (Text-to-Speech) – ElevenLabs**
  - Converts agent text responses into voice audio.
  - Audio is fed to the frontend to be rendered through the **Anam avatar**.

---

## 4. Core Differentiators

- **Doc-aware meetings** 
  The agent reads and uses attached documents to set context, recognise constraints, and tie action items back to real specs and goals.

- **Voice-first, avatar-driven UX** 
  Using **ElevenLabs** + **Anam**, the agent is presented as a live avatar that speaks and guides the meeting, not just a silent sidebar.

- **Action-oriented reasoning** 
  Instead of just transcribing or summarising, the agent:
  - Extracts risks and proposals per speaker.
  - Synthesises them into a concrete, shareable action plan.

- **Hackathon-friendly architecture** 
  All orchestration runs in a single **Next.js** app on **Vercel**, with **Clerk** for auth, **Convex** for state, and external APIs for AI/voice. No custom infra required.

---

## 5. Possible Future Extensions

- Integrations with task trackers (GitHub Issues, Jira, Linear).
- Richer RAG over multiple historical documents and previous meeting notes.
- Role-aware behaviour (e.g. “product manager mode”, “tech lead mode”).
- Custom voice and persona configuration for the Anam avatar.
- Multi-lingual support for teams working across regions.
