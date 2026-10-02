import type { BlockType, PageModel, SiteBlock } from './types'

const photoUrl =
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1600&q=85'

const clinicianPhotos = [
  'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=800&q=85',
  'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=800&q=85',
  'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=800&q=85',
]

function blockId(type: BlockType) {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function createBlock(type: BlockType): SiteBlock {
  const base: SiteBlock = {
    id: blockId(type),
    type,
    label: '',
    title: '',
    text: '',
    buttonLabel: '',
    buttonUrl: '#',
    image: '',
    alignment: 'left',
    background: 'white',
    items: [],
  }

  switch (type) {
    case 'hero':
      return {
        ...base,
        label: 'Primary care, thoughtfully personal',
        title: 'Healthcare that sees the whole you.',
        text: 'Northstar Health combines same-week appointments, longer visits, and a care team that stays with you.',
        buttonLabel: 'Book an appointment',
        image: photoUrl,
        background: 'soft',
      }
    case 'heading':
      return {
        ...base,
        label: 'Whole-person care',
        title: 'Care begins with being heard.',
        alignment: 'center',
      }
    case 'text':
      return {
        ...base,
        title: 'Clear information for every patient',
        text: 'Explain your care approach, what patients can expect, and how to prepare for their next visit.',
      }
    case 'button':
      return {
        ...base,
        buttonLabel: 'Find an appointment',
        alignment: 'center',
      }
    case 'image':
      return {
        ...base,
        label: 'Compassionate care, close to home',
        image: photoUrl,
      }
    case 'features':
      return {
        ...base,
        label: 'Care built around you',
        title: 'Everything you need to feel your best.',
        text: 'Connected primary care, preventive support, and guidance for every stage of life.',
        background: 'soft',
        items: [
          { title: 'Same-week visits', text: 'See a clinician in person or from the comfort of home.' },
          { title: 'Connected care', text: 'Your records, specialists, and care team stay in sync.' },
          { title: 'A personal plan', text: 'Leave each visit with clear next steps built around you.' },
        ],
      }
    case 'team':
      return {
        ...base,
        label: 'Your care team',
        title: 'Expert clinicians who listen first.',
        text: 'Meet the people who bring clinical excellence and human connection to every visit.',
        items: [
          { title: 'Dr. Amara Lewis', text: 'Family medicine', meta: 'MD, FAAFP', image: clinicianPhotos[0] },
          { title: 'Dr. Daniel Kim', text: 'Internal medicine', meta: 'MD, FACP', image: clinicianPhotos[1] },
          { title: 'Dr. Sofia Martinez', text: 'Preventive care', meta: 'DO, MPH', image: clinicianPhotos[2] },
        ],
      }
    case 'insurance':
      return {
        ...base,
        label: 'Coverage made clearer',
        title: 'Care that works with your plan.',
        text: 'We accept most major plans and offer transparent self-pay options.',
        background: 'soft',
        alignment: 'center',
        items: [
          { title: 'PPO plans', text: 'Most national networks' },
          { title: 'Medicare', text: 'New patients welcome' },
          { title: 'Self-pay', text: 'Upfront pricing' },
          { title: 'HSA / FSA', text: 'Eligible visits' },
        ],
      }
    case 'hours':
      return {
        ...base,
        label: 'Visit Northstar',
        title: 'Care when and where you need it.',
        text: '125 Harbor Street, Suite 200\nPortland, OR 97205',
        background: 'ink',
        items: [
          { title: 'Monday - Friday', text: '8:00 AM - 7:00 PM' },
          { title: 'Saturday', text: '9:00 AM - 2:00 PM' },
          { title: 'Sunday', text: 'Virtual visits only' },
        ],
      }
    case 'faq':
      return {
        ...base,
        label: 'Common questions',
        title: 'Know what to expect.',
        text: 'Clear answers before your first visit.',
        items: [
          { title: 'Are you accepting new patients?', text: 'Yes. New-patient appointments are available in person and by video.' },
          { title: 'What should I bring?', text: 'Bring a photo ID, insurance card, medication list, and any recent records.' },
          { title: 'Can I use telehealth?', text: 'Virtual visits are available for many follow-ups and same-day concerns.' },
        ],
      }
    case 'appointment':
      return {
        ...base,
        label: 'Request an appointment',
        title: 'Let us find the right visit for you.',
        text: 'Share a few details and our care team will follow up within one business day.',
        buttonLabel: 'Request appointment',
        background: 'soft',
      }
    case 'stats':
      return {
        ...base,
        label: 'Care you can count on',
        background: 'ink',
        alignment: 'center',
        items: [
          { title: '4.9/5', text: 'patient rating' },
          { title: '<24h', text: 'average response' },
          { title: '92%', text: 'same-week access' },
        ],
      }
    case 'testimonial':
      return {
        ...base,
        label: 'Elena R., Northstar patient',
        title: 'For the first time, I felt like my care team knew my story before I walked through the door.',
        background: 'accent',
        alignment: 'center',
      }
    case 'contact':
      return {
        ...base,
        label: 'New patients welcome',
        title: 'A healthier next chapter starts here.',
        text: 'Choose an appointment that fits your day. Most major insurance plans are accepted.',
        buttonLabel: 'Find an appointment',
        background: 'soft',
      }
    case 'spacer':
      return { ...base, title: 'Spacer' }
  }
}

export const defaultPage: PageModel = {
  settings: {
    projectName: 'Northstar Health',
    pageTitle: 'Northstar Health - Whole-person primary care',
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
    { ...createBlock('hero'), id: 'hero-welcome' },
    { ...createBlock('features'), id: 'features-focus' },
    { ...createBlock('team'), id: 'team-clinicians' },
    { ...createBlock('stats'), id: 'stats-proof' },
    { ...createBlock('insurance'), id: 'insurance-coverage' },
    { ...createBlock('testimonial'), id: 'testimonial-maya' },
    { ...createBlock('faq'), id: 'faq-common' },
    { ...createBlock('appointment'), id: 'appointment-start' },
  ],
}