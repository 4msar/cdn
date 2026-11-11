import { defineConfig } from 'vite'
import cdnPages from './build/plugin.mjs'

export default defineConfig({
  plugins: [cdnPages()],
  build: {
    rollupOptions: {
      input: { main: 'index.html', font: 'font.html' },
    },
  },
})
