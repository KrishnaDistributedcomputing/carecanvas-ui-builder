import JSZip from 'jszip'
import type { PageModel, SiteBlock } from './types'

export const PACKAGE_KIND = 'CareCanvasDeploymentPackage'
export const PACKAGE_API_VERSION = 'carecanvas.dev/v1'
export const PACKAGE_SCHEMA_VERSION = '1.0.0'
export const APPLICATION_VERSION = '1.0.0'

export const portablePackageJsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://carecanvas.dev/schemas/deployment-package-1.0.0.json',
  title: 'CareCanvas deployment package',
  type: 'object',
  required: ['kind', 'apiVersion', 'metadata', 'artifacts', 'dependencies', 'relationships'],
  properties: {
    kind: { const: PACKAGE_KIND },
    apiVersion: { const: PACKAGE_API_VERSION },
    metadata: {
      type: 'object',
      required: ['packageId', 'applicationVersion', 'packageVersion', 'schemaVersion', 'createdAt', 'contentDigest', 'compatibility'],
      properties: {
        packageId: { type: 'string', pattern: '^[a-z0-9-]{1,80}$' },
        applicationName: { type: 'string', minLength: 1 },
        applicationVersion: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
        packageVersion: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
        schemaVersion: { const: PACKAGE_SCHEMA_VERSION },
        createdAt: { type: 'string', format: 'date-time' },
        createdBy: { type: 'string' },
        description: { type: 'string' },
        contentDigest: { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' },
        compatibility: { type: 'object' },
      },
    },
    artifacts: {
      type: 'object',
      required: ['pages', 'forms', 'workflows', 'permissions', 'integrations', 'configuration'],
      properties: {
        pages: { type: 'array', minItems: 1 },
        forms: { type: 'array' },
        workflows: { type: 'array' },
        permissions: { type: 'array' },
        integrations: { type: 'array' },
        configuration: { type: 'object' },
      },
    },
    dependencies: { type: 'array' },
    relationships: { type: 'array' },
  },
} as const

export const environmentConfigurationJsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://carecanvas.dev/schemas/environment-configuration-1.0.0.json',
  title: 'CareCanvas environment configuration',
  type: 'object',
  required: ['schemaVersion', 'environment', 'packageId', 'values', 'secretReferences'],
  properties: {
    schemaVersion: { const: PACKAGE_SCHEMA_VERSION },
    environment: { enum: ['development', 'test', 'uat', 'staging', 'production'] },
    packageId: { type: 'string', pattern: '^[a-z0-9-]{1,80}$' },
    values: { type: 'object', additionalProperties: { type: ['string', 'number', 'boolean'] } },
    secretReferences: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        required: ['provider', 'reference'],
        properties: {
          provider: { enum: ['environment', 'azure-key-vault', 'aws-secrets-manager', 'hashicorp-vault', 'github-actions'] },
          reference: { type: 'string', minLength: 1 },
          version: { type: 'string' },
        },
      },
    },
  },
} as const

export const deploymentEnvironments = [
  'development',
  'test',
  'uat',
  'staging',
  'production',
] as const

export type DeploymentEnvironment = (typeof deploymentEnvironments)[number]
export type ValidationSeverity = 'error' | 'warning' | 'information'
export type SecretProvider =
  | 'environment'
  | 'azure-key-vault'
  | 'aws-secrets-manager'
  | 'hashicorp-vault'
  | 'github-actions'

export interface PackageDependency {
  id: string
  name: string
  type: 'runtime' | 'block' | 'integration'
  versionRange: string
  required: boolean
  description: string
}

export interface FormFieldDefinition {
  id: string
  label: string
  type: 'text' | 'email' | 'select' | 'date'
  required: boolean
  options?: string[]
  validationRuleIds: string[]
}

export interface ValidationRuleDefinition {
  id: string
  type: 'required' | 'format' | 'minimum-date'
  value?: string
  message: string
}

export interface FormDefinition {
  id: string
  name: string
  sourceBlockId: string
  fields: FormFieldDefinition[]
  validationRules: ValidationRuleDefinition[]
  submitWorkflowId: string
}

