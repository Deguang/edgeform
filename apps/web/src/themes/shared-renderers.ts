/**
 * Shared block renderer helpers.
 * Themes use these to generate HTML, wrapping with their own CSS classes.
 */

import { icon } from '../lib/icons';

// --- Helpers ---
const esc = (s: string) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// --- Form Field Rendering ---
export function renderFormField(field: any): string {
  const id = esc(field.id);
  const label = field.label ? `<label class="ef-field-label" for="ef-f-${id}">${field.label}${field.required ? ' <span class="ef-req">*</span>' : ''}</label>` : '';
  const req = field.required ? 'required' : '';
  const ph = field.placeholder ? `placeholder="${esc(field.placeholder)}"` : '';
  const cls = `ef-field ef-field-${field.width || 'full'}`;

  let input = '';
  switch (field.type) {
    case 'textarea':
      input = `<textarea id="ef-f-${id}" name="${id}" class="ef-input ef-textarea" ${ph} ${req} rows="4"></textarea>`;
      break;
    case 'select':
      const opts = (field.options || []).map((o: string) => `<option value="${esc(o)}">${o}</option>`).join('');
      input = `<select id="ef-f-${id}" name="${id}" class="ef-input ef-select" ${req}><option value="">${field.placeholder || 'Select...'}</option>${opts}</select>`;
      break;
    case 'checkbox':
      if (field.options?.length) {
        const boxes = field.options.map((o: string, i: number) =>
          `<label class="ef-check-label"><input type="checkbox" name="${id}" value="${esc(o)}" class="ef-checkbox" /><span>${o}</span></label>`
        ).join('');
        const groupReq = field.required ? ` data-required="true" data-group-name="${id}"` : '';
        input = `<div class="ef-check-group"${groupReq}>${boxes}</div>`;
      } else {
        input = `<label class="ef-check-label"><input type="checkbox" id="ef-f-${id}" name="${id}" class="ef-checkbox" ${req} /><span>${field.placeholder || field.label || ''}</span></label>`;
      }
      break;
    case 'radio':
      const radios = (field.options || []).map((o: string) =>
        `<label class="ef-check-label"><input type="radio" name="${id}" value="${esc(o)}" class="ef-radio" /><span>${o}</span></label>`
      ).join('');
      const radioReq = field.required ? ` data-required="true" data-group-name="${id}"` : '';
      input = `<div class="ef-check-group"${radioReq}>${radios}</div>`;
      break;
    default:
      input = `<input type="${field.type || 'text'}" id="ef-f-${id}" name="${id}" class="ef-input" ${ph} ${req} />`;
  }

  return `<div class="${cls}">${label}${input}</div>`;
}

export function renderFormFields(fields: any[]): string {
  return `<div class="ef-form-grid">${fields.map(renderFormField).join('')}</div>`;
}

export function renderMultiStepForm(b: any): string {
  if (!b.steps?.length) return '';
  const fieldsMap = new Map((b.fields || []).map((f: any) => [f.id, f]));

  const stepsHtml = b.steps.map((step: any, i: number) => {
    // Support both formats:
    //   1) step.fields — fields nested directly in each step
    //   2) step.fieldIds — references to top-level b.fields by id
    const stepFields = step.fields?.length
      ? step.fields
      : (step.fieldIds || []).map((id: string) => fieldsMap.get(id)).filter(Boolean);
    return `<div class="ef-step${i === 0 ? ' active' : ''}" data-step="${i}">
      <div class="ef-step-header">${step.title || step.label || ''}</div>
      ${renderFormFields(stepFields)}
    </div>`;
  }).join('');

  const progress = b.steps.map((_: any, i: number) =>
    `<div class="ef-progress-dot${i === 0 ? ' active' : ''}" data-step="${i}"></div>`
  ).join('');

  return `${stepsHtml}
    <div class="ef-step-nav">
      <button type="button" class="ef-step-prev ef-btn-ghost" style="visibility:hidden">Back</button>
      <div class="ef-step-progress">${progress}</div>
      <button type="button" class="ef-step-next ef-cta">Next</button>
    </div>`;
}

