import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

/*
  This config REPLACES vite.config.js rather than extending it, so anything the
  app build relies on has to be repeated here or it silently does not apply.

  The react plugin is the case that bit: without it, esbuild falls back to the
  classic JSX transform and every component compiles to `React.createElement`,
  which throws "React is not defined" the moment one is rendered. That went
  unnoticed while no test rendered anything — the pure-logic tests import JSX
  modules without ever evaluating their JSX.

  `environment: 'node'` stays the default because it is much faster and almost
  every test here is a pure function. The one file that needs a DOM opts in with
  a `// @vitest-environment jsdom` docblock, so only that file pays for it.
*/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
})