export interface WorkflowDefinition {
  id: string
  name: string
  trigger: { type: 'form.submit'; formId: string }
  enabledWhen: string
  steps: Array<{
    id: string
    type: 'integration.request' | 'audit.event'
    integrationId?: string
    action: string
    continueOnError: boolean
  }>
}

export interface PermissionDefinition {
  role: 'public' | 'editor' | 'deployer'
  resources: string[]
  actions: string[]
}

export interface IntegrationDefinition {
  id: string
  name: string
  type: 'http'
  enabledWhen: string
  endpointParameter: string
  authentication: {
    type: 'bearer-secret-reference'
    secretKey: string
  }
}

export interface ParameterDefinition {
  key: string
  type: 'string' | 'url' | 'boolean' | 'number'
  required: boolean
  description: string
  example?: string | number | boolean
}

export interface SecretDefinition {
  key: string
  required: boolean
  description: string
  allowedProviders: SecretProvider[]
}

export interface EnvironmentSecretReference {
  provider: SecretProvider
  reference: string
  version?: string
}

export interface EnvironmentConfiguration {
  schemaVersion: string
  environment: DeploymentEnvironment
  packageId: string
  values: Record<string, string | number | boolean>
  secretReferences: Record<string, EnvironmentSecretReference>
}

export interface PackageRelationship {
  from: string
  to: string
  type: 'contains' | 'renders' | 'submits-to' | 'invokes' | 'requires' | 'governs'
}

export interface PortableDeploymentPackage {
  kind: typeof PACKAGE_KIND
  apiVersion: typeof PACKAGE_API_VERSION
  metadata: {
    packageId: string
    applicationName: string
    applicationVersion: string
    packageVersion: string
    schemaVersion: string
    createdAt: string
    createdBy: string
    description: string
    contentDigest: string
    compatibility: {
      careCanvasRuntime: string
      packageSchema: string
      nodeRuntime: string
    }
  }
  artifacts: {
    pages: Array<{ id: string; route: string; model: PageModel }>
    forms: FormDefinition[]
    workflows: WorkflowDefinition[]
    permissions: PermissionDefinition[]
    integrations: IntegrationDefinition[]
    configuration: {
      settings: Record<string, string | number | boolean>
      parameters: ParameterDefinition[]
      secrets: SecretDefinition[]
    }
  }
  dependencies: PackageDependency[]
  relationships: PackageRelationship[]
}

export interface PackageValidationFinding {
  code: string
  severity: ValidationSeverity
  category: 'package' | 'dependency' | 'configuration' | 'security' | 'relationship'
  message: string
  path?: string
  resolution?: string
}

export interface PackageValidationReport {
  valid: boolean
  environment: DeploymentEnvironment
  packageId: string
  packageVersion: string
  contentDigest: string
  findings: PackageValidationFinding[]
  summary: { errors: number; warnings: number; information: number }
  validatedAt: string
}

export interface DeploymentArchive {
  deploymentPackage: PortableDeploymentPackage
  environmentTemplates: Record<DeploymentEnvironment, EnvironmentConfiguration>
  checksums: Record<string, string>
}

interface PackageBuildOptions {
  packageVersion?: string
  createdBy?: string
  description?: string
}

const supportedBlockTypes = new Set([
  'hero',
  'heading',
  'text',
  'button',
  'image',
  'features',
  'team',
  'insurance',
  'hours',
  'faq',
  'appointment',
  'stats',
  'testimonial',
  'contact',
  'spacer',
])

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'carecanvas-app'
}

function parameterKey(block: SiteBlock) {
  return `LINK_${block.id.replace(/[^a-z0-9]+/gi, '_').toUpperCase()}`
}

function isAbsoluteUrl(value: string) {
  return /^https?:\/\//i.test(value)
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([first], [second]) => first.localeCompare(second))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    )
  }
  return value
}

function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value))
}