// --- Text Block ---
export function renderText(b: any): string {
  const align = b.align || 'left';
  const size = b.size || 'md';
  return `<div class="ef-text ef-text-${size}" style="text-align:${align}">${b.content}</div>`;
}

// --- Image Block ---
export function renderImage(b: any): string {
  const style = b.maxWidth ? `max-width:${b.maxWidth}` : '';
  const rounded = b.rounded ? ' ef-img-rounded' : '';
  return `<figure class="ef-image${rounded}" style="${style}">
    <img src="${esc(b.src)}" alt="${esc(b.alt || '')}" loading="lazy" style="object-fit:${b.fit || 'cover'}" />
    ${b.caption ? `<figcaption class="ef-caption">${b.caption}</figcaption>` : ''}
  </figure>`;
}

// --- Pricing Block ---
export function renderPricing(b: any, prefix: string): string {
  const heading = b.heading ? `<h2 class="${prefix}-heading">${b.heading}</h2>${b.description ? `<p class="${prefix}-dim">${b.description}</p>` : ''}` : '';
  const plans = (b.plans || []).map((p: any) => {
    const features = (p.features || []).map((f: string) => `<li>${f}</li>`).join('');
    const cta = p.cta ? `<a href="${esc(p.cta.url)}" class="ef-cta ef-pricing-cta">${p.cta.label}</a>` : '';
    return `<div class="ef-pricing-card${p.highlighted ? ' ef-pricing-hl' : ''}">
      <div class="ef-pricing-name">${p.name}</div>
      <div class="ef-pricing-price">${p.price}${p.period ? `<span class="ef-pricing-period">/${p.period}</span>` : ''}</div>
      ${p.description ? `<p class="ef-pricing-desc">${p.description}</p>` : ''}
      <ul class="ef-pricing-features">${features}</ul>
      ${cta}
    </div>`;
  }).join('');
  return `${heading}<div class="ef-pricing-grid">${plans}</div>`;
}

// --- Links Block ---
export function renderLinks(b: any): string {
  const avatar = b.avatar ? `<div class="ef-links-avatar"><img src="${esc(b.avatar.src)}" alt="${esc(b.avatar.alt || '')}" /></div>` : '';
  const heading = b.heading ? `<h2 class="ef-links-heading">${b.heading}</h2>` : '';
  const items = (b.items || []).map((item: any) => {
    const style = item.style || 'default';
    const itemIcon = item.icon
      ? `<span class="ef-link-icon">${item.icon}</span>`
      : `<span class="ef-link-icon">${icon('link')}</span>`;
    const desc = item.description ? `<span class="ef-link-desc">${item.description}</span>` : '';
    return `<a href="${esc(item.url)}" class="ef-link-item ef-link-${style}" target="_blank" rel="noopener">
      ${itemIcon}<span class="ef-link-label">${item.label}</span>${desc}
    </a>`;
  }).join('');
  return `${avatar}${heading}<div class="ef-links-list">${items}</div>`;
}

// --- FAQ Block ---
export function renderFAQ(b: any): string {
  const heading = b.heading ? `<h2 class="ef-faq-heading">${b.heading}</h2>${b.description ? `<p class="ef-faq-desc">${b.description}</p>` : ''}` : '';
  const items = (b.items || []).map((item: any, i: number) =>
    `<div class="ef-faq-item" data-faq="${i}">
      <button class="ef-faq-q" type="button">
        <span>${item.question}</span>
        <span class="ef-faq-icon">${icon('plus')}</span>
      </button>
      <div class="ef-faq-a"><div class="ef-faq-a-inner">${item.answer}</div></div>
    </div>`
  ).join('');
  return `${heading}<div class="ef-faq-list">${items}</div>`;
}

