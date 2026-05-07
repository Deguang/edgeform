// ============================================================
// EdgeForm Shared Types
// ============================================================

// --- Form Field Types (used by "form" block) ---

export type FieldType = 'text' | 'email' | 'select' | 'textarea' | 'number' | 'radio' | 'checkbox' | 'url' | 'tel' | 'date';

export interface FormField {
  id: string;
  type: FieldType;
  label?: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  defaultValue?: string;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    maxLength?: number;
    minLength?: number;
  };
  /** Width in grid columns: 'full' | 'half'. Default: 'full' */
  width?: 'full' | 'half';
}

// --- Block Types ---

export interface HeroBlock {
  type: 'hero';
  title: string;
  subtitle?: string;
  description?: string;
  cta?: { label: string; action: 'next' | 'scroll' | string };
  background?: { type: 'gradient' | 'image' | 'particles'; value: string };
  /** Entrance animation */
  animation?: AnimationConfig;
}

export interface FeaturesBlock {
  type: 'features';
  heading?: string;
  items: {
    tag?: string;
    tagColor?: 'accent' | 'green' | 'blue' | 'purple';
    icon?: string;
    title: string;
    description?: string;
  }[];
  layout?: 'grid' | 'list';
  columns?: 2 | 3 | 4;
  animation?: AnimationConfig;
}

export interface FormBlock {
  type: 'form';
  heading?: string;
  description?: string;
  fields: FormField[];
  submitEndpoint: string;
  submitLabel: string;
  successMessage: string;
  /** Multi-step form: group fields into named steps */
  steps?: { label: string; fieldIds: string[] }[];
  /** Store to submissions table with this form ID */
  formId?: string;
  animation?: AnimationConfig;
}

export interface FooterBlock {
  type: 'footer';
  text: string;
  links?: { label: string; url: string; icon?: string }[];
  socials?: { platform: string; url: string }[];
}

export interface TextBlock {
  type: 'text';
  content: string;
  align?: 'left' | 'center' | 'right';
  size?: 'sm' | 'md' | 'lg';
  animation?: AnimationConfig;
}

export interface ImageBlock {
  type: 'image';
  src: string;
  alt?: string;
  caption?: string;
  fit?: 'cover' | 'contain' | 'fill';
  rounded?: boolean;
  maxWidth?: string;
  animation?: AnimationConfig;
}

export interface PricingBlock {
  type: 'pricing';
  heading?: string;
  description?: string;
  plans: {
    name: string;
    price: string;
    period?: string;
    description?: string;
    features: string[];
    cta?: { label: string; url: string };
    highlighted?: boolean;
  }[];
  animation?: AnimationConfig;
}

export interface LinksBlock {
  type: 'links';
  heading?: string;
  avatar?: { src: string; alt?: string };
  items: {
    label: string;
    url: string;
    icon?: string;
    description?: string;
    style?: 'default' | 'highlight' | 'outline';
  }[];
  animation?: AnimationConfig;
}

export interface CountdownBlock {
  type: 'countdown';
  heading?: string;
  description?: string;
  targetDate: string; // ISO 8601
  labels?: { days?: string; hours?: string; minutes?: string; seconds?: string };
  expiredMessage?: string;
  animation?: AnimationConfig;
}

export interface FAQBlock {
  type: 'faq';
  heading?: string;
  description?: string;
  items: { question: string; answer: string }[];
  animation?: AnimationConfig;
}

export interface TestimonialsBlock {
  type: 'testimonials';
  heading?: string;
  items: {
    quote: string;
    author: string;
    avatar?: string;
    company?: string;
    role?: string;
  }[];
  animation?: AnimationConfig;
}

export interface LogosBlock {
  type: 'logos';
  heading?: string;
  items: { src: string; alt: string; url?: string }[];
  animation?: AnimationConfig;
}

export interface VideoBlock {
  type: 'video';
  src: string; // YouTube/Bilibili URL or direct mp4
  heading?: string;
  caption?: string;
  autoplay?: boolean;
  animation?: AnimationConfig;
}

// --- Animation Config ---

export interface AnimationConfig {
  type: 'fade-up' | 'fade-in' | 'slide-left' | 'slide-right' | 'zoom' | 'typewriter' | 'none';
  delay?: number;   // ms
  duration?: number; // ms
  stagger?: number;  // ms between child items
}

// --- All Block Types ---

export type Block =
  | HeroBlock
  | FeaturesBlock
  | FormBlock
  | FooterBlock
  | TextBlock
  | ImageBlock
  | PricingBlock
  | LinksBlock
  | CountdownBlock
  | FAQBlock
  | TestimonialsBlock
  | LogosBlock
  | VideoBlock;

// --- Common block options (applied via spread in each block) ---

/** Optional per-block layout overrides — applied by the engine, not themes */
export interface BlockLayoutOptions {
  /** Override page inner width when this block is present */
  pageWidth?: 'auto' | 'narrow' | 'normal' | 'wide' | 'full';
  /** Vertical spacing around this block */
  spacing?: 'compact' | 'normal' | 'loose';
  /** Per-block background */
  blockBackground?: { type: 'color' | 'gradient' | 'image'; value: string };
}

// --- Page & Site Config ---

export type NavigationMode = 'fullpage' | 'scroll' | 'tabs' | 'none';

export interface PageConfig {
  id: string;
  blocks: Block[];
  /** Optional background override for this page */
  background?: { type: 'gradient' | 'image' | 'color'; value: string };
}

export interface SiteTheme {
  primaryColor: string;
  logoUrl?: string;
}

export type I18nMap = Record<string, Record<string, string>>;

export type ThemeName = 'terminal' | 'glass' | 'brutal' | 'minimal' | 'retro' | 'light' | 'soft';

export interface ThemeSwitcherConfig {
  enabled: boolean;
  themes?: ThemeName[];
  defaultTheme?: ThemeName;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

export interface WebhookConfig {
  url: string;
  secret?: string;
  events?: ('submission' | 'waitlist')[];
}

export interface SiteConfig {
  id: string;
  title: string;
  description?: string;
  favicon?: string;
  theme: SiteTheme & { name?: ThemeName };
  themeSwitcher?: ThemeSwitcherConfig;
  pages: PageConfig[];
  navigation: NavigationMode;
  i18n_map?: I18nMap;
  translate_settings?: TranslateSettings;
  webhook?: WebhookConfig;
  version?: number;
  updatedAt?: string;
}

// --- D1 Row Types ---

export interface SiteRow {
  id: string;
  title: string;
  status: 'draft' | 'published' | 'archived';
  config_json: string;
  created_at: string;
  updated_at: string;
}

export interface SubmissionRow {
  id: string;
  form_id: string;
  data_json: string;
  locale: string;
  ip_hash: string;
  user_agent: string;
  latency_ms: number;
  created_at: string;
}

// --- Translation Provider Types ---

export type TranslateProvider = 'google' | 'microsoft' | 'workers-ai' | 'openai' | 'claude' | 'deepseek' | 'coze';

export interface TranslateProviderConfig {
  provider: TranslateProvider;
  enabled: boolean;
  apiKey?: string;
  botId?: string;
  endpoint?: string;
}

export interface TranslateSettings {
  providers: TranslateProviderConfig[];
  sourceLang: string;
  targetLangs: string[];
}

// --- Waitlist (Phase 0, backward compatible) ---

export interface WaitlistEntry {
  email: string;
  created_at: string;
}
