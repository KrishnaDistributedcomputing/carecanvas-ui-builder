---
title: CareCanvas Local Metadata Datastore Guide
description: Step-by-step setup, query, processing, backup, restore, and troubleshooting guidance for the local SQLite metadata index
ms.date: 2026-10-02
ms.topic: tutorial
keywords:
  - SQLite
  - local datastore
  - metadata processing
  - deployment history
  - Docker persistence
estimated_reading_time: 14
---

## Overview

CareCanvas uses a local SQLite database to index operational metadata while
keeping immutable JSON artifacts as the recovery source.

The datastore tracks:

* Published site names, titles, digests, block counts, and form counts
* Portable package versions, dependencies, forms, workflows, and permissions
* Pre-deployment validation runs and individual findings
* Deployment status, environment, version, digest, parameters, and secret
  reference counts
* Ordered deployment and rollback logs
* Active releases for Development, Test, UAT, Staging, and Production

> [!IMPORTANT]
> The SQLite database stores metadata and secret references, not secret values.
> Do not place PHI, credentials, tokens, connection strings, or patient data in
> project metadata or environment configuration.

## Understand the Storage Model

CareCanvas separates payloads from searchable metadata.

| Storage                                | Purpose                                                |
|----------------------------------------|--------------------------------------------------------|
| Browser `localStorage`                 | Current visual builder draft                           |
| `/data/*.json`                         | Immutable published page payloads                      |
| `/data/deployment-system/packages`     | Immutable portable package payloads                    |
| `/data/deployment-system/environments` | Release records, logs, configurations, active pointers |
| `/data/carecanvas-metadata.sqlite`     | Searchable and processed metadata index                |

JSON files remain the source of truth. The SQLite database can be deleted and
rebuilt from those files through the reindex operation.

## Step 1: Start CareCanvas With the Datastore

Build and start the Docker service:

```bash
docker compose up -d --build
```

Confirm that the container is healthy:

```bash
docker compose ps
curl http://localhost:8082/health
```

The response includes datastore status:

```json
{
  "status": "ok",
  "metadata": {
    "status": "ok",
    "engine": "sqlite",
    "schemaVersion": 1,
    "journalMode": "wal"
  }
}
```

The Linux container uses SQLite WAL mode. Direct Windows runs use rollback
journal mode because Node's built-in SQLite shared-memory handles remain open
until process exit on Windows.

## Step 2: Confirm Persistent Files

List the Docker volume:

```bash
docker volume ls --filter name=mason-sites
```

List the data directory inside the running container:

```bash
docker exec mason-app-designer sh -c "ls -lah /data"
```

After the first startup, `/data` contains:

```text
carecanvas-metadata.sqlite
deployment-system/
```

SQLite WAL and shared-memory files can also appear while the service is running.
They are normal and must not be edited.

## Step 3: Create Metadata

Metadata is indexed automatically when you perform application operations.

### Publish a site

1. Open <http://localhost:8082>.
2. Edit a block or theme setting.
3. Select **Publish**.
4. Open the generated `/p/<slug>` URL.

The server writes the page JSON first, then indexes its metadata in SQLite.

### Deploy a portable package

1. Select **Package** in the top toolbar.
2. Choose an environment.
3. Run pre-deployment validation.
4. Select **Deploy to `<environment>`**.

The server stores the immutable package and release files before indexing:

* Package metadata and artifact counts
* Validation summary and findings
* Deployment metadata and logs
* Active environment release

Rollback creates another deployment row with action `rollback` and keeps the
complete release history.

## Step 4: Query the Processed Summary

Metadata APIs use the same optional deployment bearer token as deployment
management APIs.

Without a configured token:

```bash
curl http://localhost:8082/api/metadata/summary
```

With `DEPLOYMENT_API_TOKEN` configured:

```bash
curl \
  --header "Authorization: Bearer ${CARECANVAS_DEPLOYMENT_TOKEN}" \
  http://localhost:8082/api/metadata/summary
```

