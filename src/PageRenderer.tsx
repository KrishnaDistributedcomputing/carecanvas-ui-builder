import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react'
import { ArrowRight, CalendarDays, Check, Clock3, ShieldCheck, Stethoscope } from 'lucide-react'
import type { PageModel, SiteBlock } from './types'

interface PageRendererProps {
  page: PageModel
  selectedId?: string | null
  onSelect?: (id: string) => void
  publicMode?: boolean
}

type SiteStyle = CSSProperties & {
  '--site-accent': string
  '--site-surface': string
  '--site-ink': string
  '--site-page': string
  '--site-on-accent': string
  '--site-radius': string
  '--site-heading': string
  '--site-body': string
  '--site-space': string
  '--site-max': string
}

const headingStacks = {
  'Instrument Serif': '"Instrument Serif", Georgia, serif',
  Manrope: '"Manrope", sans-serif',
  'Space Grotesk': '"Space Grotesk", sans-serif',
}

const bodyStacks = {
  Manrope: '"Manrope", sans-serif',
  'Space Grotesk': '"Space Grotesk", sans-serif',
}

function readableText(hex: string) {
  const normalized = hex.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return '#ffffff'
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  return (red * 299 + green * 587 + blue * 114) / 1000 > 150 ? '#172321' : '#ffffff'
}

function stopEditorLink(event: MouseEvent<HTMLAnchorElement>, isEditor: boolean) {
  if (isEditor) event.preventDefault()
}

