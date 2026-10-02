import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  createDeploymentStore,
  packageContentDigest,
  validateDeploymentRequest,
} from '../deployment-runtime.mjs'

function packageFixture(version = '1.0.0', title = 'Release one') {
  const deploymentPackage = {
    kind: 'CareCanvasDeploymentPackage',
    apiVersion: 'carecanvas.dev/v1',
    metadata: {
      packageId: 'northstar-health',
      applicationName: 'Northstar Health',
      applicationVersion: '1.0.0',
      packageVersion: version,
      schemaVersion: '1.0.0',
      createdAt: '2026-10-02T00:00:00.000Z',
      createdBy: 'test',
      description: 'Deployment test package.',
      contentDigest: '',
      compatibility: {
        careCanvasRuntime: '>=1.0.0 <2.0.0',
        packageSchema: '^1.0.0',
        nodeRuntime: '>=24.0.0',
      },
    },
    artifacts: {
      pages: [{
        id: 'main',
        route: '/',
        model: {
          settings: {
            projectName: 'Northstar Health',
            pageTitle: title,
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
          blocks: [],
        },
      }],
      forms: [],
      workflows: [],
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
    environment: 'development',
    packageId: 'northstar-health',
    values: { PUBLIC_BASE_URL: 'https://dev.example.org' },
    secretReferences: {},
  }
}

test('validation rejects missing parameters and embedded secret-like values', () => {
  const configuration = configurationFixture()
  configuration.values.PUBLIC_BASE_URL = ''
  configuration.values.API_TOKEN = 'not-allowed'
  const report = validateDeploymentRequest(
    packageFixture(),
    'development',
    configuration,
    {},
  )
  assert.equal(report.valid, false)
  assert.ok(report.findings.some((finding) => finding.code === 'CFG003'))
  assert.ok(report.findings.some((finding) => finding.code === 'SEC002'))
})

test('deployment history is immutable and rollback creates a new release', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'carecanvas-deployment-'))
  try {
    const store = await createDeploymentStore(directory)
    const configuration = configurationFixture()
    const firstPackage = packageFixture('1.0.0', 'Release one')
    const firstValidation = validateDeploymentRequest(firstPackage, 'development', configuration, {})
    assert.equal(firstValidation.valid, true)
    const first = await store.deploy(firstPackage, 'development', configuration, firstValidation)

    const secondPackage = packageFixture('1.1.0', 'Release two')
    const secondValidation = validateDeploymentRequest(secondPackage, 'development', configuration, {})
    assert.equal(secondValidation.valid, true)
    const second = await store.deploy(secondPackage, 'development', configuration, secondValidation)
    assert.notEqual(first.contentDigest, second.contentDigest)

    const beforeRollback = await store.history('development', 'northstar-health')
    assert.equal(beforeRollback.length, 2)
    assert.equal((await store.getActive('development', 'northstar-health')).packageVersion, '1.1.0')

    const rollback = await store.rollback('development', 'northstar-health', first.deploymentId)
    assert.equal(rollback.action, 'rollback')
    assert.equal(rollback.rollbackOf, first.deploymentId)
    assert.equal(rollback.packageVersion, '1.0.0')
    assert.equal((await store.getActive('development', 'northstar-health')).deploymentId, rollback.deploymentId)
    assert.equal((await store.history('development', 'northstar-health')).length, 3)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
