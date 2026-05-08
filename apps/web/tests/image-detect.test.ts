import { describe, it, expect } from 'vitest';
import { detectImageType } from '../src/lib/image-detect';

// Helpers — fabricate just enough header bytes for the detector
function bytes(...nums: number[]) { return new Uint8Array(nums); }
function pad(arr: Uint8Array, totalLen: number) {
  const out = new Uint8Array(Math.max(arr.length, totalLen));
  out.set(arr);
  return out;
}

describe('detectImageType — magic-number sniff', () => {
  it('recognises PNG signature', () => {
    const png = pad(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a), 16);
    expect(detectImageType(png)).toBe('image/png');
  });

  it('recognises JPEG (FF D8 FF) signature', () => {
    const jpeg = pad(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46), 16);
    expect(detectImageType(jpeg)).toBe('image/jpeg');
  });

  it('recognises GIF signature', () => {
    const gif87 = pad(bytes(0x47, 0x49, 0x46, 0x38, 0x37, 0x61), 16);
    const gif89 = pad(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61), 16);
    expect(detectImageType(gif87)).toBe('image/gif');
    expect(detectImageType(gif89)).toBe('image/gif');
  });

  it('recognises WebP RIFF signature', () => {
    const webp = bytes(
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      0x00, 0x00, 0x00, 0x00, // file size (placeholder)
      0x57, 0x45, 0x42, 0x50, // "WEBP"
    );
    expect(detectImageType(webp)).toBe('image/webp');
  });

  it('recognises SVG with <?xml prelude', () => {
    const svg = new TextEncoder().encode('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(detectImageType(svg)).toBe('image/svg+xml');
  });

  it('recognises SVG starting directly with <svg', () => {
    const svg = new TextEncoder().encode('<svg width="10" height="10"></svg>');
    expect(detectImageType(svg)).toBe('image/svg+xml');
  });

  it('recognises SVG after BOM + leading whitespace', () => {
    const head = new Uint8Array([0xef, 0xbb, 0xbf, 0x20, 0x0a]);
    const tail = new TextEncoder().encode('<svg></svg>');
    const all = new Uint8Array(head.length + tail.length);
    all.set(head); all.set(tail, head.length);
    expect(detectImageType(all)).toBe('image/svg+xml');
  });

  it('rejects too-short buffers', () => {
    expect(detectImageType(bytes(0x89, 0x50, 0x4e))).toBeNull();
  });

  it('rejects HTML masquerading as PNG via filename', () => {
    // Real bytes: <html>...
    const fake = new TextEncoder().encode('<html><body>not an image</body></html>');
    expect(detectImageType(fake)).toBeNull();
  });

  it('rejects executable bytes', () => {
    // ELF magic
    const elf = pad(bytes(0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00), 16);
    expect(detectImageType(elf)).toBeNull();
    // PE / .exe
    const exe = pad(bytes(0x4d, 0x5a, 0x90, 0x00), 16);
    expect(detectImageType(exe)).toBeNull();
  });

  it('rejects PDF (which the upload route does not allow)', () => {
    const pdf = pad(bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34), 16);
    expect(detectImageType(pdf)).toBeNull();
  });
});
