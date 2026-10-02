import { readFile } from 'node:fs/promises'
import process from 'node:process'
import JSZip from 'jszip'
import { DEPLOYMENT_ENVIRONMENTS, sha256 } from '../deployment-runtime.mjs'

function usage() {
  console.log(`CareCanvas deployment CLI

Commands:
  validate  --package <archive.zip> --environment <name> [--config <file>] [--server <url>]
  deploy    --package <archive.zip> --environment <name> [--config <file>] [--server <url>]
  history   --package-id <id> --environment <name> [--server <url>]
  rollback  --package-id <id> --environment <name> [--deployment-id <id>] [--server <url>]

Environments: ${DEPLOYMENT_ENVIRONMENTS.join(', ')}

The CLI sends secret references, never secret values. Configure referenced secrets in the target environment.`)
}

function parseArguments(argv) {
  const [command, ...rest] = argv
  const options = {}
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index]
    if (!value.startsWith('--')) throw new Error(`Unexpected argument: ${value}`)
    const key = value.slice(2)
    const next = rest[index + 1]
    if (!next || next.startsWith('--')) options[key] = true
    else {
      options[key] = next
      index += 1
    }
  }
  return { command, options }
}

async function loadArchive(filePath, environment, configPath) {
  const zip = await JSZip.loadAsync(await readFile(filePath))
  const packageFile = zip.file('carecanvas.package.json')
  const checksumFile = zip.file('checksums.json')
  if (!packageFile || !checksumFile) throw new Error('Archive is missing carecanvas.package.json or checksums.json.')
  const deploymentPackage = JSON.parse(await packageFile.async('string'))
  const checksums = JSON.parse(await checksumFile.async('string'))

  for (const [name, expected] of Object.entries(checksums)) {
    const file = zip.file(name)
    if (!file) throw new Error(`Checksum references missing archive file: ${name}`)
    const actual = sha256(Buffer.from(await file.async('arraybuffer')))
    if (actual !== expected) throw new Error(`Checksum verification failed for ${name}.`)
  }

  let configuration
  if (configPath) configuration = JSON.parse(await readFile(configPath, 'utf8'))
  else {
    const template = zip.file(`config/environments/${environment}.template.json`)
    if (!template) throw new Error(`Archive has no ${environment} environment template.`)
    configuration = JSON.parse(await template.async('string'))
  }
  return { deploymentPackage, configuration }
}

async function request(server, path, options = {}) {
  const token = process.env.CARECANVAS_DEPLOYMENT_TOKEN
  const response = await fetch(new URL(path, server), {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
  console.log(JSON.stringify(body, null, 2))
  if (!response.ok) process.exitCode = 1
  return { response, body }
}

async function main() {
  const { command, options } = parseArguments(process.argv.slice(2))
  if (!command || command === 'help' || options.help) {
    usage()
    return
  }

  const server = options.server ?? process.env.CARECANVAS_SERVER_URL ?? 'http://localhost:8082'
  const environment = options.environment
  if (!DEPLOYMENT_ENVIRONMENTS.includes(environment)) {
    throw new Error(`--environment must be one of: ${DEPLOYMENT_ENVIRONMENTS.join(', ')}`)
  }

  if (command === 'validate' || command === 'deploy') {
    if (!options.package) throw new Error('--package is required.')
    const { deploymentPackage, configuration } = await loadArchive(options.package, environment, options.config)
    const endpoint = command === 'validate' ? '/api/packages/validate' : '/api/deployments'
    await request(server, endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deploymentPackage, environment, configuration }),
    })
    return
  }

  if (!options['package-id']) throw new Error('--package-id is required.')
  const packageId = encodeURIComponent(options['package-id'])
  if (command === 'history') {
    await request(server, `/api/environments/${environment}/apps/${packageId}/deployments`)
    return
  }
  if (command === 'rollback') {
    await request(server, `/api/environments/${environment}/apps/${packageId}/rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deploymentId: options['deployment-id'] }),
    })
    return
  }
  throw new Error(`Unknown command: ${command}`)
}

main().catch((error) => {
  console.error(`carecanvas-deploy: ${error.message}`)
  process.exitCode = 1
})
