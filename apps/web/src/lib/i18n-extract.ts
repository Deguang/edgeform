/**
 * i18n text extraction and block translation utilities.
 * Walks the SiteConfig block tree to find all translatable strings,
 * and applies translations back onto block objects before rendering.
 */

/** Extract all unique translatable strings from a site config. */
export function extractTexts(config: any): string[] {
  const set = new Set<string>();
  const add = (v: any) => { if (typeof v === 'string' && v.trim()) set.add(v); };

  add(config.title);
  add(config.description);

  for (const page of config.pages || []) {
    for (const block of page.blocks || []) {
      extractBlockTexts(block, add);
    }
  }

  return Array.from(set);
}

function extractBlockTexts(b: any, add: (v: string) => void) {
  switch (b.type) {
    case 'hero':
      add(b.title); add(b.subtitle); add(b.description);
      add(b.cta?.label);
      break;

    case 'features':
      add(b.heading);
      for (const item of b.items || []) {
        add(item.title); add(item.description); add(item.tag);
      }
      break;

    case 'form':
      add(b.heading); add(b.description);
      add(b.submitLabel); add(b.successMessage);
      for (const f of b.fields || []) {
        add(f.label); add(f.placeholder);
        for (const o of f.options || []) add(o);
      }
      for (const step of b.steps || []) {
        add(step.label);
      }
      break;

    case 'text':
      add(b.content);
      break;

    case 'image':
      add(b.alt); add(b.caption);
      break;

    case 'pricing':
      add(b.heading); add(b.description);
      for (const plan of b.plans || []) {
        add(plan.name); add(plan.price); add(plan.description);
        add(plan.cta?.label);
        for (const feat of plan.features || []) add(feat);
      }
      break;

    case 'links':
      add(b.heading);
      add(b.avatar?.alt);
      for (const item of b.items || []) {
        add(item.label); add(item.description);
      }
      break;

    case 'countdown':
      add(b.heading); add(b.description); add(b.expiredMessage);
      if (b.labels) {
        add(b.labels.days); add(b.labels.hours);
        add(b.labels.minutes); add(b.labels.seconds);
      }
      break;

    case 'footer':
      add(b.text);
      for (const link of b.links || []) add(link.label);
      break;

    case 'faq':
      add(b.heading); add(b.description);
      for (const item of b.items || []) { add(item.question); add(item.answer); }
      break;

    case 'testimonials':
      add(b.heading);
      for (const item of b.items || []) { add(item.quote); }
      break;

    case 'logos':
      add(b.heading);
      break;

    case 'video':
      add(b.heading); add(b.caption);
      break;
  }
}

/**
 * Deep-clone a block and replace all text fields using a translation function.
 * The `t` function should return the translated string, or the original if no translation.
 */
export function translateBlock(block: any, t: (s: string) => string): any {
  const b = JSON.parse(JSON.stringify(block));

  switch (b.type) {
    case 'hero':
      if (b.title) b.title = t(b.title);
      if (b.subtitle) b.subtitle = t(b.subtitle);
      if (b.description) b.description = t(b.description);
      if (b.cta?.label) b.cta.label = t(b.cta.label);
      break;

    case 'features':
      if (b.heading) b.heading = t(b.heading);
      for (const item of b.items || []) {
        if (item.title) item.title = t(item.title);
        if (item.description) item.description = t(item.description);
        if (item.tag) item.tag = t(item.tag);
      }
      break;

    case 'form':
      if (b.heading) b.heading = t(b.heading);
      if (b.description) b.description = t(b.description);
      if (b.submitLabel) b.submitLabel = t(b.submitLabel);
      if (b.successMessage) b.successMessage = t(b.successMessage);
      for (const f of b.fields || []) {
        if (f.label) f.label = t(f.label);
        if (f.placeholder) f.placeholder = t(f.placeholder);
        if (f.options) f.options = f.options.map((o: string) => t(o));
      }
      for (const step of b.steps || []) {
        if (step.label) step.label = t(step.label);
      }
      break;

    case 'text':
      if (b.content) b.content = t(b.content);
      break;

    case 'image':
      if (b.alt) b.alt = t(b.alt);
      if (b.caption) b.caption = t(b.caption);
      break;

    case 'pricing':
      if (b.heading) b.heading = t(b.heading);
      if (b.description) b.description = t(b.description);
      for (const plan of b.plans || []) {
        if (plan.name) plan.name = t(plan.name);
        if (plan.description) plan.description = t(plan.description);
        if (plan.cta?.label) plan.cta.label = t(plan.cta.label);
        if (plan.features) plan.features = plan.features.map((f: string) => t(f));
      }
      break;

    case 'links':
      if (b.heading) b.heading = t(b.heading);
      if (b.avatar?.alt) b.avatar.alt = t(b.avatar.alt);
      for (const item of b.items || []) {
        if (item.label) item.label = t(item.label);
        if (item.description) item.description = t(item.description);
      }
      break;

    case 'countdown':
      if (b.heading) b.heading = t(b.heading);
      if (b.description) b.description = t(b.description);
      if (b.expiredMessage) b.expiredMessage = t(b.expiredMessage);
      if (b.labels) {
        if (b.labels.days) b.labels.days = t(b.labels.days);
        if (b.labels.hours) b.labels.hours = t(b.labels.hours);
        if (b.labels.minutes) b.labels.minutes = t(b.labels.minutes);
        if (b.labels.seconds) b.labels.seconds = t(b.labels.seconds);
      }
      break;

    case 'footer':
      if (b.text) b.text = t(b.text);
      for (const link of b.links || []) {
        if (link.label) link.label = t(link.label);
      }
      break;

    case 'faq':
      if (b.heading) b.heading = t(b.heading);
      if (b.description) b.description = t(b.description);
      for (const item of b.items || []) {
        if (item.question) item.question = t(item.question);
        if (item.answer) item.answer = t(item.answer);
      }
      break;

    case 'testimonials':
      if (b.heading) b.heading = t(b.heading);
      for (const item of b.items || []) {
        if (item.quote) item.quote = t(item.quote);
      }
      break;

    case 'logos':
      if (b.heading) b.heading = t(b.heading);
      break;

    case 'video':
      if (b.heading) b.heading = t(b.heading);
      if (b.caption) b.caption = t(b.caption);
      break;
  }

  return b;
}
