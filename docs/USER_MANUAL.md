# ELegislative User Manual

## 1. Purpose
This manual explains how to use the ELegislative system in a technical, click-by-click way for day-to-day legislative operations, including:
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

### 2.1 Role Capability Summary
- Admin:
   - create, edit, and deactivate users
   - manage sessions, committees, measures, and audit controls
   - override or complete workflow actions when needed
- Secretary:
   - create and manage sessions, participants, minutes, and order of business
   - manage readings, agenda inclusion, recordings, and official records
   - keep committee and session workflows moving
- Vice Mayor:
   - assign committees to proposed measures
   - approve or reject items at the executive stage
   - participate in leadership and session operations
- Councilor:
   - create and update ordinances or resolutions
   - submit measures into workflow and cast votes when allowed
   - participate in committee and session activities
- Participant:
   - join assigned sessions and view permitted content
   - no direct workflow modification actions

### 2.2 Workflow Modification Matrix (Who Can Modify What)
The matrix below reflects current role guards configured in backend routes.

| Workflow / Action | Roles Allowed to Modify |
| --- | --- |
| User Management: create/edit users | Admin |
| Sessions: create/edit session | Secretary, Admin |
| Sessions: delete session | Admin |
| Sessions: add participants / add from OOB | Secretary, Admin |
| Order of Business: create/update/reorder/status/documents | Secretary, Admin |
| Minutes: create/generate/transcribe/update/delete | Secretary, Admin |
| Proposed Measures (Ordinance/Resolution): create draft | Councilor, Admin |
| Proposed Measures: update draft/content | Secretary, Councilor, Admin |
| Proposed Measures: delete item | Secretary, Admin |
| Proposed Measures: submit to Vice Mayor | Councilor, Admin |
| Proposed Measures: first reading / second reading | Secretary, Admin |
| Proposed Measures: assign committee | Vice Mayor, Secretary, Admin |
| Proposed Measures: committee report | Councilor, Committee Secretary, Admin |
| Proposed Measures: open/close voting | Secretary, Admin |
| Proposed Measures: cast vote | Councilor, Secretary, Admin |
| Proposed Measures: executive approval/rejection | Vice Mayor, Admin |
| Proposed Measures: post publicly / mark effective | Secretary, Admin |
| Votes module: create/close vote session, cast vote | Councilor, Secretary, Admin |
| Votes module: delete vote session | Admin |
| Reports: create/update | Councilor, Secretary, Admin |
| Reports: delete | Secretary, Admin |
| Committee setup: create committee | Vice Mayor, Admin |
| Committee setup: update committee | Assigned Chairperson, Vice Mayor, Admin |
| Committee setup: delete committee | Admin |
| Committee membership: add/remove members | Secretary, Admin |

### 2.3 Notes on Access Variations
- UI visibility can differ from API authority; some buttons may be hidden even if API role allows action.
- Some actions also require assignment context (for example: chairperson-specific committee updates).
- If your LGU policy is stricter, Admin configuration may further limit permissions.

### 2.4 What Each Role Clicks
Use this table when you want the short version of the actual screens and buttons each role uses.

| Role | What to open | What to click | What to finish |
| --- | --- | --- | --- |
| Admin | User Management, Sessions, Committees, Audit Logs | Click Create User, Edit, Delete, Save, or admin-only overrides | Confirm users, logs, and configuration are correct |
| Secretary | Sessions, Minutes, Order of Business, Ordinances and Resolutions | Click Create Session, Edit, Add Participants, Create Minutes, Start Recording, Submit or Forward | Confirm official records, uploads, and agenda items are complete |
| Councilor | Ordinances and Resolutions, Voting, Assigned Committees, Sessions | Click New Proposed Measure, Save Draft, Submit, Cast Vote, or open committee review items | Confirm the measure moved to the next workflow stage |
| Committee Secretary | Committee Meetings, Committee Minutes, Assigned Ordinances or Resolutions | Click + Create Meeting, Start Local Recording, mark attendance, save minutes, submit committee report | Confirm quorum, attendance, and committee recommendation are recorded |
| Vice Mayor | Committees, Proposed Measures, Session workflow | Click Assign Committee, Approve, Reject, or open committee setup screens | Confirm the committee assignment or executive action is finished |
| Participant | Sessions and live or recording views | Click Join Session, Watch Live, or open an allowed session page | Review the session content without editing workflow data |

### 2.5 Role Click Sequences
Use these exact screen trails when you need the shortest literal path for each role.

- Admin:
   - User Management > Create User > Save
   - Sessions > Create Session > Save
   - Committees > Create Committee > Save
   - Audit Logs > Refresh