The processed response includes:

* Total published sites, packages, deployments, active deployments, and
  validations
* Validation error count
* Published block and packaged form/workflow totals
* Deployment and rollback counts by environment
* Version counts by application
* Startup synchronization results

## Step 5: Search Published Site Metadata

Search by slug, project name, or browser title:

```bash
curl "http://localhost:8082/api/metadata/sites?query=Northstar&limit=25"
```

Response shape:

```json
{
  "sites": [
    {
      "slug": "northstar-health-a1b2c3",
      "projectName": "Northstar Health",
      "pageTitle": "Northstar Health - Whole-person primary care",
      "contentDigest": "sha256:...",
      "blockCount": 8,
      "formCount": 1,
      "createdAt": "2026-10-02T19:00:00.000Z",
      "indexedAt": "2026-10-02T19:00:00.000Z"
    }
  ]
}
```

## Step 6: Query Package Metadata

List package versions:

```bash
curl "http://localhost:8082/api/metadata/packages?packageId=northstar-health&limit=50"
```

Package metadata includes:

* Application and package versions
* Content digest and schema version
* Dependency count
* Form, workflow, permission, and integration counts
* Creation and indexing timestamps

## Step 7: Query Deployment Metadata

Filter by environment and package ID:

```bash
curl "http://localhost:8082/api/metadata/deployments?environment=test&packageId=northstar-health&limit=50"
```

Each result identifies whether the release is active and records:

* Deployment ID and immutable content digest
* Package version
* Environment, status, and action
* Previous deployment and rollback target
* Parameter and secret-reference counts
* Completion timestamp

Secret values are not written to the datastore.

## Step 8: Query Validation Metadata

List validation history:

```bash
curl "http://localhost:8082/api/metadata/validations?environment=uat&packageId=northstar-health&limit=50"
```

The response provides validation status and error, warning, and information
counts. Individual findings remain relationally linked to each validation run in
SQLite.

## Step 9: Rebuild the Metadata Index

Reindex after restoring a backup, upgrading the schema, or recovering from a
damaged database:

```bash
curl \
  --request POST \
  http://localhost:8082/api/metadata/reindex
```

With authentication enabled:

```bash
curl \
  --request POST \
  --header "Authorization: Bearer ${CARECANVAS_DEPLOYMENT_TOKEN}" \
  http://localhost:8082/api/metadata/reindex
```

Reindexing performs these steps:

1. Scans published page JSON files.
2. Scans immutable package files.
3. Scans release records for every environment and application.
4. Reads active release pointers.
5. Rebuilds metadata tables in one SQLite transaction.
6. Returns processed, skipped, and aggregate counts.

The operation never changes the source JSON artifacts.

## Step 10: Inspect SQLite Directly

The runtime image does not install a separate SQLite command-line package. Use
Node's built-in read-only SQLite connection:

```bash
docker exec mason-app-designer node --input-type=module -e \
  "import { DatabaseSync } from 'node:sqlite'; \
   const db = new DatabaseSync('/data/carecanvas-metadata.sqlite', { readOnly: true }); \
   console.table(db.prepare('SELECT environment, package_id, package_version, action, completed_at FROM deployments ORDER BY completed_at DESC LIMIT 10').all()); \
   db.close();"
```

Use the metadata APIs for application integration. Direct SQL is intended for
local diagnostics and remains a read-only workflow.

## Step 11: Run Without Docker

Configure a local data directory and optional database path.

PowerShell:

```powershell
$env:DATA_DIR = "$PWD\data"
$env:METADATA_DB_PATH = "$PWD\data\carecanvas-metadata.sqlite"
npm run build
npm start
```

Bash:

```bash
DATA_DIR="$(pwd)/data" \
METADATA_DB_PATH="$(pwd)/data/carecanvas-metadata.sqlite" \
npm run build

DATA_DIR="$(pwd)/data" \
METADATA_DB_PATH="$(pwd)/data/carecanvas-metadata.sqlite" \
npm start
```

