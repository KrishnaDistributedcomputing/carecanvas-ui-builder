---
title: CareCanvas Security Policy
description: Supported versions, healthcare data limitations, security controls, and private vulnerability reporting
ms.date: 2026-10-02
ms.topic: reference
keywords:
  - security policy
  - vulnerability reporting
  - PHI
  - HIPAA
estimated_reading_time: 7
---

## Supported Versions

Security fixes target the current `main` branch. Older commits, exported project
files, and previously built container images do not receive backported fixes.

## Healthcare Data Classification

CareCanvas is a prototype visual builder for fictional or approved public
marketing content.

> [!WARNING]
> Do not process PHI, personal health information, medical records, diagnoses,
> appointment details, insurance identifiers, or other sensitive personal data.
> The repository is not HIPAA-compliant as provided.

The appointment form is intentionally UI-only. It prevents normal browser form
submission and has no endpoint for submitted values.

## Current Security Controls

The production server includes:

* A non-root Docker runtime user
* Content Security Policy
* Strict referrer policy
* Clickjacking protection through `X-Frame-Options`
* MIME-sniffing protection
* A 2 MB JSON body limit
* Restricted published-site slug format
* Atomic snapshot file writes
* Docker health checks

These controls reduce specific risks but do not provide a complete security
program.

## Known Security Boundaries

The default application has no:

* Authentication or authorization
* User, organization, or tenant isolation
* API rate limiting
* Audit trail
* Managed encryption-at-rest configuration
* Site listing, deletion, or retention controls
* Malware scanning or controlled media upload
* Secret-management integration
* Consent or privacy workflow
* Business Associate Agreement support
* Compliance certification

Published routes are readable by anyone who can reach the server and knows the
URL. Random slug suffixes are not an authorization mechanism.

## Report a Vulnerability

Use GitHub private vulnerability reporting:

1. Open the repository **Security** tab.
2. Select **Report a vulnerability**.
3. Include affected versions, reproduction steps, impact, and suggested
   mitigations when available.
4. Remove all patient data, credentials, access tokens, and unrelated secrets.

Do not open a public issue, discussion, or pull request for an undisclosed
vulnerability.

If private vulnerability reporting is unavailable, contact the repository owner
through a private GitHub channel and request a secure reporting path. Do not
send exploit details in a public message.

## Response Expectations

Maintainers should:

1. Acknowledge a complete report within five business days.
2. Confirm scope and request missing reproduction details privately.
3. Assess impact and affected versions.
4. Develop and validate a focused remediation.
5. Coordinate disclosure timing with the reporter.
6. Publish an advisory when users need to act.

These targets are goals rather than a service-level agreement.

## Secure Deployment Guidance

Before internet exposure:

* Restrict editor and publish API access.
* Terminate TLS at a maintained reverse proxy or platform ingress.
* Add authenticated identities and least-privilege authorization.
* Store snapshots in an approved service with backup and deletion controls.
* Add rate limits, monitoring, alerting, and centralized audit logs.
* Pin and scan runtime images and dependencies.
* Review the Content Security Policy for every external host.
* Complete threat modeling, privacy review, and accessibility testing.

See the [Deployment Guide](docs/DEPLOYMENT.md) for operational steps and the
[Architecture Guide](docs/ARCHITECTURE.md) for current trust boundaries.

## Dependency Updates

Review automated dependency pull requests before merging. Run the full
repository check, rebuild the Docker image, and verify editor plus published
routes after dependency changes.

## Secrets

Never commit:

* GitHub tokens
* API keys
* Patient or clinician credentials
* Private certificates or keys
* Production environment files
* Real exported health data

Rotate a secret immediately if it enters Git history. Removing it from a later
commit does not invalidate earlier exposure.