- Secretary:
   - Sessions > Create Session > Save
   - Sessions > Session List > Session Details > Participants > Add Participant > Save
   - Ordinances and Resolutions > Proposed Measure List > Measure Details > Submit
   - Minutes > Create Minutes > Save Minutes
   - Sessions > Session List > Session Details > Recording > Start Local Recording > Stop and Save > Download local copy

- Councilor:
   - Ordinances and Resolutions > Proposed Measure List > Create New > Save Draft > Submit
   - Ordinances and Resolutions > Proposed Measure List > Measure Details > Committee Review
   - Voting > Vote Sessions > Vote Detail > Cast Vote
   - Sessions > Session List > Session Details > Join Session

- Committee Secretary:
   - Committees > Committee List > Committee Details > Meetings > + Create Meeting
   - Committees > Committee Details > Meetings > Meeting Detail > Start Local Recording > Stop and Save > Download local copy
   - Committee Minutes > Minutes List > New Minutes > Save Minutes
   - Committee Minutes > Minutes Detail > Submit Committee Report

- Vice Mayor:
   - Committees > Committee List > Committee Details > Edit
   - Proposed Measures > Measure Details > Assign Committee
   - Proposed Measures > Measure Details > Approve or Reject
   - Sessions > Session List > Session Details > Review Agenda

- Participant:
   - Sessions > Session List > Session Details > Participants > Join Session
   - Sessions > Session List > Session Details > Recording > Watch Live
   - Sessions > Session List > Session Details > Recording > Open Recording

## 3. Signing In
1. Open the ELegislative login page.
2. Type your username or email and password.
3. Click Sign In.
4. Wait for the dashboard to load.
5. If login fails:
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

### 4.1 Navigational Toolbar Guide
Use the left sidebar or top navigation toolbar (depending on layout) to move between modules.

- Dashboard:
   - What it does: shows pending actions, recent records, and quick status indicators.
   - Typical users: Admin, Secretary, Vice Mayor, Councilor.

- Calendar:
   - What it does: shows scheduled committee meetings and sessions by date.
   - Quick actions: Join Session and Watch Live from event cards.
   - Typical users: all roles with session access.

- Ordinances and Resolutions:
   - What it does: opens proposed measure lists, drafts, and workflow status.
   - Typical users: Councilor, Secretary, Vice Mayor, Admin.

- Committees:
   - What it does: opens committee setup, membership, meetings, and recommendations.
   - Typical users: Secretary, Vice Mayor, Councilor, Admin.

- Sessions:
   - What it does: opens session records, agenda, participants, recording, and live panel.
   - Typical users: Secretary, Vice Mayor, Councilor, Participant (view/join only), Admin.

- Order of Business:
   - What it does: manages session flow items, ordering, and document records.
   - Typical users: Secretary, Admin.

- Minutes:
   - What it does: creates and updates session minutes, transcripts, and recording links.
   - Typical users: Secretary, Admin.

- Voting:
   - What it does: opens voting sessions, ballot actions, and vote summaries.
   - Typical users: Councilor, Secretary, Admin.

- Reports:
   - What it does: generates operational and legislative reports.
   - Typical users: Councilor, Secretary, Admin.

- Notifications and Messages:
   - What it does: system alerts, workflow updates, and internal communication.
   - Typical users: all active users.

- User Management:
   - What it does: create/edit users, assign roles, and manage account status.
   - Typical users: Admin.

- Audit Logs:
   - What it does: tracks who did what action and when for accountability.
   - Typical users: Admin, authorized oversight roles.

### 4.2 Common Click Path Rules
- Open the module from the sidebar first, then choose the record you want to work on.
- Use page buttons such as Create New, Edit, Save, Submit, Delete, or Refresh after opening a record.
- If a button is missing, check your role or assignment before assuming the feature is broken.

### 4.3 UI Click Paths by Module
Use these paths as the default click sequence for each major screen. Button labels may vary slightly by role, but the flow is the same.

