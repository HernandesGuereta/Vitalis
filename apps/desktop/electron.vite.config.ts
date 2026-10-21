import { defineConfig } from 'electron-vite';

export default defineConfig({
  main: {},
  renderer: {
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
    },
  },
});
