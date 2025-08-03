import { defineConfig } from 'vite'
import path from 'path'
import dts from 'vite-plugin-dts'

/**
 * Config for the NPM package
 */
export default defineConfig({
  plugins: [dts({ insertTypesEntry: true })],
  publicDir: false,
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/threejs-cannones-rigger.ts'),
      name: 'ThreeJsCannonesRigger',
      formats: ['es', 'cjs'],
      fileName: "threejs-cannones-rigger",
    },
    rollupOptions: {
      external: ['three', 'cannon-es','threejs-cannones-tube'],
      output: {
        globals: {
          three: 'THREE',
          'cannon-es': 'CANNON' 
        }
      }
    } 
  },
    server: {
    host: "0.0.0.0",
    port: 5173, 
  }
})
