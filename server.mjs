import { randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import {
  createDeploymentStore,
  DEPLOYMENT_ENVIRONMENTS,
  validateDeploymentRequest,
} from './deployment-runtime.mjs'
import { createMetadataStore } from './metadata-store.mjs'

const app = express()
const port = Number(process.env.PORT ?? 8080)
const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const distDirectory = path.join(currentDirectory, 'dist')
const dataDirectory = process.env.DATA_DIR ?? path.join(currentDirectory, 'data')
const metadataDatabasePath = process.env.METADATA_DB_PATH ?? path.join(dataDirectory, 'carecanvas-metadata.sqlite')
const deploymentApiToken = process.env.DEPLOYMENT_API_TOKEN ?? ''

await mkdir(dataDirectory, { recursive: true })
const metadataStore = await createMetadataStore(dataDirectory, metadataDatabasePath)
const startupMetadataIndex = await metadataStore.synchronize()
const deploymentStore = await createDeploymentStore(dataDirectory, metadataStore)

app.disable('x-powered-by')
app.use((_, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.setHeader('X-Frame-Options', 'SAMEORIGIN')
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self'",
  )
  next()
})
app.use(express.json({ limit: '5mb' }))

function authorizeDeployment(request, response, next) {
  if (!deploymentApiToken) {
    next()
    return
  }
  const supplied = request.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const expectedBuffer = Buffer.from(deploymentApiToken)
  const suppliedBuffer = Buffer.from(supplied)
  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    response.status(401).json({ error: 'Deployment API authorization required' })
    return
  }
  next()
}

function isPageModel(value) {
  if (!value || typeof value !== 'object') return false
  const { settings, blocks } = value
  return (
    settings &&
    typeof settings === 'object' &&
    typeof settings.projectName === 'string' &&
    settings.projectName.trim().length > 0 &&
    settings.projectName.length <= 80 &&
    Array.isArray(blocks) &&
    blocks.length <= 100
  )
}

function siteFile(slug) {
  return path.join(dataDirectory, `${slug}.json`)
}

function createSlug(projectName) {
  const base = projectName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 42) || 'site'
  return `${base}-${randomUUID().slice(0, 6)}`
}

app.get('/health', (_, response) => {
  response.json({ status: 'ok', metadata: metadataStore.health() })
})

app.post('/api/packages/validate', authorizeDeployment, (request, response) => {
  const { deploymentPackage, environment, configuration } = request.body ?? {}
  const report = validateDeploymentRequest(deploymentPackage, environment, configuration)
  const validationId = metadataStore.recordValidation(report, 'preflight')
  response.status(report.valid ? 200 : 422).json({ ...report, validationId })
})

app.post('/api/deployments', authorizeDeployment, async (request, response) => {
  const { deploymentPackage, environment, configuration } = request.body ?? {}
  const validation = validateDeploymentRequest(deploymentPackage, environment, configuration)
  if (!validation.valid) {
    metadataStore.recordValidation(validation, 'deployment-preflight')
    response.status(422).json({ error: 'Pre-deployment validation failed', validation })
    return
  }

  try {
    const deployment = await deploymentStore.deploy(
      deploymentPackage,
      environment,
      configuration,
      validation,
    )
    response.status(201).json({
      deployment,
      validation,
      url: `/e/${environment}/${deployment.packageId}`,
    })
  } catch (error) {
    console.error('Unable to deploy package', error)
    response.status(500).json({ error: 'Unable to deploy package' })
  }
})

app.get('/api/environments/:environment/apps/:packageId', async (request, response) => {
  const { environment, packageId } = request.params
  if (!DEPLOYMENT_ENVIRONMENTS.includes(environment)) {
    response.status(400).json({ error: 'Unsupported environment' })
    return
  }
  try {
    const deployment = await deploymentStore.getActive(environment, packageId)
    response.json({
      page: deployment.resolvedPage,
      deployment: {
        deploymentId: deployment.deploymentId,
        packageId: deployment.packageId,
        packageVersion: deployment.packageVersion,
        contentDigest: deployment.contentDigest,
        environment: deployment.environment,
        completedAt: deployment.completedAt,
      },
    })
  } catch (error) {
    if (error?.code === 'ENOENT') {
      response.status(404).json({ error: 'No active deployment found' })
      return
    }
    console.error('Unable to read active deployment', error)
    response.status(500).json({ error: 'Unable to read active deployment' })
  }
})

