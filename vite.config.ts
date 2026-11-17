import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    // スマートフォン実機から同一LANで開けるようにする
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
  },
});
