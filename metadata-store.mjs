import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export const METADATA_SCHEMA_VERSION = 1

const migrations = [
  {
    version: 1,
    name: 'initial-metadata-index',
    sql: `
      CREATE TABLE published_sites (
        slug TEXT PRIMARY KEY,
        project_name TEXT NOT NULL,
        page_title TEXT NOT NULL,
        artifact_path TEXT NOT NULL,
        content_digest TEXT NOT NULL,
        block_count INTEGER NOT NULL,
        form_count INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        indexed_at TEXT NOT NULL
      );

      CREATE TABLE packages (
        content_digest TEXT PRIMARY KEY,
        package_id TEXT NOT NULL,
        application_name TEXT NOT NULL,
        application_version TEXT NOT NULL,
        package_version TEXT NOT NULL,
        schema_version TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        description TEXT NOT NULL,
        artifact_path TEXT NOT NULL,
        dependency_count INTEGER NOT NULL,
        form_count INTEGER NOT NULL,
        workflow_count INTEGER NOT NULL,
        permission_count INTEGER NOT NULL,
        integration_count INTEGER NOT NULL,
        indexed_at TEXT NOT NULL
      );

      CREATE TABLE validations (
        validation_id TEXT PRIMARY KEY,
        package_id TEXT NOT NULL,
        package_version TEXT NOT NULL,
        content_digest TEXT NOT NULL,
        environment TEXT NOT NULL,
        valid INTEGER NOT NULL,
        errors INTEGER NOT NULL,
        warnings INTEGER NOT NULL,
        information INTEGER NOT NULL,
        runtime_version TEXT NOT NULL,
        source TEXT NOT NULL,
        validated_at TEXT NOT NULL,
        indexed_at TEXT NOT NULL
      );

      CREATE TABLE validation_findings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        validation_id TEXT NOT NULL REFERENCES validations(validation_id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL,
        code TEXT NOT NULL,
        severity TEXT NOT NULL,
        category TEXT NOT NULL,
        message TEXT NOT NULL,
        path TEXT,
        resolution TEXT
      );

      CREATE TABLE deployments (
        deployment_id TEXT PRIMARY KEY,
        package_id TEXT NOT NULL,
        package_version TEXT NOT NULL,
        content_digest TEXT NOT NULL REFERENCES packages(content_digest),
        environment TEXT NOT NULL,
        status TEXT NOT NULL,
        action TEXT NOT NULL,
        previous_deployment_id TEXT,
        rollback_of TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT NOT NULL,
        release_path TEXT NOT NULL,
        validation_id TEXT REFERENCES validations(validation_id),
        parameter_count INTEGER NOT NULL,
        secret_reference_count INTEGER NOT NULL,
        indexed_at TEXT NOT NULL
      );

      CREATE TABLE deployment_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deployment_id TEXT NOT NULL REFERENCES deployments(deployment_id) ON DELETE CASCADE,
        sequence INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        level TEXT NOT NULL,
        code TEXT NOT NULL,
        message TEXT NOT NULL,
        details_json TEXT
      );

      CREATE TABLE active_deployments (
        environment TEXT NOT NULL,
        package_id TEXT NOT NULL,
        deployment_id TEXT NOT NULL REFERENCES deployments(deployment_id),
        activated_at TEXT NOT NULL,
        PRIMARY KEY (environment, package_id)
      );

      CREATE INDEX idx_sites_project_name ON published_sites(project_name);
      CREATE INDEX idx_packages_id_version ON packages(package_id, package_version);
      CREATE INDEX idx_validations_package_environment ON validations(package_id, environment, validated_at DESC);
      CREATE INDEX idx_findings_validation ON validation_findings(validation_id, sequence);
      CREATE INDEX idx_deployments_package_environment ON deployments(package_id, environment, completed_at DESC);
      CREATE INDEX idx_deployment_logs_deployment ON deployment_logs(deployment_id, sequence);
    `,
  },
]

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function safeLimit(value, fallback = 50) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return fallback
  return Math.min(parsed, 250)
}

function relativeArtifactPath(dataDirectory, artifactPath) {
  return path.relative(dataDirectory, artifactPath).replaceAll('\\', '/')
}