async function sha256(value: string | ArrayBuffer) {
  const source = typeof value === 'string' ? new TextEncoder().encode(value) : value
  const digest = await crypto.subtle.digest('SHA-256', source)
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

function externalizeEnvironmentUrls(page: PageModel) {
  const parameters: ParameterDefinition[] = [
    {
      key: 'PUBLIC_BASE_URL',
      type: 'url',
      required: true,
      description: 'Public base URL for the deployed application.',
      example: 'https://care.example.org',
    },
  ]
  const extractedValues: Record<string, string> = {}
  const model = structuredClone(page)

  model.blocks = model.blocks.map((block) => {
    if (!isAbsoluteUrl(block.buttonUrl)) return block
    const key = parameterKey(block)
    extractedValues[key] = block.buttonUrl
    parameters.push({
      key,
      type: 'url',
      required: true,
      description: `Target URL for the ${block.id} block action.`,
      example: block.buttonUrl,
    })
    return { ...block, buttonUrl: `{{parameters.${key}}}` }
  })

  if (model.blocks.some((block) => block.type === 'appointment')) {
    parameters.push({
      key: 'APPOINTMENT_API_URL',
      type: 'url',
      required: false,
      description: 'Optional target API for appointment request workflows.',
      example: 'https://api.example.org/appointments',
    })
  }

  return { model, parameters, extractedValues }
}

function extractForms(page: PageModel): FormDefinition[] {
  return page.blocks
    .filter((block) => block.type === 'appointment')
    .map((block) => {
      const formId = `form-${block.id}`
      const rules: ValidationRuleDefinition[] = [
        { id: `${formId}-name-required`, type: 'required', message: 'Full name is required.' },
        { id: `${formId}-email-required`, type: 'required', message: 'Email address is required.' },
        { id: `${formId}-email-format`, type: 'format', value: 'email', message: 'Enter a valid email address.' },
        { id: `${formId}-visit-required`, type: 'required', message: 'Visit type is required.' },
        { id: `${formId}-date-future`, type: 'minimum-date', value: 'today', message: 'Choose today or a future date.' },
      ]
      return {
        id: formId,
        name: block.title || 'Appointment request',
        sourceBlockId: block.id,
        fields: [
          { id: 'fullName', label: 'Full name', type: 'text', required: true, validationRuleIds: [`${formId}-name-required`] },
          { id: 'email', label: 'Email address', type: 'email', required: true, validationRuleIds: [`${formId}-email-required`, `${formId}-email-format`] },
          { id: 'visitType', label: 'Visit type', type: 'select', required: true, options: ['Primary care', 'Preventive visit', 'Virtual care'], validationRuleIds: [`${formId}-visit-required`] },
          { id: 'preferredDay', label: 'Preferred day', type: 'date', required: false, validationRuleIds: [`${formId}-date-future`] },
        ],
        validationRules: rules,
        submitWorkflowId: `workflow-${formId}-submit`,
      }
    })
}

function extractWorkflows(forms: FormDefinition[]): WorkflowDefinition[] {
  return forms.map((form) => ({
    id: form.submitWorkflowId,
    name: `${form.name} submission`,
    trigger: { type: 'form.submit', formId: form.id },
    enabledWhen: 'parameters.APPOINTMENT_API_URL is configured',
    steps: [
      {
        id: `${form.id}-submit-request`,
        type: 'integration.request',
        integrationId: 'appointment-api',
        action: 'POST appointment request',
        continueOnError: false,
      },
      {
        id: `${form.id}-audit-event`,
        type: 'audit.event',
        action: 'Record workflow outcome without form field values',
        continueOnError: true,
      },
    ],
  }))
}

function createRelationships(page: PageModel, forms: FormDefinition[], workflows: WorkflowDefinition[]) {
  const relationships: PackageRelationship[] = page.blocks.map((block) => ({
    from: 'page:main',
    to: `block:${block.id}`,
    type: 'contains',
  }))

  for (const form of forms) {
    relationships.push(
      { from: `block:${form.sourceBlockId}`, to: `form:${form.id}`, type: 'renders' },
      { from: `form:${form.id}`, to: `workflow:${form.submitWorkflowId}`, type: 'submits-to' },
    )
  }
  for (const workflow of workflows) {
    relationships.push({ from: `workflow:${workflow.id}`, to: 'integration:appointment-api', type: 'invokes' })
  }
  relationships.push({ from: 'permission:public', to: 'page:main', type: 'governs' })
  return relationships
}

function environmentTemplate(
  environment: DeploymentEnvironment,
  packageId: string,
  parameters: ParameterDefinition[],
  extractedValues: Record<string, string>,
): EnvironmentConfiguration {
  const host = environment === 'production'
    ? 'https://care.example.org'
    : `https://care-${environment}.example.org`
  const values: Record<string, string | number | boolean> = { PUBLIC_BASE_URL: host }

  for (const parameter of parameters) {
    if (parameter.key in values) continue
    if (parameter.key in extractedValues) values[parameter.key] = extractedValues[parameter.key]
    else if (parameter.required && parameter.example !== undefined) values[parameter.key] = parameter.example
  }

  return {
    schemaVersion: PACKAGE_SCHEMA_VERSION,
    environment,
    packageId,
    values,
    secretReferences: {
      APPOINTMENT_API_TOKEN: {
        provider: 'environment',
        reference: `CARECANVAS_${environment.toUpperCase()}_APPOINTMENT_API_TOKEN`,
      },
    },
  }
}

export async function createPortablePackage(page: PageModel, options: PackageBuildOptions = {}) {
  const packageId = slugify(page.settings.projectName)
  const { model, parameters, extractedValues } = externalizeEnvironmentUrls(page)
  const forms = extractForms(model)
  const workflows = extractWorkflows(forms)
  const blockTypes = [...new Set(model.blocks.map((block) => block.type))].sort()
  const deploymentPackage: PortableDeploymentPackage = {
    kind: PACKAGE_KIND,
    apiVersion: PACKAGE_API_VERSION,
    metadata: {
      packageId,
      applicationName: page.settings.projectName,
      applicationVersion: APPLICATION_VERSION,
      packageVersion: options.packageVersion ?? APPLICATION_VERSION,
      schemaVersion: PACKAGE_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      createdBy: options.createdBy ?? 'CareCanvas UI Builder',
      description: options.description ?? `Portable deployment package for ${page.settings.projectName}.`,
      contentDigest: '',
      compatibility: {
        careCanvasRuntime: '>=1.0.0 <2.0.0',
        packageSchema: '^1.0.0',
        nodeRuntime: '>=24.0.0',
      },
    },
    artifacts: {
      pages: [{ id: 'main', route: '/', model }],
      forms,
      workflows,
      permissions: [
        { role: 'public', resources: ['page:main'], actions: ['read'] },
        { role: 'editor', resources: ['page:main', 'forms:*', 'workflows:*'], actions: ['read', 'update', 'export'] },
        { role: 'deployer', resources: ['package:*', 'environment:*'], actions: ['validate', 'deploy', 'rollback'] },
      ],
      integrations: forms.length
        ? [{
            id: 'appointment-api',
            name: 'Appointment API',
            type: 'http',
            enabledWhen: 'parameters.APPOINTMENT_API_URL is configured',
            endpointParameter: 'APPOINTMENT_API_URL',
            authentication: { type: 'bearer-secret-reference', secretKey: 'APPOINTMENT_API_TOKEN' },
          }]
        : [],
      configuration: {
        settings: {
          publicationModel: 'immutable',
          formSubmissionMode: forms.length ? 'integration-when-configured' : 'disabled',
          preserveArtifactRelationships: true,
        },
        parameters,
        secrets: forms.length
          ? [{
              key: 'APPOINTMENT_API_TOKEN',
              required: false,
              description: 'Bearer token for the optional appointment API integration.',
              allowedProviders: ['environment', 'azure-key-vault', 'aws-secrets-manager', 'hashicorp-vault', 'github-actions'],
            }]
          : [],
      },
    },
    dependencies: [
      {
        id: 'carecanvas-runtime',
        name: 'CareCanvas runtime',
        type: 'runtime',
        versionRange: '>=1.0.0 <2.0.0',
        required: true,
        description: 'Runtime capable of rendering the package schema.',
      },
      ...blockTypes.map((type) => ({
        id: `block-${type}`,
        name: `${type} block renderer`,
        type: 'block' as const,
        versionRange: '^1.0.0',
        required: true,
        description: `Renderer required by ${type} artifacts.`,
      })),
      ...(forms.length
        ? [{
            id: 'appointment-http-integration',
            name: 'Appointment HTTP integration',
            type: 'integration' as const,
            versionRange: '^1.0.0',
            required: false,
            description: 'Optional workflow adapter for appointment submission.',
          }]
        : []),
    ],
    relationships: createRelationships(model, forms, workflows),
  }

  deploymentPackage.metadata.contentDigest = await sha256(canonicalJson({
    ...deploymentPackage,
    metadata: { ...deploymentPackage.metadata, contentDigest: '' },
  }))

  const environmentTemplates = Object.fromEntries(
    deploymentEnvironments.map((environment) => [
      environment,
      environmentTemplate(environment, packageId, parameters, extractedValues),
    ]),
  ) as Record<DeploymentEnvironment, EnvironmentConfiguration>

  return { deploymentPackage, environmentTemplates }
}

export async function createDeploymentArchive(page: PageModel, options: PackageBuildOptions = {}) {
  const { deploymentPackage, environmentTemplates } = await createPortablePackage(page, options)
  const files: Record<string, string> = {
    'carecanvas.package.json': JSON.stringify(deploymentPackage, null, 2),
    'manifest.json': JSON.stringify(deploymentPackage.metadata, null, 2),
    'dependencies.json': JSON.stringify(deploymentPackage.dependencies, null, 2),
    'relationships.json': JSON.stringify(deploymentPackage.relationships, null, 2),
    'artifacts/pages/main.json': JSON.stringify(deploymentPackage.artifacts.pages[0], null, 2),
    'artifacts/permissions/roles.json': JSON.stringify(deploymentPackage.artifacts.permissions, null, 2),
    'artifacts/integrations/integrations.json': JSON.stringify(deploymentPackage.artifacts.integrations, null, 2),
    'config/parameters.schema.json': JSON.stringify(deploymentPackage.artifacts.configuration, null, 2),
    'schemas/carecanvas-package.schema.json': JSON.stringify(portablePackageJsonSchema, null, 2),
    'schemas/environment-configuration.schema.json': JSON.stringify(environmentConfigurationJsonSchema, null, 2),
  }

  for (const form of deploymentPackage.artifacts.forms) {
    files[`artifacts/forms/${form.id}.json`] = JSON.stringify(form, null, 2)
  }
  for (const workflow of deploymentPackage.artifacts.workflows) {
    files[`artifacts/workflows/${workflow.id}.json`] = JSON.stringify(workflow, null, 2)
  }
  for (const environment of deploymentEnvironments) {
    files[`config/environments/${environment}.template.json`] = JSON.stringify(environmentTemplates[environment], null, 2)
  }

  const checksums: Record<string, string> = {}
  for (const [name, contents] of Object.entries(files)) checksums[name] = await sha256(contents)
  files['checksums.json'] = JSON.stringify(checksums, null, 2)

  const zip = new JSZip()
  for (const [name, contents] of Object.entries(files)) zip.file(name, contents)
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  return { blob, deploymentPackage, environmentTemplates, checksums }
}

export async function readDeploymentArchive(input: Blob): Promise<DeploymentArchive> {
  const zip = await JSZip.loadAsync(input)
  const packageFile = zip.file('carecanvas.package.json')
  const checksumFile = zip.file('checksums.json')
  if (!packageFile || !checksumFile) throw new Error('Archive is missing carecanvas.package.json or checksums.json.')

  const deploymentPackage = JSON.parse(await packageFile.async('string')) as PortableDeploymentPackage
  const checksums = JSON.parse(await checksumFile.async('string')) as Record<string, string>

  for (const [name, expected] of Object.entries(checksums)) {
    const file = zip.file(name)
    if (!file) throw new Error(`Archive checksum references missing file: ${name}`)
    const actual = await sha256(await file.async('arraybuffer'))
    if (actual !== expected) throw new Error(`Checksum mismatch for ${name}.`)
  }

  const templates = {} as Record<DeploymentEnvironment, EnvironmentConfiguration>
  for (const environment of deploymentEnvironments) {
    const file = zip.file(`config/environments/${environment}.template.json`)
    if (!file) throw new Error(`Archive is missing the ${environment} environment template.`)
    templates[environment] = JSON.parse(await file.async('string')) as EnvironmentConfiguration
  }

  return { deploymentPackage, environmentTemplates: templates, checksums }
}

function addFinding(
  findings: PackageValidationFinding[],
  code: string,
  severity: ValidationSeverity,
  category: PackageValidationFinding['category'],
  message: string,
  path?: string,
  resolution?: string,
) {
  findings.push({ code, severity, category, message, path, resolution })
}

function scanEmbeddedSecrets(value: unknown, findings: PackageValidationFinding[], path = 'package') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanEmbeddedSecrets(item, findings, `${path}[${index}]`))
    return
  }
  if (!value || typeof value !== 'object') return
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const nestedPath = `${path}.${key}`
    const secretKey = /(password|secret|token|api[-_]?key|connection[-_]?string|credential)/i.test(key)
    const referenceContext = /(secretReferences|secrets|secretKey|allowedProviders)/i.test(path) || key === 'secretKey'
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

