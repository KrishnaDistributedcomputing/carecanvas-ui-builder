import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, DragEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  AlignCenter,
  AlignLeft,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  Blocks,
  Box,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  CircleCheck,
  Clock3,
  CloudUpload,
  Columns3,
  Copy,
  Download,
  Eye,
  ExternalLink,
  FileArchive,
  FileUp,
  GripVertical,
  Heading2,
  History,
  Image as ImageIcon,
  Laptop,
  Layers3,
  LayoutTemplate,
  MessageSquareQuote,
  Minus,
  Monitor,
  Maximize2,
  MousePointer2,
  Palette,
  PackageCheck,
  PackageOpen,
  PanelLeft,
  Plus,
  Redo2,
  RotateCcw,
  Rocket,
  Search,
  Settings2,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Sparkles,
  SquareMousePointer,
  Stethoscope,
  Tablet,
  Trash2,
  Type,
  Undo2,
  X,
} from 'lucide-react'
import './App.css'
import {
  createDeploymentArchive,
  createPortablePackage,
  deploymentEnvironments,
  readDeploymentArchive,
  resolvePackagePage,
  validateDeploymentPackage,
} from './deploymentPackage'
import type {
  DeploymentEnvironment,
  EnvironmentConfiguration,
  PackageValidationReport,
  PortableDeploymentPackage,
} from './deploymentPackage'
import { createBlock, defaultPage } from './defaults'
import { PageRenderer } from './PageRenderer'
import type { BlockBackground, BlockType, PageModel, SiteBlock } from './types'

type Viewport = 'desktop' | 'tablet' | 'mobile'
type MobilePanel = 'elements' | 'settings' | null
type LibraryView = 'blocks' | 'layers'

interface PaletteItem {
  type: BlockType
  label: string
  description: string
  icon: LucideIcon
}

interface DeploymentRecord {
  deploymentId: string
  packageId: string
  packageVersion: string
  contentDigest: string
  environment: DeploymentEnvironment
  status: 'succeeded' | 'failed'
  action: 'deploy' | 'rollback'
  completedAt: string
  rollbackOf?: string
  logs: Array<{
    timestamp: string
    level: 'error' | 'warning' | 'information'
    code: string
    message: string
  }>
}

interface DeploymentResult {
  deployment: DeploymentRecord
  validation?: PackageValidationReport
  url: string
}

const paletteGroups: { title: string; items: PaletteItem[] }[] = [
  {
    title: 'Care sections',
    items: [
      { type: 'hero', label: 'Clinic hero', description: 'Care promise and image', icon: LayoutTemplate },
      { type: 'features', label: 'Services', description: 'Specialties and care', icon: Columns3 },
      { type: 'team', label: 'Care team', description: 'Clinician profiles', icon: Stethoscope },
      { type: 'stats', label: 'Outcomes', description: 'Build patient trust', icon: BarChart3 },
      { type: 'hours', label: 'Hours', description: 'Location and schedule', icon: Clock3 },
      { type: 'spacer', label: 'Spacer', description: 'Add breathing room', icon: Box },
    ],
  },
  {
    title: 'Patient content',
    items: [
      { type: 'heading', label: 'Heading', description: 'Care section title', icon: Heading2 },
      { type: 'text', label: 'Patient info', description: 'Helpful care copy', icon: Type },
      { type: 'button', label: 'Appointment', description: 'Booking action', icon: SquareMousePointer },
      { type: 'image', label: 'Care image', description: 'Clinical photo', icon: ImageIcon },
    ],
  },
  {
    title: 'Patient trust',
    items: [
      { type: 'insurance', label: 'Insurance', description: 'Coverage options', icon: ShieldCheck },
      { type: 'faq', label: 'FAQ', description: 'Common questions', icon: CircleHelp },
      { type: 'testimonial', label: 'Patient story', description: 'Care experience', icon: MessageSquareQuote },
      { type: 'appointment', label: 'Request form', description: 'Appointment intake', icon: CalendarDays },
      { type: 'contact', label: 'Book a visit', description: 'Appointment close', icon: Sparkles },
    ],
  },
]

const themePresets: { name: string; accent: string; surface: string; ink: string; pageBackground: string }[] = [
  { name: 'Clinical teal', accent: '#147d74', surface: '#edf4f1', ink: '#172321', pageBackground: '#ffffff' },
  { name: 'Trust blue', accent: '#2563a8', surface: '#edf3fa', ink: '#182230', pageBackground: '#ffffff' },
  { name: 'Warm care', accent: '#bd4f38', surface: '#faf0eb', ink: '#2c211e', pageBackground: '#fffdfb' },
  { name: 'Bright care', accent: '#d94f65', surface: '#eef7f5', ink: '#20312e', pageBackground: '#ffffff' },
]

function normalizePage(page: PageModel): PageModel {
  return {
    settings: { ...defaultPage.settings, ...page.settings },
    blocks: Array.isArray(page.blocks)
      ? page.blocks.map((block) => ({ ...block, items: Array.isArray(block.items) ? block.items : [] }))
      : defaultPage.blocks,
  }
}

function blockLabel(type: BlockType) {
  return paletteGroups.flatMap((group) => group.items).find((item) => item.type === type)?.label
    ?? type.charAt(0).toUpperCase() + type.slice(1)
}

function luminance(hex: string) {
  const normalized = hex.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return 0
  const channels = [0, 2, 4].map((offset) => {
    const value = Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}

function contrastRatio(first: string, second: string) {
  const light = Math.max(luminance(first), luminance(second))
  const dark = Math.min(luminance(first), luminance(second))
  return (light + 0.05) / (dark + 0.05)
}

function loadPage(): PageModel {
  try {
    const saved = localStorage.getItem('carecanvas-page')
    return saved ? normalizePage(JSON.parse(saved) as PageModel) : defaultPage
  } catch {
    return defaultPage
  }
}

function createCopyId(type: BlockType) {
  return `${type}-${crypto.randomUUID()}`
}

function PublishedSite({ slug }: { slug: string }) {
  const [page, setPage] = useState<PageModel | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(`/api/sites/${encodeURIComponent(slug)}`)
      .then((response) => {
        if (!response.ok) throw new Error('Site not found')
        return response.json() as Promise<PageModel>
      })
      .then((site) => {
        document.title = site.settings.pageTitle
        setPage(site)
      })
      .catch(() => setError(true))
  }, [slug])

  if (error) {
    return (
      <main className="published-state">
        <span>404</span>
        <h1>This site has not been published.</h1>
        <a href="/">Open CareCanvas</a>
      </main>
    )
  }

  if (!page) {
    return (
      <main className="published-state">
        <div className="loader" />
        <p>Opening site</p>
      </main>
    )
  }

  return <PageRenderer page={page} publicMode />
}

