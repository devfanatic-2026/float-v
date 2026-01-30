/**
 * Float-V CSS Processing
 * Handles CSS with PostCSS and Tailwind
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkTailwindSetup } from './tailwind-setup.js';

interface CSSProcessResult {
  code: string;
  map?: string;
}

/**
 * Process CSS file with PostCSS and Tailwind
 */
export async function processCSS(
  filePath: string,
  rootDir: string = process.cwd()
): Promise<CSSProcessResult> {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check if project has Tailwind setup
  const tailwindConfig = checkTailwindSetup(rootDir);

  if (!tailwindConfig.hasTailwind) {
    // Return raw CSS if no Tailwind
    return { code: content };
  }

  try {
    // Helper to import packages from the project root
    const importFromRoot = async (pkgName: string) => {
      try {
        // First try standard import
        const m = await import(pkgName);
        return m.default || m;
      } catch (e) {
        // Fallback to resolving from project root
        const { createRequire } = await import('node:module');
        const { pathToFileURL } = await import('node:url');
        const require = createRequire(path.join(rootDir, 'package.json'));
        const pkgPath = require.resolve(pkgName);
        const m = await import(pathToFileURL(pkgPath).href);
        return m.default || m;
      }
    };

    // Dynamic import of PostCSS and Tailwind from the project root
    const postcss = await importFromRoot('postcss');
    const tailwindcss = await importFromRoot('tailwindcss');
    const autoprefixer = await importFromRoot('autoprefixer');

    // Load Tailwind config
    const configPath = tailwindConfig.configPath || path.join(rootDir, 'tailwind.config.js');
    let tailwindConfigModule = {};

    if (fs.existsSync(configPath)) {
      // Use dynamic import for config
      const configUrl = pathToFileURL(configPath);
      tailwindConfigModule = await import(configUrl.href).then(m => m.default || m);
    }

    // Process with PostCSS
    const result = await postcss([
      tailwindcss(tailwindConfigModule),
      autoprefixer(),
    ]).process(content, {
      from: filePath,
      to: filePath,
      map: { inline: false },
    });

    return {
      code: result.css,
      map: result.map?.toString(),
    };
  } catch (error) {
    // If PostCSS/Tailwind not available, return raw CSS
    console.warn('CSS processing failed, serving raw CSS:', error);
    return { code: content };
  }
}

/**
 * Check if CSS file needs processing
 */
export function needsCSSProcessing(filePath: string, rootDir: string): boolean {
  const config = checkTailwindSetup(rootDir);

  // Process if:
  // 1. Project has Tailwind setup
  // 2. File is globals.css or contains @tailwind directives
  if (!config.hasTailwind) {
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return content.includes('@tailwind') || content.includes('@apply');
}

/**
 * Get cache key for processed CSS
 */
export function getCSSCacheKey(filePath: string): string {
  const stats = fs.statSync(filePath);
  return `${filePath}_${stats.mtimeMs}`;
}