export function validateDeploymentPackage(
  deploymentPackage: PortableDeploymentPackage,
  environment: DeploymentEnvironment,
  configuration: EnvironmentConfiguration,
): PackageValidationReport {
  const findings: PackageValidationFinding[] = []

  if (deploymentPackage.kind !== PACKAGE_KIND || deploymentPackage.apiVersion !== PACKAGE_API_VERSION) {
    addFinding(findings, 'PKG001', 'error', 'package', 'Unsupported package kind or API version.', 'kind', 'Export the package from a compatible CareCanvas version.')
  }
  if (!deploymentPackage.metadata?.packageId || !deploymentPackage.metadata?.packageVersion) {
    addFinding(findings, 'PKG002', 'error', 'package', 'Package metadata is incomplete.', 'metadata')
  }
  if (deploymentPackage.metadata?.schemaVersion !== PACKAGE_SCHEMA_VERSION) {
    addFinding(findings, 'PKG003', 'error', 'package', `Schema ${deploymentPackage.metadata?.schemaVersion ?? 'unknown'} is incompatible with ${PACKAGE_SCHEMA_VERSION}.`, 'metadata.schemaVersion')
  }
  if (!deploymentPackage.artifacts?.pages?.length) {
    addFinding(findings, 'PKG004', 'error', 'package', 'At least one page artifact is required.', 'artifacts.pages')
  }
  if (configuration.environment !== environment) {
    addFinding(findings, 'CFG001', 'error', 'configuration', `Configuration targets ${configuration.environment}, not ${environment}.`, 'environment')
  }
  if (configuration.packageId !== deploymentPackage.metadata?.packageId) {
    addFinding(findings, 'CFG002', 'error', 'configuration', 'Configuration packageId does not match the deployment package.', 'packageId')
  }

  for (const dependency of deploymentPackage.dependencies ?? []) {
    if (dependency.type === 'runtime' && dependency.required && dependency.id !== 'carecanvas-runtime') {
      addFinding(findings, 'DEP001', 'error', 'dependency', `Required runtime ${dependency.id} is unavailable.`, `dependencies.${dependency.id}`)
    }
    if (dependency.type === 'block' && dependency.required) {
      const type = dependency.id.replace(/^block-/, '')
      if (!supportedBlockTypes.has(type)) {
        addFinding(findings, 'DEP002', 'error', 'dependency', `Block renderer ${type} is not supported by this runtime.`, `dependencies.${dependency.id}`)
      }
    }
    if (!dependency.required) {
      addFinding(findings, 'DEP003', 'information', 'dependency', `Optional dependency ${dependency.name} will activate only when configured.`, `dependencies.${dependency.id}`)
    }
  }

  for (const parameter of deploymentPackage.artifacts?.configuration?.parameters ?? []) {
    const value = configuration.values?.[parameter.key]
    if (parameter.required && (value === undefined || value === '')) {
      addFinding(findings, 'CFG003', 'error', 'configuration', `Required parameter ${parameter.key} is missing.`, `values.${parameter.key}`, 'Add the value to the target environment configuration.')
    }
    if (parameter.type === 'url' && value && typeof value === 'string') {
      try {
        new URL(value)
      } catch {
        addFinding(findings, 'CFG004', 'error', 'configuration', `${parameter.key} must be an absolute URL.`, `values.${parameter.key}`)
      }
    }
  }

  for (const [key, value] of Object.entries(configuration.values ?? {})) {
    if (/(password|secret|token|api[-_]?key|connection[-_]?string|credential)/i.test(key) && value !== '') {
      addFinding(findings, 'SEC002', 'error', 'security', `Environment value ${key} appears to contain a secret.`, `values.${key}`, 'Move the value to secretReferences and configure it in the target secret manager.')
    }
  }

  for (const secret of deploymentPackage.artifacts?.configuration?.secrets ?? []) {
    const reference = configuration.secretReferences?.[secret.key]
    if (secret.required && (!reference?.provider || !reference.reference)) {
      addFinding(findings, 'SEC003', 'error', 'security', `Required secret reference ${secret.key} is missing.`, `secretReferences.${secret.key}`)
    }
    if (reference && !secret.allowedProviders.includes(reference.provider)) {
      addFinding(findings, 'SEC004', 'error', 'security', `Secret provider ${reference.provider} is not allowed for ${secret.key}.`, `secretReferences.${secret.key}.provider`)
    }
  }

  scanEmbeddedSecrets(deploymentPackage, findings)

  const knownResources = new Set<string>(['page:main', 'permission:public', 'integration:appointment-api'])
  for (const block of deploymentPackage.artifacts?.pages?.[0]?.model?.blocks ?? []) knownResources.add(`block:${block.id}`)
  for (const form of deploymentPackage.artifacts?.forms ?? []) knownResources.add(`form:${form.id}`)
  for (const workflow of deploymentPackage.artifacts?.workflows ?? []) knownResources.add(`workflow:${workflow.id}`)
  for (const integration of deploymentPackage.artifacts?.integrations ?? []) knownResources.add(`integration:${integration.id}`)
  for (const relationship of deploymentPackage.relationships ?? []) {
    if (!knownResources.has(relationship.from)) addFinding(findings, 'REL001', 'error', 'relationship', `Relationship source ${relationship.from} does not exist.`, 'relationships')
    if (!knownResources.has(relationship.to)) addFinding(findings, 'REL002', 'error', 'relationship', `Relationship target ${relationship.to} does not exist.`, 'relationships')
  }

  const integrationUrl = configuration.values?.APPOINTMENT_API_URL
  if (deploymentPackage.artifacts?.forms?.length && !integrationUrl) {
    addFinding(findings, 'CFG005', 'warning', 'configuration', 'Appointment forms will remain presentation-only because APPOINTMENT_API_URL is not configured.', 'values.APPOINTMENT_API_URL')
  }

  const summary = {
    errors: findings.filter((finding) => finding.severity === 'error').length,
    warnings: findings.filter((finding) => finding.severity === 'warning').length,
    information: findings.filter((finding) => finding.severity === 'information').length,
  }
  return {
    valid: summary.errors === 0,
    environment,
    packageId: deploymentPackage.metadata?.packageId ?? 'unknown',
    packageVersion: deploymentPackage.metadata?.packageVersion ?? 'unknown',
    contentDigest: deploymentPackage.metadata?.contentDigest ?? '',
    findings,
    summary,
    validatedAt: new Date().toISOString(),
  }
}

export function resolvePackagePage(
  deploymentPackage: PortableDeploymentPackage,
  configuration: EnvironmentConfiguration,
) {
  const page = structuredClone(deploymentPackage.artifacts.pages[0].model)
  const replace = (value: string) => value.replace(
    /\{\{parameters\.([A-Z0-9_]+)\}\}/g,
    (_, key: string) => String(configuration.values[key] ?? ''),
  )
  page.blocks = page.blocks.map((block) => ({
    ...block,
    buttonUrl: replace(block.buttonUrl),
    image: replace(block.image),
  }))
  return page
}
