---
title: CareCanvas Deployment Guide
description: Step-by-step Docker and Node.js deployment, persistence, backup, upgrade, and operational guidance
ms.date: 2026-10-02
ms.topic: how-to
keywords:
  - Docker deployment
  - CareCanvas hosting
  - persistent volume
  - production operations
estimated_reading_time: 14
---

## Deployment Boundaries

CareCanvas serves a visual editor and public site snapshots from one process.
The provided container is suitable for demos, internal evaluation, and
non-sensitive public content.

> [!WARNING]
> The default deployment has no login, access control, tenancy boundary, audit
> trail, managed secret store, database encryption, deletion API, rate limiting,
> or compliance certification. Do not use it to collect or store PHI.

## Runtime Model

The production container:

1. Serves built React assets from `/app/dist`.
2. Exposes HTTP on container port `8080`.
3. Stores published JSON snapshots under `/data`.
4. Reports status at `/health`.
5. Runs as the non-root `node` user.

Docker Compose maps host port `8082` to container port `8080` and mounts the
`mason-sites` named volume at `/data`.

## Deploy With Docker Compose

### Prerequisites

* Docker Desktop 4.x, or Docker Engine with Compose v2
* At least 1 GB free disk space for image layers and dependencies
* Host port `8082`, or another available port

### Step 1: Clone the repository

```bash
git clone https://github.com/KrishnaDistributedcomputing/carecanvas-ui-builder.git
cd carecanvas-ui-builder
```

### Step 2: Review the port and volume

The default Compose settings are:

```yaml
ports:
  - "8082:8080"
volumes:
  - mason-sites:/data
```

Change only the first port number to use another host port. For example, this
maps <http://localhost:8090> to the same container port:

```yaml
ports:
  - "8090:8080"
```

### Step 3: Build and start

```bash
docker compose up -d --build
```

### Step 4: Verify health

```bash
docker compose ps
curl http://localhost:8082/health
```

Expected JSON:

```json
{"status":"ok"}
```

### Step 5: Open the application

Open <http://localhost:8082> and publish a test site. Confirm that its generated
`/p/<slug>` route opens in a second browser tab.

## Operate the Container

### View logs

```bash
docker compose logs -f mason
```

### Restart the service

```bash
docker compose restart mason
```

### Stop while preserving data

```bash
docker compose down
```

### Remove service and published data

```bash
docker compose down -v
```

> [!CAUTION]
> Removing the named volume permanently deletes every published JSON snapshot.
> Browser drafts are separate and remain in browser storage until cleared.

## Back Up Published Sites

The Docker volume name normally includes the Compose project directory prefix.
Find the exact name first:

```bash
docker volume ls --filter name=mason-sites
```

### Back up from PowerShell

Run this command from the directory where the archive should be created:

```powershell
$volume = (docker volume ls --filter name=mason-sites --format "{{.Name}}" | Select-Object -First 1)
docker run --rm -v "${volume}:/data:ro" -v "${PWD}:/backup" alpine tar czf /backup/carecanvas-sites.tar.gz -C /data .
```

### Back up from Bash

```bash
volume=$(docker volume ls --filter name=mason-sites --format '{{.Name}}' | head -n 1)
docker run --rm -v "${volume}:/data:ro" -v "${PWD}:/backup" alpine tar czf /backup/carecanvas-sites.tar.gz -C /data .
```

Inspect the archive before relying on it:

```bash
tar tzf carecanvas-sites.tar.gz
```

## Restore Published Sites

1. Stop CareCanvas.

   ```bash
   docker compose down
   ```

2. Resolve the target volume name after starting once, or create it with
   `docker compose up -d` and stop again.

3. Restore the archive.

   ```powershell
   $volume = (docker volume ls --filter name=mason-sites --format "{{.Name}}" | Select-Object -First 1)
   docker run --rm -v "${volume}:/data" -v "${PWD}:/backup:ro" alpine sh -c "rm -f /data/*.json && tar xzf /backup/carecanvas-sites.tar.gz -C /data"
   ```

4. Start and verify the service.

   ```bash
   docker compose up -d
   curl http://localhost:8082/health
   ```

5. Open at least one restored `/p/<slug>` URL.

## Upgrade the Application

1. Back up the published-site volume.
2. Pull repository changes.
3. Rebuild and replace the container.
4. Check health and inspect logs.
5. Test the editor and one existing public URL.

```bash
git pull --ff-only
docker compose up -d --build
docker compose ps
docker compose logs --tail 100 mason
```

Published JSON remains in the named volume across image replacement.

## Run Without Docker

### Step 1: Install dependencies

```bash
npm ci
```

### Step 2: Build assets

```bash
npm run build
```

### Step 3: Configure the runtime

PowerShell:

```powershell
$env:PORT = "8080"
$env:DATA_DIR = "$PWD\data"
npm start
```

Bash:

```bash
PORT=8080 DATA_DIR="$(pwd)/data" npm start
```

### Step 4: Verify

Open <http://localhost:8080> and request <http://localhost:8080/health>.

## Environment Variables

| Variable   | Default  | Purpose                                         |
|------------|----------|-------------------------------------------------|
| `PORT`     | `8080`   | HTTP listening port inside the runtime          |
| `DATA_DIR` | `./data` | Directory containing published JSON snapshots   |
| `NODE_ENV` | unset    | Set to `production` in the Docker runtime image |

## Place a Reverse Proxy in Front

Use a reverse proxy for TLS and a stable hostname. The proxy should forward all
paths, including `/api/*` and `/p/*`, to CareCanvas.

Operational requirements include:

* HTTPS termination with an automatically renewed certificate
* Request body limit of at least 2 MB for publish requests
* Forwarded host and protocol headers
* No caching for `/api/*`
* Appropriate access logs and retention policy
* Network restriction if the editor must not be publicly reachable

> [!IMPORTANT]
> A reverse proxy and TLS do not make the application HIPAA-compliant. A
> compliant architecture requires a documented threat model, access controls,
> auditability, data governance, approved infrastructure, and organizational
> procedures.

## Production Hardening Checklist

Before exposing CareCanvas to the internet:

* Add authentication and authorization for the editor and publish API.
* Separate editor access from public-site access.
* Add request rate limits and abuse monitoring.
* Validate complete page documents with a strict schema.
* Use a managed database or object store with backup and retention policies.
* Add site lifecycle APIs for listing, updating, archiving, and deleting data.
* Pin trusted image sources or proxy uploaded media through controlled storage.
* Add centralized logs, metrics, alerts, and dependency scanning.
* Review Content Security Policy requirements for the chosen image and font hosts.
* Complete privacy, legal, security, and accessibility reviews.

## Health Monitoring

The image includes a Docker health check that requests
`http://127.0.0.1:8080/health` every 20 seconds. Monitor both container health
and external reachability because a reverse proxy can fail while the internal
health check remains green.

Useful checks:

```bash
docker inspect --format='{{json .State.Health}}' mason-app-designer
curl --fail --silent --show-error http://localhost:8082/health
```

Continue with [Troubleshooting](TROUBLESHOOTING.md) when a check fails.
