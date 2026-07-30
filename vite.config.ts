import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const FORBIDDEN_PUBLIC_AUTHORITY =
  /(?:TOKEN|SECRET|API_BASE|ANONYMOUS|PRIMARY|REFRESH)/i

export function assertWinkBuildEnvironment(
  mode: string,
  env: Record<string, string | undefined>,
) {
  const exposedAuthority = Object.keys(env).find(
    (key) => key.startsWith('VITE_') && FORBIDDEN_PUBLIC_AUTHORITY.test(key),
  )

  if (exposedAuthority) {
    throw new Error(
      `Wink public authority input is forbidden: ${exposedAuthority}`,
    )
  }

  const offlineMode = env.VITE_WINK_OFFLINE_MODE
  if (offlineMode !== undefined && !['true', 'false', ''].includes(offlineMode)) {
    throw new Error('VITE_WINK_OFFLINE_MODE must be true or false')
  }
  if (offlineMode === 'true' && mode !== 'development') {
    throw new Error('Wink offline mode is development-only')
  }
}

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  assertWinkBuildEnvironment(mode, {
    ...process.env,
    ...loadEnv(mode, process.cwd(), 'VITE_'),
  })

  return {
    plugins: [
      figmaAssetResolver(),
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used – do not remove them
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
    },

    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined

            if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
              return 'react-vendor'
            }

            if (id.includes('/pixi.js/')) {
              return 'pixi-vendor'
            }

            if (id.includes('/lucide-react/') || id.includes('/tw-animate-css/')) {
              return 'ui-vendor'
            }

            return 'vendor'
          },
        },
      },
    },
  }
})
