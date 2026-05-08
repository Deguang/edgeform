/**
 * Inspect actual upload bytes to identify the image format. Clients may lie
 * about the declared MIME type — only trust what the bytes say.
 *
 * Recognises PNG / JPEG / GIF / WebP (RIFF) / SVG. Returns the canonical MIME
 * type, or null if the bytes don't match any supported format.
 */

export function detectImageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  // GIF: 47 49 46 38 (37|39) 61
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif';
  // WebP: RIFF .... WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp';

  // SVG: text starting (after optional BOM + whitespace) with <?xml ... <svg or <svg.
  let i = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) i = 3;
  while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d)) i++;
  const head = new TextDecoder().decode(bytes.slice(i, Math.min(bytes.length, i + 256))).toLowerCase();
  if (head.startsWith('<?xml') && head.includes('<svg')) return 'image/svg+xml';
  if (head.startsWith('<svg')) return 'image/svg+xml';
  return null;
}