function transaction(database, operation) {
  database.exec('BEGIN IMMEDIATE')
  try {
    const result = operation()
    database.exec('COMMIT')
    return result
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'))
}

async function readDirectory(directory) {
  try {
    return await readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}

export async function createMetadataStore(
  dataDirectory,
  databasePath = path.join(dataDirectory, 'carecanvas-metadata.sqlite'),
) {
  await mkdir(path.dirname(databasePath), { recursive: true })
  const database = new DatabaseSync(databasePath)
  const journalMode = process.platform === 'win32' ? 'DELETE' : 'WAL'
  database.exec('PRAGMA foreign_keys = ON')
  database.exec('PRAGMA busy_timeout = 5000')
  database.exec(`PRAGMA journal_mode = ${journalMode}`)
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `)

  for (const migration of migrations) {
    const applied = database
      .prepare('SELECT 1 FROM schema_migrations WHERE version = ?')
      .get(migration.version)
    if (applied) continue
    transaction(database, () => {
      database.exec(migration.sql)
      database.prepare(
        'INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)',
      ).run(migration.version, migration.name, new Date().toISOString())
    })
  }

  const upsertSiteStatement = database.prepare(`
    INSERT INTO published_sites(
      slug, project_name, page_title, artifact_path, content_digest,
      block_count, form_count, created_at, indexed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      project_name = excluded.project_name,
      page_title = excluded.page_title,
      artifact_path = excluded.artifact_path,
      content_digest = excluded.content_digest,
      block_count = excluded.block_count,
      form_count = excluded.form_count,
      created_at = excluded.created_at,
      indexed_at = excluded.indexed_at
  `)

  const upsertPackageStatement = database.prepare(`
    INSERT INTO packages(
      content_digest, package_id, application_name, application_version,
      package_version, schema_version, created_at, created_by, description,
      artifact_path, dependency_count, form_count, workflow_count,
      permission_count, integration_count, indexed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(content_digest) DO UPDATE SET
      package_id = excluded.package_id,
      application_name = excluded.application_name,
      application_version = excluded.application_version,
      package_version = excluded.package_version,
      schema_version = excluded.schema_version,
      created_at = excluded.created_at,
      created_by = excluded.created_by,
      description = excluded.description,
      artifact_path = excluded.artifact_path,
      dependency_count = excluded.dependency_count,
      form_count = excluded.form_count,
      workflow_count = excluded.workflow_count,
      permission_count = excluded.permission_count,
      integration_count = excluded.integration_count,
      indexed_at = excluded.indexed_at
  `)

  const insertValidationStatement = database.prepare(`
    INSERT INTO validations(
      validation_id, package_id, package_version, content_digest, environment,
      valid, errors, warnings, information, runtime_version, source,
      validated_at, indexed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(validation_id) DO UPDATE SET
      package_id = excluded.package_id,
      package_version = excluded.package_version,
      content_digest = excluded.content_digest,
      environment = excluded.environment,
      valid = excluded.valid,
      errors = excluded.errors,
      warnings = excluded.warnings,
      information = excluded.information,
      runtime_version = excluded.runtime_version,
      source = excluded.source,
      validated_at = excluded.validated_at,
      indexed_at = excluded.indexed_at
  `)

  const insertFindingStatement = database.prepare(`
    INSERT INTO validation_findings(
      validation_id, sequence, code, severity, category, message, path, resolution
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertDeploymentStatement = database.prepare(`
    INSERT INTO deployments(
      deployment_id, package_id, package_version, content_digest, environment,
      status, action, previous_deployment_id, rollback_of, started_at,
      completed_at, release_path, validation_id, parameter_count,
      secret_reference_count, indexed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(deployment_id) DO UPDATE SET
      package_id = excluded.package_id,
      package_version = excluded.package_version,
      content_digest = excluded.content_digest,
      environment = excluded.environment,
      status = excluded.status,
      action = excluded.action,
      previous_deployment_id = excluded.previous_deployment_id,
      rollback_of = excluded.rollback_of,
      started_at = excluded.started_at,
      completed_at = excluded.completed_at,
      release_path = excluded.release_path,
      validation_id = excluded.validation_id,
      parameter_count = excluded.parameter_count,
      secret_reference_count = excluded.secret_reference_count,
      indexed_at = excluded.indexed_at
  `)

  const insertLogStatement = database.prepare(`
    INSERT INTO deployment_logs(
      deployment_id, sequence, timestamp, level, code, message, details_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  const upsertActiveStatement = database.prepare(`
    INSERT INTO active_deployments(environment, package_id, deployment_id, activated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(environment, package_id) DO UPDATE SET
      deployment_id = excluded.deployment_id,
      activated_at = excluded.activated_at
  `)

  function writeSite(site) {
    const indexedAt = new Date().toISOString()
    const blocks = Array.isArray(site.page.blocks) ? site.page.blocks : []
    upsertSiteStatement.run(
      site.slug,
      site.page.settings?.projectName ?? 'Untitled site',
      site.page.settings?.pageTitle ?? site.page.settings?.projectName ?? 'Untitled site',
      relativeArtifactPath(dataDirectory, site.artifactPath),
      sha256(JSON.stringify(site.page)),
      blocks.length,
      blocks.filter((block) => block.type === 'appointment').length,
      site.createdAt ?? indexedAt,
      indexedAt,
    )
  }

  function writePackage(deploymentPackage, artifactPath) {
    const metadata = deploymentPackage.metadata
    const artifacts = deploymentPackage.artifacts ?? {}
    upsertPackageStatement.run(
      metadata.contentDigest,
      metadata.packageId,
      metadata.applicationName,
      metadata.applicationVersion,
      metadata.packageVersion,
      metadata.schemaVersion,
      metadata.createdAt,
      metadata.createdBy ?? '',
      metadata.description ?? '',
      relativeArtifactPath(dataDirectory, artifactPath),
      deploymentPackage.dependencies?.length ?? 0,
      artifacts.forms?.length ?? 0,
      artifacts.workflows?.length ?? 0,
      artifacts.permissions?.length ?? 0,
      artifacts.integrations?.length ?? 0,
      new Date().toISOString(),
    )
  }

  function writeValidation(report, source, validationId = `val-${Date.now()}-${randomUUID().slice(0, 6)}`) {
    const indexedAt = new Date().toISOString()
    database.prepare('DELETE FROM validation_findings WHERE validation_id = ?').run(validationId)
    insertValidationStatement.run(
      validationId,
      report.packageId,
      report.packageVersion,
      report.contentDigest,
      report.environment,
      report.valid ? 1 : 0,
      report.summary?.errors ?? 0,
      report.summary?.warnings ?? 0,
      report.summary?.information ?? 0,
      report.runtimeVersion ?? '',
      source,
      report.validatedAt ?? indexedAt,
      indexedAt,
    )
    for (const [index, finding] of (report.findings ?? []).entries()) {
      insertFindingStatement.run(
        validationId,
        index,
        finding.code,
        finding.severity,
        finding.category,
        finding.message,
        finding.path ?? null,
        finding.resolution ?? null,
      )
    }
    return validationId
  }

  function writeDeployment(deploymentPackage, record, options) {
    writePackage(deploymentPackage, options.packagePath)
    const validationId = record.validation
      ? writeValidation(record.validation, 'deployment', `val-${record.deploymentId}`)
      : null
    database.prepare('DELETE FROM deployment_logs WHERE deployment_id = ?').run(record.deploymentId)
    insertDeploymentStatement.run(
      record.deploymentId,
      record.packageId,
      record.packageVersion,
      record.contentDigest,
      record.environment,
      record.status,
      record.action,
      record.previousDeploymentId ?? null,
      record.rollbackOf ?? null,
      record.startedAt,
      record.completedAt,
      relativeArtifactPath(dataDirectory, options.releasePath),
      validationId,
      Object.keys(record.configuration?.values ?? {}).length,
      Object.keys(record.configuration?.secretReferences ?? {}).length,
      new Date().toISOString(),
    )
    for (const [index, log] of (record.logs ?? []).entries()) {
      insertLogStatement.run(
        record.deploymentId,
        index,
        log.timestamp,
        log.level,
        log.code,
        log.message,
        log.details ? JSON.stringify(log.details) : null,
      )
    }
    if (options.active) {
      upsertActiveStatement.run(
        record.environment,
        record.packageId,
        record.deploymentId,
        record.completedAt,
      )
    }
  }

  function recordPublishedSite(site) {
    transaction(database, () => writeSite(site))
  }

  function recordValidation(report, source = 'preflight') {
    return transaction(database, () => writeValidation(report, source))
  }

  function recordDeployment(deploymentPackage, record, options) {
    transaction(database, () => writeDeployment(deploymentPackage, record, options))
  }

  function health() {
    const schemaVersion = database
      .prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations')
      .get().version
    database.prepare('SELECT 1 AS ok').get()
    return {
      status: 'ok',
      engine: 'sqlite',
      schemaVersion,
      journalMode: database.prepare('PRAGMA journal_mode').get().journal_mode,
    }
  }

  function processSummary() {
    const counts = database.prepare(`
      SELECT
        (SELECT COUNT(*) FROM published_sites) AS publishedSites,
        (SELECT COUNT(*) FROM packages) AS packages,
        (SELECT COUNT(*) FROM deployments) AS deployments,
        (SELECT COUNT(*) FROM active_deployments) AS activeDeployments,
        (SELECT COUNT(*) FROM validations) AS validations,
        (SELECT COUNT(*) FROM validation_findings WHERE severity = 'error') AS validationErrors,
        (SELECT COALESCE(SUM(block_count), 0) FROM published_sites) AS publishedBlocks,
        (SELECT COALESCE(SUM(form_count), 0) FROM packages) AS packagedForms,
        (SELECT COALESCE(SUM(workflow_count), 0) FROM packages) AS packagedWorkflows
    `).get()
    const deploymentsByEnvironment = database.prepare(`
      SELECT
        environment,
        COUNT(*) AS deployments,
        SUM(CASE WHEN action = 'rollback' THEN 1 ELSE 0 END) AS rollbacks,
        MAX(completed_at) AS latestDeploymentAt
      FROM deployments
      GROUP BY environment
      ORDER BY environment
    `).all()
    const packagesByApplication = database.prepare(`
      SELECT
        package_id AS packageId,
        application_name AS applicationName,
        COUNT(*) AS versions,
        MAX(created_at) AS latestPackageAt
      FROM packages
      GROUP BY package_id, application_name
      ORDER BY latestPackageAt DESC
    `).all()
    return {
      generatedAt: new Date().toISOString(),
      schemaVersion: METADATA_SCHEMA_VERSION,
      counts,
      deploymentsByEnvironment,
      packagesByApplication,
    }
  }

  function listPublishedSites({ query = '', limit = 50 } = {}) {
    const search = `%${query}%`
    return database.prepare(`
      SELECT
        slug,
        project_name AS projectName,
        page_title AS pageTitle,
        content_digest AS contentDigest,
        block_count AS blockCount,
        form_count AS formCount,
        created_at AS createdAt,
        indexed_at AS indexedAt
      FROM published_sites
      WHERE project_name LIKE ? OR page_title LIKE ? OR slug LIKE ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(search, search, search, safeLimit(limit))
  }

  function listPackages({ packageId = '', limit = 50 } = {}) {
    return database.prepare(`
      SELECT
        content_digest AS contentDigest,
        package_id AS packageId,
        application_name AS applicationName,
        application_version AS applicationVersion,
        package_version AS packageVersion,
        schema_version AS schemaVersion,
        dependency_count AS dependencyCount,
        form_count AS formCount,
        workflow_count AS workflowCount,
        permission_count AS permissionCount,
        integration_count AS integrationCount,
        created_at AS createdAt,
        indexed_at AS indexedAt
      FROM packages
      WHERE (? = '' OR package_id = ?)
      ORDER BY created_at DESC
      LIMIT ?
    `).all(packageId, packageId, safeLimit(limit))
  }

  function listDeployments({ environment = '', packageId = '', limit = 50 } = {}) {
    return database.prepare(`
      SELECT
        d.deployment_id AS deploymentId,
        d.package_id AS packageId,
        d.package_version AS packageVersion,
        d.content_digest AS contentDigest,
        d.environment,
        d.status,
        d.action,
        d.previous_deployment_id AS previousDeploymentId,
        d.rollback_of AS rollbackOf,
        d.completed_at AS completedAt,
        d.parameter_count AS parameterCount,
        d.secret_reference_count AS secretReferenceCount,
        CASE WHEN a.deployment_id = d.deployment_id THEN 1 ELSE 0 END AS active
      FROM deployments d
      LEFT JOIN active_deployments a
        ON a.environment = d.environment AND a.package_id = d.package_id
      WHERE (? = '' OR d.environment = ?)
        AND (? = '' OR d.package_id = ?)
      ORDER BY d.completed_at DESC
      LIMIT ?
    `).all(environment, environment, packageId, packageId, safeLimit(limit))
  }

  function listValidations({ environment = '', packageId = '', limit = 50 } = {}) {
    return database.prepare(`
      SELECT
        validation_id AS validationId,
        package_id AS packageId,
        package_version AS packageVersion,
        content_digest AS contentDigest,
        environment,
        valid,
        errors,
        warnings,
        information,
        runtime_version AS runtimeVersion,
        source,
        validated_at AS validatedAt
      FROM validations
      WHERE (? = '' OR environment = ?)
        AND (? = '' OR package_id = ?)
      ORDER BY validated_at DESC
      LIMIT ?
    `).all(environment, environment, packageId, packageId, safeLimit(limit))
  }

  async function collectArtifacts() {
    const sites = []
    const packages = []
    const deployments = []
    const activeDeploymentIds = new Set()

    for (const entry of await readDirectory(dataDirectory)) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue
      const artifactPath = path.join(dataDirectory, entry.name)
      try {
        const page = await readJson(artifactPath)
        if (!page?.settings || !Array.isArray(page.blocks)) continue
        const details = await stat(artifactPath)
        sites.push({
          slug: entry.name.replace(/\.json$/, ''),
          page,
          artifactPath,
          createdAt: details.birthtime.toISOString(),
        })
      } catch {
        // Invalid payload files remain untouched and are reported by count below.
      }
    }

    const deploymentRoot = path.join(dataDirectory, 'deployment-system')
    const packagesDirectory = path.join(deploymentRoot, 'packages')
    for (const entry of await readDirectory(packagesDirectory)) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue
      const artifactPath = path.join(packagesDirectory, entry.name)
      try {
        packages.push({ deploymentPackage: await readJson(artifactPath), artifactPath })
      } catch {
        // Invalid package artifacts are skipped without mutating source files.
      }
    }

    const environmentsDirectory = path.join(deploymentRoot, 'environments')
    for (const environmentEntry of await readDirectory(environmentsDirectory)) {
      if (!environmentEntry.isDirectory()) continue
      const environmentDirectory = path.join(environmentsDirectory, environmentEntry.name)
      for (const packageEntry of await readDirectory(environmentDirectory)) {
        if (!packageEntry.isDirectory()) continue
        const packageDirectory = path.join(environmentDirectory, packageEntry.name)
        try {
          const active = await readJson(path.join(packageDirectory, 'active.json'))
          activeDeploymentIds.add(active.deploymentId)
        } catch {
          // An application can have history without an active pointer during recovery.
        }
        const releasesDirectory = path.join(packageDirectory, 'releases')
        for (const releaseEntry of await readDirectory(releasesDirectory)) {
          if (!releaseEntry.isFile() || !releaseEntry.name.endsWith('.json')) continue
          const releasePath = path.join(releasesDirectory, releaseEntry.name)
          try {
            deployments.push({ record: await readJson(releasePath), releasePath })
          } catch {
            // Invalid release files are skipped and remain available for inspection.
          }
        }
      }
    }

    return { sites, packages, deployments, activeDeploymentIds }
  }

  function indexArtifacts(artifacts, reset) {
    const packagesByDigest = new Map(
      artifacts.packages.map((item) => [item.deploymentPackage.metadata.contentDigest, item]),
    )
    const skippedDeployments = []

    transaction(database, () => {
      if (reset) {
        database.exec(`
          DELETE FROM active_deployments;
          DELETE FROM deployment_logs;
          DELETE FROM deployments;
          DELETE FROM validation_findings;
          DELETE FROM validations;
          DELETE FROM packages;
          DELETE FROM published_sites;
        `)
      } else {
        database.exec('DELETE FROM active_deployments')
      }
      for (const site of artifacts.sites) writeSite(site)
      for (const item of artifacts.packages) writePackage(item.deploymentPackage, item.artifactPath)
      for (const item of artifacts.deployments) {
        const packageItem = packagesByDigest.get(item.record.contentDigest)
        if (!packageItem) {
          skippedDeployments.push(item.record.deploymentId)
          continue
        }
        writeDeployment(packageItem.deploymentPackage, item.record, {
          packagePath: packageItem.artifactPath,
          releasePath: item.releasePath,
          active: artifacts.activeDeploymentIds.has(item.record.deploymentId),
        })
      }
    })

    return skippedDeployments
  }

  async function processArtifacts(reset) {
    const artifacts = await collectArtifacts()
    const skippedDeployments = indexArtifacts(artifacts, reset)

    return {
      processedAt: new Date().toISOString(),
      publishedSites: artifacts.sites.length,
      packages: artifacts.packages.length,
      deployments: artifacts.deployments.length - skippedDeployments.length,
      skippedDeployments,
      summary: processSummary(),
    }
  }

  async function synchronize() {
    return processArtifacts(false)
  }

  async function reindex() {
    return processArtifacts(true)
  }

  function close() {
    if (journalMode === 'WAL') database.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    database.close()
  }

  return {
    databasePath,
    close,
    health,
    listDeployments,
    listPackages,
    listPublishedSites,
    listValidations,
    processSummary,
    recordDeployment,
    recordPublishedSite,
    recordValidation,
    reindex,
    synchronize,
  }
}
