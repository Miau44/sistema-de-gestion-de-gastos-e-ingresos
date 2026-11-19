import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { createApi } from './presentation/api.js';
import { createServices } from './application/services.js';
import { createRepositories } from './infrastructure/database/repositories.js';
import { swaggerSpec } from './infrastructure/config/swagger.js';

export function createApp({ services, env = process.env } = {}) {
  const resolvedServices = services || createServices({ ...createRepositories(), env });
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(env.NODE_ENV === 'test' ? 'tiny' : 'dev'));
  app.get('/api/v1/health', (_req, res) => res.json({ status: 'OK', message: 'API de Gestor de Gastos activa', proyecto: env.PROJECT_NAME || 'Sistema de gestión de gastos e ingresos' }));
  app.get('/api/v1/info', (_req, res) => res.json({ proyecto: env.PROJECT_NAME || 'Sistema de gestión de gastos e ingresos', autor: env.AUTHOR_NAME || 'Mauricio Gonzalo Morales Fernandez', github: env.AUTHOR_GITHUB || 'https://github.com/Miau44', programa: 'Diplomado en Desarrollo Web Full Stack', version: '2.0.0' }));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use('/api/v1', createApi(resolvedServices, env));
  app.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } }));
  app.use((error, _req, res, _next) => {
    if (error?.code === 11000) return res.status(409).json({ error: { code: 'DUPLICATE_RESOURCE', message: 'El recurso ya existe' } });
    const status = Number(error.status || error.statusCode || 500);
    if (status >= 500) console.error(error);
    res.status(status).json({ error: { code: error.code || 'INTERNAL_ERROR', message: status >= 500 ? 'Error interno del servidor' : error.message } });
  });
  return app;
}

const app = createApp();
export default app;
