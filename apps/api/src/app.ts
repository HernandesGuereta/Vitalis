import express from 'express';

export const app = express();

app.disable('x-powered-by');
app.use(express.json());

// As rotas e regras de negócio serão adicionadas nas próximas etapas.
