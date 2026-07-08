# ELegislative User Manual

## 1. Purpose
This manual explains how to use the ELegislative system for day-to-day legislative operations, including:
- user access and roles
- ordinance and resolution workflows
- committee and session workflows
- live session viewing
- local recording and server upload
- common troubleshooting steps

## 2. Roles and Access
The system uses role-based access. Actual permissions may vary by your account configuration.

Common roles:
- Admin: full system management, user and configuration control.
- Secretary: manages records, sessions, minutes, and recording workflows.
- Vice Mayor: participates in leadership workflows and session operations.
- Councilor: authors and co-authors measures, joins sessions, participates in live and voting activities.
- Participant: joins assigned sessions and views allowed content.

## 3. Signing In
1. Open the ELegislative login page.
2. Enter your account credentials.
3. Click Sign In.
4. If login fails:
   - verify username/email and password
   - confirm your account is active
   - ask Admin or Secretary to reset credentials if needed

## 4. Main Areas
Typical modules in the system:
- Dashboard: summary metrics, recent activity, pending actions.
- Ordinances and Resolutions: create, submit, review, approve lifecycle.
- Committees: assignments, meetings, reports, workflows.
- Sessions: agenda, participants, order of business, live, recording.
- Notifications and Messages: updates and communication.
- Reports and Audit Logs: tracking and transparency.

## 4A. Workflow: Creating a Proposed Measure and Resolution
Use this workflow when creating a new legislative proposal (ordinance or resolution).

### 4A.1 Create Draft
1. Open Ordinances and Resolutions.
2. Click Create New or New Proposed Measure.
3. Select measure type:
   - Ordinance
   - Resolution
4. Fill required draft fields:
   - title
   - summary or rationale
   - legal basis or reference (if required)
   - category or subject area

### 4A.2 Set Author and Co-Authors
1. Confirm the main author/proponent.
2. Add co-authors when applicable.
3. Save draft metadata.

### 4A.3 Attach Supporting Files
1. Upload supporting documents (if available):
   - draft text
   - committee notes
   - reference files
2. Verify each attachment appears in the document list.

### 4A.4 Submit for Workflow
1. Click Submit or Forward.
2. Confirm status changes from Draft to Submitted (or equivalent).
3. Confirm the item appears in pending review queues.

### 4A.5 Committee Review Path
1. Assigned committee opens the submitted item.
2. Committee deliberates and records recommendation:
   - APPROVE
   - REVISION
   - REJECTION
3. Committee report is returned to secretary workflow.

### 4A.6 Session Inclusion and Final Action
1. Secretary includes approved/recommended item in session agenda.
2. Item proceeds through session discussion, readings, or voting.
3. Final status updates based on decision (for example: Approved, Returned for Revision, Rejected, Published).

### 4A.7 Quick Validation Checklist
- Title and measure type are correct.
- Author and co-authors are complete.
- Required attachments are uploaded.
- Status changed successfully after submit.
- Committee recommendation is recorded.
- Session agenda inclusion is confirmed when ready.

## 4B. Workflow: Admin User Management (Create User)
Use this workflow when the Admin needs to create a new account.

### 4B.1 Open User Management
1. Sign in using an Admin account.
2. Open User Management.
3. Click Create User or Add User.

### 4B.2 Enter User Information
1. Fill required fields:
   - full name
   - username or email
   - contact details (if required)
   - temporary password (or system-generated password)
2. Verify there are no duplicate usernames or emails.

### 4B.3 Assign Role and Access
1. Select the role:
   - Secretary
   - Vice Mayor
   - Councilor
   - Participant
   - Admin (only when authorized)
2. Set status to Active.
3. Save user account.

### 4B.4 Validate New Account
1. Confirm the user appears in the User Management list.
2. Confirm role and status are correct.
3. Ask the new user to sign in and change password on first login (if policy requires).

## 5. Creating and Managing Sessions
### 5.1 Create a Session
1. Open Sessions.
2. Click Create Session.
3. Fill required fields:
   - title
   - date
   - time
   - location
   - agenda
4. Save.

### 5.2 Edit a Session
1. Open Sessions.
2. Select the target session.
3. Click Edit.
4. Update details and save.

