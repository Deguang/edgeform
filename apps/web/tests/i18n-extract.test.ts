import { describe, it, expect } from 'vitest';
import { extractTexts, translateBlock } from '../src/lib/i18n-extract';

describe('extractTexts', () => {
  it('extracts title and description from config', () => {
    const config = { title: 'My Site', description: 'A great site', pages: [] };
    const texts = extractTexts(config);
    expect(texts).toContain('My Site');
    expect(texts).toContain('A great site');
  });

  it('extracts hero block texts', () => {
    const config = {
      title: 'Site',
      pages: [{ blocks: [{ type: 'hero', title: 'Hello', subtitle: 'World', cta: { label: 'Click me' } }] }],
    };
    const texts = extractTexts(config);
    expect(texts).toContain('Hello');
    expect(texts).toContain('World');
    expect(texts).toContain('Click me');
  });

  it('extracts form block texts including fields and options', () => {
    const config = {
      title: 'Survey',
      pages: [{
        blocks: [{
          type: 'form',
          heading: 'Feedback',
          submitLabel: 'Send',
          successMessage: 'Thanks!',
          fields: [
            { id: 'q1', label: 'Reason', placeholder: 'Select one', options: ['Too slow', 'Not useful'] },
            { id: 'q2', label: 'Comments' },
          ],
          steps: [{ label: 'Step 1' }],
        }],
      }],
    };
    const texts = extractTexts(config);
    expect(texts).toContain('Feedback');
    expect(texts).toContain('Send');
    expect(texts).toContain('Thanks!');
    expect(texts).toContain('Reason');
    expect(texts).toContain('Select one');
    expect(texts).toContain('Too slow');
    expect(texts).toContain('Not useful');
    expect(texts).toContain('Comments');
    expect(texts).toContain('Step 1');
  });

  it('extracts faq block texts', () => {
    const config = {
      title: 'FAQ',
      pages: [{ blocks: [{ type: 'faq', heading: 'Questions', items: [{ question: 'Why?', answer: 'Because.' }] }] }],
    };
    const texts = extractTexts(config);
    expect(texts).toContain('Questions');
    expect(texts).toContain('Why?');
    expect(texts).toContain('Because.');
  });

  it('extracts pricing block texts', () => {
    const config = {
      title: 'Pricing',
      pages: [{
        blocks: [{
          type: 'pricing', heading: 'Plans',
          plans: [{ name: 'Free', price: '$0', description: 'Basic', features: ['1 user', '10 GB'], cta: { label: 'Start' } }],
        }],
      }],
    };
    const texts = extractTexts(config);
    expect(texts).toContain('Plans');
    expect(texts).toContain('Free');
    expect(texts).toContain('$0');
    expect(texts).toContain('Basic');
    expect(texts).toContain('1 user');
    expect(texts).toContain('10 GB');
    expect(texts).toContain('Start');
  });

  it('extracts countdown block texts with labels', () => {
    const config = {
      title: 'Launch',
      pages: [{ blocks: [{ type: 'countdown', heading: 'Coming Soon', expiredMessage: 'Launched!', labels: { days: 'Days', hours: 'Hrs' } }] }],
    };
    const texts = extractTexts(config);
    expect(texts).toContain('Coming Soon');
    expect(texts).toContain('Launched!');
    expect(texts).toContain('Days');
    expect(texts).toContain('Hrs');
  });

  it('deduplicates strings', () => {
    const config = {
      title: 'Same',
      description: 'Same',
      pages: [{ blocks: [{ type: 'hero', title: 'Same', subtitle: 'Same' }] }],
    };
    const texts = extractTexts(config);
    expect(texts.filter(t => t === 'Same').length).toBe(1);
  });

  it('skips empty/whitespace strings', () => {
    const config = {
      title: '',
      description: '   ',
      pages: [{ blocks: [{ type: 'hero', title: '', subtitle: null }] }],
    };
    const texts = extractTexts(config);
    expect(texts.length).toBe(0);
  });

  it('handles missing pages gracefully', () => {
    const config = { title: 'Empty' };
    const texts = extractTexts(config);
    expect(texts).toContain('Empty');
  });
});

describe('translateBlock', () => {
  const mockT = (s: string) => `[${s}]`; // Wrap in brackets as "translation"

  it('translates hero block fields', () => {
    const block = { type: 'hero', title: 'Hello', subtitle: 'World', cta: { label: 'Go' } };
    const result = translateBlock(block, mockT);
    expect(result.title).toBe('[Hello]');
    expect(result.subtitle).toBe('[World]');
    expect(result.cta.label).toBe('[Go]');
  });

  it('does not mutate original block', () => {
    const block = { type: 'hero', title: 'Hello' };
    translateBlock(block, mockT);
    expect(block.title).toBe('Hello');
  });

  it('translates form fields and options', () => {
    const block = {
      type: 'form', heading: 'Survey', submitLabel: 'Send',
      fields: [{ id: 'q1', label: 'Reason', options: ['A', 'B'] }],
    };
    const result = translateBlock(block, mockT);
    expect(result.heading).toBe('[Survey]');
    expect(result.submitLabel).toBe('[Send]');
    expect(result.fields[0].label).toBe('[Reason]');
    expect(result.fields[0].options).toEqual(['[A]', '[B]']);
  });

  it('translates faq items', () => {
    const block = { type: 'faq', heading: 'FAQ', items: [{ question: 'Q?', answer: 'A.' }] };
    const result = translateBlock(block, mockT);
    expect(result.heading).toBe('[FAQ]');
    expect(result.items[0].question).toBe('[Q?]');
    expect(result.items[0].answer).toBe('[A.]');
  });

  it('translates features items', () => {
    const block = { type: 'features', heading: 'Why', items: [{ title: 'Fast', description: 'Very fast', tag: 'NEW' }] };
    const result = translateBlock(block, mockT);
    expect(result.heading).toBe('[Why]');
    expect(result.items[0].title).toBe('[Fast]');
    expect(result.items[0].description).toBe('[Very fast]');
    expect(result.items[0].tag).toBe('[NEW]');
  });

  it('translates text block', () => {
    const block = { type: 'text', content: 'Hello world' };
    const result = translateBlock(block, mockT);
    expect(result.content).toBe('[Hello world]');
  });

  it('handles blocks with missing optional fields', () => {
    const block = { type: 'hero' };
    const result = translateBlock(block, mockT);
    expect(result.title).toBeUndefined();
    expect(result.subtitle).toBeUndefined();
  });
});
