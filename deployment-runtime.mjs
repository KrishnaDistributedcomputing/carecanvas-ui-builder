import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const RUNTIME_VERSION = '1.0.0'
export const PACKAGE_KIND = 'CareCanvasDeploymentPackage'
export const PACKAGE_API_VERSION = 'carecanvas.dev/v1'
export const PACKAGE_SCHEMA_VERSION = '1.0.0'
export const DEPLOYMENT_ENVIRONMENTS = ['development', 'test', 'uat', 'staging', 'production']

const supportedBlockTypes = new Set([
  'hero', 'heading', 'text', 'button', 'image', 'features', 'team', 'insurance',
  'hours', 'faq', 'appointment', 'stats', 'testimonial', 'contact', 'spacer',
])

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    )
  }
  return value
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value))
}

export function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`
}

function safeSegment(value, label) {
  if (typeof value !== 'string' || !/^[a-z0-9-]{1,80}$/.test(value)) {
    throw new Error(`${label} must contain 1-80 lowercase letters, numbers, or hyphens.`)
  }
  return value
}

function major(version) {
  const match = String(version ?? '').match(/^(\d+)/)
  return match ? Number(match[1]) : -1
}

function addFinding(findings, code, severity, category, message, pathValue, resolution) {
  findings.push({ code, severity, category, message, path: pathValue, resolution })
}

function scanEmbeddedSecrets(value, findings, currentPath = 'package') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanEmbeddedSecrets(item, findings, `${currentPath}[${index}]`))
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, nested] of Object.entries(value)) {
    const nestedPath = `${currentPath}.${key}`
    const secretKey = /(password|secret|token|api[-_]?key|connection[-_]?string|credential)/i.test(key)
    const referenceContext = /(secretReferences|secrets|secretKey|allowedProviders)/i.test(currentPath) || key === 'secretKey'
    if (secretKey && !referenceContext && typeof nested === 'string' && nested.trim()) {
      addFinding(
        findings,
        'SEC001',
        'error',
        'security',
        `A potential secret is embedded at ${nestedPath}.`,
        nestedPath,
        'Remove the value and use a target-environment secret reference.',
      )
    }
    scanEmbeddedSecrets(nested, findings, nestedPath)
  }
}

export function packageContentDigest(deploymentPackage) {
  const digestSource = {
    ...deploymentPackage,
    metadata: { ...deploymentPackage.metadata, contentDigest: '' },
  }
  return sha256(canonicalJson(digestSource))
}

export function validateDeploymentRequest(deploymentPackage, environment, configuration, targetSecrets = process.env) {
  const findings = []
  const metadata = deploymentPackage?.metadata ?? {}
  const artifacts = deploymentPackage?.artifacts ?? {}

  if (!DEPLOYMENT_ENVIRONMENTS.includes(environment)) {
    addFinding(findings, 'ENV001', 'error', 'configuration', `Environment ${environment} is not supported.`, 'environment')
  }
  if (deploymentPackage?.kind !== PACKAGE_KIND || deploymentPackage?.apiVersion !== PACKAGE_API_VERSION) {
    addFinding(findings, 'PKG001', 'error', 'package', 'Unsupported package kind or API version.', 'kind', 'Export from a compatible CareCanvas version.')
  }
  if (!metadata.packageId || !metadata.packageVersion || !metadata.applicationVersion) {
    addFinding(findings, 'PKG002', 'error', 'package', 'Package metadata is incomplete.', 'metadata')
  }
  if (metadata.schemaVersion !== PACKAGE_SCHEMA_VERSION || major(metadata.compatibility?.packageSchema?.replace(/^\D+/, '')) !== major(PACKAGE_SCHEMA_VERSION)) {
    addFinding(findings, 'PKG003', 'error', 'package', `Package schema ${metadata.schemaVersion ?? 'unknown'} is incompatible with ${PACKAGE_SCHEMA_VERSION}.`, 'metadata.schemaVersion')
  }
  if (major(metadata.applicationVersion) !== major(RUNTIME_VERSION)) {
    addFinding(findings, 'PKG004', 'error', 'package', `Application version ${metadata.applicationVersion} is incompatible with runtime ${RUNTIME_VERSION}.`, 'metadata.applicationVersion')
  }
  if (!artifacts.pages?.length || !artifacts.pages[0]?.model?.settings || !Array.isArray(artifacts.pages[0]?.model?.blocks)) {
    addFinding(findings, 'PKG005', 'error', 'package', 'A valid page artifact is required.', 'artifacts.pages')
  }

  const actualDigest = packageContentDigest(deploymentPackage)
  if (!metadata.contentDigest || actualDigest !== metadata.contentDigest) {
    addFinding(findings, 'PKG006', 'error', 'package', 'Package content digest does not match its immutable manifest.', 'metadata.contentDigest', 'Export the package again or restore the original artifact from source control.')
  }

  if (configuration?.environment !== environment) {
    addFinding(findings, 'CFG001', 'error', 'configuration', `Configuration targets ${configuration?.environment ?? 'unknown'}, not ${environment}.`, 'environment')
  }
  if (configuration?.packageId !== metadata.packageId) {
    addFinding(findings, 'CFG002', 'error', 'configuration', 'Configuration packageId does not match the deployment package.', 'packageId')
  }

  for (const dependency of deploymentPackage?.dependencies ?? []) {
    if (dependency.type === 'runtime' && dependency.required && dependency.id !== 'carecanvas-runtime') {
      addFinding(findings, 'DEP001', 'error', 'dependency', `Required runtime ${dependency.id} is unavailable.`, `dependencies.${dependency.id}`)
    }
    if (dependency.type === 'block' && dependency.required) {
      const blockType = dependency.id.replace(/^block-/, '')
      if (!supportedBlockTypes.has(blockType)) {
        addFinding(findings, 'DEP002', 'error', 'dependency', `Block renderer ${blockType} is unavailable.`, `dependencies.${dependency.id}`)
      }
    }
    if (!dependency.required) {
      addFinding(findings, 'DEP003', 'information', 'dependency', `Optional dependency ${dependency.name} activates only when configured.`, `dependencies.${dependency.id}`)
    }
  }

  for (const parameter of artifacts.configuration?.parameters ?? []) {
    const value = configuration?.values?.[parameter.key]
    if (parameter.required && (value === undefined || value === '')) {
      addFinding(findings, 'CFG003', 'error', 'configuration', `Required parameter ${parameter.key} is missing.`, `values.${parameter.key}`, 'Provide it in the target environment configuration file.')
    }
    if (parameter.type === 'url' && value && typeof value === 'string') {
      try {
        new URL(value)
      } catch {
        addFinding(findings, 'CFG004', 'error', 'configuration', `${parameter.key} must be an absolute URL.`, `values.${parameter.key}`)
      }
    }
  }

  for (const [key, value] of Object.entries(configuration?.values ?? {})) {
    if (/(password|secret|token|api[-_]?key|connection[-_]?string|credential)/i.test(key) && value !== '') {
      addFinding(findings, 'SEC002', 'error', 'security', `Environment value ${key} appears to contain a secret.`, `values.${key}`, 'Move the value to secretReferences and configure it in the target secret manager.')
    }
  }

  for (const secret of artifacts.configuration?.secrets ?? []) {
    const reference = configuration?.secretReferences?.[secret.key]
    const integrationEnabled = Boolean(configuration?.values?.APPOINTMENT_API_URL)
    if ((secret.required || integrationEnabled) && (!reference?.provider || !reference.reference)) {
      addFinding(findings, 'SEC003', 'error', 'security', `Secret reference ${secret.key} is required for the enabled integration.`, `secretReferences.${secret.key}`)
      continue
    }
    if (!reference) continue
    if (!secret.allowedProviders?.includes(reference.provider)) {
      addFinding(findings, 'SEC004', 'error', 'security', `Secret provider ${reference.provider} is not allowed for ${secret.key}.`, `secretReferences.${secret.key}.provider`)
    } else if (reference.provider === 'environment' && integrationEnabled && !targetSecrets[reference.reference]) {
      addFinding(findings, 'SEC005', 'error', 'security', `Target environment variable ${reference.reference} is not available.`, `secretReferences.${secret.key}.reference`, 'Create the secret in the target runtime before deploying.')
    } else if (reference.provider !== 'environment') {
      addFinding(findings, 'SEC006', 'warning', 'security', `Secret ${secret.key} uses ${reference.provider}; target-platform resolution must be confirmed by the pipeline.`, `secretReferences.${secret.key}`)
    }
  }

  scanEmbeddedSecrets(deploymentPackage, findings)

  const knownResources = new Set(['page:main', 'permission:public', 'integration:appointment-api'])
  for (const block of artifacts.pages?.[0]?.model?.blocks ?? []) knownResources.add(`block:${block.id}`)
  for (const form of artifacts.forms ?? []) knownResources.add(`form:${form.id}`)
  for (const workflow of artifacts.workflows ?? []) knownResources.add(`workflow:${workflow.id}`)
  for (const integration of artifacts.integrations ?? []) knownResources.add(`integration:${integration.id}`)
  for (const relationship of deploymentPackage?.relationships ?? []) {
    if (!knownResources.has(relationship.from)) addFinding(findings, 'REL001', 'error', 'relationship', `Relationship source ${relationship.from} does not exist.`, 'relationships')
    if (!knownResources.has(relationship.to)) addFinding(findings, 'REL002', 'error', 'relationship', `Relationship target ${relationship.to} does not exist.`, 'relationships')
  }

  if (artifacts.forms?.length && !configuration?.values?.APPOINTMENT_API_URL) {
    addFinding(findings, 'CFG005', 'warning', 'configuration', 'Appointment forms remain presentation-only because APPOINTMENT_API_URL is not configured.', 'values.APPOINTMENT_API_URL')
  }

  const summary = {
    errors: findings.filter((finding) => finding.severity === 'error').length,
    warnings: findings.filter((finding) => finding.severity === 'warning').length,
    information: findings.filter((finding) => finding.severity === 'information').length,
  }
  return {
    valid: summary.errors === 0,
    environment,
    packageId: metadata.packageId ?? 'unknown',
    packageVersion: metadata.packageVersion ?? 'unknown',
    contentDigest: metadata.contentDigest ?? '',
    runtimeVersion: RUNTIME_VERSION,
    findings,
    summary,
    validatedAt: new Date().toISOString(),
  }
}

export function resolvePackagePage(deploymentPackage, configuration) {
  const page = structuredClone(deploymentPackage.artifacts.pages[0].model)
  const replace = (value) => typeof value === 'string'
    ? value.replace(/\{\{parameters\.([A-Z0-9_]+)\}\}/g, (_, key) => String(configuration.values?.[key] ?? ''))
    : value
  page.blocks = page.blocks.map((block) => ({
    ...block,
    buttonUrl: replace(block.buttonUrl),
    image: replace(block.image),
  }))
  return page
}

async function atomicWrite(destination, value) {
  const temporary = `${destination}.${randomUUID()}.tmp`
  await writeFile(temporary, JSON.stringify(value, null, 2), 'utf8')
  await rename(temporary, destination)
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'))
}

function logEvent(level, code, message, details) {
  return { timestamp: new Date().toISOString(), level, code, message, details }
}

export async function createDeploymentStore(dataDirectory) {
  const root = path.join(dataDirectory, 'deployment-system')
  const packagesDirectory = path.join(root, 'packages')
  const environmentsDirectory = path.join(root, 'environments')
  await mkdir(packagesDirectory, { recursive: true })
  await mkdir(environmentsDirectory, { recursive: true })

  function appDirectory(environment, packageId) {
    return path.join(
      environmentsDirectory,
      safeSegment(environment, 'environment'),
      safeSegment(packageId, 'packageId'),
    )
  }

  async function saveImmutablePackage(deploymentPackage) {
    const digest = deploymentPackage.metadata.contentDigest.replace(/^sha256:/, '')
    const destination = path.join(packagesDirectory, `${digest}.json`)
    try {
      await writeFile(destination, JSON.stringify(deploymentPackage, null, 2), { encoding: 'utf8', flag: 'wx' })
      return { path: destination, reused: false }
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error
      const existing = await readJson(destination)
      if (existing.metadata.contentDigest !== deploymentPackage.metadata.contentDigest) {
        throw new Error('Stored immutable package digest collision.')
      }
      return { path: destination, reused: true }
    }
  }

  async function deploy(deploymentPackage, environment, configuration, validation) {
    const packageId = safeSegment(deploymentPackage.metadata.packageId, 'packageId')
    const directory = appDirectory(environment, packageId)
    const releasesDirectory = path.join(directory, 'releases')
    await mkdir(releasesDirectory, { recursive: true })
    const activeFile = path.join(directory, 'active.json')
    let previousDeploymentId = null
    try {
      previousDeploymentId = (await readJson(activeFile)).deploymentId
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }

    const packageStore = await saveImmutablePackage(deploymentPackage)
    const deploymentId = `dep-${Date.now()}-${randomUUID().slice(0, 6)}`
    const startedAt = new Date().toISOString()
    const logs = [
      logEvent('information', 'DEPLOY_START', `Started deployment to ${environment}.`),
      ...validation.findings.map((finding) => logEvent(finding.severity, finding.code, finding.message, { path: finding.path })),
      logEvent('information', packageStore.reused ? 'PACKAGE_REUSED' : 'PACKAGE_STORED', packageStore.reused ? 'Reused immutable package artifact.' : 'Stored immutable package artifact.'),
      logEvent('information', 'CONFIG_APPLIED', 'Applied target environment parameters and retained secret references only.'),
      logEvent('information', 'DEPLOY_ACTIVE', 'Activated deployment after validation completed.'),
    ]
    const record = {
      deploymentId,
      packageId,
      packageVersion: deploymentPackage.metadata.packageVersion,
      contentDigest: deploymentPackage.metadata.contentDigest,
      environment,
      status: 'succeeded',
      action: 'deploy',
      previousDeploymentId,
      startedAt,
      completedAt: new Date().toISOString(),
      configuration: {
        schemaVersion: configuration.schemaVersion,
        environment: configuration.environment,
        packageId: configuration.packageId,
        values: configuration.values,
        secretReferences: configuration.secretReferences,
      },
      validation,
      resolvedPage: resolvePackagePage(deploymentPackage, configuration),
      logs,
    }
    const releaseFile = path.join(releasesDirectory, `${deploymentId}.json`)
    await atomicWrite(releaseFile, record)
    await atomicWrite(activeFile, {
      deploymentId,
      packageId,
      packageVersion: record.packageVersion,
      contentDigest: record.contentDigest,
      environment,
      activatedAt: record.completedAt,
    })
    return record
  }

  async function getActive(environment, packageId) {
    const directory = appDirectory(environment, packageId)
    const active = await readJson(path.join(directory, 'active.json'))
    return readJson(path.join(directory, 'releases', `${active.deploymentId}.json`))
  }

  async function history(environment, packageId) {
    const releasesDirectory = path.join(appDirectory(environment, packageId), 'releases')
    try {
      const files = await readdir(releasesDirectory)
      const records = await Promise.all(
        files.filter((file) => file.endsWith('.json')).map((file) => readJson(path.join(releasesDirectory, file))),
      )
      return records.sort((first, second) => second.completedAt.localeCompare(first.completedAt))
    } catch (error) {
      if (error?.code === 'ENOENT') return []
      throw error
    }
  }

  async function rollback(environment, packageId, requestedDeploymentId) {
    const directory = appDirectory(environment, packageId)
    const active = await readJson(path.join(directory, 'active.json'))
    const records = await history(environment, packageId)
    const target = requestedDeploymentId
      ? records.find((record) => record.deploymentId === requestedDeploymentId)
      : records.find((record) => record.deploymentId !== active.deploymentId && record.status === 'succeeded')
    if (!target) throw Object.assign(new Error('No eligible deployment is available for rollback.'), { code: 'NO_ROLLBACK_TARGET' })

    const deploymentId = `dep-${Date.now()}-${randomUUID().slice(0, 6)}`
    const completedAt = new Date().toISOString()
    const record = {
      ...structuredClone(target),
      deploymentId,
      action: 'rollback',
      rollbackOf: target.deploymentId,
      previousDeploymentId: active.deploymentId,
      startedAt: completedAt,
      completedAt,
      logs: [
        logEvent('information', 'ROLLBACK_START', `Rolling back ${environment}/${packageId} from ${active.deploymentId}.`),
        logEvent('information', 'ROLLBACK_TARGET', `Restoring immutable deployment ${target.deploymentId}.`),
        logEvent('information', 'ROLLBACK_ACTIVE', 'Rollback release activated.'),
      ],
    }
    const releasesDirectory = path.join(directory, 'releases')
    await atomicWrite(path.join(releasesDirectory, `${deploymentId}.json`), record)
    await atomicWrite(path.join(directory, 'active.json'), {
      deploymentId,
      packageId,
      packageVersion: record.packageVersion,
      contentDigest: record.contentDigest,
      environment,
      activatedAt: completedAt,
    })
    return record
  }

  return { deploy, getActive, history, rollback }
}
