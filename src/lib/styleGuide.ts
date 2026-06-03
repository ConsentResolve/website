export interface StyleGuideEntry {
  slug: string;
  title: string;
  description: string;
}

export const STYLE_GUIDE: StyleGuideEntry[] = [
  { slug: "voice", title: "Voice", description: "Locked voice: audience, banned/preferred words, canonical facts." },
  { slug: "buttons", title: "Buttons", description: "Variants, sizes, with-icon, link buttons." },
  { slug: "icons", title: "Icon Styles", description: "Tabler icon library presets and sizing." },
  { slug: "alerts", title: "Alert Messages", description: "Info, success, warning, danger." },
  { slug: "badges", title: "Badges", description: "Pill tags for status, category, and metadata — light and dark surface renditions." },
  { slug: "accordion", title: "Accordion", description: "Single and grouped collapsible panels." },
  { slug: "tabs-toggles", title: "Tabs & Toggles", description: "Tabbed content + binary toggles." },
  { slug: "lists", title: "List Styles", description: "Ordered, unordered, checklist, feature lists." },
  { slug: "blockquote", title: "Blockquote", description: "Pull quotes and citations." },
  { slug: "typography", title: "Dropcaps, Ampersand & Highlighter", description: "Type-level decorative treatments." },
  { slug: "callouts", title: "Content & Callout Boxes", description: "Tip, warn, note, premium." },
  { slug: "dividers", title: "Dividers", description: "Horizontal rules and section separators." },
  { slug: "columns", title: "Columns Layouts", description: "Two- and three-column structured content." },
  { slug: "grid", title: "Column Grid Layout", description: "Responsive grid showcase." },
  { slug: "image-frames", title: "Image Frames", description: "Image presentation styles." },
  { slug: "embed-videos", title: "Embedded Videos", description: "YouTube / Vimeo responsive embeds." },
  { slug: "google-map", title: "Google Map", description: "Responsive embedded map." },
  { slug: "progress", title: "Progress Bars & Charts", description: "Linear progress, ring progress, bar chart." },
  { slug: "stats", title: "Animated Stats & Highlights", description: "Count-up stats, standouts, before/after comparisons." },
  { slug: "analytics", title: "Analytics Widgets", description: "Metric cards, sparklines, funnels." },
  { slug: "logo-carousel", title: "Logo Carousel", description: "Marquee, grid, and static brand strips." },
  { slug: "calculators", title: "Calculators", description: "Interactive ROI and lead-cost calculators." },
  { slug: "how-it-works", title: "How It Works (Comet)", description: "Animated dark-theme 3-step section with a comet that sweeps and lights each node in turn." },
  { slug: "feature-cards", title: "Feature Cards", description: "Eight variants of an icon + title + body tile primitive." },
  { slug: "illustration-cards", title: "Illustration Cards", description: "Illustration-led card primitive — brand SVG on a mint gradient plate, title, body, optional Learn more chip. Used on /features/ and /how-it-works/." },
  { slug: "comparison-tables", title: "Comparison Tables", description: "Mattress-site-style product cards + dense feature × brand matrix." },
  { slug: "product-demo", title: "Product Demo Screens", description: "Anonymized HTML/CSS replicas of the dashboard for landing-page use." },
  { slug: "illustrations", title: "Illustrations", description: "Locked hand-drawn sage-palette icon system with OpenAI regeneration script." },
  { slug: "pricing-table", title: "Pricing Table", description: "Tiered pricing card layout." },
  { slug: "testimonials", title: "Testimonials", description: "Customer testimonial card variants." },
];

export function getNeighbors(slug: string) {
  const i = STYLE_GUIDE.findIndex((e) => e.slug === slug);
  return {
    prev: i > 0 ? STYLE_GUIDE[i - 1] : null,
    next: i >= 0 && i < STYLE_GUIDE.length - 1 ? STYLE_GUIDE[i + 1] : null,
  };
}
