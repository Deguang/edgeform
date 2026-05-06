/**
 * Theme Contract — every theme implements this interface.
 * A theme is a set of block renderers (HTML generators) + a CSS string.
 * The engine calls renderBlock(block) and injects the CSS. That's it.
 */

export type BlockRenderer = (block: any) => string;

export interface ThemeDefinition {
  /** Unique theme ID, matches the schema's theme name */
  name: string;
  /** Display label for the switcher pill */
  label: string;
  /** CSS class prefix applied to the page (ef-t-{name}) */
  cssClass: string;
  /** Block renderers keyed by block type */
  blocks: Record<string, BlockRenderer>;
}
