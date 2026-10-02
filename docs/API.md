---
title: CareCanvas API Reference
description: HTTP health, publish, and published-site retrieval endpoints exposed by the CareCanvas Express server
ms.date: 2026-10-02
ms.topic: reference
keywords:
  - CareCanvas API
  - publish endpoint
  - health endpoint
  - Express API
estimated_reading_time: 9
---

## Base URL

The Docker Compose deployment uses:

```text
http://localhost:8082
```

A direct Node.js deployment uses port `8080` unless `PORT` overrides it.

All API responses use JSON. Publish requests must send
`Content-Type: application/json` and remain below the 2 MB server limit.

> [!WARNING]
> The API has no authentication or authorization. Do not expose it to an
> untrusted network or send PHI, patient details, credentials, or secrets.

## Health Check

### `GET /health`

Reports whether the Express process can answer HTTP requests.

Request:

```bash
curl --fail http://localhost:8082/health
```

Successful response:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
```

```json
{
  "status": "ok"
}
```

The endpoint does not inspect Docker volume capacity, image providers, or
published snapshot readability. Combine it with an external public-route check
for operational monitoring.

## Publish a Site

### `POST /api/sites`

Creates a new immutable JSON snapshot and returns a public route.

Minimum accepted document:

```json
{
  "settings": {
    "projectName": "Northstar Health"
  },
  "blocks": []
}
```

The visual editor sends the complete `PageModel`, including design settings and
block content.

Example request:

```bash
curl --request POST \
  --url http://localhost:8082/api/sites \
  --header "Content-Type: application/json" \
  --data '{"settings":{"projectName":"Northstar Health"},"blocks":[]}'
```

Successful response:

```http
HTTP/1.1 201 Created
Content-Type: application/json; charset=utf-8
```

```json
{
  "slug": "northstar-health-a1b2c3",
  "url": "/p/northstar-health-a1b2c3"
}
```

The slug contains:

* A normalized form of `settings.projectName`, limited to 42 characters
* A hyphen
* A six-character random suffix

The server writes a temporary file and atomically renames it to
`<DATA_DIR>/<slug>.json`.

### Publish validation

The current server validates these top-level conditions:

* The body is a JSON object.
* `settings` is an object.
* `settings.projectName` is a non-empty string of at most 80 characters.
* `blocks` is an array with at most 100 entries.

It does not yet validate every nested block property against a strict schema.
Treat input validation as a required extension before accepting documents from
untrusted clients.

### Publish responses

#### `201 Created`

The snapshot was written successfully.

#### `400 Bad Request`

The page document failed top-level validation.

```json
{
  "error": "Invalid site document"
}
```

#### `413 Payload Too Large`

The JSON body exceeded 2 MB. Express returns this before the route handler.

#### `500 Internal Server Error`

The server could not write or rename the snapshot.

```json
{
  "error": "Unable to publish site"
}
```

Inspect container logs and volume permissions after a `500` response.

## Read a Published Site Model

### `GET /api/sites/:slug`

Returns the exact JSON model stored during publishing.

Request:

```bash
curl http://localhost:8082/api/sites/northstar-health-a1b2c3
```

Successful response:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
```

The response body is the stored `PageModel`.

### Slug validation

Read requests accept lowercase letters, numbers, and hyphens. Slugs must contain
between 1 and 80 characters.

### Read responses

#### `400 Bad Request`

The slug contains an unsupported character or length.

```json
{
  "error": "Invalid site name"
}
```

#### `404 Not Found`

No matching snapshot exists in `DATA_DIR`.

```json
{
  "error": "Site not found"
}
```

#### `500 Internal Server Error`

The snapshot exists but could not be read.

```json
{
  "error": "Unable to read site"
}
```

## Render a Public Site

### `GET /p/:slug`

Returns the React application shell. The browser then requests
`GET /api/sites/:slug` and renders the model through `PageRenderer`.

```bash
curl --head http://localhost:8082/p/northstar-health-a1b2c3
```

The initial HTML can return `200` even if the model is missing. In that case,
the React application displays a published-site `404` state after the API
request fails. Monitor the model endpoint when validating a specific site.

## Static and Application Routes

Express serves files from `dist` with a one-hour cache age. Other non-API GET
paths return `dist/index.html` so the client can handle them.

Unsupported non-GET requests that do not match an API route fall through to the
default Express response.

## Response Security Headers

The server applies these headers:

* `Content-Security-Policy`
* `Referrer-Policy: strict-origin-when-cross-origin`
* `X-Content-Type-Options: nosniff`
* `X-Frame-Options: SAMEORIGIN`

The Content Security Policy permits same-origin scripts and connections,
Google-hosted fonts, inline styles, data images, and HTTPS images.

## Page Model Example

```json
{
  "settings": {
    "projectName": "Northstar Health",
    "pageTitle": "Northstar Health - Whole-person primary care",
    "accent": "#147d74",
    "surface": "#edf4f1",
    "ink": "#172321",
    "pageBackground": "#ffffff",
    "headingFont": "Instrument Serif",
    "bodyFont": "Manrope",
    "radius": 4,
    "sectionSpacing": 72,
    "contentWidth": 1120
  },
  "blocks": [
    {
      "id": "heading-example",
      "type": "heading",
      "label": "Whole-person care",
      "title": "Care begins with being heard.",
      "text": "",
      "buttonLabel": "",
      "buttonUrl": "#",
      "image": "",
      "alignment": "center",
      "background": "white",
      "items": []
    }
  ]
}
```

## API Lifecycle Limitations

The server does not currently provide endpoints to:

* List published sites
* Update an existing slug
* Delete a site
* Authenticate an editor
* Submit appointment form values
* Upload or proxy media

Add explicit authorization, audit, and retention behavior before introducing
these operations.