app.get('/api/environments/:environment/apps/:packageId/deployments', authorizeDeployment, async (request, response) => {
  const { environment, packageId } = request.params
  if (!DEPLOYMENT_ENVIRONMENTS.includes(environment)) {
    response.status(400).json({ error: 'Unsupported environment' })
    return
  }
  try {
    response.json({ deployments: await deploymentStore.history(environment, packageId) })
  } catch (error) {
    console.error('Unable to read deployment history', error)
    response.status(500).json({ error: 'Unable to read deployment history' })
  }
})

app.post('/api/environments/:environment/apps/:packageId/rollback', authorizeDeployment, async (request, response) => {
  const { environment, packageId } = request.params
  if (!DEPLOYMENT_ENVIRONMENTS.includes(environment)) {
    response.status(400).json({ error: 'Unsupported environment' })
    return
  }
  try {
    const deployment = await deploymentStore.rollback(
      environment,
      packageId,
      request.body?.deploymentId,
    )
    response.status(201).json({
      deployment,
      url: `/e/${environment}/${packageId}`,
    })
  } catch (error) {
    if (error?.code === 'NO_ROLLBACK_TARGET' || error?.code === 'ENOENT') {
      response.status(409).json({ error: error.message })
      return
    }
    console.error('Unable to roll back deployment', error)
    response.status(500).json({ error: 'Unable to roll back deployment' })
  }
})

app.post('/api/sites', async (request, response) => {
  if (!isPageModel(request.body)) {
    response.status(400).json({ error: 'Invalid site document' })
    return
  }

  const slug = createSlug(request.body.settings.projectName.trim())
  const destination = siteFile(slug)
  const temporaryFile = `${destination}.${randomUUID()}.tmp`

  try {
    await writeFile(temporaryFile, JSON.stringify(request.body, null, 2), 'utf8')
    await rename(temporaryFile, destination)
    metadataStore.recordPublishedSite({
      slug,
      page: request.body,
      artifactPath: destination,
      createdAt: new Date().toISOString(),
    })
    response.status(201).json({ slug, url: `/p/${slug}` })
  } catch (error) {
    console.error('Unable to publish site', error)
    response.status(500).json({ error: 'Unable to publish site' })
  }
})

app.get('/api/sites/:slug', async (request, response) => {
  const { slug } = request.params
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) {
    response.status(400).json({ error: 'Invalid site name' })
    return
  }

  try {
    const contents = await readFile(siteFile(slug), 'utf8')
    response.type('json').send(contents)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      response.status(404).json({ error: 'Site not found' })
      return
    }
    console.error('Unable to read site', error)
    response.status(500).json({ error: 'Unable to read site' })
  }
})

app.use(express.static(distDirectory, { index: false, maxAge: '1h' }))
app.use((request, response, next) => {
  if (request.method !== 'GET' || request.path.startsWith('/api/')) {
    next()
    return
  }
  response.sendFile(path.join(distDirectory, 'index.html'))
})

app.listen(port, '0.0.0.0', () => {
  console.log(`CareCanvas is listening on http://0.0.0.0:${port}`)
})

app.get('/api/metadata/summary', authorizeDeployment, (_, response) => {
  response.json({
    startupIndex: startupMetadataIndex,
    ...metadataStore.processSummary(),
  })
})

app.get('/api/metadata/sites', authorizeDeployment, (request, response) => {
  response.json({
    sites: metadataStore.listPublishedSites({
      query: String(request.query.query ?? ''),
      limit: request.query.limit,
    }),
  })
})

app.get('/api/metadata/packages', authorizeDeployment, (request, response) => {
  response.json({
    packages: metadataStore.listPackages({
      packageId: String(request.query.packageId ?? ''),
      limit: request.query.limit,
    }),
  })
})

app.get('/api/metadata/deployments', authorizeDeployment, (request, response) => {
  response.json({
    deployments: metadataStore.listDeployments({
      environment: String(request.query.environment ?? ''),
      packageId: String(request.query.packageId ?? ''),
      limit: request.query.limit,
    }),
  })
})

app.get('/api/metadata/validations', authorizeDeployment, (request, response) => {
  response.json({
    validations: metadataStore.listValidations({
      environment: String(request.query.environment ?? ''),
      packageId: String(request.query.packageId ?? ''),
      limit: request.query.limit,
    }),
  })
})

app.post('/api/metadata/reindex', authorizeDeployment, async (_, response) => {
  try {
    response.json(await metadataStore.reindex())
  } catch (error) {
    console.error('Unable to rebuild metadata index', error)
    response.status(500).json({ error: 'Unable to rebuild metadata index' })
  }
})