Open <http://localhost:8080> and verify `/health`.

## Step 12: Back Up the Datastore

The safest backup captures the complete Docker volume while CareCanvas is
stopped.

1. Stop the service without deleting the volume.

   ```bash
   docker compose stop mason
   ```

2. Find the exact volume name.

   ```bash
   docker volume ls --filter name=mason-sites
   ```

3. Create an archive from PowerShell.

   ```powershell
   $volume = (docker volume ls --filter name=mason-sites --format "{{.Name}}" | Select-Object -First 1)
   docker run --rm -v "${volume}:/data:ro" -v "${PWD}:/backup" alpine tar czf /backup/carecanvas-data.tar.gz -C /data .
   ```

4. Restart CareCanvas.

   ```bash
   docker compose start mason
   ```

The archive includes both JSON source artifacts and SQLite metadata.

## Step 13: Restore and Process a Backup

1. Stop CareCanvas.
2. Restore the volume using the procedure in the
   [Deployment Guide](DEPLOYMENT.md#restore-published-sites).
3. Start the container.
4. Request `/health`.
5. Run `POST /api/metadata/reindex`.
6. Query `/api/metadata/summary` and compare expected counts.
7. Open one published page and one active environment release.

CareCanvas synchronizes immutable artifacts into SQLite during startup without
discarding standalone preflight validations. Explicit reindex is the
artifact-only recovery and verification step after restore.

## Step 14: Recover From a Damaged Index

Because SQLite is a derived index, preserve the JSON artifacts and recreate only
the database.

1. Stop CareCanvas.
2. Back up the Docker volume.
3. Rename or remove `carecanvas-metadata.sqlite` and its `-wal` and `-shm` files.
4. Start CareCanvas.
5. Confirm that startup migration creates schema version `1`.
6. Confirm that startup synchronization restores expected artifact counts.

Do not remove `deployment-system` or published page JSON files during index
recovery.

## Schema and Migration Rules

The `schema_migrations` table records each applied migration and timestamp.
Migrations run in ascending version order during server startup.

Current schema version `1` contains:

* `published_sites`
* `packages`
* `validations`
* `validation_findings`
* `deployments`
* `deployment_logs`
* `active_deployments`

Future migrations must be additive or include a tested data transformation.
Never edit an already released migration.

## Security and Privacy

* Metadata APIs inherit deployment API authorization.
* Configure `DEPLOYMENT_API_TOKEN` before exposing management endpoints.
* Store deployment tokens in the target secret manager, not configuration files.
* Secret references can be indexed; resolved secret values cannot.
* SQLite is local operational storage, not an approved clinical data store.
* Do not use the datastore for PHI or appointment form submissions.
* Backups inherit the same access restrictions as the running data volume.

## Troubleshooting

### Health reports a datastore error

Inspect logs and volume permissions:

```bash
docker compose logs --tail 200 mason
docker exec mason-app-designer sh -c "id && ls -lah /data"
```

The non-root `node` user must be able to write the database and journal files.

### Metadata count is lower than expected

Run reindex and review `skippedDeployments` in the response. A skipped deployment
usually points to a missing immutable package file for its content digest.

### Database is locked

CareCanvas expects one server process per local database. Do not mount the same
SQLite file into multiple writable containers. Scale public rendering only after
moving metadata to a multi-process datastore.

### `node:sqlite` prints an experimental warning

Node.js 24 still labels the built-in module experimental. CareCanvas pins the
runtime major version and protects the database behind a small store module.
Run the full metadata test suite before upgrading Node.js.

## Validate the Implementation

Run all checks from the repository root:

```bash
npm run check
docker compose config --quiet
docker build --check .
```

The datastore test verifies migration, writes, aggregate processing, filtered
queries, process restart, active deployment indexing, and deterministic reindex.