function EnvironmentSite({ environment, packageId }: { environment: DeploymentEnvironment; packageId: string }) {
  const [page, setPage] = useState<PageModel | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(`/api/environments/${encodeURIComponent(environment)}/apps/${encodeURIComponent(packageId)}`)
      .then((response) => {
        if (!response.ok) throw new Error('Deployment not found')
        return response.json() as Promise<{ page: PageModel }>
      })
      .then((result) => {
        document.title = result.page.settings.pageTitle
        setPage(result.page)
      })
      .catch(() => setError(true))
  }, [environment, packageId])

  if (error) {
    return (
      <main className="published-state">
        <span>Deployment unavailable</span>
        <h1>No active {environment} release was found.</h1>
        <a href="/">Open CareCanvas</a>
      </main>
    )
  }

  if (!page) return <main className="published-state"><div className="loader" /><p>Loading deployment</p></main>
  return <PageRenderer page={page} publicMode />
}

function Designer() {
  const [page, setPage] = useState<PageModel>(loadPage)
  const [past, setPast] = useState<PageModel[]>([])
  const [future, setFuture] = useState<PageModel[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(page.blocks[0]?.id ?? null)
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [previewMode, setPreviewMode] = useState(false)
  const [saveState, setSaveState] = useState<'Saving' | 'Saved'>('Saved')
  const [publishing, setPublishing] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null)
  const [dragActive, setDragActive] = useState(false)
  const [libraryView, setLibraryView] = useState<LibraryView>('blocks')
  const [blockQuery, setBlockQuery] = useState('')
  const [canvasZoom, setCanvasZoom] = useState(100)
  const [deploymentCenterOpen, setDeploymentCenterOpen] = useState(false)
  const [deploymentBusy, setDeploymentBusy] = useState(false)
  const [packageSource, setPackageSource] = useState<'builder' | 'archive'>('builder')
  const [packageVersion, setPackageVersion] = useState('1.0.0')
  const [portablePackage, setPortablePackage] = useState<PortableDeploymentPackage | null>(null)
  const [environmentTemplates, setEnvironmentTemplates] = useState<Record<DeploymentEnvironment, EnvironmentConfiguration> | null>(null)
  const [targetEnvironment, setTargetEnvironment] = useState<DeploymentEnvironment>('development')
  const [environmentConfiguration, setEnvironmentConfiguration] = useState<EnvironmentConfiguration | null>(null)
  const [packageFileName, setPackageFileName] = useState<string | null>(null)
  const [packageValidation, setPackageValidation] = useState<PackageValidationReport | null>(null)
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null)
  const [deploymentHistory, setDeploymentHistory] = useState<DeploymentRecord[]>([])
  const [deploymentAccessToken, setDeploymentAccessToken] = useState('')
  const packageFileInput = useRef<HTMLInputElement>(null)

  const selectedBlock = page.blocks.find((block) => block.id === selectedId) ?? null
  const selectedIndex = selectedBlock
    ? page.blocks.findIndex((block) => block.id === selectedBlock.id)
    : -1
  const accentContrast = Math.max(
    contrastRatio(page.settings.accent, '#ffffff'),
    contrastRatio(page.settings.accent, page.settings.ink),
  )
  const filteredPaletteGroups = paletteGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        `${item.label} ${item.description}`.toLowerCase().includes(blockQuery.trim().toLowerCase()),
      ),
    }))
    .filter((group) => group.items.length > 0)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem('carecanvas-page', JSON.stringify(page))
      setSaveState('Saved')
    }, 350)
    return () => window.clearTimeout(timer)
  }, [page])

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 1800)
  }

  const commit = (change: (current: PageModel) => PageModel) => {
    setSaveState('Saving')
    setPast((current) => [...current, page].slice(-40))
    setFuture([])
    setPage(change(page))
  }

  const undo = () => {
    const previous = past.at(-1)
    if (!previous) return
    setSaveState('Saving')
    setPast(past.slice(0, -1))
    setFuture([page, ...future].slice(0, 40))
    setPage(previous)
  }

  const redo = () => {
    const next = future[0]
    if (!next) return
    setSaveState('Saving')
    setPast([...past, page].slice(-40))
    setFuture(future.slice(1))
    setPage(next)
  }

  const addBlock = (type: BlockType) => {
    const nextBlock = createBlock(type)
    commit((current) => {
      const index = current.blocks.findIndex((block) => block.id === selectedId)
      const blocks = [...current.blocks]
      blocks.splice(index >= 0 ? index + 1 : blocks.length, 0, nextBlock)
      return { ...current, blocks }
    })
    setSelectedId(nextBlock.id)
    setMobilePanel('settings')
    showToast(`${type.charAt(0).toUpperCase()}${type.slice(1)} added`)
  }

  const updateSelected = (patch: Partial<SiteBlock>) => {
    if (!selectedId) return
    commit((current) => ({
      ...current,
      blocks: current.blocks.map((block) =>
        block.id === selectedId ? { ...block, ...patch } : block,
      ),
    }))
  }

  const updateBlockItem = (index: number, patch: Partial<SiteBlock['items'][number]>) => {
    if (!selectedBlock) return
    updateSelected({
      items: selectedBlock.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    })
  }

  const addBlockItem = () => {
    if (!selectedBlock || selectedBlock.items.length >= 6) return
    const item = selectedBlock.type === 'team'
      ? { title: 'New clinician', text: 'Clinical specialty', meta: 'Credentials', image: '' }
      : selectedBlock.type === 'faq'
        ? { title: 'New patient question', text: 'Add a clear, reassuring answer.' }
        : { title: 'New item', text: 'Add supporting details.' }
    updateSelected({ items: [...selectedBlock.items, item] })
  }

  const removeBlockItem = (index: number) => {
    if (!selectedBlock) return
    updateSelected({ items: selectedBlock.items.filter((_, itemIndex) => itemIndex !== index) })
  }

  const removeSelected = () => {
    if (!selectedId) return
    const nextSelection = page.blocks[selectedIndex + 1]?.id ?? page.blocks[selectedIndex - 1]?.id ?? null
    commit((current) => ({
      ...current,
      blocks: current.blocks.filter((block) => block.id !== selectedId),
    }))
    setSelectedId(nextSelection)
  }

  const duplicateSelected = () => {
    if (!selectedBlock) return
    const copy: SiteBlock = {
      ...selectedBlock,
      id: createCopyId(selectedBlock.type),
      items: selectedBlock.items.map((item) => ({ ...item })),
    }
    commit((current) => {
      const blocks = [...current.blocks]
      blocks.splice(selectedIndex + 1, 0, copy)
      return { ...current, blocks }
    })
    setSelectedId(copy.id)
  }

  const moveSelected = (direction: -1 | 1) => {
    const target = selectedIndex + direction
    if (selectedIndex < 0 || target < 0 || target >= page.blocks.length) return
    commit((current) => {
      const blocks = [...current.blocks]
      const moving = blocks[selectedIndex]
      if (!moving) return current
      blocks.splice(selectedIndex, 1)
      blocks.splice(target, 0, moving)
      return { ...current, blocks }
    })
  }

  const moveBlock = (id: string, direction: -1 | 1) => {
    commit((current) => {
      const index = current.blocks.findIndex((block) => block.id === id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= current.blocks.length) return current
      const blocks = [...current.blocks]
      const moving = blocks[index]
      if (!moving) return current
      blocks.splice(index, 1)
      blocks.splice(target, 0, moving)
      return { ...current, blocks }
    })
  }

  const updateSettings = (patch: Partial<PageModel['settings']>) => {
    commit((current) => ({
      ...current,
      settings: { ...current.settings, ...patch },
    }))
  }

  const applyTheme = (preset: (typeof themePresets)[number]) => {
    updateSettings({
      accent: preset.accent,
      surface: preset.surface,
      ink: preset.ink,
      pageBackground: preset.pageBackground,
    })
    showToast(`${preset.name} theme applied`)
  }

  const exportProject = () => {
    const blob = new Blob([JSON.stringify(page, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${page.settings.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'carecanvas'}-project.json`
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    showToast('Project exported')
  }

  const configureForTarget = (
    deploymentPackage: PortableDeploymentPackage,
    templates: Record<DeploymentEnvironment, EnvironmentConfiguration>,
    environment: DeploymentEnvironment,
  ) => {
    const configuration = structuredClone(templates[environment])
    configuration.values.PUBLIC_BASE_URL = new URL(
      `/e/${environment}/${deploymentPackage.metadata.packageId}`,
      window.location.origin,
    ).toString()
    return configuration
  }

  const prepareBuilderPackage = async () => {
    const result = await createPortablePackage(page, {
      packageVersion,
      description: `Immutable CareCanvas deployment package for ${page.settings.projectName}.`,
    })
    setPackageSource('builder')
    setPackageFileName(null)
    setPortablePackage(result.deploymentPackage)
    setEnvironmentTemplates(result.environmentTemplates)
    setEnvironmentConfiguration(configureForTarget(
      result.deploymentPackage,
      result.environmentTemplates,
      targetEnvironment,
    ))
    setPackageValidation(null)
    setDeploymentResult(null)
    setDeploymentHistory([])
    return result
  }

  const openDeploymentCenter = async () => {
    setDeploymentCenterOpen(true)
    setDeploymentBusy(true)
    try {
      await prepareBuilderPackage()
    } catch {
      showToast('Could not prepare deployment package')
    } finally {
      setDeploymentBusy(false)
    }
  }

  const exportDeploymentPackage = async () => {
    setDeploymentBusy(true)
    try {
      const result = await createDeploymentArchive(page, {
        packageVersion,
        description: `Immutable CareCanvas deployment package for ${page.settings.projectName}.`,
      })
      const url = URL.createObjectURL(result.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${result.deploymentPackage.metadata.packageId}-${packageVersion}.carecanvas.zip`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setPortablePackage(result.deploymentPackage)
      setEnvironmentTemplates(result.environmentTemplates)
      setEnvironmentConfiguration(configureForTarget(
        result.deploymentPackage,
        result.environmentTemplates,
        targetEnvironment,
      ))
      setPackageSource('builder')
      showToast('Portable deployment package exported')
    } catch {
      showToast('Could not export deployment package')
    } finally {
      setDeploymentBusy(false)
    }
  }

  const importDeploymentPackage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setDeploymentBusy(true)
    try {
      const archive = await readDeploymentArchive(file)
      setPackageSource('archive')
      setPackageFileName(file.name)
      setPackageVersion(archive.deploymentPackage.metadata.packageVersion)
      setPortablePackage(archive.deploymentPackage)
      setEnvironmentTemplates(archive.environmentTemplates)
      setEnvironmentConfiguration(configureForTarget(
        archive.deploymentPackage,
        archive.environmentTemplates,
        targetEnvironment,
      ))
      setPackageValidation(null)
      setDeploymentResult(null)
      setDeploymentHistory([])
      showToast('Package checksums verified')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not import package')
    } finally {
      setDeploymentBusy(false)
    }
  }

  const changeTargetEnvironment = (environment: DeploymentEnvironment) => {
    setTargetEnvironment(environment)
    if (portablePackage && environmentTemplates) {
      setEnvironmentConfiguration(configureForTarget(portablePackage, environmentTemplates, environment))
    }
    setPackageValidation(null)
    setDeploymentResult(null)
    setDeploymentHistory([])
  }

  const updateEnvironmentValue = (key: string, value: string | number | boolean) => {
    setEnvironmentConfiguration((current) => current
      ? { ...current, values: { ...current.values, [key]: value } }
      : current)
    setPackageValidation(null)
  }

  const updateSecretReference = (
    key: string,
    patch: Partial<EnvironmentConfiguration['secretReferences'][string]>,
  ) => {
    setEnvironmentConfiguration((current) => current
      ? {
          ...current,
          secretReferences: {
            ...current.secretReferences,
            [key]: { ...current.secretReferences[key], ...patch },
          },
        }
      : current)
    setPackageValidation(null)
  }

  const validatePackageForDeployment = async () => {
    if (!portablePackage || !environmentConfiguration) return null
    setDeploymentBusy(true)
    try {
      const localReport = validateDeploymentPackage(
        portablePackage,
        targetEnvironment,
        environmentConfiguration,
      )
      if (!localReport.valid) {
        setPackageValidation(localReport)
        return localReport
      }
      const response = await fetch('/api/packages/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(deploymentAccessToken ? { Authorization: `Bearer ${deploymentAccessToken}` } : {}),
        },
        body: JSON.stringify({
          deploymentPackage: portablePackage,
          environment: targetEnvironment,
          configuration: environmentConfiguration,
        }),
      })
      const report = await response.json() as PackageValidationReport
      setPackageValidation(report)
      return report
    } catch {
      showToast('Pre-deployment validation request failed')
      return null
    } finally {
      setDeploymentBusy(false)
    }
  }

  const refreshDeploymentHistory = async () => {
    if (!portablePackage) return
    try {
      const response = await fetch(
        `/api/environments/${targetEnvironment}/apps/${portablePackage.metadata.packageId}/deployments`,
        {
          headers: deploymentAccessToken ? { Authorization: `Bearer ${deploymentAccessToken}` } : {},
        },
      )
      if (!response.ok) throw new Error('History unavailable')
      const result = await response.json() as { deployments: DeploymentRecord[] }
      setDeploymentHistory(result.deployments)
    } catch {
      showToast('Could not load deployment history')
    }
  }

  const deployPortablePackage = async () => {
    if (!portablePackage || !environmentConfiguration) return
    const report = await validatePackageForDeployment()
    if (!report?.valid) return
    setDeploymentBusy(true)
    try {
      const response = await fetch('/api/deployments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(deploymentAccessToken ? { Authorization: `Bearer ${deploymentAccessToken}` } : {}),
        },
        body: JSON.stringify({
          deploymentPackage: portablePackage,
          environment: targetEnvironment,
          configuration: environmentConfiguration,
        }),
      })
      const result = await response.json() as DeploymentResult & { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Deployment failed')
      setDeploymentResult(result)
      showToast(`${targetEnvironment} deployment succeeded`)
      await refreshDeploymentHistory()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Deployment failed')
    } finally {
      setDeploymentBusy(false)
    }
  }

  const importPackageIntoBuilder = () => {
    if (!portablePackage || !environmentConfiguration) return
    const report = validateDeploymentPackage(portablePackage, targetEnvironment, environmentConfiguration)
    setPackageValidation(report)
    if (!report.valid) return
    const importedPage = normalizePage(resolvePackagePage(portablePackage, environmentConfiguration))
    commit(() => importedPage)
    setSelectedId(importedPage.blocks[0]?.id ?? null)
    showToast(`Imported package ${portablePackage.metadata.packageVersion}`)
  }

  const rollbackDeployment = async (deploymentId?: string) => {
    if (!portablePackage || !window.confirm(`Activate an earlier ${targetEnvironment} release?`)) return
    setDeploymentBusy(true)
    try {
      const response = await fetch(
        `/api/environments/${targetEnvironment}/apps/${portablePackage.metadata.packageId}/rollback`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(deploymentAccessToken ? { Authorization: `Bearer ${deploymentAccessToken}` } : {}),
          },
          body: JSON.stringify({ deploymentId }),
        },
      )
      const result = await response.json() as DeploymentResult & { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Rollback failed')
      setDeploymentResult(result)
      showToast('Rollback release activated')
      await refreshDeploymentHistory()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Rollback failed')
    } finally {
      setDeploymentBusy(false)
    }
  }

  const resetProject = () => {
    if (!window.confirm('Reset this project to the Northstar Health starter?')) return
    const starter = structuredClone(defaultPage)
    commit(() => starter)
    setSelectedId(starter.blocks[0]?.id ?? null)
    showToast('Starter restored')
  }

  const publish = async () => {
    setPublishing(true)
    try {
      const response = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(page),
      })
      if (!response.ok) throw new Error('Publish failed')
      const result = (await response.json()) as { url: string }
      setPublishedUrl(new URL(result.url, window.location.origin).toString())
    } catch {
      showToast('Could not publish. Try again.')
    } finally {
      setPublishing(false)
    }
  }

  const copyPublishedUrl = async () => {
    if (!publishedUrl) return
    await navigator.clipboard.writeText(publishedUrl)
    showToast('Link copied')
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(false)
    const type = event.dataTransfer.getData('application/carecanvas-block') as BlockType
    if (paletteGroups.some((group) => group.items.some((item) => item.type === type))) {
      addBlock(type)
    }
  }

  const openLibrary = (view: LibraryView) => {
    setLibraryView(view)
    setMobilePanel('elements')
  }

  const changeCanvasZoom = (amount: number) => {
    setCanvasZoom((current) => Math.min(125, Math.max(50, current + amount)))
  }

  const fitCanvas = () => {
    setCanvasZoom(viewport === 'desktop' ? 75 : viewport === 'tablet' ? 85 : 100)
  }

  if (previewMode) {
    return (
      <div className="preview-mode">
        <div className="preview-toolbar">
          <button className="button secondary-button" type="button" onClick={() => setPreviewMode(false)}>
            <ArrowLeft size={16} aria-hidden="true" /> Back to editor
          </button>
          <div><Monitor size={15} aria-hidden="true" /> Live preview</div>
          <button className="button primary-button" type="button" onClick={publish} disabled={publishing}>
            <Rocket size={16} aria-hidden="true" /> {publishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>
        <PageRenderer page={page} publicMode />
      </div>
    )
  }

  return (
    <div className="designer-shell">
      <header className="app-header">
        <div className="brand-block">
          <button
            className="icon-button mobile-only"
            type="button"
            title="Open elements"
            aria-label="Open elements"
            onClick={() => setMobilePanel(mobilePanel === 'elements' ? null : 'elements')}
          >
            <PanelLeft size={18} />
          </button>
          <a className="app-brand" href="/" aria-label="CareCanvas home">
            <span><MousePointer2 size={16} /></span>
            CareCanvas
          </a>
          <span className="header-divider" />
          <button className="project-switcher" type="button">
            <span>{page.settings.projectName}</span>
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        </div>

        <div className="history-controls">
          <button className="icon-button" type="button" onClick={undo} disabled={!past.length} title="Undo" aria-label="Undo">
            <Undo2 size={17} />
          </button>
          <button className="icon-button" type="button" onClick={redo} disabled={!future.length} title="Redo" aria-label="Redo">
            <Redo2 size={17} />
          </button>
          <span className={`save-state ${saveState.toLowerCase()}`}><Check size={13} /> {saveState}</span>
        </div>

        <div className="header-actions">
          <button className="icon-button hide-mobile" type="button" onClick={exportProject} title="Export project" aria-label="Export project">
            <Download size={17} />
          </button>
          <button className="icon-button hide-mobile" type="button" onClick={resetProject} title="Reset starter" aria-label="Reset starter">
            <RotateCcw size={17} />
          </button>
          <button className="button secondary-button hide-mobile" type="button" onClick={() => setPreviewMode(true)}>
            <Laptop size={16} aria-hidden="true" /> Preview
          </button>
          <button className="button secondary-button deployment-center-trigger" type="button" onClick={openDeploymentCenter}>
            <PackageOpen size={16} aria-hidden="true" /> <span>Package</span>
          </button>
          <button className="button primary-button" type="button" onClick={publish} disabled={publishing}>
            <Rocket size={16} aria-hidden="true" /> {publishing ? 'Publishing...' : 'Publish'}
          </button>
          <button
            className="icon-button mobile-only"
            type="button"
            title="Open settings"
            aria-label="Open settings"
            onClick={() => setMobilePanel(mobilePanel === 'settings' ? null : 'settings')}
          >
            <Settings2 size={18} />
          </button>
        </div>
      </header>

      <div className="editor-layout">
        <aside className={`left-panel${mobilePanel === 'elements' ? ' mobile-open' : ''}`}>
          <div className="panel-header">
            <div>
              <span className="panel-kicker">Healthcare UI</span>
              <h2>{libraryView === 'blocks' ? 'Care blocks' : 'Page layers'}</h2>
            </div>
            <button className="icon-button mobile-only" type="button" onClick={() => setMobilePanel(null)} aria-label="Close elements">
              <X size={17} />
            </button>
          </div>
          <div className="library-tabs" role="tablist" aria-label="Builder panel">
            <button className={libraryView === 'blocks' ? 'active' : ''} type="button" role="tab" aria-selected={libraryView === 'blocks'} onClick={() => setLibraryView('blocks')}><Blocks size={14} /> Blocks</button>
            <button className={libraryView === 'layers' ? 'active' : ''} type="button" role="tab" aria-selected={libraryView === 'layers'} onClick={() => setLibraryView('layers')}><Layers3 size={14} /> Layers</button>
          </div>
          <div className="panel-scroll element-library">
            {libraryView === 'blocks' ? (
              <>
                <label className="block-search">
                  <Search size={14} aria-hidden="true" />
                  <input value={blockQuery} onChange={(event) => setBlockQuery(event.target.value)} placeholder="Search blocks" aria-label="Search blocks" />
                </label>
                <div className="insert-hint"><Plus size={14} /> Click or drag a care block</div>
                {filteredPaletteGroups.map((group) => (
                  <section className="palette-group" key={group.title}>
                    <h3>{group.title}</h3>
                    <div className="palette-grid">
                      {group.items.map((item) => {
                        const Icon = item.icon
                        return (
                          <button
                            className="palette-item"
                            draggable
                            key={item.type}
                            type="button"
                            onClick={() => addBlock(item.type)}
                            onDragStart={(event) => {
                              event.dataTransfer.setData('application/carecanvas-block', item.type)
                              event.dataTransfer.effectAllowed = 'copy'
                            }}
                          >
                            <span><Icon size={18} strokeWidth={1.7} /></span>
                            <strong>{item.label}</strong>
                            <small>{item.description}</small>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                ))}
                {!filteredPaletteGroups.length && <div className="library-empty"><Search size={18} /><p>No blocks match that search.</p></div>}
              </>
            ) : (
              <div className="layer-list">
                {page.blocks.map((block, index) => (
                  <div className={`layer-item${block.id === selectedId ? ' active' : ''}`} key={block.id}>
                    <button className="layer-main" type="button" onClick={() => { setSelectedId(block.id); setMobilePanel('settings') }}>
                      <GripVertical size={14} aria-hidden="true" />
                      <span><strong>{blockLabel(block.type)}</strong><small>{block.title || block.label || 'Untitled block'}</small></span>
                    </button>
                    <div className="layer-actions">
                      <button type="button" onClick={() => moveBlock(block.id, -1)} disabled={index === 0} title="Move layer up" aria-label={`Move ${blockLabel(block.type)} up`}><ArrowUp size={13} /></button>
                      <button type="button" onClick={() => moveBlock(block.id, 1)} disabled={index === page.blocks.length - 1} title="Move layer down" aria-label={`Move ${blockLabel(block.type)} down`}><ArrowDown size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="panel-footer">
            <CircleHelp size={15} />
            <span>{libraryView === 'blocks' ? 'Patient-friendly sections, ready to tailor' : `${page.blocks.length} layers in this page`}</span>
          </div>
        </aside>

        <main className="canvas-area">
          <div className="canvas-toolbar" role="toolbar" aria-label="Canvas toolbar">
            <div className="canvas-tools-start">
              <button className="toolbar-command" type="button" onClick={() => openLibrary('blocks')} title="Add a block">
                <Plus size={15} aria-hidden="true" /><span>Add</span>
              </button>
              <button className="toolbar-command" type="button" onClick={() => openLibrary('layers')} title="Open page layers">
                <Layers3 size={15} aria-hidden="true" /><span>Layers</span>
              </button>
              <span className="toolbar-divider" />
              <div className="page-context" title={selectedBlock?.title || 'No block selected'}>
                <LayoutTemplate size={15} aria-hidden="true" />
                <span><strong>Home page</strong><small>{selectedBlock ? blockLabel(selectedBlock.type) : 'No selection'}</small></span>
              </div>
            </div>
            <div className="canvas-tools-center">
              <button className="toolbar-icon active" type="button" aria-label="Selection tool" aria-pressed="true" title="Selection tool">
                <MousePointer2 size={15} />
              </button>
              <span className="toolbar-divider" />
              <div className="viewport-switcher" aria-label="Preview size">
                <button className={viewport === 'desktop' ? 'active' : ''} type="button" onClick={() => setViewport('desktop')} title="Desktop" aria-label="Desktop preview"><Monitor size={16} /></button>
                <button className={viewport === 'tablet' ? 'active' : ''} type="button" onClick={() => setViewport('tablet')} title="Tablet" aria-label="Tablet preview"><Tablet size={16} /></button>
                <button className={viewport === 'mobile' ? 'active' : ''} type="button" onClick={() => setViewport('mobile')} title="Mobile" aria-label="Mobile preview"><Smartphone size={16} /></button>
              </div>
            </div>
            <div className="canvas-tools-end">
              <span className={`canvas-live ${saveState.toLowerCase()}`}><i />{saveState === 'Saved' ? 'Live' : 'Saving'}</span>
              <span className="toolbar-divider" />
              <div className="zoom-control" aria-label="Canvas zoom">
                <button type="button" onClick={() => changeCanvasZoom(-10)} disabled={canvasZoom <= 50} title="Zoom out" aria-label="Zoom out"><Minus size={14} /></button>
                <button className="zoom-value" type="button" onClick={() => setCanvasZoom(100)} title="Reset zoom to 100%">{canvasZoom}%</button>
                <button type="button" onClick={() => changeCanvasZoom(10)} disabled={canvasZoom >= 125} title="Zoom in" aria-label="Zoom in"><Plus size={14} /></button>
              </div>
              <button className="toolbar-icon" type="button" onClick={fitCanvas} title="Fit canvas" aria-label="Fit canvas"><Maximize2 size={15} /></button>
              <span className="toolbar-divider toolbar-preview-divider" />
              <button className="toolbar-command toolbar-preview" type="button" onClick={() => setPreviewMode(true)} title="Preview website">
                <Eye size={15} aria-hidden="true" /><span>Preview</span>
              </button>
            </div>
          </div>
          <div
            className={`canvas-stage${dragActive ? ' drag-active' : ''}`}
            onClick={() => setMobilePanel(null)}
            onDragEnter={(event) => { event.preventDefault(); setDragActive(true) }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragActive(false)
            }}
            onDrop={handleDrop}
          >
            <div
              className={`canvas-frame viewport-${viewport}`}
              style={{ zoom: `${canvasZoom}%` } as CSSProperties}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="browser-chrome">
                <div><span /><span /><span /></div>
                <p><span>carecanvas.health/</span>{page.settings.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}</p>
                <ExternalLink size={13} aria-hidden="true" />
              </div>
              <PageRenderer page={page} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setMobilePanel('settings') }} />
            </div>
            {dragActive && <div className="drop-indicator"><Plus size={20} /> Drop to add element</div>}
          </div>
        </main>

        <aside className={`right-panel${mobilePanel === 'settings' ? ' mobile-open' : ''}`}>
          <div className="panel-header inspector-header">
            <div>
              <span className="panel-kicker">Configure</span>
              <h2>{selectedBlock ? selectedBlock.type.charAt(0).toUpperCase() + selectedBlock.type.slice(1) : 'Page styles'}</h2>
            </div>
            <button className="icon-button mobile-only" type="button" onClick={() => setMobilePanel(null)} aria-label="Close settings"><X size={17} /></button>
          </div>

          <div className="panel-scroll inspector-scroll">
            {selectedBlock ? (
              <>
                <div className="block-actions" aria-label="Element actions">
                  <button type="button" onClick={() => moveSelected(-1)} disabled={selectedIndex <= 0} title="Move up" aria-label="Move up"><ArrowUp size={16} /></button>
                  <button type="button" onClick={() => moveSelected(1)} disabled={selectedIndex >= page.blocks.length - 1} title="Move down" aria-label="Move down"><ArrowDown size={16} /></button>
                  <span />
                  <button type="button" onClick={duplicateSelected} title="Duplicate" aria-label="Duplicate"><Copy size={16} /></button>
                  <button className="danger-action" type="button" onClick={removeSelected} title="Delete" aria-label="Delete"><Trash2 size={16} /></button>
                </div>

                <section className="control-section">
                  <h3>Content</h3>
                  {selectedBlock.type !== 'spacer' && selectedBlock.type !== 'button' && (
                    <label className="field-label">
                      <span>Eyebrow</span>
                      <input value={selectedBlock.label} onChange={(event) => updateSelected({ label: event.target.value })} placeholder="Optional label" />
                    </label>
                  )}
                  {!['button', 'image', 'spacer', 'stats'].includes(selectedBlock.type) && (
                    <label className="field-label">
                      <span>Heading</span>
                      <textarea rows={3} value={selectedBlock.title} onChange={(event) => updateSelected({ title: event.target.value })} />
                    </label>
                  )}
                  {['hero', 'text', 'features', 'team', 'insurance', 'hours', 'faq', 'appointment', 'contact'].includes(selectedBlock.type) && (
                    <label className="field-label">
                      <span>Body</span>
                      <textarea rows={4} value={selectedBlock.text} onChange={(event) => updateSelected({ text: event.target.value })} />
                    </label>
                  )}
                  {['hero', 'button', 'appointment', 'contact'].includes(selectedBlock.type) && (
                    <div className="field-row">
                      <label className="field-label">
                        <span>Button label</span>
                        <input value={selectedBlock.buttonLabel} onChange={(event) => updateSelected({ buttonLabel: event.target.value })} />
                      </label>
                      <label className="field-label compact-field">
                        <span>Link</span>
                        <input value={selectedBlock.buttonUrl} onChange={(event) => updateSelected({ buttonUrl: event.target.value })} />
                      </label>
                    </div>
                  )}
                  {['hero', 'image'].includes(selectedBlock.type) && (
                    <label className="field-label">
                      <span>Image URL</span>
                      <input value={selectedBlock.image} onChange={(event) => updateSelected({ image: event.target.value })} />
                    </label>
                  )}
                </section>

                {(selectedBlock.items.length > 0 || ['features', 'team', 'insurance', 'hours', 'faq', 'stats'].includes(selectedBlock.type)) && (
                  <section className="control-section repeater-section">
                    <div className="section-title-row">
                      <h3>Items</h3>
                      <span>{selectedBlock.items.length}/6</span>
                    </div>
                    <div className="repeater-list">
                      {selectedBlock.items.map((item, index) => (
                        <article className="repeater-item" key={`${selectedBlock.id}-item-${index}`}>
                          <div className="repeater-header">
                            <strong>Item {String(index + 1).padStart(2, '0')}</strong>
                            <button type="button" onClick={() => removeBlockItem(index)} title="Remove item" aria-label={`Remove item ${index + 1}`}><Trash2 size={13} /></button>
                          </div>
                          <label className="field-label">
                            <span>{selectedBlock.type === 'faq' ? 'Question' : selectedBlock.type === 'team' ? 'Name' : 'Title'}</span>
                            <input value={item.title} onChange={(event) => updateBlockItem(index, { title: event.target.value })} />
                          </label>
                          <label className="field-label">
                            <span>{selectedBlock.type === 'faq' ? 'Answer' : selectedBlock.type === 'team' ? 'Specialty' : 'Details'}</span>
                            <textarea rows={2} value={item.text} onChange={(event) => updateBlockItem(index, { text: event.target.value })} />
                          </label>
                          {selectedBlock.type === 'team' && (
                            <>
                              <label className="field-label"><span>Credentials</span><input value={item.meta ?? ''} onChange={(event) => updateBlockItem(index, { meta: event.target.value })} /></label>
                              <label className="field-label"><span>Photo URL</span><input value={item.image ?? ''} onChange={(event) => updateBlockItem(index, { image: event.target.value })} /></label>
                            </>
                          )}
                        </article>
                      ))}
                    </div>
                    <button className="add-item-button" type="button" onClick={addBlockItem} disabled={selectedBlock.items.length >= 6}><Plus size={14} /> Add item</button>
                  </section>
                )}

                {selectedBlock.type !== 'spacer' && (
                  <section className="control-section">
                    <h3>Layout</h3>
                    <div className="control-row">
                      <span>Alignment</span>
                      <div className="segmented-control">
                        <button className={selectedBlock.alignment === 'left' ? 'active' : ''} type="button" onClick={() => updateSelected({ alignment: 'left' })} title="Align left" aria-label="Align left"><AlignLeft size={16} /></button>
                        <button className={selectedBlock.alignment === 'center' ? 'active' : ''} type="button" onClick={() => updateSelected({ alignment: 'center' })} title="Align center" aria-label="Align center"><AlignCenter size={16} /></button>
                      </div>
                    </div>
                    <div className="control-row stack-row">
                      <span>Background</span>
                      <div className="color-options">
                        {(['white', 'soft', 'ink', 'accent'] as BlockBackground[]).map((background) => (
                          <button
                            className={`color-option color-${background}${selectedBlock.background === background ? ' active' : ''}`}
                            key={background}
                            type="button"
                            style={{
                              backgroundColor: background === 'white'
                                ? page.settings.pageBackground
                                : background === 'soft'
                                  ? page.settings.surface
                                  : background === 'ink'
                                    ? page.settings.ink
                                    : page.settings.accent,
                            }}
                            title={background}
                            aria-label={`${background} background`}
                            onClick={() => updateSelected({ background })}
                          >
                            {selectedBlock.background === background && <Check size={12} />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </section>
                )}
              </>
            ) : (
              <div className="empty-inspector"><MousePointer2 size={22} /><h3>Select an element</h3><p>Choose anything on the canvas to edit it here.</p></div>
            )}

            <section className="control-section site-settings">
              <div className="section-title-row"><h3>Site theme</h3><Palette size={15} /></div>
              <div className="theme-presets" aria-label="Color themes">
                {themePresets.map((preset) => (
                  <button key={preset.name} type="button" onClick={() => applyTheme(preset)} title={`Apply ${preset.name}`}>
                    <span><i style={{ background: preset.accent }} /><i style={{ background: preset.surface }} /><i style={{ background: preset.ink }} /></span>
                    <strong>{preset.name}</strong>
                  </button>
                ))}
              </div>
              <label className="field-label">
                <span>Site name</span>
                <input value={page.settings.projectName} onChange={(event) => updateSettings({ projectName: event.target.value })} />
              </label>
              <label className="field-label">
                <span>Browser title</span>
                <input value={page.settings.pageTitle} onChange={(event) => updateSettings({ pageTitle: event.target.value })} />
              </label>
              <div className="field-row even-field-row">
                <label className="field-label">
                  <span>Heading font</span>
                  <select value={page.settings.headingFont} onChange={(event) => updateSettings({ headingFont: event.target.value as PageModel['settings']['headingFont'] })}>
                    <option>Instrument Serif</option>
                    <option>Manrope</option>
                    <option>Space Grotesk</option>
                  </select>
                </label>
                <label className="field-label">
                  <span>Body font</span>
                  <select value={page.settings.bodyFont} onChange={(event) => updateSettings({ bodyFont: event.target.value as PageModel['settings']['bodyFont'] })}>
                    <option>Manrope</option>
                    <option>Space Grotesk</option>
                  </select>
                </label>
              </div>
              <div className="color-field-grid">
                <label className="field-label">
                  <span>Accent</span>
                  <span className="color-input"><input type="color" value={page.settings.accent} onChange={(event) => updateSettings({ accent: event.target.value })} /><code>{page.settings.accent}</code></span>
                </label>
                <label className="field-label">
                  <span>Surface</span>
                  <span className="color-input"><input type="color" value={page.settings.surface} onChange={(event) => updateSettings({ surface: event.target.value })} /><code>{page.settings.surface}</code></span>
                </label>
                <label className="field-label">
                  <span>Text</span>
                  <span className="color-input"><input type="color" value={page.settings.ink} onChange={(event) => updateSettings({ ink: event.target.value })} /><code>{page.settings.ink}</code></span>
                </label>
                <label className="field-label">
                  <span>Page</span>
                  <span className="color-input"><input type="color" value={page.settings.pageBackground} onChange={(event) => updateSettings({ pageBackground: event.target.value })} /><code>{page.settings.pageBackground}</code></span>
                </label>
              </div>
              <div className="contrast-row"><span>Accent contrast</span><strong className={accentContrast >= 4.5 ? 'passes' : 'review'}>{accentContrast.toFixed(1)}:1 {accentContrast >= 4.5 ? 'AA' : 'Review'}</strong></div>
              <label className="field-label range-field">
                <span><span>Corner radius</span><b>{page.settings.radius}px</b></span>
                <input type="range" min="0" max="24" value={page.settings.radius} onChange={(event) => updateSettings({ radius: Number(event.target.value) })} />
              </label>
              <label className="field-label range-field">
                <span><span>Section spacing</span><b>{page.settings.sectionSpacing}px</b></span>
                <input type="range" min="40" max="120" step="4" value={page.settings.sectionSpacing} onChange={(event) => updateSettings({ sectionSpacing: Number(event.target.value) })} />
              </label>
              <label className="field-label range-field">
                <span><span>Content width</span><b>{page.settings.contentWidth}px</b></span>
                <input type="range" min="880" max="1280" step="40" value={page.settings.contentWidth} onChange={(event) => updateSettings({ contentWidth: Number(event.target.value) })} />
              </label>
            </section>
          </div>
        </aside>
      </div>

      {publishedUrl && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setPublishedUrl(null)}>
          <section className="publish-dialog" role="dialog" aria-modal="true" aria-labelledby="publish-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="icon-button close-dialog" type="button" onClick={() => setPublishedUrl(null)} aria-label="Close"><X size={18} /></button>
            <span className="publish-icon"><Rocket size={22} /></span>
            <p className="panel-kicker">Published</p>
            <h2 id="publish-title">Your site is live.</h2>
            <p>CareCanvas saved this version and gave it a permanent link from this container.</p>
            <div className="published-link">
              <span>{publishedUrl}</span>
              <button type="button" onClick={copyPublishedUrl} title="Copy link" aria-label="Copy published link"><Copy size={16} /></button>
            </div>
            <a className="button primary-button dialog-primary" href={publishedUrl} target="_blank" rel="noreferrer">
              Open live site <ExternalLink size={16} />
            </a>
          </section>
        </div>
      )}

      {deploymentCenterOpen && (
        <div className="modal-backdrop deployment-backdrop" role="presentation" onMouseDown={() => setDeploymentCenterOpen(false)}>
          <section className="deployment-dialog" role="dialog" aria-modal="true" aria-labelledby="deployment-title" onMouseDown={(event) => event.stopPropagation()}>
            <header className="deployment-dialog-header">
              <div>
                <span className="deployment-dialog-icon"><FileArchive size={20} /></span>
                <span><p className="panel-kicker">Enterprise portability</p><h2 id="deployment-title">Deployment center</h2></span>
              </div>
              <button className="icon-button" type="button" onClick={() => setDeploymentCenterOpen(false)} aria-label="Close deployment center"><X size={18} /></button>
            </header>

            <div className="deployment-dialog-body">
              <section className="deployment-section deployment-package-section">
                <div className="deployment-section-title">
                  <span>01</span>
                  <div><h3>Portable package</h3><p>Immutable application artifacts and dependency manifest</p></div>
                </div>
                <input ref={packageFileInput} className="visually-hidden" type="file" accept=".zip,.carecanvas.zip,application/zip" onChange={importDeploymentPackage} />
                <div className="package-source-actions">
                  <button className="button secondary-button" type="button" onClick={() => packageFileInput.current?.click()} disabled={deploymentBusy}>
                    <FileUp size={15} /> Import ZIP
                  </button>
                  <button className="button secondary-button" type="button" onClick={exportDeploymentPackage} disabled={deploymentBusy || packageSource === 'archive'}>
                    <Download size={15} /> Export ZIP
                  </button>
                </div>
                <label className="deployment-field">
                  <span>Package version</span>
                  <input value={packageVersion} onChange={(event) => setPackageVersion(event.target.value)} disabled={packageSource === 'archive'} pattern="\d+\.\d+\.\d+" />
                </label>
                {portablePackage && (
                  <div className="package-manifest-card">
                    <div><strong>{portablePackage.metadata.applicationName}</strong><span className={`source-badge source-${packageSource}`}>{packageSource === 'archive' ? 'Verified archive' : 'Current builder'}</span></div>
                    <dl>
                      <div><dt>Package</dt><dd>{portablePackage.metadata.packageId}</dd></div>
                      <div><dt>Version</dt><dd>{portablePackage.metadata.packageVersion}</dd></div>
                      <div><dt>Schema</dt><dd>{portablePackage.metadata.schemaVersion}</dd></div>
                      <div><dt>Created</dt><dd>{new Date(portablePackage.metadata.createdAt).toLocaleString()}</dd></div>
                    </dl>
                    <code title={portablePackage.metadata.contentDigest}>{portablePackage.metadata.contentDigest.slice(0, 28)}...</code>
                    <p>{portablePackage.artifacts.pages.length} page, {portablePackage.artifacts.forms.length} forms, {portablePackage.artifacts.workflows.length} workflows, {portablePackage.dependencies.length} dependencies</p>
                    {packageFileName && <small>Source: {packageFileName}</small>}
                  </div>
                )}
              </section>

              <section className="deployment-section deployment-config-section">
                <div className="deployment-section-title">
                  <span>02</span>
                  <div><h3>Target configuration</h3><p>Environment values remain outside the core package</p></div>
                </div>
                <label className="deployment-field">
                  <span>Environment</span>
                  <select value={targetEnvironment} onChange={(event) => changeTargetEnvironment(event.target.value as DeploymentEnvironment)}>
                    {deploymentEnvironments.map((environment) => <option key={environment} value={environment}>{environment.charAt(0).toUpperCase() + environment.slice(1)}</option>)}
                  </select>
                </label>
                <div className="environment-badge-row">
                  {deploymentEnvironments.map((environment) => <i key={environment} className={environment === targetEnvironment ? 'active' : ''} title={environment} />)}
                  <span>Promoting the same digest to {targetEnvironment}</span>
                </div>
                <label className="deployment-field deployment-token-field">
                  <span>Deployment API token <b>Never packaged</b></span>
                  <input type="password" value={deploymentAccessToken} onChange={(event) => setDeploymentAccessToken(event.target.value)} autoComplete="off" placeholder="Optional bearer token for protected deployment APIs" />
                  <small>Kept only in this in-memory browser session and sent as an Authorization header.</small>
                </label>
                {portablePackage && environmentConfiguration && (
                  <div className="configuration-fields">
                    {portablePackage.artifacts.configuration.parameters.map((parameter) => (
                      <label className="deployment-field" key={parameter.key}>
                        <span>{parameter.key}{parameter.required && <b>Required</b>}</span>
                        <input
                          type={parameter.type === 'number' ? 'number' : 'text'}
                          value={String(environmentConfiguration.values[parameter.key] ?? '')}
                          placeholder={String(parameter.example ?? '')}
                          onChange={(event) => updateEnvironmentValue(parameter.key, parameter.type === 'number' ? Number(event.target.value) : event.target.value)}
                        />
                        <small>{parameter.description}</small>
                      </label>
                    ))}
                    {portablePackage.artifacts.configuration.secrets.map((secret) => {
                      const reference = environmentConfiguration.secretReferences[secret.key]
                      return (
                        <div className="secret-reference" key={secret.key}>
                          <div><ShieldCheck size={15} /><span><strong>{secret.key}</strong><small>Reference only. Secret values are never packaged.</small></span></div>
                          <div>
                            <select value={reference?.provider ?? 'environment'} onChange={(event) => updateSecretReference(secret.key, { provider: event.target.value as EnvironmentConfiguration['secretReferences'][string]['provider'] })} aria-label={`${secret.key} provider`}>
                              {secret.allowedProviders.map((provider) => <option key={provider}>{provider}</option>)}
                            </select>
                            <input value={reference?.reference ?? ''} onChange={(event) => updateSecretReference(secret.key, { reference: event.target.value })} placeholder="Secret name or vault path" aria-label={`${secret.key} reference`} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              <section className="deployment-section deployment-validation-section">
                <div className="deployment-section-title">
                  <span>03</span>
                  <div><h3>Pre-deployment validation</h3><p>Schema, dependencies, relationships, parameters, and secrets</p></div>
                </div>
                <button className="button secondary-button validation-button" type="button" onClick={validatePackageForDeployment} disabled={deploymentBusy || !portablePackage}>
                  <PackageCheck size={15} /> {deploymentBusy ? 'Checking...' : 'Run validation'}
                </button>
                {!packageValidation && <div className="validation-empty"><PackageCheck size={22} /><p>Run validation before deploying to {targetEnvironment}.</p></div>}
                {packageValidation && (
                  <>
                    <div className={`validation-summary ${packageValidation.valid ? 'valid' : 'invalid'}`}>
                      {packageValidation.valid ? <CircleCheck size={18} /> : <ShieldAlert size={18} />}
                      <span><strong>{packageValidation.valid ? 'Ready to deploy' : 'Deployment blocked'}</strong><small>{packageValidation.summary.errors} errors, {packageValidation.summary.warnings} warnings, {packageValidation.summary.information} information</small></span>
                    </div>
                    <div className="validation-findings">
                      {packageValidation.findings.length === 0 && <p className="finding-empty">No dependency or configuration issues found.</p>}
                      {packageValidation.findings.map((finding, index) => (
                        <article className={`finding finding-${finding.severity}`} key={`${finding.code}-${index}`}>
                          <span>{finding.code}</span><div><strong>{finding.message}</strong>{finding.path && <small>{finding.path}</small>}</div>
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </section>

              <section className="deployment-section deployment-release-section">
                <div className="deployment-section-title">
                  <span>04</span>
                  <div><h3>Deploy and restore</h3><p>Auditable promotion and rollback using the same package digest</p></div>
                </div>
                <div className="release-actions">
                  {packageSource === 'archive' && (
                    <button className="button secondary-button" type="button" onClick={importPackageIntoBuilder} disabled={deploymentBusy || !packageValidation?.valid}>
                      <FileUp size={15} /> Import into builder
                    </button>
                  )}
                  <button className="button primary-button" type="button" onClick={deployPortablePackage} disabled={deploymentBusy || !portablePackage}>
                    <CloudUpload size={15} /> {deploymentBusy ? 'Working...' : `Deploy to ${targetEnvironment}`}
                  </button>
                </div>
                {deploymentResult && (
                  <div className="deployment-result">
                    <div className="deployment-success"><CircleCheck size={20} /><span><strong>{deploymentResult.deployment.action === 'rollback' ? 'Rollback activated' : 'Deployment succeeded'}</strong><small>{deploymentResult.deployment.deploymentId}</small></span></div>
                    <a href={new URL(deploymentResult.url, window.location.origin).toString()} target="_blank" rel="noreferrer">Open {targetEnvironment} release <ExternalLink size={14} /></a>
                    <div className="deployment-logs">
                      {deploymentResult.deployment.logs.map((entry, index) => (
                        <div key={`${entry.code}-${index}`}><time>{new Date(entry.timestamp).toLocaleTimeString()}</time><code>{entry.code}</code><span>{entry.message}</span></div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="history-heading"><span><History size={14} /> Deployment history</span><button type="button" onClick={refreshDeploymentHistory} disabled={!portablePackage}>Refresh</button></div>
                <div className="deployment-history">
                  {deploymentHistory.length === 0 && <p>No deployment history loaded for this environment.</p>}
                  {deploymentHistory.slice(0, 6).map((record, index) => (
                    <article key={record.deploymentId}>
                      <div><span className={`history-status status-${record.action}`} /><span><strong>v{record.packageVersion} · {record.action}</strong><small>{new Date(record.completedAt).toLocaleString()} · {record.deploymentId}</small></span></div>
                      <button type="button" onClick={() => rollbackDeployment(record.deploymentId)} disabled={index === 0 || deploymentBusy}>Restore</button>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status"><Check size={15} /> {toast}</div>}
    </div>
  )
}

function App() {
  const environmentMatch = window.location.pathname.match(/^\/e\/(development|test|uat|staging|production)\/([^/]+)\/?$/)
  const publishedMatch = window.location.pathname.match(/^\/p\/([^/]+)\/?$/)
  if (environmentMatch) {
    return <EnvironmentSite environment={environmentMatch[1] as DeploymentEnvironment} packageId={decodeURIComponent(environmentMatch[2])} />
  }
  return publishedMatch ? <PublishedSite slug={decodeURIComponent(publishedMatch[1])} /> : <Designer />
}

export default App