### 5.3 Session Details Tabs
Inside Session Details, use tabs such as:
- Details
- Order of Business
- Agenda
- Recording
- Ordinances
- Participants

## 6. Joining and Managing Participants
### 6.1 Join a Session
1. Open Session Details.
2. Go to Participants or use Join Session button.
3. Click Join Session.

### 6.2 Participant Inclusion
Participants may include:
- users manually added to the session
- authors and co-authors of proposed measures, when configured by workflow

## 7. Committee Workflow
Typical committee cycle:
1. committee scheduling
2. deliberation and hearing
3. committee report drafting
4. recommendation outcome:
   - APPROVE
   - REVISION
   - REJECTION
5. submission to Secretary for inclusion in next session flow

## 8. Live Session Workflow
### 8.1 Starting Live
1. Open Session Details.
2. Go to Recording tab.
3. In Live Session panel, click Start Live (if your role is allowed).
4. Confirm screen or window sharing when prompted.

### 8.2 Viewing Live
1. Open the same session in another allowed account.
2. Go to Recording tab.
3. Live stream appears when active.
4. Verify host label: Live started by: <name>.

### 8.3 Host Behavior Notes
- If you share only one browser tab, switching away can produce black output.
- For stable output when switching work context, share a window or entire screen.

## 9. Local Recording Workflow
### 9.1 Start Recording
1. Open Session Details > Recording tab.
2. In Session Recording panel, click Start Local Recording.
3. Confirm capture source in browser prompt.
4. Wait until Capture Diagnostics shows chunk and KB growth.

### 9.2 Stop and Save
1. Click Stop and Save.
2. Wait for recording finalization.
3. In the recorder panel, click Download local copy.
4. Confirm file appears in your browser download location.

### 9.3 Attach to Server Minutes
If server sync is enabled, recording uploads to session minutes automatically after local finalization.

## 10. Recording the Active Live Session (Secretary Use)
When a live host is active:
- Secretary can watch the active live stream in Recording tab.
- Secretary recording is designed to capture the active live stream feed when available.
- If no remote live stream exists, recorder may fall back to local capture path.

## 11. Calendar-Based Access
From calendar event cards:
- Join Session opens the selected session.
- Watch Live opens Session Details directly to the Recording tab for quick viewing.

## 12. Minutes and Recordings
- Recordings are attached to session minutes records.
- If no minutes record exists, workflow may auto-create one on upload.
- Uploaded recordings can be opened from Attached Session Minutes list.

## 13. Troubleshooting
### 13.1 Live shows black screen
Check:
- host is actively sharing a valid window or screen
- host did not switch away from a single-tab share source
- viewer account has session access
- live diagnostics show receive video is present

### 13.2 Recording diagnostics show 0 chunks
Check:
- recording actually started
- capture permission granted by browser
- capture source stays active and visible
- browser is current desktop Chrome or Edge

### 13.3 File downloads but cannot open
Check:
- recorded duration is at least several seconds
- chunk and KB diagnostics were increasing before stop
- use Download local copy from recorder panel after stop
- avoid opening old files with the same name from previous attempts

### 13.4 No local download link appears
Check:
- recording reached stop/finalize state
- no page refresh occurred before finalize finished
- try recording again and wait for final status message

### 13.5 Unauthorized errors (401)
Check:
- account session/token still valid
- log out and log back in
- verify user role has endpoint access

## 14. Best Practices
- Keep session details open while recording finalizes.
- Record at least 5 to 10 seconds before stopping for validation.
- Verify diagnostics and final file size after each test recording.
- Use consistent role accounts for host and viewer testing.
- Prefer window or entire screen capture over single-tab sharing for live reliability.

## 15. Quick Checklist for Secretaries
Before session:
- verify session date/time/location
- verify participants list
- verify agenda and order of business

During session:
- confirm live host label
- monitor live diagnostics
- start recording and confirm chunk growth

After session:
- stop recording and download local copy
- confirm file opens locally
- verify upload to minutes record
- confirm recording visible in attached minutes list

## 16. Support and Escalation
If issues persist after troubleshooting:
1. capture screenshot of diagnostics area
2. note role used, session ID, and timestamp
3. report exact steps performed
4. attach any browser console errors if available

---
Document version: 1.0
Last updated: 2026-07-08
