export interface DemoCase {
  id: string; // stable id used for tab wiring, e.g. 'marketing'
  label: string; // tab label, e.g. 'Marketing site'
  prompt: string; // what the user would type
  route: string; // kit slug the router picks, e.g. 'marketing-site'
  skills: string[]; // skill slugs that kit pulls in
  excerpt: string[]; // 3-5 lines drawn verbatim from that kit's digest
}

export const DEMO_CASES: DemoCase[] = [
  {
    id: 'marketing',
    label: 'Marketing site',
    prompt: 'Design the hero for our launch page.',
    route: 'marketing-site',
    skills: ['brand-guidelines', 'frontend-design', 'web-design-guidelines', 'design-motion-principles'],
    excerpt: [
      'The hero states the thesis rather than decorating it.',
      "Rules that don't bend: animate `transform` and `opacity` only; enters slightly slower than exits; `prefers-reduced-motion` fully supported with a static poster state that still communicates.",
      "If a flourish would survive being described in a sentence to a stakeholder, it's probably earning its place.",
      'The first screen on a phone shows the argument, not the navigation.',
    ],
  },
  {
    id: 'product',
    label: 'Product UI',
    prompt: 'Review this dashboard table before I ship it.',
    route: 'product-ui',
    skills: ['web-design-guidelines', 'make-interfaces-feel-better', 'emil-design-eng', 'better-accessibility'],
    excerpt: [
      "Restraint isn't a style preference here — it's the functional requirement. A flourish that delights on first encounter becomes a tax on the four-hundredth.",
      'Encode state in form as well as color: a pill, a chip, a severity stripe, an icon. Color alone fails for ~8% of users and in every grayscale print.',
      'Most dashboard interactions land in the bottom two rows. Animate `transform` and `opacity` only; enters slightly slower than exits; never animate a keyboard-initiated action; `prefers-reduced-motion` fully supported.',
      'Errors are calm, plain, and actionable: what happened, what to do next. Zero playfulness in anything touching data loss or permissions.',
    ],
  },
  {
    id: 'mobile',
    label: 'Mobile review',
    prompt: 'Audit this screen on mobile.',
    route: 'mobile-first-review',
    skills: ['thumb-first', 'web-design-guidelines', 'better-accessibility', 'improve-animations'],
    excerpt: [
      'The discipline that makes it work: an opinion must never read as a defect, and a must-fix must never read as a preference.',
      "**Tap targets**: ≥44×44 CSS px in touch contexts. Check the *functional* hit area, not the visual box — padding on a wrapper isn't tappable if the anchor doesn't own it.",
      '**Font size in inputs**: ≥16px, or iOS Safari zooms on focus.',
      'State plainly what you could not assess: emulators lie about safe areas and address-bar behavior, dev servers lie about performance, and neither can tell you how the thing feels in one hand on a bus.',
    ],
  },
];
