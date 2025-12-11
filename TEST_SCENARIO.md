# Phase 5 Manual Testing Scenario

## Prerequisites

1. Development server running: `npm run dev`
2. Convex dev running: `npx convex dev`
3. Signed in to the app via Clerk
4. Microphone permissions available in browser
5. OpenAI API key configured (for process-turn API)
6. Anam API key configured (for avatar)

---

## Test Scenario: Sprint Planning Standup Meeting

### Setup Phase

**Step 1: Create a New Room**
1. Navigate to `/dashboard/rooms`
2. Click "Create Room"
3. Fill in:
   - Name: `Sprint 23 Standup`
   - Goal: `Review team progress, identify blockers, and assign action items for Sprint 23`
4. Click "Create"

**Step 2: Upload Context Document**
1. On the room lobby page, find the document upload area
2. Upload `test-documents/sprint-planning.txt`
3. Wait for processing (you should see the extracted text)
4. Click "Generate Summary" to create the AI context summary
5. Verify the summary appears and mentions:
   - Sprint goals
   - Team members
   - Deadlines
   - Risks/blockers

---

### Meeting Flow Testing

**Step 3: Start the Meeting**
1. Click "Start Meeting" button
2. You should be taken to `/dashboard/rooms/[id]/meeting`
3. Verify you see:
   - Avatar video area (initially shows "Connect to avatar to start")
   - Meeting Controls panel
   - Action Items panel (empty, with placeholder text)
   - Transcript panel (empty)

**Step 4: Connect to Avatar**
1. Click "Connect Avatar" button
2. Wait for connection (status should change to "Connecting...")
3. Once connected:
   - Avatar video should appear
   - Status indicator should show "Ready"
   - Microphone controls should appear (Mute/Unmute, Interrupt, Disconnect)
4. Allow microphone access when prompted

**Step 5: Start the Meeting Session**
1. Click "Start Meeting" button
2. Status should change to "Active"
3. Avatar should greet you with something contextual like:
   > "Welcome to the Sprint 23 standup. I've reviewed the planning document. We have four main goals this sprint including the OAuth2 authentication module and the payment bug fix. Who would like to give their update first?"

---

### Voice Interaction Testing

**Step 6: Simulate a Team Member Update (You speak as Sarah)**
Say something like:
> "Hi, this is Sarah. I've been working on the OAuth2 integration. I'm about 60% done with the authentication module. My main blocker is that the OAuth2 provider documentation is really incomplete. I need to schedule a call with their support team. I think I can still hit the December 15th deadline if I get that sorted by tomorrow."

**Expected Behaviour:**
1. Your speech appears in the Transcript panel as a "You" message
2. Status briefly shows "Processing response..."
3. Avatar responds with acknowledgement and follow-up, something like:
   > "Thanks Sarah. Good progress on the authentication module. I've noted the blocker about the OAuth2 documentation. Let me add an action item: Sarah to contact OAuth2 provider support by tomorrow. Is there anything the team can help with while you wait for that call?"
4. Action item should appear in the Action Items panel:
   - Task: "Contact OAuth2 provider support"
   - Owner: "Sarah" or "Unassigned"

**Step 7: Simulate Another Update (You speak as Marcus)**
Say something like:
> "This is Marcus. The dashboard analytics work is going well. I've completed the basic charts and graphs. However, I'm blocked waiting on Team Bravo to deliver the new API endpoints. I sent them a message but haven't heard back. Elena, could you help escalate this since you know their lead?"

**Expected Behaviour:**
1. Speech appears in transcript
2. Avatar acknowledges and extracts:
   - Summary of progress
   - Blocker about API endpoints
   - Potential action item for escalation
3. New action items may appear, such as:
   - "Follow up with Team Bravo about API endpoints"
   - "Elena to help escalate API dependency"

**Step 8: Test Risk Identification**
Say something like:
> "I want to flag a risk. David is out sick until Wednesday and the database optimisation work might slip. We should discuss whether we need to bring in a contractor or adjust the timeline."

