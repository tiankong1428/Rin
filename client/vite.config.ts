import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { visualizer } from "rollup-plugin-visualizer";
import copy from "rollup-plugin-copy";

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  const serverPort = Number(process.env.RIN_SERVER_PORT || "11499");
  const serverTarget = `http://127.0.0.1:${serverPort}`;
  const cacheDir = process.env.RIN_VITE_CACHE_DIR || "../.vite/client";
  
  return {
    base: "/",
    cacheDir,
    build: {
      outDir: '../dist/client',
      emptyOutDir: true,
    },
    plugins: [
      react(),
      visualizer({ open: !isDev }),
      // 👇 就是缺了这一段，之前只 import 了没在 plugins 里用
      copy({
  hook: "closeBundle",
  targets: [
    {
      src: "node_modules/vditor/dist/**/*",
      dest: "../dist/client/assets/vditor/dist"
    }
  ]
})
    ],
    server: {
      proxy: {
        "/api": { target: serverTarget, changeOrigin: false },
        "/rss.xml": { target: serverTarget, changeOrigin: false },
        "/atom.xml": { target: serverTarget, changeOrigin: false },
        "/rss.json": { target: serverTarget, changeOrigin: false },
        "/feed.json": { target: serverTarget, changeOrigin: false },
        "/feed.xml": { target: serverTarget, changeOrigin: false },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
    },
  }
})