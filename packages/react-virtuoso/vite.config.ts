import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { defineConfig } from 'vitest/config'

const ext = {
  cjs: 'cjs',
  es: 'mjs',
}

const inLadle = process.env.LADLE !== undefined

// https://vitejs.dev/config/
export default inLadle
  ? defineConfig({
      plugins: [react()],
    })
  : defineConfig({
      build: {
        lib: {
          entry: ['src/index.tsx'],
          //@ts-expect-error not sure why
          fileName: (format) => `index.${ext[format]}`,
          formats: ['es', 'cjs'],
        },
        minify: true,
        rollupOptions: {
          external: ['react', 'react-dom', 'react/jsx-runtime'],
        },
        target: ['es2022', 'edge109', 'firefox115', 'chrome109', 'safari16'],
      },
      plugins: [react(), dts({ rollupTypes: true })],
      test: {
        environment: 'jsdom',
        include: ['test/**/*.test.{ts,tsx}'],
      },
    })
