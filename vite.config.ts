import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import sass from 'sass';

export default defineConfig({
 plugins: [react()],
 server: {
   proxy: {
     '/api': { target: 'http://localhost:3001', changeOrigin: true },
   },
 },
 css: {
   preprocessorOptions: {
    scss: {
      implementation: sass,
    },
   },
 },
});
