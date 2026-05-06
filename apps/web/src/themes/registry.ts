/**
 * Theme Registry — all themes register here.
 *
 * To add a new theme:
 * 1. Create themes/{name}/index.ts (implements ThemeDefinition)
 * 2. Create themes/{name}/style.css
 * 3. Import and add to this registry
 * 4. Import the CSS in SiteEngine.astro
 *
 * That's it. No engine code changes needed.
 */

import type { ThemeDefinition } from './types';
import { glass } from './glass/index';
import { terminal } from './terminal/index';
import { brutal } from './brutal/index';
import { minimal } from './minimal/index';
import { retro } from './retro/index';
import { light } from './light/index';
import { soft } from './soft/index';

const allThemes: ThemeDefinition[] = [glass, terminal, brutal, minimal, retro, light, soft];

/** Map of theme name → ThemeDefinition */
export const themeRegistry: Record<string, ThemeDefinition> = {};
for (const t of allThemes) {
  themeRegistry[t.name] = t;
}

/** Ordered list of all registered theme names */
export const themeNames: string[] = allThemes.map(t => t.name);

/** Get a theme by name, fallback to glass */
export function getTheme(name: string): ThemeDefinition {
  return themeRegistry[name] || themeRegistry['glass'] || allThemes[0];
}