function BlockContent({ block, isEditor }: { block: SiteBlock; isEditor: boolean }) {
  const alignmentClass = `align-${block.alignment}`

  switch (block.type) {
    case 'hero':
      return (
        <div className={`site-container hero-layout ${alignmentClass}`}>
          <div className="hero-copy">
            {block.label && <p className="site-eyebrow">{block.label}</p>}
            <h1>{block.title}</h1>
            <p className="site-lede">{block.text}</p>
            {block.buttonLabel && (
              <a
                className="site-button site-button--primary"
                href={block.buttonUrl || '#'}
                onClick={(event) => stopEditorLink(event, isEditor)}
              >
                {block.buttonLabel}
                <ArrowRight size={17} aria-hidden="true" />
              </a>
            )}
          </div>
          {block.image && (
            <figure className="hero-image-wrap">
              <img src={block.image} alt="A clinician providing attentive patient care" />
              <figcaption>
                <span><Check size={14} aria-hidden="true" /> Next available visit</span>
                <strong>Today, 3:30 PM</strong>
              </figcaption>
            </figure>
          )}
        </div>
      )
    case 'heading':
      return (
        <div className={`site-container narrow-copy ${alignmentClass}`}>
          {block.label && <p className="site-eyebrow">{block.label}</p>}
          <h2>{block.title}</h2>
        </div>
      )
    case 'text':
      return (
        <div className={`site-container narrow-copy ${alignmentClass}`}>
          {block.title && <h3>{block.title}</h3>}
          <p className="site-body-copy">{block.text}</p>
        </div>
      )
    case 'button':
      return (
        <div className={`site-container button-block ${alignmentClass}`}>
          <a
            className="site-button site-button--primary"
            href={block.buttonUrl || '#'}
            onClick={(event) => stopEditorLink(event, isEditor)}
          >
            {block.buttonLabel || 'Get started'}
            <ArrowRight size={17} aria-hidden="true" />
          </a>
        </div>
      )
    case 'image':
      return (
        <figure className="site-container image-block">
          <img src={block.image} alt={block.label || 'Website visual'} />
          {block.label && <figcaption>{block.label}</figcaption>}
        </figure>
      )
    case 'features':
      return (
        <div className="site-container">
          <div className={`section-intro ${alignmentClass}`}>
            {block.label && <p className="site-eyebrow">{block.label}</p>}
            <h2>{block.title}</h2>
            <p>{block.text}</p>
          </div>
          <div className="feature-grid">
            {block.items.map((item, index) => (
              <article className="feature-item" key={`${item.title}-${index}`}>
                <span className="feature-number">0{index + 1}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      )
    case 'team':
      return (
        <div className="site-container">
          <div className={`section-intro ${alignmentClass}`}>
            {block.label && <p className="site-eyebrow">{block.label}</p>}
            <h2>{block.title}</h2>
            <p>{block.text}</p>
          </div>
          <div className="clinician-grid">
            {block.items.map((item, index) => (
              <article className="clinician-card" key={`${item.title}-${index}`}>
                {item.image && <img src={item.image} alt={`${item.title}, ${item.text}`} />}
                <div>
                  <span><Stethoscope size={14} aria-hidden="true" /> {item.meta}</span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      )
    case 'insurance':
      return (
        <div className={`site-container insurance-block ${alignmentClass}`}>
          <ShieldCheck size={24} aria-hidden="true" />
          {block.label && <p className="site-eyebrow">{block.label}</p>}
          <h2>{block.title}</h2>
          <p>{block.text}</p>
          <div className="insurance-grid">
            {block.items.map((item, index) => (
              <div className="insurance-item" key={`${item.title}-${index}`}>
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      )
    case 'hours':
      return (
        <div className="site-container hours-layout">
          <div>
            {block.label && <p className="site-eyebrow">{block.label}</p>}
            <h2>{block.title}</h2>
            <p className="hours-address">{block.text}</p>
          </div>
          <div className="hours-list">
            {block.items.map((item, index) => (
              <div key={`${item.title}-${index}`}>
                <span><Clock3 size={15} aria-hidden="true" /> {item.title}</span>
                <strong>{item.text}</strong>
              </div>
            ))}
          </div>
        </div>
      )
    case 'faq':
      return (
        <div className="site-container faq-layout">
          <div className={`section-intro ${alignmentClass}`}>
            {block.label && <p className="site-eyebrow">{block.label}</p>}
            <h2>{block.title}</h2>
            <p>{block.text}</p>
          </div>
          <div className="faq-list">
            {block.items.map((item, index) => (
                <details key={`${item.title}-${index}`}>
                <summary>{item.title}<span aria-hidden="true">+</span></summary>
                <p>{item.text}</p>
              </details>
            ))}
          </div>
        </div>
      )
    case 'appointment':
      return (
        <div className="site-container appointment-layout">
          <div>
            <CalendarDays size={27} aria-hidden="true" />
            {block.label && <p className="site-eyebrow">{block.label}</p>}
            <h2>{block.title}</h2>
            <p>{block.text}</p>
          </div>
          <form className="appointment-form" onSubmit={(event) => event.preventDefault()}>
            <div className="appointment-fields">
              <label>Full name<input type="text" placeholder="Your name" /></label>
              <label>Email address<input type="email" placeholder="you@example.com" /></label>
              <label>Visit type<select defaultValue=""><option value="" disabled>Choose a visit</option><option>Primary care</option><option>Preventive visit</option><option>Virtual care</option></select></label>
              <label>Preferred day<input type="date" /></label>
            </div>
            <button className="site-button site-button--primary" type="submit">{block.buttonLabel || 'Request appointment'}<ArrowRight size={17} /></button>
            <small>For medical emergencies, call your local emergency number.</small>
          </form>
        </div>
      )
    case 'stats':
      return (
        <div className={`site-container ${alignmentClass}`}>
          {block.label && <p className="site-eyebrow">{block.label}</p>}
          <div className="stats-grid">
            {block.items.map((item, index) => (
              <div className="stat-item" key={`${item.title}-${index}`}>
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      )
    case 'testimonial':
      return (
        <div className={`site-container quote-block ${alignmentClass}`}>
          <span className="quote-mark" aria-hidden="true">&ldquo;</span>
          <blockquote>{block.title}</blockquote>
          <p>{block.label}</p>
        </div>
      )
    case 'contact':
      return (
        <div className={`site-container contact-layout ${alignmentClass}`}>
          <div>
            {block.label && <p className="site-eyebrow">{block.label}</p>}
            <h2>{block.title}</h2>
            <p>{block.text}</p>
          </div>
          <a
            className="site-button site-button--dark"
            href={block.buttonUrl || '#'}
            onClick={(event) => stopEditorLink(event, isEditor)}
          >
            {block.buttonLabel || 'Get started'}
            <ArrowRight size={17} aria-hidden="true" />
          </a>
        </div>
      )
    case 'spacer':
      return <div className="site-spacer" aria-label="Spacer" />
  }
}

export function PageRenderer({ page, selectedId, onSelect, publicMode = false }: PageRendererProps) {
  const accent = page.settings.accent ?? '#147d74'
  const style: SiteStyle = {
    '--site-accent': accent,
    '--site-surface': page.settings.surface ?? '#edf4f1',
    '--site-ink': page.settings.ink ?? '#172321',
    '--site-page': page.settings.pageBackground ?? '#ffffff',
    '--site-on-accent': readableText(accent),
    '--site-radius': `${page.settings.radius}px`,
    '--site-heading': headingStacks[page.settings.headingFont] ?? headingStacks['Instrument Serif'],
    '--site-body': bodyStacks[page.settings.bodyFont] ?? bodyStacks.Manrope,
    '--site-space': `${page.settings.sectionSpacing ?? 72}px`,
    '--site-max': `${page.settings.contentWidth ?? 1120}px`,
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>, id: string) => {
    if (onSelect && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      onSelect(id)
    }
  }

  return (
    <div className={`site-preview${publicMode ? ' site-preview--public' : ''}`} style={style}>
      <header className="site-nav">
        <a className="site-wordmark" href="#top" onClick={(event) => stopEditorLink(event, !publicMode)}>
          <span>{page.settings.projectName.slice(0, 1).toUpperCase()}</span>
          {page.settings.projectName}
        </a>
        <nav aria-label="Website navigation">
          <a href="#features" onClick={(event) => stopEditorLink(event, !publicMode)}>Services</a>
          <a href="#story" onClick={(event) => stopEditorLink(event, !publicMode)}>Our approach</a>
          <a className="nav-cta" href="#start" onClick={(event) => stopEditorLink(event, !publicMode)}>Book a visit</a>
        </nav>
      </header>
      <main id="top">
        {page.blocks.map((block, index) => (
          <section
            className={`site-block block-${block.type} bg-${block.background}${selectedId === block.id ? ' is-selected' : ''}`}
            id={index === 1 ? 'features' : index === page.blocks.length - 1 ? 'start' : undefined}
            key={block.id}
            onClick={() => onSelect?.(block.id)}
            onKeyDown={(event) => handleKeyDown(event, block.id)}
              data-editor-block={onSelect ? 'true' : undefined}
              role={onSelect ? 'group' : undefined}
              aria-label={onSelect ? `Select ${block.type} block` : undefined}
            tabIndex={onSelect ? 0 : undefined}
          >
            {onSelect && <span className="selection-label">{block.type}</span>}
            <BlockContent block={block} isEditor={!publicMode} />
          </section>
        ))}
      </main>
      <footer className="site-footer" id="story">
        <div className="site-wordmark">
          <span>{page.settings.projectName.slice(0, 1).toUpperCase()}</span>
          {page.settings.projectName}
        </div>
        <p>Compassionate care, close to home.</p>
        <small>&copy; {new Date().getFullYear()} {page.settings.projectName}</small>
      </footer>
    </div>
  )
}