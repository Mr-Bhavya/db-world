import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'node:fs'
import os from 'node:os'

const localMediaPlugin = (files) => ({
  name: 'dbworld-local-player-media',
  configureServer(server) {
    Object.entries(files).forEach(([route, value]) => server.middlewares.use(route, (req, res) => {
      const { filePath, contentType } = value
      if (!fs.existsSync(filePath)) {
        res.statusCode = 404
        res.end('Local player sample not found')
        return
      }

      const size = fs.statSync(filePath).size
      const range = req.headers.range
      const match = typeof range === 'string' && /^bytes=(\d*)-(\d*)$/.exec(range)
      if (match) {
        const start = match[1] ? Number(match[1]) : 0
        const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1
        if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
          res.statusCode = 416
          res.setHeader('Content-Range', `bytes */${size}`)
          res.end()
          return
        }
        res.statusCode = 206
        res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
        res.setHeader('Content-Length', end - start + 1)
        res.setHeader('Content-Type', contentType)
        res.setHeader('Accept-Ranges', 'bytes')
        if (req.method === 'HEAD') res.end()
        else fs.createReadStream(filePath, { start, end }).pipe(res)
        return
      }

      res.statusCode = 200
      res.setHeader('Content-Type', contentType)
      res.setHeader('Content-Length', size)
      res.setHeader('Accept-Ranges', 'bytes')
      if (req.method === 'HEAD') res.end()
      else fs.createReadStream(filePath).pipe(res)
    }))
  },
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const localPlayerMedia = env.VITE_LOCAL_PLAYER_MEDIA
    || path.join(os.homedir(), 'Downloads', 'db', 'sample.mkv')
  const localWebMedia = env.VITE_LOCAL_PLAYER_WEB_MEDIA
    || path.join(os.homedir(), 'Downloads', 'db', 'sample-web.mp4')

  return {
    plugins: [react(), localMediaPlugin({
      '/__local-player-media/sample.mkv': { filePath: localPlayerMedia, contentType: 'video/x-matroska' },
      '/__local-player-media/sample.mp4': { filePath: localWebMedia, contentType: 'video/mp4' },
    })],

    // Vitest — code coverage via V8. The lcov report (db-world-frontend/coverage/lcov.info)
    // feeds SonarCloud; `text` prints a summary locally. Run with `npm run test:coverage`.
    test: {
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        reportsDirectory: './coverage',
        exclude: [
          '**/*.{test,spec}.{js,jsx}',
          '**/__tests__/**',
          '**/*.config.js',
          'dist/**',
          'android/**',
          'src/main.jsx',
        ],
      },
    },

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

        // The public site's editorial copy, shared with the backend.
        //
        // It lives in backend resources because SeoRenderController serves the same
        // words to crawlers from the classpath, and dynamic rendering is only
        // legitimate while both sides say the same thing — two copies would drift
        // within a release and make it cloaking. Imported (not fetched), so it is
        // inlined at build time and costs no request.
        //
        // Every CI job runs a full `actions/checkout` and only sets
        // `working-directory`, so the sibling directory is always present.
        '@content':  path.resolve(__dirname, '../db-world-backend/src/main/resources/site-content.json'),
      },
    },

    server: {
      host: true,   // bind 0.0.0.0 → reachable from other devices on the same network
      port: 3000,
      // @content resolves outside the Vite root, which the dev server blocks by
      // default. Allow the repo root so `npm run dev` can serve it; the production
      // build inlines the JSON and never consults this.
      fs: { allow: [path.resolve(__dirname, '..')] },
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
