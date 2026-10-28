import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El proxy hace que el frontend y la API compartan origen (cookie de sesión)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/auth': 'http://localhost:3000',
    },
  },
});