**Expected Behaviour:**
1. Avatar should acknowledge the risk
2. Response might include:
   - Acknowledgement of the staffing issue
   - Question about whether to adjust timeline or get help
   - Possible action item to "Discuss contractor support for David's absence"

---

### Meeting Controls Testing

**Step 9: Test Mute/Unmute**
1. Click "Mute" button
2. Speak something - avatar should NOT respond
3. Click "Unmute"
4. Speak again - avatar should respond

**Step 10: Test Interrupt**
1. While avatar is speaking a long response
2. Click "Interrupt" button
3. Avatar should stop speaking immediately

**Step 11: Test Pause/Resume**
1. Click "Pause" button
2. Status should show "Paused"
3. Click "Resume" button
4. Status should show "Active"

---

### Real-time Updates Testing

**Step 12: Verify Action Items Panel**
1. Check that all action items mentioned during the conversation appear
2. Try clicking the checkbox on an action item to mark it complete
3. Verify completed items show with strikethrough styling
4. Verify animations work when new items appear

**Step 13: Verify Transcript Panel**
1. Check all completed messages appear in order
2. Messages should be colour-coded (blue for Facilitator, grey for You)
3. Panel should auto-scroll to latest message

---

### End Meeting Testing

**Step 14: End the Meeting**
1. Click "End Meeting" button
2. You should be redirected back to the room lobby
3. Meeting status should be "ended" in the database

---

## Verification Checklist

### Avatar & Connection
- [ ] Avatar video renders correctly
- [ ] Connection status updates properly (idle -> connecting -> connected)
- [ ] Microphone controls work (mute/unmute)
- [ ] Interrupt stops avatar speech
- [ ] Disconnect properly closes connection

### Meeting State Machine
- [ ] Meeting can be created (lobby state)
- [ ] Meeting can be started (active state)
- [ ] Meeting can be paused
- [ ] Meeting can be resumed from paused
- [ ] Meeting can be ended
- [ ] End meeting redirects to lobby

### Voice Interaction
- [ ] User speech is transcribed and displayed
- [ ] Avatar responds contextually to room context
- [ ] Avatar acknowledges speaker updates
- [ ] Avatar extracts action items from conversation
- [ ] Avatar asks relevant follow-up questions

### Action Items
- [ ] Action items appear in real-time as extracted
- [ ] Action items show task and owner
- [ ] Checkboxes toggle completion status
- [ ] Framer-motion animations work on new items
- [ ] Completed items show strikethrough styling

### Transcript
- [ ] All messages appear in order
- [ ] User messages styled differently from avatar
- [ ] Auto-scrolls to latest message
- [ ] Shows speaker labels (Facilitator/You)

---

## Sample Utterances to Test

Use these phrases to test different extraction capabilities:

**Status Update:**
> "I completed the login page yesterday. Today I'm working on the forgot password flow. No blockers."

**With Blocker:**
> "I'm stuck waiting for design mockups from the UX team. Can someone follow up with them?"

**With Action Item:**
> "We need to schedule a code review session for Friday. John, can you set that up?"

**With Risk:**
> "I'm concerned we might miss the deadline because of the third-party API instability."

**Question:**
> "Has anyone tested the integration with the new payment provider yet?"

---

## Troubleshooting

**Avatar won't connect:**
- Check ANAM_API_KEY in .env.local
- Verify Anam session API returns valid token
- Check browser console for errors

**No action items extracted:**
- Check OPENAI_API_KEY in .env.local
- Verify process-turn API returns 200
- Check response in browser Network tab

**Transcript not updating:**
- Verify microphone permissions granted
- Check Anam connection state is "connected"
- Verify MESSAGE_STREAM_EVENT listener fires

**Meeting state not persisting:**
- Run `npx convex dev` to ensure Convex is connected
- Check Convex dashboard for meeting records
- Verify authentication token is valid
