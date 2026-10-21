import { app } from './app.ts';

const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT deve ser um número inteiro entre 1 e 65535.');
}

app.listen(port, host, () => {
  console.log(`Vitalis API iniciada em http://${host}:${port}`);
});
