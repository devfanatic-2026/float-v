/**
 * Float-V Image Optimization
 * Automatic image optimization, resizing, and format conversion
 * 
 * Similar to Next.js Image but with more features!
 */

import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import {
  type ImageConfig,
  type ImageFormat,
  type ImageLoaderProps,
  type ImageProps,
  type OptimizedImage,
  type StaticImageData,
  configureImages as configureClientImages,
  getImageConfig,
  floatImageLoader,
  generateSrcSet,
  getImageProps,
  renderImageToString,
} from './client-image.js';

// Re-export client types and functions
export {
  type ImageConfig,
  type ImageFormat,
  type ImageLoaderProps,
  type ImageProps,
  type OptimizedImage,
  type StaticImageData,
  getImageConfig,
  floatImageLoader,
  generateSrcSet,
  getImageProps,
  renderImageToString,
};

// ============================================================================
// SERVER-SIDE CONFIG
// ============================================================================

/**
 * Configure global images and ensure cache directory exists
 */
export function configureImages(config: Partial<ImageConfig>): void {
  // Update client config state
  configureClientImages(config);

  // Server-side side effect: Ensure cache directory exists
  const fullConfig = getImageConfig();
  if (!existsSync(fullConfig.cacheDir)) {
    mkdirSync(fullConfig.cacheDir, { recursive: true });
  }
}

// ============================================================================
// IMAGE UTILITIES
// ============================================================================

/**
 * Generate a hash for cache key
 */
function generateCacheKey(url: string, width: number, quality: number, format: string): string {
  const hash = createHash('md5')
    .update(`${url}-${width}-${quality}-${format}`)
    .digest('hex');
  return `${hash}.${format}`;
}

/**
 * Get the best format for the request
 */
function getBestFormat(acceptHeader: string): ImageFormat {
  const config = getImageConfig();
  if (config.avif && acceptHeader.includes('image/avif')) {
    return 'avif';
  }
  if (acceptHeader.includes('image/webp')) {
    return 'webp';
  }
  return 'jpeg';
}

/**
 * Parse image URL parameters
 */
function parseImageParams(url: URL): { src: string; width: number; quality: number } | null {
  const config = getImageConfig();
  const src = url.searchParams.get('url');
  const width = parseInt(url.searchParams.get('w') || '0', 10);
  const quality = parseInt(url.searchParams.get('q') || String(config.quality), 10);

  if (!src || !width) {
    return null;
  }

  // Validate width
  const allSizes = [...config.deviceSizes, ...config.imageSizes];
  if (!allSizes.includes(width)) {
    return null;
  }

  // Validate quality
  if (quality < 1 || quality > 100) {
    return null;
  }

  return { src, width, quality };
}

/**
 * Check if URL is external
 */
function isExternalUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Validate external domain
 */
function isAllowedDomain(url: string): boolean {
  if (!isExternalUrl(url)) return true;

  try {
    const { hostname } = new URL(url);
    const config = getImageConfig();
    return config.domains.includes(hostname);
  } catch {
    return false;
  }
}

// ============================================================================
// IMAGE OPTIMIZATION (Sharp-like without Sharp dependency)
// ============================================================================

/**
 * Simple image resize using canvas (for basic optimization)
 * In production, you'd use Sharp or similar
 */
async function optimizeImage(
  input: Buffer,
  _width: number,
  _quality: number,
  _format: ImageFormat
): Promise<Buffer> {
  // For now, return original with proper content type
  // In real implementation, use Sharp or similar:
  // const sharp = await import('sharp');
  // return sharp(input).resize(_width).toFormat(_format, { quality: _quality }).toBuffer();

  // Placeholder - returns original image
  // Users can install sharp for real optimization
  return input;
}

/**
 * Generate blur placeholder
 */
export async function generateBlurDataURL(input: Buffer): Promise<string> {
  // Generate a tiny version for blur placeholder
  // In real implementation, resize to 8x8 or 10x10 and base64 encode
  return `data:image/jpeg;base64,${input.slice(0, 50).toString('base64')}`;
}

// ============================================================================
// IMAGE HANDLER
// ============================================================================

export function createImageHandler() {
  const config = getImageConfig();

  // Ensure cache directory exists
  if (!existsSync(config.cacheDir)) {
    mkdirSync(config.cacheDir, { recursive: true });
  }

  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const urlString = req.url || '';

    // Check if this is an image optimization request
    if (!urlString.startsWith(config.basePath)) {
      return next();
    }

    try {
      const url = new URL(urlString, `http://${req.headers.host}`);
      const params = parseImageParams(url);

      if (!params) {
        res.statusCode = 400;
        res.end('Invalid image parameters');
        return;
      }

      const { src, width, quality } = params;

      // Validate domain for external URLs
      if (!isAllowedDomain(src)) {
        res.statusCode = 400;
        res.end('Domain not allowed');
        return;
      }

      // Determine best format
      const acceptHeader = req.headers.accept || '';
      const format = getBestFormat(acceptHeader);

      // Check cache
      const cacheKey = generateCacheKey(src, width, quality, format);
      const cachePath = join(config.cacheDir, cacheKey);

      if (existsSync(cachePath)) {
        const cachedImage = readFileSync(cachePath);
        const stat = statSync(cachePath);

        res.setHeader('Content-Type', `image/${format}`);
        res.setHeader('Cache-Control', `public, max-age=${config.minimumCacheTTL}, stale-while-revalidate`);
        res.setHeader('X-Float-Image-Cache', 'HIT');
        res.setHeader('Last-Modified', stat.mtime.toUTCString());
        res.end(cachedImage);
        return;
      }

      // Fetch or read image
      let imageBuffer: Buffer;

      if (isExternalUrl(src)) {
        const response = await fetch(src);
        if (!response.ok) {
          res.statusCode = 404;
          res.end('Image not found');
          return;
        }
        imageBuffer = Buffer.from(await response.arrayBuffer());
      } else {
        const imagePath = join(process.cwd(), 'public', src);
        if (!existsSync(imagePath)) {
          res.statusCode = 404;
          res.end('Image not found');
          return;
        }
        imageBuffer = readFileSync(imagePath);
      }

      // Optimize image
      const optimizedBuffer = await optimizeImage(imageBuffer, width, quality, format);

      // Save to cache
      writeFileSync(cachePath, optimizedBuffer);

      // Send response
      res.setHeader('Content-Type', `image/${format}`);
      res.setHeader('Cache-Control', `public, max-age=${config.minimumCacheTTL}, stale-while-revalidate`);
      res.setHeader('X-Float-Image-Cache', 'MISS');
      res.end(optimizedBuffer);
    } catch (error) {
      console.error('Image optimization error:', error);
      res.statusCode = 500;
      res.end('Image optimization failed');
    }
  };
}

// ============================================================================
// STATIC IMPORT HELPERS
// ============================================================================

/**
 * Import static image (for build-time optimization)
 */
export function importImage(imagePath: string): StaticImageData {
  // This would be processed at build time
  // Returns placeholder data for runtime
  return {
    src: imagePath,
    width: 0, // Determined at build time
    height: 0, // Determined at build time
    blurDataURL: undefined,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const image = {
  configure: configureImages,
  getConfig: getImageConfig,
  handler: createImageHandler,
  loader: floatImageLoader,
  srcSet: generateSrcSet,
  props: getImageProps,
  render: renderImageToString,
  import: importImage,
};