| Module | Screen Path | Primary Buttons |
| --- | --- | --- |
| Dashboard | Dashboard | Refresh, open any pending item card |
| Ordinances and Resolutions | Ordinances and Resolutions > Proposed Measure List > Measure Details | Create New, New Proposed Measure, Save Draft, Submit, Forward, Edit, Delete |
| Committees | Committees > Committee List > Committee Details | Create Committee, Edit, Delete, Add Member, View Meetings |
| Committee Meetings | Committees > Committee Details > Meetings | + Create Meeting, Edit, Delete, Start Local Recording, Stop and Save, Download local copy |
| Committee Minutes | Committee Minutes > Minutes List > Minutes Detail | New Minutes, Edit, Save Minutes, Delete, View |
| Sessions | Sessions > Session List > Session Details | Create Session, Edit, Delete, Save, Add Participant, Join Session |
| Session Details | Sessions > Session List > Session Details > Tabs | Details, Order of Business, Agenda, Recording, Ordinances, Participants |
| Recording | Sessions > Session Details > Recording | Start Live, Start Local Recording, Stop and Save, Download local copy |
| Order of Business | Order of Business > Order of Business List > Item Detail | Create Item, Edit, Reorder, Save, Delete, Add Document |
| Voting | Voting > Vote Sessions > Vote Detail | Create Vote Session, Open Vote, Close Vote, Cast Vote, Delete Vote Session |
| Reports | Reports > Report List > Report Detail | Create Report, Edit, Save, Delete, Export |
| Notifications | Notifications > Notification List | Refresh, Select All, Delete Selected, Mark Read, Mark Unread |
| Messages | Messages > Message List | New Message, Open, Reply, Delete |
| User Management | User Management > User List > User Detail | Create User, Edit, Deactivate, Save, Delete |
| Audit Logs | Audit Logs > Log List > Log Detail | Refresh, Filter, View Details |

## 4A. Workflow: Creating a Proposed Measure and Resolution
Ordinances and Resolutions > Proposed Measure List > Create New > Ordinance or Resolution > Title, Summary or Rationale, Legal Basis or Reference, Category or Subject Area > Save Draft

Ordinances and Resolutions > Proposed Measure List > Measure Details > Author and Co-Authors > Save

Ordinances and Resolutions > Proposed Measure List > Measure Details > Attachments > Upload Document > Save

Ordinances and Resolutions > Proposed Measure List > Measure Details > Submit > Draft becomes Submitted

Committee Review Queue > Measure Details > Committee Action Panel > APPROVE, REVISION, or REJECTION > Save Report

Sessions > Order of Business > Add to Agenda > Include in Session

Sessions > Session Details > Agenda Item > Readings > Discussion > Voting > Save Final Result

### 4A. Quick Validation Checklist
- Create New opens the draft form.
- Save Draft stores the ordinance or resolution.
- Submit moves the item into review.
- Save Report stores the committee recommendation.
- Add to Agenda places the item in the session workflow.

## 4B. Workflow: Admin User Management (Create User)
User Management > User List > Create User > Full Name, Username or Email, Contact Details, and Temporary Password > Secretary, Vice Mayor, Councilor, Participant, or Admin > Active > Save

User Management > User List > User Detail > Confirm Role and Status > Save

Sign In > First Login > Change Password

## 5. Creating and Managing Sessions
Sessions > Session List > Create Session > Title, Date, Time, Location, and Agenda > Save

Sessions > Session List > Session Details > Edit > Update Details > Save

Sessions > Session List > Session Details > Details / Order of Business / Agenda / Recording / Ordinances / Participants

## 6. Joining and Managing Participants
Sessions > Session List > Session Details > Participants > Join Session

Sessions > Session List > Session Details > Participants > Add Participant > Select User > Save

Sessions > Session List > Session Details > Participants > Add from OOB > Select User > Save

## 7. Committee Workflow
Committees > Committee Meetings > + Create Meeting > Title, Date, Time, Meeting Mode, Meeting Link, Meeting Place > Create Meeting

Committees > Committee Meetings > Meeting Detail > Attendance > Mark Present Members > Quorum indicator

Committee Minutes > Minutes List > New Minutes > Recommendation and Notes > Save Minutes

Committee Minutes > Minutes Detail > Submit Committee Report

## 8. Live Session Workflow
Sessions > Session Details > Recording > Start Live > Screen, Window, or Browser Tab > Share or Start Broadcast

Sessions > Session Details > Recording > Live Stream Panel > Verify Host Label and Video Preview

Sessions > Session Details > Recording > Stop Live

## 9. Local Recording Workflow
Sessions > Session Details > Recording > Start Local Recording > Capture Source > Capture Diagnostics

Sessions > Session Details > Recording > Stop and Save > Download local copy

Sessions > Session Details > Recording > Upload to Session Minutes

## 10. Recording the Active Live Session (Secretary Use)
Sessions > Session Details > Recording > Live Stream Panel > View Active Stream

Sessions > Session Details > Recording > Start Local Recording > Stop and Save > Download local copy

## 11. Calendar-Based Access
Calendar > Event Card > Join Session

Calendar > Event Card > Watch Live

Calendar > Event Card > Session Details > Recording

## 12. Minutes and Recordings
Minutes > Minutes List > Minutes Detail > View or Edit

