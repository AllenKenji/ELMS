🏛 Steps to Create a Committee in ELMS
1. Committee Database Setup
Predefine standing committees (Finance, Health, Education, Infrastructure, etc.) in the system.

Store metadata: committee name, scope, description, and type (standing, special/ad hoc, oversight).

2. Measure Referral
When a councilor proposes a measure:

The system tags it by subject matter (e.g., budget → Finance Committee).

Automatically routes it to the relevant standing committee.

If no suitable committee exists, the system prompts the presiding officer to create a special committee.

3. Committee Creation Workflow
Initiation: Only the Vice Mayor or an authorized Admin can initiate committee creation by clicking “Create Committee.”

Form Fields:

Committee Name

Type (Standing / Special / Oversight)

Scope or Purpose

Duration (for special committees)

Membership Assignment:

Add councilors as members.

Assign a chairperson and vice-chairperson.

Ensure proportional representation if required by rules.

4. Approval & Activation
The system logs the committee creation in the council’s records.

Members receive notifications of their assignment.

Committee status changes to “Active,” ready to deliberate measures.

5. Tracking & Monitoring
ELMS tracks:

Hearings scheduled

Reports submitted

Recommendations forwarded to the council

Provides dashboards for transparency and accountability.

📊 Example Data Structure (Simplified)
Committee Table

Committee_ID

Name

Type (Standing, Special, Oversight)

Scope

Status (Active/Inactive)

Committee_Members Table

Member_ID

Committee_ID

Role (Chair, Vice-Chair, Member)

Measure_Referral Table

Measure_ID

Committee_ID

Referral_Date

Status (Pending, In Committee, Reported)

✅ In practice: Committees are created once (standing) or as needed (special), and ELMS automates the referral of measures to them. This avoids duplication and ensures every measure is properly tracked from proposal to final action.