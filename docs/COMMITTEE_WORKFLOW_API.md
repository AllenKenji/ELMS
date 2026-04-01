# Committee Workflow API

## Endpoints

- `POST /committee-workflow/` — Create a new workflow entry
- `GET /committee-workflow/item/:item_type/:item_id` — Get all workflows for a specific item (ordinance/resolution)
- `PUT /committee-workflow/:id/status` — Update workflow status
- `GET /committee-workflow/committee/:committee_id` — Get all workflows for a committee

## Model
- Tracks item type (ordinance/resolution), item id, committee id, status, remarks, and last action date.

## Example Workflow Statuses
- pending
- in_review
- hearing
- reported
- completed

## Usage
- Assign an ordinance/resolution to a committee by creating a workflow entry.
- Update status as the committee reviews, holds hearings, and reports.
- Query workflow status for an item or committee.
