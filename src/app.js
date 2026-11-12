import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';

const app = express();

// Datos editables en el archivo .env local (no se publica en GitHub).
const PROJECT_NAME = process.env.PROJECT_NAME || 'Sistema de gestión de gastos e ingresos';
const AUTHOR_NAME = process.env.AUTHOR_NAME || 'Mauricio Gonzalo Morales Fernandez';
const AUTHOR_GITHUB = process.env.AUTHOR_GITHUB || 'https://github.com/Miau44';

app.disable('x-powered-by');
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use('/uploads', express.static('uploads'));

// Ruta original, conservada para mantener compatibilidad.
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'API de Gestor de Gastos activa',
    proyecto: PROJECT_NAME
  });
});

// Pequena personalizacion para identificar el trabajo del diplomado.
app.get('/api/v1/info', (req, res) => {
  res.status(200).json({
    proyecto: PROJECT_NAME,
    autor: AUTHOR_NAME,
    github: AUTHOR_GITHUB,
    programa: 'Diplomado en Desarrollo Web Full Stack',
    version: '1.0.1'
  });
});

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`${PROJECT_NAME}: servidor escuchando en el puerto ${PORT}`);
  });
}

export default app;