// --- Testimonials Block ---
export function renderTestimonials(b: any): string {
  const heading = b.heading ? `<h2 class="ef-testimonials-heading">${b.heading}</h2>` : '';
  const items = (b.items || []).map((item: any) => {
    const avatar = item.avatar
      ? `<img class="ef-testimonial-avatar" src="${esc(item.avatar)}" alt="${esc(item.author)}" loading="lazy" />`
      : `<div class="ef-testimonial-avatar ef-testimonial-avatar-placeholder">${(item.author || '?')[0].toUpperCase()}</div>`;
    const meta = [item.role, item.company].filter(Boolean).join(' @ ');
    return `<div class="ef-testimonial-card">
      <div class="ef-testimonial-quote">&ldquo;${item.quote}&rdquo;</div>
      <div class="ef-testimonial-author">
        ${avatar}
        <div>
          <div class="ef-testimonial-name">${item.author}</div>
          ${meta ? `<div class="ef-testimonial-meta">${meta}</div>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
  return `${heading}<div class="ef-testimonials-grid">${items}</div>`;
}

// --- Logos Block ---
export function renderLogos(b: any): string {
  const heading = b.heading ? `<h2 class="ef-logos-heading">${b.heading}</h2>` : '';
  const items = (b.items || []).map((item: any) => {
    const img = `<img src="${esc(item.src)}" alt="${esc(item.alt)}" loading="lazy" class="ef-logo-img" />`;
    return item.url
      ? `<a href="${esc(item.url)}" class="ef-logo-item" target="_blank" rel="noopener">${img}</a>`
      : `<div class="ef-logo-item">${img}</div>`;
  }).join('');
  return `${heading}<div class="ef-logos-strip">${items}</div>`;
}

// --- Video Block ---
export function renderVideo(b: any): string {
  const heading = b.heading ? `<h2 class="ef-video-heading">${b.heading}</h2>` : '';
  const caption = b.caption ? `<p class="ef-video-caption">${b.caption}</p>` : '';
  let embed = '';
  const src = b.src || '';

  // YouTube
  const ytMatch = src.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    embed = `<iframe class="ef-video-iframe" src="https://www.youtube.com/embed/${ytMatch[1]}${b.autoplay ? '?autoplay=1&mute=1' : ''}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
  }
  // Bilibili
  else if (src.includes('bilibili.com')) {
    const bvMatch = src.match(/\/video\/(BV[a-zA-Z0-9]+)/);
    if (bvMatch) {
      embed = `<iframe class="ef-video-iframe" src="https://player.bilibili.com/player.html?bvid=${bvMatch[1]}&autoplay=${b.autoplay ? 1 : 0}" frameborder="0" allowfullscreen loading="lazy"></iframe>`;
    }
  }
  // Direct video URL
  else if (src.match(/\.(mp4|webm|ogg)(\?|$)/i)) {
    embed = `<video class="ef-video-native" controls ${b.autoplay ? 'autoplay muted' : ''} playsinline><source src="${esc(src)}" /></video>`;
  }
  // Generic iframe fallback
  else if (src) {
    embed = `<iframe class="ef-video-iframe" src="${esc(src)}" frameborder="0" allowfullscreen loading="lazy"></iframe>`;
  }

  return `${heading}<div class="ef-video-wrap">${embed}</div>${caption}`;
}

// --- Countdown Block ---
export function renderCountdown(b: any): string {
  const labels = b.labels || {};
  const heading = b.heading ? `<h2 class="ef-countdown-heading">${b.heading}</h2>${b.description ? `<p class="ef-countdown-desc">${b.description}</p>` : ''}` : '';
  return `${heading}
    <div class="ef-countdown" data-target="${esc(b.targetDate)}" data-expired="${esc(b.expiredMessage || 'Time is up!')}">
      <div class="ef-cd-unit"><span class="ef-cd-num" data-cd="days">00</span><span class="ef-cd-label">${labels.days || 'Days'}</span></div>
      <div class="ef-cd-sep">:</div>
      <div class="ef-cd-unit"><span class="ef-cd-num" data-cd="hours">00</span><span class="ef-cd-label">${labels.hours || 'Hours'}</span></div>
      <div class="ef-cd-sep">:</div>
      <div class="ef-cd-unit"><span class="ef-cd-num" data-cd="minutes">00</span><span class="ef-cd-label">${labels.minutes || 'Min'}</span></div>
      <div class="ef-cd-sep">:</div>
      <div class="ef-cd-unit"><span class="ef-cd-num" data-cd="seconds">00</span><span class="ef-cd-label">${labels.seconds || 'Sec'}</span></div>
    </div>`;
}
