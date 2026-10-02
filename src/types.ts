export type BlockType =
  | 'hero'
  | 'heading'
  | 'text'
  | 'button'
  | 'image'
  | 'features'
  | 'team'
  | 'insurance'
  | 'hours'
  | 'faq'
  | 'appointment'
  | 'stats'
  | 'testimonial'
  | 'contact'
  | 'spacer'

export type BlockAlignment = 'left' | 'center'
export type BlockBackground = 'white' | 'soft' | 'ink' | 'accent'

export interface BlockItem {
  title: string
  text: string
  image?: string
  meta?: string
}

export interface SiteBlock {
  id: string
  type: BlockType
  label: string
  title: string
  text: string
  buttonLabel: string
  buttonUrl: string
  image: string
  alignment: BlockAlignment
  background: BlockBackground
  items: BlockItem[]
}

export interface SiteSettings {
  projectName: string
  pageTitle: string
  accent: string
  surface: string
  ink: string
  pageBackground: string
  headingFont: 'Instrument Serif' | 'Manrope' | 'Space Grotesk'
  bodyFont: 'Manrope' | 'Space Grotesk'
  radius: number
  sectionSpacing: number
  contentWidth: number
}

export interface PageModel {
  settings: SiteSettings
  blocks: SiteBlock[]
}