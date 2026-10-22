import { defineConfig } from 'electron-vite';
import { loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const envDir = fileURLToPath(new URL('../../', import.meta.url));
  const env = loadEnv(mode, envDir, 'VITE_API_URL');
  const url = new URL(env.VITE_API_URL || 'http://127.0.0.1:3000');
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error(
      'VITE_API_URL deve conter somente a origem HTTP/HTTPS da API, sem credenciais.',
    );
  return {
    main: {},
    renderer: {
      envDir,
      plugins: [
        {
          name: 'vitalis-api-csp',
          transformIndexHtml: (html) => html.replaceAll('__VITALIS_API_ORIGIN__', url.origin),
        },
      ],
      server: {
        host: '127.0.0.1',
        port: 5173,
        strictPort: true,
      },
    },
  };
});
