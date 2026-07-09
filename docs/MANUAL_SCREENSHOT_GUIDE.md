# ELegislative Manual Screenshot Guide

Use this guide to populate visual placeholders in the printable manual file at docs/USER_MANUAL_PRINT.html before exporting to PDF.

## 1. Recommended Screenshot Specs
- Format: PNG
- Width: 1400 to 1800 px
- Aspect ratio: 16:9 or close
- UI zoom: 100%
- Browser: Chrome or Edge desktop
- Hide sensitive data before capture

## 2. Recommended File Names
- session-create-form.png
- session-edit-form.png
- proposed-measure-create.png
- proposed-measure-authors.png
- proposed-measure-attachments.png
- proposed-measure-submitted-status.png
- proposed-measure-committee-to-session.png
- admin-user-management-create-user.png
- live-start-panel.png
- live-viewer-panel.png
- recording-chunk-diagnostics.png
- recording-download-local-copy.png

## 3. Capture Tips per Screen
- Session Form: show required fields clearly.
- Proposed Measure: include measure type selector and title field.
- Authors: include author and co-author fields.
- Attachments: show upload control and uploaded file list.
- Submitted Status: include current status badge/label.
- Committee to Session: show recommendation and agenda inclusion evidence.
- Admin Create User: show user form fields, role selector, and active status control.
- Live Start: show Start Live and host label.
- Live Viewer: show remote stream and diagnostics.
- Recording Diagnostics: show chunk and KB growth.
- Download Local Copy: show visible download link after stop.

## 4. PDF Export Steps
1. Open docs/USER_MANUAL_PRINT.html in browser.
2. Replace each placeholder box with the corresponding image.
3. Press Ctrl+P.
4. Choose Save as PDF.
5. Use A4 paper size and default margins.

## 5. Quality Check Before Final PDF
- All placeholders replaced
- Text remains readable
- No confidential data visible
- Page breaks look clean
- Final PDF opens correctly

## 6. Manual PDF Generation (Operator Steps)

Follow this when you want to replace screenshots yourself and generate a fresh PDF without terminal commands.

### 6.1 Replace Screenshot Files
1. Save your screenshots in the `docs/` folder.
2. Use the exact filenames expected by the printable manual:
	- `proposed-measure-create.png`
	- `proposed-measure-authors.png`
	- `proposed-measure-attachments.png`
	- `proposed-measure-submitted-status.png`
	- `proposed-measure-committee-to-session.png`
	- `admin-user-management-create-user.png`
	- `session-create-form.png`
	- `live-start-panel.png`
	- `recording-chunk-diagnostics.png`
	- `recording-download-local-copy.png`

### 6.2 Open Printable Manual
1. Open `docs/USER_MANUAL_PRINT.html` in Chrome or Edge.
2. Confirm all screenshot sections display the correct images.
3. If an old image still appears, do a hard refresh (`Ctrl+F5`).

### 6.3 Print to PDF
1. Press `Ctrl+P`.
2. Set destination to **Save as PDF**.
3. Use these print settings:
	- Paper size: **A4**
	- Scale: **100%**
	- Margins: **Default**
	- **Background graphics: ON**
4. Save output as `docs/USER_MANUAL_PRINT.pdf`.

### 6.4 Final Validation
1. Open the generated PDF.
2. Verify each screenshot appears in the correct section.
3. Check text readability and page breaks.
4. Confirm no sensitive data is visible.

### 6.5 Optional: Change Image References in HTML
If you prefer custom image names instead of replacing files with exact names:
1. Open `docs/USER_MANUAL_PRINT.html`.
2. Edit the `src` values of each screenshot image.
3. Save the file and refresh the browser.
4. Repeat the print steps above.
