import 'dotenv/config';
import app from './app.js';
import { connectDatabases, closeDatabases } from './infrastructure/database/connect.js';

const required = ['JWT_SECRET', 'MONGO_URI', 'MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DB'];
for (const name of required) if (!process.env[name]) throw new Error(`Falta configurar ${name} en .env`);
if (process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET debe contener al menos 32 caracteres');

await connectDatabases();
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, () => console.log(`${process.env.PROJECT_NAME || 'API'} escuchando en puerto ${port}`));
const shutdown = async () => { server.close(); await closeDatabases(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
