import path from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
  css: { postcss: { plugins: [tailwindcss()] } },
  publicDir: 'public',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    copyPublicDir: true,
    minify: 'esbuild',
    lib: {
      entry: path.resolve(__dirname, 'static/main.tsx'),
      name: 'MyLog',
      formats: ['iife'],
      fileName: () => 'mylog.js',
      cssFileName: 'mylog',
    },
  },
});
