---
title: CareCanvas Troubleshooting
description: Diagnostic steps for installation, Docker, browser drafts, publishing, images, and public-site problems
ms.date: 2026-10-02
ms.topic: troubleshooting
keywords:
  - CareCanvas troubleshooting
  - Docker port conflict
  - publish error
  - browser localStorage
estimated_reading_time: 12
---

## Start With Four Checks

Run these commands from the repository root:

```bash
docker compose ps
docker compose logs --tail 100 mason
curl http://localhost:8082/health
curl --head http://localhost:8082
```

Expected results:

* The container status is `healthy`.
* Logs include `CareCanvas is listening on http://0.0.0.0:8080`.
* The health endpoint returns `{"status":"ok"}`.
* The root URL returns HTTP `200`.

## Host Port Is Already Allocated

### Symptom

Docker reports a message similar to:

```text
Bind for 0.0.0.0:8082 failed: port is already allocated
```

### Resolution

1. Identify the owner.

   PowerShell:

   ```powershell
   Get-NetTCPConnection -LocalPort 8082 -State Listen | Select-Object OwningProcess
   docker ps --format "table {{.Names}}\t{{.Ports}}"
   ```

2. Do not stop an unrelated service unless you own it.
3. Change the host side of the Compose mapping.

   ```yaml
   ports:
     - "8090:8080"
   ```

4. Start CareCanvas and use <http://localhost:8090>.

## Docker Hub TLS Timeout

### Symptom

The build fails while fetching the base image or an anonymous registry token.

### Resolution

Pull the base image separately, then rebuild:

```bash
docker pull node:24-alpine
docker compose up -d --build
```

If the pull still fails, confirm Docker Desktop proxy, VPN, DNS, and registry
access settings.

## Container Is Starting but Not Healthy

### Resolution

1. Wait through the 10-second health-check start period.
2. Read container logs.

   ```bash
   docker compose logs --tail 200 mason
   ```

3. Request the internal endpoint.

   ```bash
   docker exec mason-app-designer node -e "fetch('http://127.0.0.1:8080/health').then(r=>console.log(r.status)).catch(console.error)"
   ```

4. Inspect health output.

   ```bash
   docker inspect --format='{{json .State.Health}}' mason-app-designer
   ```

Rebuild if the static bundle or dependencies are missing.

## `npm ci` Fails

Confirm the required runtime versions:

```bash
node --version
npm --version
```

Use Node.js 24 or newer and npm 11 or newer. Remove no lockfile entries by hand.
If a package cache is corrupt, clear the npm cache and retry:

```bash
npm cache verify
npm ci
```

## Development Server Cannot Publish

### Symptom

The editor works at the Vite URL, but **Publish** reports an error.

### Cause

`npm run dev` serves the React frontend only. The publishing API belongs to the
Express production server.

### Resolution

Use Docker, or build and start Express:

```bash
npm run build
npm start
```

Open <http://localhost:8080> for a direct Node.js run.

## Draft Changes Are Missing

Drafts are stored in `localStorage` for the current origin. A different host,
port, browser, profile, or private window has a separate draft.

Check the active origin and browser storage. The key is:

```text
carecanvas-page
```

Use the export action for a file backup before clearing site data.

## Starter Does Not Include New Blocks

An older saved draft can replace the new default block list while keeping new
settings through migration.

Options:

1. Add the new block from the library.
2. Select the header reset icon and confirm the Northstar Health starter reset.
3. Clear the `carecanvas-page` local storage key when no draft must be kept.

## Undo or Redo Is Disabled

History exists only for the current editor session and contains at most 40
states. Reloading the page restores the saved draft but not its history stack.

Make a new edit to activate Undo. Redo becomes available only after Undo and is
cleared by a new branch of edits.

## Remote Images Do Not Render

Confirm that the image URL:

* Uses HTTPS
* Returns an image without authentication
* Allows browser embedding
* Has not expired
* Is permitted by the server Content Security Policy

Open the URL directly in the browser. Replace unstable or signed URLs with a
durable image host. Do not use patient photography without appropriate rights
and consent.

## Google Fonts Do Not Load

The browser needs access to `fonts.googleapis.com` and `fonts.gstatic.com`.
Network filtering can force fallback fonts without breaking the application.

For an offline deployment, self-host approved font files and update both the CSS
imports and Content Security Policy.

## Publish Returns `400`

The top-level page document is invalid. Confirm that:

* `settings.projectName` is a non-empty string no longer than 80 characters.
* `blocks` is an array with no more than 100 entries.
* The request body is JSON.

Browser drafts created through the editor normally satisfy these checks.

## Publish Returns `413`

The request exceeds the 2 MB JSON body limit. Large image URLs usually do not
cause this, but embedded base64 images can.

Use external HTTPS image URLs and remove oversized inline data.

## Publish Returns `500`

Inspect logs and volume access:

```bash
docker compose logs --tail 200 mason
docker exec mason-app-designer sh -c "id && ls -la /data"
```

The runtime uses the non-root `node` user and must be able to write `/data`.
Recreate a damaged empty development volume only after confirming no snapshots
must be retained:

```bash
docker compose down -v
docker compose up -d --build
```

## Published URL Shows a Site 404

The React shell can load while the model endpoint returns `404`. Check the model
directly:

```bash
curl http://localhost:8082/api/sites/your-site-slug
```

Possible causes include:

* The URL contains a typo.
* The Docker volume was removed.
* The application now points at a different `DATA_DIR`.
* A backup was restored into another volume.

## Published Site Did Not Update

Publishing creates a new immutable slug. It does not overwrite an existing
public URL.

Select **Publish** again and use the newly generated link. This behavior keeps
older snapshots stable.

## Browser Shows an Older Application Build

1. Rebuild and replace the container.

   ```bash
   docker compose up -d --build
   ```

2. Open a new browser tab or reload the root URL rather than navigating only to
   another hash fragment.
3. Confirm the container creation time with `docker compose ps`.
4. Inspect the served asset names in the browser network panel if needed.

## Mobile Drawer Appears Stuck

Bring the editor tab to the foreground and select the panel icon again. Browser
automation and background tabs can pause CSS transitions. In normal foreground
use, the Blocks and Settings panels slide into the viewport.

## No Horizontal Overflow but Content Looks Crowded

Use the site-theme controls to reduce content width or increase section spacing.
Shorten long headings and keep repeatable item text lengths balanced. Test the
`390px` canvas before publishing.

## Collect Diagnostic Information

Include these details in a bug report:

* Operating system and browser version
* Docker, Node.js, and npm versions
* Exact reproduction steps
* Expected and actual behavior
* `docker compose ps` output
* Relevant logs with secrets and sensitive data removed
* Whether the issue occurs in a new browser profile
* Whether `/health` and the affected `/api/sites/<slug>` URL respond

Never attach PHI, tokens, credentials, or private patient content.
