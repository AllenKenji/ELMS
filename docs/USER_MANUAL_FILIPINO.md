# Manwal ng Gumagamit ng ELegislative

## 1. Layunin
Ang manwal na ito ay gabay sa pang-araw-araw na paggamit ng ELegislative system, kabilang ang:
- access ng user at mga role
- workflow ng ordinansa at resolusyon
- workflow ng komite at session
- panonood ng live session
- local recording at upload sa server
- karaniwang troubleshooting steps

## 2. Mga Role at Access
Role-based ang system. Maaaring mag-iba ang eksaktong permission ayon sa account configuration.

Karaniwang roles:
- Admin: buong pamamahala ng system, users, at configuration.
- Secretary: namamahala ng records, sessions, minutes, at recording workflows.
- Vice Mayor: may access sa leadership at session operations.
- Councilor: may-akda/co-author ng measures, sumasali sa sessions, live, at voting.
- Participant: sumasali sa assigned sessions at pinapayagang content.

### 2.1 Buod ng Kakayahan ng Bawat Role
- Admin:
   - gumawa/mag-edit/mag-deactivate ng users
   - buong session at workflow administration
   - maaaring magpatupad ng karamihan sa legislative lifecycle actions
- Secretary:
   - gumawa at mamahala ng sessions, participants, minutes, at order of business
   - mamahala ng workflow transitions tulad ng readings, agenda inclusion, posting/effectivity
   - mamahala ng recording at minutes attachments
- Vice Mayor:
   - committee assignment actions sa measure workflow
   - executive approval o rejection actions
   - nakikilahok sa session operations
- Councilor:
   - gumawa at mag-update ng proposed measures (ordinansa/resolusyon)
   - magsumite ng measures sa workflow at bumoto
   - lumahok sa committee at session activities
- Participant:
   - sumali sa pinapayagang sessions at manood ng allowed content
   - walang direktang workflow modification actions

### 2.2 Workflow Modification Matrix (Sino ang Puwedeng Magbago)
Ang matrix na ito ay batay sa kasalukuyang role guards sa backend routes.

| Workflow / Action | Mga Role na Puwedeng Mag-modify |
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

### 2.3 Notes sa Posibleng Pagkakaiba ng Access
- Maaaring magkaiba ang nakikitang UI buttons at aktwal na API authority.
- May ilang actions na kailangan ng assignment context (halimbawa: chairperson-specific updates).
- Maaaring mas higpitan pa ng lokal na policy/configuration ang permissions.

## 3. Pag-login
1. Buksan ang ELegislative login page.
2. Ilagay ang account credentials.
3. I-click ang Sign In.
4. Kapag hindi makapag-login:
   - i-verify ang username/email at password
   - i-check kung active ang account
   - makipag-ugnayan sa Admin o Secretary para sa reset kung kailangan

## 4. Pangunahing Modules
Karaniwang bahagi ng system:
- Dashboard: buod ng metrics, recent activity, at pending actions.
- Ordinances at Resolutions: paggawa, pagsusumite, review, at approval lifecycle.
- Committees: assignments, meetings, reports, at workflows.
- Sessions: agenda, participants, order of business, live, at recording.
- Notifications at Messages: updates at komunikasyon.
- Reports at Audit Logs: tracking at transparency.

### 4.1 Gabay sa Navigational Toolbar
Gamitin ang left sidebar o top navigation toolbar (depende sa layout) para lumipat sa modules.

- Dashboard:
   - Gamit: ipinapakita ang pending actions, recent records, at quick status indicators.
   - Karaniwang users: Admin, Secretary, Vice Mayor, Councilor.

- Calendar:
   - Gamit: ipinapakita ang nakaiskedyul na committee meetings at sessions ayon sa petsa.
   - Quick actions: Join Session at Watch Live mula sa event cards.
   - Karaniwang users: lahat ng roles na may session access.

- Ordinances at Resolutions:
   - Gamit: listahan ng proposed measures, drafts, at workflow status.
   - Karaniwang users: Councilor, Secretary, Vice Mayor, Admin.

- Committees:
   - Gamit: committee setup, membership, meetings, at recommendations.
   - Karaniwang users: Secretary, Vice Mayor, Councilor, Admin.

- Sessions:
   - Gamit: session records, agenda, participants, recording, at live panel.
   - Karaniwang users: Secretary, Vice Mayor, Councilor, Participant (view/join lamang), Admin.

- Order of Business:
   - Gamit: pamamahala ng session flow items, ordering, at document records.
   - Karaniwang users: Secretary, Admin.

- Minutes:
   - Gamit: paglikha at pag-update ng session minutes, transcripts, at recording links.
   - Karaniwang users: Secretary, Admin.

