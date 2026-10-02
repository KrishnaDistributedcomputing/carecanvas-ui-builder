---
title: Contributing to CareCanvas
description: Development setup, coding conventions, validation requirements, and pull request workflow for CareCanvas contributors
ms.date: 2026-10-02
ms.topic: how-to
keywords:
  - contributing
  - pull requests
  - development workflow
estimated_reading_time: 9
---

## Before You Contribute

CareCanvas welcomes focused bug fixes, accessibility improvements, healthcare
blocks, documentation, and deployment enhancements.

Read [Security](SECURITY.md) before proposing features that collect, transmit,
or store user-entered health information. Do not use real patient data in code,
fixtures, screenshots, issues, or pull requests.

## Development Setup

### Prerequisites

* Node.js 24 or newer
* npm 11 or newer
* Docker with Compose v2 for production-path testing
* Git

### Install and run

```bash
git clone https://github.com/KrishnaDistributedcomputing/carecanvas-ui-builder.git
cd carecanvas-ui-builder
npm ci
npm run dev
```

### Run the production path

```bash
npm run build
npm start
```

Or use Docker:

```bash
docker compose up -d --build
```

## Choose an Issue

Search existing issues before starting work. For substantial features, open a
proposal first and describe:

* The user problem
* The intended workflow
* Data classification and privacy impact
* Accessibility considerations
* Scope exclusions
* Verification approach

## Create a Branch

Use a short branch name that describes the change:

```bash
git switch -c feat/provider-directory-block
```

Common prefixes include `feat/`, `fix/`, `docs/`, and `chore/`.

## Coding Expectations

* Keep the `PageModel` serializable as JSON.
* Preserve older browser drafts through `normalizePage` defaults.
* Render editor, preview, and public sites through `PageRenderer`.
* Use semantic HTML and visible keyboard focus.
* Use Lucide icons instead of hand-authored interface SVGs.
* Add responsive behavior through container queries for rendered blocks.
* Keep medical content fictional and avoid unsupported clinical claims.
* Do not introduce PHI collection without an approved security architecture.
* Avoid unrelated refactors in focused pull requests.

## Add a Healthcare Block

1. Add the identifier to `BlockType` in `src/types.ts`.
2. Add safe fictional defaults in `createBlock` in `src/defaults.ts`.
3. Render the section in `BlockContent` in `src/PageRenderer.tsx`.
4. Add the block to the palette in `src/App.tsx`.
5. Add inspector fields only for data the block uses.
6. Style desktop and narrow container layouts in `src/App.css`.
7. Test adding, editing, moving, duplicating, deleting, previewing, and
   publishing the block.
8. Update the user and architecture guides.

## Documentation Style

All Markdown files require YAML frontmatter. Follow the repository
`.markdownlint.json` rules and use copy-pasteable commands.

Avoid claims that CareCanvas is secure, compliant, production-ready, or suitable
for patient data unless the underlying controls have been implemented and
independently reviewed.

## Validate Changes

Run every check before opening a pull request:

```bash
npm run check
docker compose config
docker build --check .
```

For UI changes, also verify:

1. Desktop editor layout
2. Tablet canvas at `768px`
3. Mobile canvas and public site at `390px`
4. Keyboard selection and form controls
5. Color contrast feedback
6. Publish and public-route retrieval
7. No horizontal overflow

## Commit Changes

Use Conventional Commits in imperative mood:

```text
feat: add provider directory block
fix: preserve custom colors in published pages
docs(docs): expand Docker backup guide
```

Keep each commit coherent and free of generated build output, local data,
credentials, and editor-specific files.

## Open a Pull Request

Include:

* A concise problem and solution summary
* Screenshots for visible desktop and mobile changes
* Commands and scenarios used for validation
* Data, security, and accessibility impact
* Known limitations or follow-up work

Link the relevant issue when one exists. Keep the pull request small enough for
a reviewer to understand the behavioral change without unrelated cleanup.

## Review Criteria

Reviewers prioritize:

* Functional correctness
* Backward compatibility for saved and published models
* Healthcare data safety
* Accessibility and responsive behavior
* Persistence and deployment effects
* Focused tests and documentation

## Report Security Problems Privately

Do not open a public issue for a vulnerability. Follow the private reporting
process in [Security](SECURITY.md).
