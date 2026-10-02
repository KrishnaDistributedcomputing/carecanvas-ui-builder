import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  createDeploymentStore,
  packageContentDigest,
  validateDeploymentRequest,
} from '../deployment-runtime.mjs'
import { createMetadataStore } from '../metadata-store.mjs'

function pageFixture() {
  return {
    settings: {
      projectName: 'Metadata Clinic',
      pageTitle: 'Metadata Clinic - Local care',
      accent: '#147d74',
      surface: '#edf4f1',
      ink: '#172321',
      pageBackground: '#ffffff',
      headingFont: 'Instrument Serif',
      bodyFont: 'Manrope',
      radius: 4,
      sectionSpacing: 72,
      contentWidth: 1120,
    },
    blocks: [
      {
        id: 'appointment-main',
        type: 'appointment',
        label: 'Request an appointment',
        title: 'Plan your visit',
        text: 'Our team will follow up.',
        buttonLabel: 'Request appointment',
        buttonUrl: '#',
        image: '',
        alignment: 'left',
        background: 'soft',
        items: [],
      },
    ],
  }
}

function packageFixture(page) {
  const deploymentPackage = {
    kind: 'CareCanvasDeploymentPackage',
    apiVersion: 'carecanvas.dev/v1',
    metadata: {
      packageId: 'metadata-clinic',
      applicationName: 'Metadata Clinic',
      applicationVersion: '1.0.0',
      packageVersion: '1.0.0',
      schemaVersion: '1.0.0',
      createdAt: '2026-10-02T00:00:00.000Z',
      createdBy: 'metadata test',
      description: 'Metadata persistence fixture.',
      contentDigest: '',
      compatibility: {
        careCanvasRuntime: '>=1.0.0 <2.0.0',
        packageSchema: '^1.0.0',
        nodeRuntime: '>=24.0.0',
      },
    },
    artifacts: {
      pages: [{ id: 'main', route: '/', model: page }],
      forms: [{
        id: 'form-appointment-main',
        name: 'Plan your visit',
        sourceBlockId: 'appointment-main',
        fields: [],
        validationRules: [],
        submitWorkflowId: 'workflow-form-appointment-main-submit',
      }],
      workflows: [{
        id: 'workflow-form-appointment-main-submit',
        name: 'Appointment submission',
        trigger: { type: 'form.submit', formId: 'form-appointment-main' },
        enabledWhen: 'disabled',
        steps: [],
      }],
      permissions: [{ role: 'public', resources: ['page:main'], actions: ['read'] }],
      integrations: [],
      configuration: {
        settings: { publicationModel: 'immutable' },
        parameters: [{
          key: 'PUBLIC_BASE_URL',
          type: 'url',
          required: true,
          description: 'Public URL.',
        }],
        secrets: [],
      },
    },
    dependencies: [{
      id: 'carecanvas-runtime',
      name: 'CareCanvas runtime',
      type: 'runtime',
      versionRange: '>=1.0.0 <2.0.0',
      required: true,
      description: 'Runtime.',
    }],
    relationships: [{ from: 'permission:public', to: 'page:main', type: 'governs' }],
  }
  deploymentPackage.metadata.contentDigest = packageContentDigest(deploymentPackage)
  return deploymentPackage
}

function configurationFixture() {
  return {
    schemaVersion: '1.0.0',
    environment: 'test',
    packageId: 'metadata-clinic',
    values: { PUBLIC_BASE_URL: 'https://test.example.org' },
    secretReferences: {},
  }
}

async function runMetadataScenario(directory) {
  const databasePath = path.join(directory, 'metadata.sqlite')
  const page = pageFixture()
  const sitePath = path.join(directory, 'metadata-clinic-public.json')
  await writeFile(sitePath, JSON.stringify(page, null, 2), 'utf8')

  const metadata = await createMetadataStore(directory, databasePath)
  metadata.recordPublishedSite({
    slug: 'metadata-clinic-public',
    page,
    artifactPath: sitePath,
    createdAt: '2026-10-02T00:00:00.000Z',
  })

  const deploymentStore = await createDeploymentStore(directory, metadata)
  const deploymentPackage = packageFixture(page)
  const configuration = configurationFixture()
  const validation = validateDeploymentRequest(
    deploymentPackage,
    'test',
    configuration,
    {},
  )
  assert.equal(validation.valid, true)
  await deploymentStore.deploy(deploymentPackage, 'test', configuration, validation)
  metadata.recordValidation(
    { ...validation, validatedAt: '2026-10-02T01:00:00.000Z' },
    'preflight',
  )

  const firstSummary = metadata.processSummary()
  assert.deepEqual({ ...firstSummary.counts }, {
    publishedSites: 1,
    packages: 1,
    deployments: 1,
    activeDeployments: 1,
    validations: 2,
    validationErrors: 0,
    publishedBlocks: 1,
    packagedForms: 1,
    packagedWorkflows: 1,
  })
  assert.equal(metadata.listPublishedSites({ query: 'Clinic' }).length, 1)
  assert.equal(metadata.listDeployments({ environment: 'test' })[0].active, 1)
  metadata.close()

  const reopened = await createMetadataStore(directory, databasePath)
  assert.equal(reopened.processSummary().counts.deployments, 1)
  const synchronizeResult = await reopened.synchronize()
  assert.equal(synchronizeResult.summary.counts.validations, 2)
  const reindexResult = await reopened.reindex()
  assert.equal(reindexResult.publishedSites, 1)
  assert.equal(reindexResult.packages, 1)
  assert.equal(reindexResult.deployments, 1)
  assert.equal(reindexResult.summary.counts.validations, 1)
  assert.equal(reopened.processSummary().counts.activeDeployments, 1)
  const result = reopened.processSummary()
  reopened.close()
  return result
}

if (process.env.CARECANVAS_METADATA_TEST_WORKER === '1') {
  const result = await runMetadataScenario(process.argv[2])
  process.stdout.write(`${JSON.stringify(result)}\n`)
} else {
  test('SQLite metadata persists, aggregates, and rebuilds from immutable artifacts', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'carecanvas-metadata-'))
    try {
      const script = fileURLToPath(import.meta.url)
      const childResult = await new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [script, directory], {
          env: { ...process.env, CARECANVAS_METADATA_TEST_WORKER: '1' },
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        let stdout = ''
        let stderr = ''
        child.stdout.on('data', (chunk) => { stdout += chunk })
        child.stderr.on('data', (chunk) => { stderr += chunk })
        child.on('error', reject)
        child.on('close', (code) => {
          if (code !== 0) reject(new Error(`Metadata worker failed (${code}): ${stderr}`))
          else resolve(JSON.parse(stdout.trim().split(/\r?\n/).at(-1)))
        })
      })
      assert.equal(childResult.counts.deployments, 1)
      assert.equal(childResult.counts.activeDeployments, 1)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
}