- Voting:
   - Gamit: voting sessions, ballot actions, at vote summaries.
   - Karaniwang users: Councilor, Secretary, Admin.

- Reports:
   - Gamit: pag-generate ng operational at legislative reports.
   - Karaniwang users: Councilor, Secretary, Admin.

- Notifications at Messages:
   - Gamit: system alerts, workflow updates, at internal communication.
   - Karaniwang users: lahat ng active users.

- User Management:
   - Gamit: paggawa/pag-edit ng users, role assignment, at account status management.
   - Karaniwang users: Admin.

- Audit Logs:
   - Gamit: talaan kung sino ang gumawa ng action at kailan para sa accountability.
   - Karaniwang users: Admin at authorized oversight roles.

## 4A. Workflow: Paggawa ng Proposed Measure at Resolution
Gamitin ang workflow na ito kapag gagawa ng bagong panukalang ordinansa o resolusyon.

### 4A.1 Gumawa ng Draft
1. Buksan ang Ordinances at Resolutions.
2. I-click ang Create New o New Proposed Measure.
3. Piliin ang uri ng measure:
   - Ordinance
   - Resolution
4. Punan ang required fields:
   - title
   - summary/rationale
   - legal basis (kung required)
   - category o subject area

### 4A.2 Itakda ang Author at Co-Authors
1. I-confirm ang pangunahing author/proponent.
2. Magdagdag ng co-authors kung naaangkop.
3. I-save ang draft metadata.

### 4A.3 Mag-attach ng Supporting Files
1. Mag-upload ng supporting documents kung mayroon:
   - draft text
   - committee notes
   - reference files
2. I-verify na lumabas ang attachments sa document list.

### 4A.4 Isumite sa Workflow
1. I-click ang Submit o Forward.
2. I-check kung nagbago ang status mula Draft to Submitted (o katumbas).
3. I-check kung lumabas sa pending review queue.

### 4A.5 Committee Review at Session Path
1. Re-reviewhin ng committee ang item at maglalagay ng recommendation:
   - APPROVE
   - REVISION
   - REJECTION
2. Ibabalik ang committee output sa secretary workflow.
3. Isasama ng Secretary ang recommended item sa session agenda para sa discussion/readings/voting at final status update.

## 4B. Workflow: Admin User Management (Paggawa ng User)
Gamitin ang workflow na ito kapag ang Admin ay gagawa ng bagong account.

### 4B.1 Buksan ang User Management
1. Mag-sign in gamit ang Admin account.
2. Buksan ang User Management.
3. I-click ang Create User o Add User.

### 4B.2 Ilagay ang User Information
1. Punan ang required fields:
   - buong pangalan
   - username o email
   - contact details (kung required)
   - temporary password (o system-generated password)
2. I-verify na walang duplicate na username o email.

### 4B.3 Itakda ang Role at Access
1. Piliin ang tamang role:
   - Secretary
   - Vice Mayor
   - Councilor
   - Participant
   - Admin (kung authorized)
2. Itakda ang status sa Active.
3. I-save ang account.

### 4B.4 I-validate ang Bagong Account
1. I-confirm na lumabas ang user sa User Management list.
2. I-confirm na tama ang role at status.
3. Ipa-change password sa first login kung required ng policy.

## 5. Paggawa at Pamamahala ng Session
### 5.1 Gumawa ng Session
1. Buksan ang Sessions.
2. I-click ang Create Session.
3. Punan ang required fields:
   - title
   - date
   - time
   - location
   - agenda
4. I-save.

### 5.2 I-edit ang Session
1. Buksan ang Sessions.
2. Piliin ang target session.
3. I-click ang Edit.
4. I-update ang detalye at i-save.

### 5.3 Session Details Tabs
Sa Session Details, gamitin ang tabs tulad ng:
- Details
- Order of Business
- Agenda
- Recording
- Ordinances
- Participants

## 6. Pagsali at Pamamahala ng Participants
### 6.1 Sumali sa Session
1. Buksan ang Session Details.
2. Pumunta sa Participants o gamitin ang Join Session button.
3. I-click ang Join Session.

### 6.2 Inclusion ng Participants
Maaaring kabilang ang participants:
- users na manual na idinagdag sa session
- authors at co-authors ng proposed measures, depende sa workflow configuration

## 7. Committee Workflow
Karaniwang cycle ng komite:
1. committee scheduling
2. deliberation at hearing
3. committee report drafting
4. recommendation outcome:
   - APPROVE
   - REVISION
   - REJECTION
5. pagsumite sa Secretary para maisama sa susunod na session flow

