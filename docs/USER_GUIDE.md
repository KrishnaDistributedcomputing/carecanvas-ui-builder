---
title: CareCanvas User Guide
description: Step-by-step instructions for building, styling, previewing, exporting, and publishing healthcare websites with CareCanvas
ms.date: 2026-10-02
ms.topic: tutorial
keywords:
  - CareCanvas tutorial
  - healthcare website builder
  - visual editor
  - medical UI
estimated_reading_time: 18
---

## Safety Before You Begin

CareCanvas is intended for prototypes, demos, and public healthcare marketing
content. Use fictional names, locations, schedules, testimonials, and outcomes.

> [!WARNING]
> Do not enter PHI, medical records, appointment details, diagnoses, insurance
> identifiers, or real patient information. CareCanvas does not provide the
> safeguards required for regulated healthcare data.

The appointment form is a visual component. It does not send or store submitted
values.

## Open the Builder

### Docker installation

1. Start the application from the repository root.

   ```bash
   docker compose up -d --build
   ```

2. Wait for the container to become healthy.

   ```bash
   docker compose ps
   ```

3. Open <http://localhost:8082>.

### Local development installation

1. Install the Node.js dependencies.

   ```bash
   npm ci
   ```

2. Start the Vite development server.

   ```bash
   npm run dev
   ```

3. Open the URL shown by Vite, normally <http://localhost:5173>.

> [!NOTE]
> Publishing requires the Express production server. The Vite-only development
> server does not provide the `/api/sites` endpoint.

## Understand the Workspace

The builder has four persistent areas.

### Header

Use the header to:

* Undo and redo project changes
* See whether the draft is **Saving** or **Saved**
* Export the project as JSON
* Reset the project to the Northstar Health starter
* Open a full-page preview
* Publish a permanent snapshot

### Block library

The left panel has two tabs:

* **Blocks** lists healthcare sections you can add
* **Layers** lists sections already on the page in display order

On smaller screens, select the left-panel icon in the header to open this panel.

### Canvas

The center canvas renders the website from the same data used by the published
site. Select a section to edit it. Use the desktop, tablet, and mobile controls
above the canvas to test responsive behavior.

### Inspector

The right panel edits the selected section and the site-wide design system. On
smaller screens, select the settings icon in the header to open it.

## Create a Site Step by Step

### Step 1: Start from the healthcare template

The starter includes a clinic hero, services, outcomes, patient story, FAQ,
insurance information, clinician profiles, and an appointment request form.

You can keep the sections you need and remove the rest. Select a section on the
canvas, then use the trash icon in the inspector to delete it.

### Step 2: Set the organization name

1. Scroll to **Site theme** in the right inspector.
2. Enter the organization name in **Site name**.
3. Enter a concise browser title in **Browser title**.
4. Wait for the header status to change from **Saving** to **Saved**.

The site name updates the preview wordmark, footer, and generated browser path.
The browser title becomes the title of published pages.

### Step 3: Add healthcare blocks

1. Open the **Blocks** tab.
2. Enter a term in **Search blocks**, such as `team`, `insurance`, or `FAQ`.
3. Select the matching block, or drag it onto the canvas.
4. CareCanvas inserts it after the currently selected section.
5. Edit the new block in the inspector.

Available blocks include:

* Clinic hero
* Services
* Care team
* Outcomes
* Hours and location
* Insurance coverage
* FAQ
* Patient story
* Appointment request form
* Appointment call to action
* Heading, patient information, image, button, and spacer primitives

### Step 4: Edit content

Select a canvas section. The **Content** group changes according to the block.
Common fields include:

* Eyebrow for short contextual labels
* Heading for the primary section message
* Body for supporting patient-facing information
* Button label and destination link
* Image URL for HTTPS-hosted images

Write for patients rather than internal clinical teams. Use plain language,
short sentences, and explicit next steps.

> [!TIP]
> Links can be section anchors such as `#start`, relative paths such as
> `/services`, or complete HTTPS URLs.

### Step 5: Edit repeatable items

Services, clinicians, outcomes, insurance options, hours, and FAQs contain
repeatable items.

1. Select one of these blocks.
2. Find the **Items** group in the inspector.
3. Edit each title and detail field.
4. For clinicians, also set credentials and an image URL.
5. Select **Add item** to add another entry.
6. Use the trash icon inside an item to remove it.

Each block supports up to six items. Keep neighboring item text similar in
length for a balanced layout.

### Step 6: Arrange page layers

1. Open the **Layers** tab in the left panel.
2. Select any layer to focus that section on the canvas.
3. Use the up or down arrow on a layer to move it one position.
4. Repeat until the patient journey reads logically.

A common healthcare order is:

1. Hero and appointment action
2. Services
3. Care team
4. Outcomes or trust indicators
5. Insurance information
6. Hours and location
7. Patient story
8. FAQ
9. Appointment form

### Step 7: Duplicate, move, or delete a section

The inspector toolbar provides:

* Up arrow to move the selected section earlier
* Down arrow to move it later
* Copy icon to duplicate it
* Trash icon to remove it

Undo remains available after these actions.

## Choose Colors and Typography

### Apply a preset

1. Scroll to **Site theme**.
2. Select **Clinical teal**, **Trust blue**, **Warm care**, or **Bright care**.
3. Review all canvas sections, especially accent backgrounds and buttons.

A preset changes the accent, soft surface, text, and page colors together.

### Choose custom colors

Use the four color controls:

* **Accent** controls buttons, labels, marks, and accent backgrounds
* **Surface** controls soft section backgrounds
* **Text** controls main page text and dark sections
* **Page** controls white or neutral page sections

Select the color swatch to open the browser color picker. Changes appear on the
canvas immediately.

### Check contrast

The **Accent contrast** row calculates the strongest contrast between the accent
and the available light or dark foreground.

* **AA** means the calculated ratio is at least `4.5:1`
* **Review** means the accent needs manual adjustment

> [!IMPORTANT]
> The score is a design aid, not a complete accessibility audit. Verify text,
> focus indicators, images, keyboard operation, and zoom behavior before release.

### Set fonts

Choose separate heading and body fonts:

* Instrument Serif for an editorial heading style
* Manrope for a clear clinical interface
* Space Grotesk for a more technical visual language

### Adjust layout tokens

Use the sliders to control:

* Corner radius from square to gently rounded
* Section spacing from compact to spacious
* Content width from narrow to wide

Review the result in all three responsive canvas sizes after changing these
values.

## Configure Section Layout

### Alignment

Use the left and center alignment icons in the selected block's **Layout**
group. Alignment affects headings and call-to-action placement where supported.

### Background

Choose one of four section backgrounds:

* Page color
* Soft surface color
* Text color as a dark section
* Accent color

Foreground colors adapt to custom theme tokens. Confirm legibility after every
color change.

## Preview Responsively

### Canvas preview

Use the controls above the canvas:

1. Select the monitor icon for a responsive desktop frame.
2. Select the tablet icon for a `768px` frame.
3. Select the phone icon for a `390px` frame.
4. Scroll through the full page at each size.

Check that:

* Headlines wrap without clipping
* Buttons remain visible and readable
* Clinician cards and insurance options stack predictably
* Appointment form fields fit the available width
* No horizontal scrollbar appears

### Full-page preview

Select **Preview** in the header to remove the editor panels. Use **Back to
editor** to return without losing changes.

## Save and Recover Work

### Autosave

CareCanvas stores the current draft in browser `localStorage`. The header shows
**Saving** during the delay and **Saved** when the browser copy is current.

Drafts are tied to the current browser profile. Clearing site data, changing
browsers, or using another computer does not transfer the draft.

### Undo and redo

Use the header arrows to navigate recent project changes. CareCanvas keeps up
to 40 history states for the active browser session.

### Export project JSON

1. Select the download icon in the header.
2. Save the generated `<site-name>-project.json` file.
3. Store it outside the browser as a project backup.

The current version exports JSON for backup and inspection. It does not yet
include an import command in the UI.

### Reset the starter

1. Select the reset icon in the header.
2. Confirm the browser prompt.
3. CareCanvas replaces the draft with the Northstar Health starter.
4. Use **Undo** immediately if the reset was accidental.

## Publish a Site

1. Confirm the production server is running.
2. Select **Publish** in the header or preview toolbar.
3. Wait for the **Your site is live** dialog.
4. Copy the URL or select **Open live site**.
5. Verify the public page at desktop and mobile sizes.

Published URLs use this format:

```text
http://localhost:8082/p/northstar-health-a1b2c3
```

Publishing creates a new immutable JSON snapshot. Editing the browser draft
does not update an older URL. Publish again to create another version.

## Work on Mobile

At narrow viewport widths:

1. Use the left header icon to open Blocks or Layers.
2. Select a section or add a block.
3. Close the panel to inspect the canvas.
4. Use the right header icon to open settings.
5. Edit the selected section or site theme.
6. Publish from the persistent header action.

For extensive content entry, a desktop or tablet viewport is more efficient.

## Content Checklist Before Publishing

* Use fictional data unless the deployment has been independently secured and
  approved for its intended data class.
* Confirm organization name, browser title, address, hours, and contact links.
* Remove unsupported outcome claims or statistics.
* Confirm clinician names, credentials, specialties, and approved photography.
* Verify accepted insurance statements with the organization.
* Add descriptive alternative text through block defaults or future custom
  extensions where required.
* Test keyboard navigation, contrast, zoom, and mobile layout.
* Confirm emergency language and route urgent needs away from the form.
* Open every published link after deployment.

## Next Steps

* Use the [Deployment Guide](DEPLOYMENT.md) to host CareCanvas beyond a laptop.
* Review [Architecture](ARCHITECTURE.md) before extending block types.
* Use [Troubleshooting](TROUBLESHOOTING.md) when a build or publish step fails.
