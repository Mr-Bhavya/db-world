import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],

    // Emit Web Workers as ES modules so the pdf.js worker bundles to a .js chunk (served with a
    // correct JS MIME by the Capacitor WebView — .mjs is not, which silently breaks the worker).
    worker: { format: 'es' },

    // Shim process.env for any legacy code or third-party libs that reference it
    define: {
      'process.env': {},
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
    },

    // Treat .js files containing JSX as JSX (esbuild loader)
    esbuild: {
      loader: 'jsx',
      include: /src\/.*\.[jt]sx?$/,
      exclude: [],
    },

    resolve: {
      alias: {
        '@app':      path.resolve(__dirname, './src/app'),
        '@features': path.resolve(__dirname, './src/features'),
        '@shared':   path.resolve(__dirname, './src/shared'),
        '@assets':   path.resolve(__dirname, './src/assets'),
        '@platform': path.resolve(__dirname, './src/platform'),
        '@styles':   path.resolve(__dirname, './src/styles'),
      },
    },

    server: {
      host: true,   // bind 0.0.0.0 → reachable from other devices on the same network
      port: 3000,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL,
          changeOrigin: true,
        },
      },
    },

    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor:  ['react', 'react-dom', 'react-router-dom'],
            mui:     ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
            grid:    ['@mui/x-data-grid'],
          },
        },
      },
    },

    optimizeDeps: {
      esbuildOptions: {
        loader: {
          '.js': 'jsx',
        },
      },
      include: ['react', 'react-dom', 'react-router-dom', '@mui/material'],
    },
  }
})
