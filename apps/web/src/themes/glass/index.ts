import type { ThemeDefinition } from '../types';
import { renderText, renderImage, renderPricing, renderLinks, renderCountdown, renderFAQ, renderTestimonials, renderLogos, renderVideo, renderFormFields, renderMultiStepForm } from '../shared-renderers';

const cta = (b: any) => b.cta?.label ? `<button class="ef-cta" onclick="document.dispatchEvent(new CustomEvent('ef:next'))">${b.cta.label}</button>` : '';
const tag = (item: any) => item.tag ? `<span class="ef-tag ef-tag-${item.tagColor || 'accent'}">${item.tag}</span>` : '';

export const glass: ThemeDefinition = {
  name: 'glass',
  label: 'Glass',
  cssClass: 'ef-t-glass',
  blocks: {
    hero: (b) => `
      <h1 class="g-hero-title">${b.title}</h1>
      <p class="g-hero-sub">${b.subtitle || ''}</p>
      <p class="g-hero-desc">${b.description || ''}</p>
      ${cta(b)}`,

    features: (b) => {
      const heading = b.heading ? `<h2 class="g-heading">${b.heading}</h2>` : '';
      const cols = b.columns || 0;
      const colStyle = cols ? ` style="grid-template-columns:repeat(${cols},1fr)"` : '';
      const items = (b.items || []).map((item: any) =>
        `<div class="g-feat-card">${tag(item)}<h3>${item.title}</h3><p>${item.description || ''}</p></div>`
      ).join('');
      return `${heading}<div class="ef-features g-feat-grid"${colStyle}>${items}</div>`;
    },

    form: (b) => {
      const heading = b.heading ? `<h2 class="g-heading">${b.heading}</h2><p class="g-dim">${b.description || ''}</p>` : '';
      const formId = b.formId || '';
      // Multi-step form
      if (b.steps?.length) {
        return `${heading}
          <div class="ef-form-wrap ef-form-scrollable" data-endpoint="${b.submitEndpoint}" data-form-id="${formId}" data-success="${b.successMessage}">
            ${renderMultiStepForm(b)}
            <p class="ef-error hidden"></p>
            <div class="ef-success hidden">
              <p class="ef-ok">${b.successMessage}</p>
              <p class="ef-latency-text"></p>
            </div>
          </div>`;
      }
      // Single-field legacy (email waitlist)
      if (b.fields?.length === 1 && b.fields[0].type === 'email') {
        const field = b.fields[0];
        return `${heading}
          <div class="ef-form-wrap" data-endpoint="${b.submitEndpoint}" data-form-id="${formId}" data-success="${b.successMessage}">
            <div class="ef-form-row">
              <input type="email" class="ef-email ef-input" placeholder="${field.placeholder || ''}" />
              <button class="ef-submit">${b.submitLabel}</button>
            </div>
            <p class="ef-error hidden"></p>
            <div class="ef-success hidden">
              <p class="ef-ok">${b.successMessage}</p>
              <p class="ef-latency-text"></p>
              <p class="ef-count-text"></p>
            </div>
          </div>`;
      }
      // Multi-field form
      return `${heading}
        <div class="ef-form-wrap ef-form-scrollable" data-endpoint="${b.submitEndpoint}" data-form-id="${formId}" data-success="${b.successMessage}">
          ${renderFormFields(b.fields || [])}
          <button class="ef-submit ef-submit-full">${b.submitLabel}</button>
          <p class="ef-error hidden"></p>
          <div class="ef-success hidden">
            <p class="ef-ok">${b.successMessage}</p>
            <p class="ef-latency-text"></p>
          </div>
        </div>`;
    },

    footer: (b) => {
      const links = (b.links || []).map((l: any) => `<a href="${l.url}" class="ef-footer-link">${l.label}</a>`).join(' · ');
      const socials = (b.socials || []).map((s: any) => `<a href="${s.url}" class="ef-social-link" target="_blank" rel="noopener">${s.platform}</a>`).join('');
      return `<div class="ef-footer-inner"><span>${b.text}</span>${links ? `<div>${links}</div>` : ''}${socials ? `<div class="ef-socials">${socials}</div>` : ''}</div>`;
    },

    text: (b) => renderText(b),
    image: (b) => renderImage(b),
    pricing: (b) => renderPricing(b, 'g'),
    links: (b) => renderLinks(b),
    countdown: (b) => renderCountdown(b),
    faq: (b) => renderFAQ(b),
    testimonials: (b) => renderTestimonials(b),
    logos: (b) => renderLogos(b),
    video: (b) => renderVideo(b),
  },
};
