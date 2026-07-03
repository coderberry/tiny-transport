import { describe, expect, it } from 'vitest'
import readme from '../../README.md?raw'
import headers from '../../public/_headers?raw'
import redirects from '../../public/_redirects?raw'
import wranglerConfig from '../../wrangler.jsonc?raw'

describe('Cloudflare Pages deployment config', () => {
  it('declares the Vite build output for Pages', () => {
    const config = JSON.parse(wranglerConfig) as {
      name?: string
      pages_build_output_dir?: string
      compatibility_date?: string
    }

    expect(config.name).toBe('tiny-transport')
    expect(config.pages_build_output_dir).toBe('./dist')
    expect(config.compatibility_date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('ships static security and cache headers', () => {
    expect(headers).toContain('/*')
    expect(headers).toContain('X-Content-Type-Options: nosniff')
    expect(headers).toContain('Referrer-Policy: strict-origin-when-cross-origin')
    expect(headers).toContain('/assets/*')
    expect(headers).toContain('Cache-Control: public, max-age=31536000, immutable')
  })

  it('keeps the app routable as a single-page game', () => {
    expect(redirects).toContain('/* /index.html 200')
  })

  it('documents the Cloudflare Pages dashboard settings', () => {
    expect(readme).toContain('Build command: `npm run build`')
    expect(readme).toContain('Build output directory: `dist`')
    expect(readme).toContain('Direct upload: `npx wrangler pages deploy dist --project-name=tiny-transport`')
  })
})
