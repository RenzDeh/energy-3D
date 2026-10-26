import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import glsl from 'vite-plugin-glsl'
import { templateCompilerOptions } from '@tresjs/core'

// Energy-Charts staat geen browserverzoeken van andere sites toe (CORS),
// daarom halen de dev- en preview-server de stroomprijzen op en geven ze door.
const proxy = {
  '/api/energy-charts': {
    target: 'https://api.energy-charts.info',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/energy-charts/, ''),
  },
}

// https://vitejs.dev/config/
export default defineConfig({
  server: { proxy },
  preview: { proxy },
  plugins: [
    vue({
      ...templateCompilerOptions,
    }),
    glsl(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three/')) return 'three'
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['vue', 'three'],
  },
})