Minutes > Minutes Detail > Transcript, Attendees, and Recording Links

Sessions > Session Details > Recording > Upload to Session Minutes > Attached Session Minutes List

## 13. Troubleshooting
### 13.1 Live shows black screen
Sessions > Session Details > Recording > Live Stream Panel > verify host sharing source

Sessions > Session Details > Recording > Live Stream Panel > confirm the host did not switch away from a single-tab share

Sessions > Session Details > Recording > Live Stream Panel > verify the viewer account has session access

Sessions > Session Details > Recording > Live Stream Diagnostics > confirm Receive Video is present

### 13.2 Recording diagnostics show 0 chunks
Sessions > Session Details > Recording > Start Local Recording > confirm the recorder state changes to active

Browser prompt > Grant capture permission

Sessions > Session Details > Recording > Capture Source > keep the selected window, tab, or screen active

Browser > Use current desktop Chrome or Edge

### 13.3 File downloads but cannot open
Sessions > Session Details > Recording > verify the recording ran for several seconds before stopping

Sessions > Session Details > Recording > Capture Diagnostics > confirm chunk count and KB size increased before Stop and Save

Sessions > Session Details > Recording > Download local copy > open the newly downloaded file

Downloads folder > avoid opening an older file with the same name

### 13.4 No local download link appears
Sessions > Session Details > Recording > Stop and Save > wait for finalize to complete

Browser > do not refresh the page during finalization

Sessions > Session Details > Recording > retry the capture and wait for the final status message

### 13.5 Unauthorized errors (401)
Sign Out > Sign In > confirm the session token is refreshed

User Management > User Detail > verify the assigned role has access to the target module

If the screen still returns 401, recheck the module path against the current role guard.

## 14. Best Practices
- Sessions > Session Details > Recording > keep the screen open until Stop and Save finishes finalizing.
- Sessions > Session Details > Recording > run each test capture for at least 5 to 10 seconds before stopping.
- Sessions > Session Details > Recording > Capture Diagnostics > verify chunk count, KB growth, and final file size after each test.
- Use separate host and viewer accounts for live testing so role access can be validated cleanly.
- Browser prompt > prefer Window or Entire Screen capture over Single Tab sharing for more stable live output.

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

## 17. Screen Index
This index lists the main routed screens that exist in the current app. Use it as the final completeness check for the manual.

| Route | Screen Name | Typical Access |
| --- | --- | --- |
| `/` | Login | All users before sign-in |
| `/forgot-password` | Forgot Password | Public auth screen |
| `/register` | Register | Public auth screen |
| `/dashboard` | Role Dashboard | Depends on signed-in role |
| `/dashboard/committee-secretary` | Committee Secretary Panel | Committee Secretary |
| `/dashboard/proposed-measures` | Proposed Measures | Admin, Secretary, Councilor, Vice Mayor, Committee Secretary |
| `/dashboard/drafts` | Drafts | Admin, Secretary, Councilor |
| `/dashboard/sessions` | Sessions | Admin, Secretary, Councilor, Vice Mayor, Resident |
| `/dashboard/order-of-business` | Order of Business | Admin, Secretary, Councilor, Vice Mayor |
| `/dashboard/committees` | Committees | Admin, Secretary, Councilor, Vice Mayor, Resident |
| `/dashboard/committee-meetings` | Committee Meetings | Committee Secretary, Admin, Secretary, Vice Mayor, Councilor |
| `/dashboard/ordinances` | Ordinances | Admin, Secretary, Councilor, Vice Mayor, Resident |
| `/dashboard/resolutions` | Resolutions | Admin, Secretary, Councilor, Vice Mayor, Resident |
| `/dashboard/calendar` | Events Calendar | All signed-in roles with access |
| `/dashboard/reports` | Reports | Admin, Secretary, Councilor, Vice Mayor |
| `/dashboard/minutes` | AI Meeting Minutes | Admin, Secretary, Committee Secretary |
| `/dashboard/messages` | Messages | Signed-in users with messaging access |
| `/dashboard/notifications` | Notifications | All signed-in users |
| `/dashboard/users` | User Management | Admin |
| `/dashboard/audit-logs` | Audit Logs | Admin |
| `/dashboard/system-settings` | System Settings | Admin |

## 18. Manual Completion Check
The manual is complete when all of the following are covered:
- login and account recovery screens
- every routed screen in the current app
- role-based click paths for the main workflows
- technical steps for session, committee, minutes, recording, and voting operations
- troubleshooting and validation steps for live and local recording

---
Document version: 1.1
Last updated: 2026-07-09
