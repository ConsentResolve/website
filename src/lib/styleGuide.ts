export interface StyleGuideEntry {
  slug: string;
  title: string;
  description: string;
}

export const STYLE_GUIDE: StyleGuideEntry[] = [
  // Foundations
  { slug: "voice", title: "Voice", description: "Locked voice: audience, banned/preferred words, canonical facts." },
  { slug: "typography", title: "Dropcaps, Ampersand & Highlighter", description: "Type-level decorative treatments." },
  { slug: "icons", title: "Icon Styles", description: "Tabler icon library presets and sizing." },
  { slug: "illustrations", title: "Illustrations", description: "Locked hand-drawn sage-palette icon system with Recraft regeneration script." },
  // Atoms
  { slug: "buttons", title: "Buttons", description: "Variants, sizes, with-icon, link buttons." },
  { slug: "badges", title: "Badges", description: "Pill tags for status, category, and metadata — light and dark surface renditions." },
  { slug: "alerts", title: "Alert Messages", description: "Info, success, warning, danger." },
  { slug: "accordion", title: "Accordion", description: "Single and grouped collapsible panels." },
  { slug: "tabs-toggles", title: "Tabs & Toggles", description: "Tabbed content + binary toggles." },
  { slug: "lists", title: "List Styles", description: "Ordered, unordered, checklist, feature lists." },
  { slug: "blockquote", title: "Blockquote", description: "Pull quotes and citations." },
  { slug: "callouts", title: "Content & Callout Boxes", description: "Tip, warn, note, premium." },
  { slug: "dividers", title: "Dividers", description: "Horizontal rules and section separators." },
  // Layout
  { slug: "columns", title: "Columns Layouts", description: "Two- and three-column structured content." },
  { slug: "grid", title: "Column Grid Layout", description: "Responsive grid showcase." },
  { slug: "image-frames", title: "Image Frames", description: "Image presentation styles." },
  { slug: "embed-videos", title: "Embedded Videos", description: "YouTube / Vimeo responsive embeds." },
  { slug: "google-map", title: "Google Map", description: "Responsive embedded map." },
  // Data & numbers
  { slug: "progress", title: "Progress Bars & Charts", description: "Linear progress, ring progress, bar chart." },
  { slug: "stats", title: "Animated Stats & Highlights", description: "Count-up stats, standouts, before/after comparisons." },
  { slug: "analytics", title: "Analytics Widgets", description: "Metric cards, sparklines, funnels." },
  { slug: "metric-row", title: "Metric Row", description: "Horizontal label-on-left, big-value-on-right row card. Stack 2-3 in a dark CTA to anchor a price / promise." },
  // Cards
  { slug: "feature-cards", title: "Feature Cards", description: "Eight variants of an icon + title + body tile primitive." },
  { slug: "illustration-cards", title: "Illustration Cards", description: "Illustration-led card primitive — brand SVG on a mint gradient plate, title, body, optional Learn more chip." },
  { slug: "pillar-card", title: "Pillar Card", description: "Mint icon tile + eyebrow + headline + body + Learn-more cap. Used for 2-4 top-level value pillars that lead deeper into a section or feature group." },
  { slug: "stake-card", title: "Stake Card", description: "Problem-stat card with icon + big stat + label + body + optional source link. Surface-aware (light/dark) + tones (danger/neutral/brand)." },
  // Tables
  { slug: "comparison-tables", title: "Comparison Tables", description: "Mattress-site-style product cards + dense feature × brand matrix." },
  { slug: "pricing-table", title: "Pricing Table", description: "Tiered pricing card layout." },
  { slug: "pricing-feature-table", title: "Pricing Feature Table", description: "Grouped 'everything included' feature table for /pricing/. Group label rows + icon-tile-title-desc rows + Check column." },
  // Composite UI
  { slug: "logo-carousel", title: "Logo Carousel", description: "Marquee, grid, and static brand strips." },
  { slug: "calculators", title: "Calculators", description: "Interactive ROI and lead-cost calculators." },
  { slug: "product-demo", title: "Product Demo Screens", description: "Anonymized HTML/CSS replicas of the dashboard for landing-page use." },
  // Sections — production marketing-page composites
  { slug: "hero", title: "Hero Section", description: "Two-column hero with eyebrow + headline + subhead + CTAs + a configurable right-side panel (lead-phone | lead-visit | illustration)." },
  { slug: "step-flow", title: "Step Flow", description: "Horizontal numbered step strip with optional illustrated nodes and an inverted 'payoff' final step." },
  { slug: "how-it-works", title: "How It Works (5-step)", description: "Canonical 'how it works' section — a thin wrapper around StepFlow that renders the five illustrated recovery steps. Used on /, /how-it-works/, and every industry page." },
  { slug: "feature-bento", title: "Feature Bento", description: "Homepage feature section — 4 feature groups from src/data/features.ts, each rendered as an IllustrationCard grid." },
  { slug: "problem-stats", title: "Problem Stats", description: "Dark 'the leak in numbers' section. Header + ghost-in-browser illustration + Funnel viz + 3 stat cards." },
  { slug: "product-showcase", title: "Product Showcase", description: "Big dashboard-chrome reveal section with a mint glow + corner chips. The 'sexy product visual' moment." },
  { slug: "compare-section", title: "Compare Section", description: "Channel-ROI comparison: keep your existing channel + add Consent Resolve on top. Pulls CPL benchmarks from src/data/compare.ts." },
  { slug: "product-tour", title: "Product Tour", description: "Multi-step dashboard walkthrough — steps left, screen mock right. Used on /how-it-works/." },
  { slug: "risk-vs-consent", title: "Risk vs Consent", description: "Two-column moat section: scrape-and-spray tracking (red) vs Consent Resolve's consent-first model (mint)." },
  { slug: "compliance-band", title: "Compliance Band", description: "Trust band near every page tail: privacy / consent-first / GDPR + CCPA / Termageddon." },
  { slug: "faq", title: "FAQ Section", description: "Canonical FAQ section — dark band, mint eyebrow, white accordion card. Used on /, /faq/, /pricing/, /how-it-works/, every industry, every feature." },
  { slug: "aeo-answer", title: "AEO Answer", description: "Polished card section that wraps a 40-55 word LLM-citable answer paragraph. Used as the second-to-last section on every page that wants to be cited by AI engines." },
  { slug: "final-cta", title: "Final CTA", description: "Closing dark section. Two-column: headline + body + primary CTA on the left, $7 + 'Exclusive' + 'No contract' anchors on the right." },
  { slug: "related-links", title: "Related Links", description: "Small linked-card grid for 'you might also want to read' tail sections." },
];

export function getNeighbors(slug: string) {
  const i = STYLE_GUIDE.findIndex((e) => e.slug === slug);
  return {
    prev: i > 0 ? STYLE_GUIDE[i - 1] : null,
    next: i >= 0 && i < STYLE_GUIDE.length - 1 ? STYLE_GUIDE[i + 1] : null,
  };
}
