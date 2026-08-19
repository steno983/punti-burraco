import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    // jsdom per tutti i test: serve a storage e interfaccia, e non disturba il motore.
    environment: 'jsdom',
  },
})
