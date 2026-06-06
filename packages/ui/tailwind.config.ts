import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}', './stories/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Kerry brand palette mapped to Tailwind semantic names
        brand: 'var(--valentia-slate)',
        'brand-deep': 'var(--forest)',
        'bg-paper': 'var(--stone)',
      },
      fontFamily: {
        sans: ['Noto Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