## 8. Live Session Workflow
### 8.1 Pagsisimula ng Live
1. Buksan ang Session Details.
2. Pumunta sa Recording tab.
3. Sa Live Session panel, i-click ang Start Live (kung pinapayagan ang role mo).
4. I-confirm ang screen o window sharing sa browser prompt.

### 8.2 Panonood ng Live
1. Buksan ang parehong session gamit ang ibang pinapayagang account.
2. Pumunta sa Recording tab.
3. Lalabas ang live stream kapag active.
4. I-verify ang host label: Live started by: pangalan.

### 8.3 Mahahalagang Tala sa Host
- Kapag single browser tab lang ang ni-share, puwedeng mag-black output kapag lumipat ng tab.
- Para stable habang nagpapalit ng task, i-share ang window o entire screen.

## 9. Local Recording Workflow
### 9.1 Simulan ang Recording
1. Buksan ang Session Details > Recording tab.
2. Sa Session Recording panel, i-click ang Start Local Recording.
3. I-confirm ang capture source sa browser prompt.
4. Hintayin na tumaas ang chunk at KB sa Capture Diagnostics.

### 9.2 Stop at Save
1. I-click ang Stop and Save.
2. Hintayin ang recording finalization.
3. Sa recorder panel, i-click ang Download local copy.
4. I-check kung nasa browser download location ang file.

### 9.3 Attach sa Server Minutes
Kung enabled ang server sync, ia-upload ang recording sa session minutes pagkatapos ng local finalization.

## 10. Pag-record ng Active Live Session (Para sa Secretary)
Kapag may active live host:
- Maaaring panoorin ng Secretary ang active live stream sa Recording tab.
- Idinisenyo ang recording ng Secretary para i-capture ang active live stream kapag available.
- Kung walang remote live stream, babalik sa local capture path ang recorder.

## 11. Calendar-Based Access
Sa calendar event cards:
- Join Session: binubuksan ang napiling session.
- Watch Live: binubuksan ang Session Details sa Recording tab para sa mabilis na panonood.

## 12. Minutes at Recordings
- Ang recordings ay naka-attach sa session minutes records.
- Kung walang minutes record, maaaring awtomatikong gumawa nito sa upload.
- Makikita ang uploaded recordings sa Attached Session Minutes list.

## 13. Troubleshooting
### 13.1 Black screen ang live
I-check:
- active na nagse-share ang host ng valid window o screen
- hindi lumipat ang host mula sa single-tab share source
- may session access ang viewer
- may receive video sa live diagnostics

### 13.2 0 chunks sa recording diagnostics
I-check:
- talagang nagsimula ang recording
- pinayagan ang capture permission sa browser
- active at visible ang capture source
- updated desktop Chrome o Edge ang gamit

### 13.3 Na-download pero hindi ma-open ang file
I-check:
- may sapat na recording duration (ilang segundo)
- tumataas ang chunk at KB diagnostics bago mag-stop
- gamitin ang Download local copy mula sa recorder panel
- iwasan ang pag-open ng lumang file na kapareho ang pangalan

### 13.4 Walang local download link
I-check:
- umabot ang recording sa stop/finalize state
- walang page refresh bago matapos ang finalize
- subukan ulit at hintayin ang final status message

### 13.5 Unauthorized (401)
I-check:
- valid pa ang account session/token
- mag-log out at mag-log in ulit
- i-verify kung may tamang access ang role sa endpoint/action

## 14. Best Practices
- Panatilihing bukas ang Session Details habang nagfa-finalize ang recording.
- Mag-record ng hindi bababa sa 5 hanggang 10 segundo para sa validation.
- I-check ang diagnostics at final file size sa bawat test recording.
- Gumamit ng consistent na role accounts sa host at viewer testing.
- Mas stable ang window o entire-screen capture kaysa single-tab sharing.

## 15. Quick Checklist para sa Secretaries
Bago ang session:
- i-verify ang date/time/location
- i-verify ang participants list
- i-verify ang agenda at order of business

Habang session:
- i-confirm ang live host label
- i-monitor ang live diagnostics
- simulan ang recording at i-confirm ang chunk growth

Pagkatapos ng session:
- i-stop ang recording at i-download ang local copy
- i-confirm na nabubuksan ang file
- i-verify ang upload sa minutes record
- i-confirm na visible ang recording sa attached minutes list

## 16. Support at Escalation
Kung nagpapatuloy ang issue pagkatapos ng troubleshooting:
1. kumuha ng screenshot ng diagnostics area
2. itala ang role, session ID, at timestamp
3. ilista ang eksaktong steps na ginawa
4. ilakip ang browser console errors kung mayroon

---
Bersyon ng dokumento: 1.0 (Filipino)
Huling update: 2026-07-08
