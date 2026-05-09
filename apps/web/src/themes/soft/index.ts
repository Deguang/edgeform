import type { ThemeDefinition } from '../types';
import { renderText, renderImage, renderPricing, renderLinks, renderCountdown, renderFAQ, renderTestimonials, renderLogos, renderVideo, renderFormFields, renderMultiStepForm } from '../shared-renderers';

const cta = (b: any) => b.cta?.label ? `<button class="ef-cta" onclick="document.dispatchEvent(new CustomEvent('ef:next'))">${b.cta.label}</button>` : '';
const tag = (item: any) => item.tag ? `<span class="ef-tag ef-tag-${item.tagColor || 'accent'}">${item.tag}</span>` : '';

const formInner = (b: any) => {
  const formId = b.formId || '';
  if (b.steps?.length) {
    return `<div class="ef-form-wrap ef-form-scrollable" data-endpoint="${b.submitEndpoint}" data-form-id="${formId}" data-success="${b.successMessage}">
      ${renderMultiStepForm(b)}
      <p class="ef-error hidden"></p>
      <div class="ef-success hidden"><p class="ef-ok">${b.successMessage}</p><p class="ef-latency-text"></p></div>
    </div>`;
  }
  if (b.fields?.length === 1 && b.fields[0].type === 'email') {
    const field = b.fields[0];
    return `<div class="ef-form-wrap" data-endpoint="${b.submitEndpoint}" data-form-id="${formId}" data-success="${b.successMessage}">
      <div class="ef-form-row">
        <input type="email" class="ef-email ef-input" placeholder="${field.placeholder || ''}" />
        <button class="ef-submit">${b.submitLabel}</button>
      </div>
      <p class="ef-error hidden"></p>
      <div class="ef-success hidden"><p class="ef-ok">${b.successMessage}</p><p class="ef-latency-text"></p><p class="ef-count-text"></p></div>
    </div>`;
  }
  return `<div class="ef-form-wrap ef-form-scrollable" data-endpoint="${b.submitEndpoint}" data-form-id="${formId}" data-success="${b.successMessage}">
    ${renderFormFields(b.fields || [])}
    <button class="ef-submit ef-submit-full">${b.submitLabel}</button>
    <p class="ef-error hidden"></p>
    <div class="ef-success hidden"><p class="ef-ok">${b.successMessage}</p><p class="ef-latency-text"></p></div>
  </div>`;
};

export const soft: ThemeDefinition = {
  name: 'soft',
  label: 'Soft',
  cssClass: 'ef-t-soft',
  blocks: {
    hero: (b) => `
      <h1 class="s-hero-title">${b.title}</h1>
      <p class="s-hero-sub">${b.subtitle || ''}</p>
      <p class="s-hero-desc">${b.description || ''}</p>
      ${cta(b)}`,

    features: (b) => {
      const heading = b.heading ? `<h2 class="s-heading">${b.heading}</h2>` : '';
      const cols = b.columns || 0;
      const colStyle = cols ? ` style="grid-template-columns:repeat(${cols},1fr)"` : '';
      const items = (b.items || []).map((item: any) =>
        `<div class="s-feat-card">${tag(item)}<h3>${item.title}</h3><p>${item.description || ''}</p></div>`
      ).join('');
      return `${heading}<div class="ef-features s-feat-grid"${colStyle}>${items}</div>`;
    },

    form: (b) => {
      const heading = b.heading ? `<h2 class="s-heading">${b.heading}</h2><p class="s-dim">${b.description || ''}</p>` : '';
      return `${heading}${formInner(b)}`;
    },

    footer: (b) => {
      const links = (b.links || []).map((l: any) => `<a href="${l.url}" class="ef-footer-link">${l.label}</a>`).join(' · ');
      return `<div class="ef-footer-inner"><span>${b.text}</span>${links ? `<div>${links}</div>` : ''}</div>`;
    },

    text: (b) => renderText(b),
    image: (b) => renderImage(b),
    pricing: (b) => renderPricing(b, 's'),
    links: (b) => renderLinks(b),
    countdown: (b) => renderCountdown(b),
    faq: (b) => renderFAQ(b),
    testimonials: (b) => renderTestimonials(b),
    logos: (b) => renderLogos(b),
    video: (b) => renderVideo(b),
  },
};
