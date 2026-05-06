import { describe, it, expect } from 'vitest';
import {
  renderText, renderImage, renderPricing, renderLinks,
  renderFAQ, renderTestimonials, renderLogos, renderVideo,
  renderCountdown, renderFormField, renderFormFields, renderMultiStepForm,
} from '../src/themes/shared-renderers';

describe('renderText', () => {
  it('renders text with content', () => {
    const html = renderText({ content: 'Hello world', size: 'md', align: 'center' });
    expect(html).toContain('Hello world');
    expect(html).toContain('ef-text-md');
    expect(html).toContain('text-align:center');
  });

  it('uses defaults for missing size/align', () => {
    const html = renderText({ content: 'Hi' });
    expect(html).toContain('ef-text-md');
    expect(html).toContain('text-align:left');
  });
});

describe('renderImage', () => {
  it('renders image with src and alt', () => {
    const html = renderImage({ src: '/img/test.png', alt: 'Test image' });
    expect(html).toContain('src="/img/test.png"');
    expect(html).toContain('alt="Test image"');
    expect(html).toContain('<figure');
  });

  it('renders caption when provided', () => {
    const html = renderImage({ src: '/x.png', alt: '', caption: 'A caption' });
    expect(html).toContain('A caption');
    expect(html).toContain('ef-caption');
  });

  it('omits caption when not provided', () => {
    const html = renderImage({ src: '/x.png', alt: '' });
    expect(html).not.toContain('ef-caption');
  });

  it('applies rounded class', () => {
    const html = renderImage({ src: '/x.png', alt: '', rounded: true });
    expect(html).toContain('ef-img-rounded');
  });

  it('escapes HTML in src and alt', () => {
    const html = renderImage({ src: '<script>', alt: '"xss"' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;xss&quot;');
  });
});

describe('renderPricing', () => {
  it('renders heading and plans', () => {
    const html = renderPricing({
      heading: 'Pricing',
      plans: [{ name: 'Free', price: '$0', features: ['Feature 1'], cta: { label: 'Start', url: '/signup' } }],
    }, 'ef');
    expect(html).toContain('Pricing');
    expect(html).toContain('Free');
    expect(html).toContain('$0');
    expect(html).toContain('Feature 1');
    expect(html).toContain('Start');
    expect(html).toContain('/signup');
  });

  it('handles empty plans', () => {
    const html = renderPricing({ heading: 'Plans', plans: [] }, 'ef');
    expect(html).toContain('Plans');
    expect(html).toContain('ef-pricing-grid');
  });

  it('marks highlighted plan', () => {
    const html = renderPricing({
      plans: [{ name: 'Pro', price: '$10', highlighted: true, features: [] }],
    }, 'ef');
    expect(html).toContain('ef-pricing-hl');
  });

  it('handles plan with period', () => {
    const html = renderPricing({
      plans: [{ name: 'Pro', price: '$10', period: 'month', features: [] }],
    }, 'ef');
    expect(html).toContain('/month');
  });
});

describe('renderLinks', () => {
  it('renders link items', () => {
    const html = renderLinks({
      heading: 'My Links',
      items: [{ label: 'GitHub', url: 'https://github.com', icon: '🐙' }],
    });
    expect(html).toContain('My Links');
    expect(html).toContain('GitHub');
    expect(html).toContain('https://github.com');
    expect(html).toContain('🐙');
  });

  it('renders avatar when provided', () => {
    const html = renderLinks({
      avatar: { src: '/me.png', alt: 'Me' },
      items: [],
    });
    expect(html).toContain('ef-links-avatar');
    expect(html).toContain('/me.png');
  });

  it('handles empty items', () => {
    const html = renderLinks({ items: [] });
    expect(html).toContain('ef-links-list');
  });
});

describe('renderFAQ', () => {
  it('renders FAQ items with accordion structure', () => {
    const html = renderFAQ({
      heading: 'FAQ',
      items: [{ question: 'What is this?', answer: 'A tool.' }],
    });
    expect(html).toContain('FAQ');
    expect(html).toContain('What is this?');
    expect(html).toContain('A tool.');
    expect(html).toContain('ef-faq-item');
    expect(html).toContain('ef-faq-q');
    expect(html).toContain('data-faq="0"');
  });

  it('renders multiple items with correct indices', () => {
    const html = renderFAQ({
      items: [
        { question: 'Q1', answer: 'A1' },
        { question: 'Q2', answer: 'A2' },
        { question: 'Q3', answer: 'A3' },
      ],
    });
    expect(html).toContain('data-faq="0"');
    expect(html).toContain('data-faq="1"');
    expect(html).toContain('data-faq="2"');
  });

  it('handles empty items', () => {
    const html = renderFAQ({ heading: 'FAQ', items: [] });
    expect(html).toContain('FAQ');
    expect(html).toContain('ef-faq-list');
  });

  it('renders description when provided', () => {
    const html = renderFAQ({ heading: 'FAQ', description: 'Common questions' });
    expect(html).toContain('Common questions');
    expect(html).toContain('ef-faq-desc');
  });
});

describe('renderTestimonials', () => {
  it('renders testimonial cards', () => {
    const html = renderTestimonials({
      heading: 'Reviews',
      items: [{ author: 'Alice', quote: 'Great product!', company: 'Acme', role: 'CEO' }],
    });
    expect(html).toContain('Reviews');
    expect(html).toContain('Alice');
    expect(html).toContain('Great product!');
    expect(html).toContain('CEO @ Acme');
  });

  it('renders avatar placeholder when no avatar URL', () => {
    const html = renderTestimonials({
      items: [{ author: 'Bob', quote: 'Nice' }],
    });
    expect(html).toContain('ef-testimonial-avatar-placeholder');
    expect(html).toContain('B'); // First letter of Bob
  });

  it('renders avatar image when provided', () => {
    const html = renderTestimonials({
      items: [{ author: 'Bob', quote: 'Nice', avatar: '/bob.png' }],
    });
    expect(html).toContain('/bob.png');
    expect(html).not.toContain('ef-testimonial-avatar-placeholder');
  });

  it('handles empty items', () => {
    const html = renderTestimonials({ items: [] });
    expect(html).toContain('ef-testimonials-grid');
  });
});

describe('renderLogos', () => {
  it('renders logo images', () => {
    const html = renderLogos({
      heading: 'Partners',
      items: [{ src: '/logo1.png', alt: 'Company A' }],
    });
    expect(html).toContain('Partners');
    expect(html).toContain('/logo1.png');
    expect(html).toContain('Company A');
  });

  it('wraps in link when URL provided', () => {
    const html = renderLogos({
      items: [{ src: '/logo.png', alt: 'X', url: 'https://x.com' }],
    });
    expect(html).toContain('<a href="https://x.com"');
    expect(html).toContain('target="_blank"');
  });

  it('uses div when no URL', () => {
    const html = renderLogos({
      items: [{ src: '/logo.png', alt: 'X' }],
    });
    expect(html).toContain('<div class="ef-logo-item">');
    expect(html).not.toContain('<a ');
  });
});

describe('renderVideo', () => {
  it('renders YouTube embed', () => {
    const html = renderVideo({ src: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
    expect(html).toContain('youtube.com/embed/dQw4w9WgXcQ');
    expect(html).toContain('ef-video-iframe');
  });

  it('renders YouTube short URL', () => {
    const html = renderVideo({ src: 'https://youtu.be/dQw4w9WgXcQ' });
    expect(html).toContain('youtube.com/embed/dQw4w9WgXcQ');
  });

  it('renders Bilibili embed', () => {
    const html = renderVideo({ src: 'https://www.bilibili.com/video/BV1xx411c7mD' });
    expect(html).toContain('player.bilibili.com');
    expect(html).toContain('BV1xx411c7mD');
  });

  it('renders native video for mp4', () => {
    const html = renderVideo({ src: 'https://example.com/video.mp4' });
    expect(html).toContain('<video');
    expect(html).toContain('ef-video-native');
    expect(html).toContain('video.mp4');
  });

  it('adds autoplay for YouTube', () => {
    const html = renderVideo({ src: 'https://youtu.be/dQw4w9WgXcQ', autoplay: true });
    expect(html).toContain('autoplay=1');
  });

  it('adds autoplay for native video', () => {
    const html = renderVideo({ src: '/v.mp4', autoplay: true });
    expect(html).toContain('autoplay muted');
  });

  it('renders heading and caption', () => {
    const html = renderVideo({ src: '/v.mp4', heading: 'Demo', caption: 'Watch this' });
    expect(html).toContain('Demo');
    expect(html).toContain('Watch this');
  });

  it('handles empty src', () => {
    const html = renderVideo({});
    expect(html).toContain('ef-video-wrap');
    // Should not crash
  });
});

describe('renderCountdown', () => {
  it('renders countdown structure', () => {
    const html = renderCountdown({
      heading: 'Launch',
      targetDate: '2026-12-31T00:00:00',
      expiredMessage: 'Launched!',
    });
    expect(html).toContain('Launch');
    expect(html).toContain('2026-12-31T00:00:00');
    expect(html).toContain('Launched!');
    expect(html).toContain('data-cd="days"');
    expect(html).toContain('data-cd="hours"');
  });

  it('uses custom labels', () => {
    const html = renderCountdown({
      targetDate: '2026-01-01',
      labels: { days: 'Dias', hours: 'Horas', minutes: 'Min', seconds: 'Seg' },
    });
    expect(html).toContain('Dias');
    expect(html).toContain('Horas');
    expect(html).toContain('Min');
    expect(html).toContain('Seg');
  });

  it('uses default labels', () => {
    const html = renderCountdown({ targetDate: '2026-01-01' });
    expect(html).toContain('Days');
    expect(html).toContain('Hours');
    expect(html).toContain('Min');
    expect(html).toContain('Sec');
  });
});

describe('renderFormField', () => {
  it('renders text input', () => {
    const html = renderFormField({ id: 'name', type: 'text', label: 'Name', required: true, placeholder: 'Your name' });
    expect(html).toContain('type="text"');
    expect(html).toContain('Name');
    expect(html).toContain('ef-req');
    expect(html).toContain('placeholder="Your name"');
    expect(html).toContain('required');
  });

  it('renders textarea', () => {
    const html = renderFormField({ id: 'msg', type: 'textarea', label: 'Message' });
    expect(html).toContain('<textarea');
    expect(html).toContain('ef-textarea');
  });

  it('renders select with options', () => {
    const html = renderFormField({ id: 'reason', type: 'select', label: 'Reason', options: ['A', 'B', 'C'] });
    expect(html).toContain('<select');
    expect(html).toContain('<option value="A">A</option>');
    expect(html).toContain('<option value="B">B</option>');
    expect(html).toContain('<option value="C">C</option>');
  });

  it('renders checkbox group', () => {
    const html = renderFormField({ id: 'tags', type: 'checkbox', options: ['X', 'Y'] });
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('ef-check-group');
    expect(html).toContain('value="X"');
    expect(html).toContain('value="Y"');
  });

  it('renders radio group', () => {
    const html = renderFormField({ id: 'choice', type: 'radio', options: ['Yes', 'No'] });
    expect(html).toContain('type="radio"');
    expect(html).toContain('value="Yes"');
    expect(html).toContain('value="No"');
  });

  it('renders email input', () => {
    const html = renderFormField({ id: 'email', type: 'email', label: 'Email' });
    expect(html).toContain('type="email"');
  });

  it('applies width class', () => {
    const html = renderFormField({ id: 'x', type: 'text', width: 'half' });
    expect(html).toContain('ef-field-half');
  });

  it('defaults to full width', () => {
    const html = renderFormField({ id: 'x', type: 'text' });
    expect(html).toContain('ef-field-full');
  });
});

describe('renderFormFields', () => {
  it('wraps fields in grid', () => {
    const html = renderFormFields([
      { id: 'a', type: 'text', label: 'A' },
      { id: 'b', type: 'text', label: 'B' },
    ]);
    expect(html).toContain('ef-form-grid');
    expect(html).toContain('A');
    expect(html).toContain('B');
  });
});

describe('renderMultiStepForm', () => {
  it('renders steps with fields', () => {
    const html = renderMultiStepForm({
      steps: [
        { label: 'Step 1', fieldIds: ['q1'] },
        { label: 'Step 2', fieldIds: ['q2'] },
      ],
      fields: [
        { id: 'q1', type: 'text', label: 'Question 1' },
        { id: 'q2', type: 'textarea', label: 'Question 2' },
      ],
    });
    expect(html).toContain('Step 1');
    expect(html).toContain('Step 2');
    expect(html).toContain('Question 1');
    expect(html).toContain('Question 2');
    expect(html).toContain('ef-step-progress');
    expect(html).toContain('ef-step-nav');
  });

  it('first step is active', () => {
    const html = renderMultiStepForm({
      steps: [{ label: 'S1', fieldIds: [] }, { label: 'S2', fieldIds: [] }],
      fields: [],
    });
    expect(html).toContain('class="ef-step active"');
    // Second step should not be active
    const steps = html.match(/class="ef-step(?:\s[^"]*)?"/g)?.filter(s => !s.includes('progress') && !s.includes('header') && !s.includes('nav')) || [];
    expect(steps[0]).toContain('active');
    expect(steps[1]).not.toContain('active');
  });

  it('returns empty string when no steps', () => {
    expect(renderMultiStepForm({ fields: [] })).toBe('');
    expect(renderMultiStepForm({ steps: [], fields: [] })).toBe('');
  });
});
