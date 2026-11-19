import swaggerJSDoc from 'swagger-jsdoc';

const paths = {
  '/health': ['get'], '/info': ['get'],
  '/auth/register': ['post'], '/auth/login': ['post'], '/auth/me': ['get'],
  '/categories': ['get','post'], '/categories/{id}': ['put','delete'],
  '/transactions': ['get','post'], '/transactions/{id}': ['put','delete'],
  '/currencies': ['get','post'], '/currencies/by-date': ['get'],
  '/budgets': ['get','post'], '/budgets/{id}': ['delete'],
  '/reports/summary': ['get'], '/reports/by-category': ['get'],
  '/reports/by-exchange-rate': ['get'], '/reports/audits': ['get']
};
const bodies = {
  '/auth/register': { required: ['name','email','password'], properties: { name: { type: 'string', example: 'Ana Pérez' }, email: { type: 'string', format: 'email', example: 'ana@example.com' }, password: { type: 'string', format: 'password', example: 'secreto123' }, baseCurrency: { type: 'string', example: 'BOB' } } },
  '/auth/login': { required: ['email','password'], properties: { email: { type: 'string', format: 'email', example: 'ana@example.com' }, password: { type: 'string', format: 'password', example: 'secreto123' } } },
  '/categories': { required: ['name','type'], properties: { name: { type: 'string', example: 'Alimentación' }, type: { type: 'string', enum: ['INCOME','EXPENSE'], example: 'EXPENSE' } } },
  '/transactions': { required: ['type','amount','categoryId'], properties: { type: { type: 'string', enum: ['INCOME','EXPENSE'], example: 'EXPENSE' }, amount: { type: 'number', minimum: 0.01, example: 35.5 }, currency: { type: 'string', example: 'BOB' }, categoryId: { type: 'integer', example: 2 }, description: { type: 'string', example: 'Almuerzo' }, date: { type: 'string', format: 'date', example: '2026-11-19' } } },
  '/currencies': { required: ['code','name','exchangeRate','date'], properties: { code: { type: 'string', example: 'USD' }, name: { type: 'string', example: 'Dólar estadounidense' }, exchangeRate: { type: 'number', example: 6.9 }, date: { type: 'string', format: 'date', example: '2026-11-19' }, source: { type: 'string', example: 'Banco Central (indicar fuente)' } } },
  '/budgets': { required: ['categoryId','month','year','amountLimit'], properties: { categoryId: { type: 'integer', example: 2 }, month: { type: 'integer', minimum: 1, maximum: 12, example: 11 }, year: { type: 'integer', example: 2026 }, amountLimit: { type: 'number', minimum: 0.01, example: 800 } } }
};
export const swaggerSpec = swaggerJSDoc({ definition: { openapi: '3.0.3', info: { title: 'Sistema de gestión de gastos e ingresos', version: '2.0.0', description: 'API académica desarrollada por Mauricio Gonzalo Morales Fernandez. Referencia técnica: https://github.com/loquendo2309/manager-expense-api' }, servers: [{ url: 'http://localhost:3000/api/v1' }], components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } } }, apis: [] });

for (const [path, methods] of Object.entries(paths)) {
  swaggerSpec.paths[path] = {};
  for (const method of methods) {
    const authenticated = !['/health','/info','/auth/register','/auth/login','/currencies','/currencies/by-date'].includes(path) || path === '/currencies' && method === 'post';
    const body = bodies[path];
    const responses = {};
    for (const [code, description] of Object.entries({ 200: 'Operación exitosa', 201: 'Recurso creado', 400: 'Solicitud inválida', 401: 'No autenticado', 403: 'Sin permisos', 404: 'Recurso no encontrado', 409: 'Conflicto de integridad' })) {
      responses[code] = { description };
      if (code === '200' || code === '201') responses[code].content = { 'application/json': { examples: { success: { value: path.includes('auth') ? { user: { id: 'uuid', name: 'Ana Pérez', email: 'ana@example.com', role: 'USER' }, token: 'eyJhbGciOi...' } : { data: 'Recurso JSON de la operación solicitada' } } } } };
    }
    const operation = {
      summary: `${method.toUpperCase()} ${path}`,
      description: `${method.toUpperCase()} ${path}. ${path.startsWith('/categories') ? 'Catálogo global; escritura ADMIN.' : path === '/currencies' && method === 'post' ? 'Solo ADMIN; registra la fuente declarada sin importar cotizaciones automáticamente.' : path.startsWith('/transactions') || path.startsWith('/budgets') ? 'El recurso pertenece al usuario autenticado.' : ''}`,
      tags: [path.split('/')[1]],
      parameters: [ ...(path.includes('{id}') ? [{ name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: '1' }] : []), ...(path === '/currencies/by-date' ? [{ name: 'date', in: 'query', required: true, schema: { type: 'string', format: 'date' }, example: '2026-11-19' }] : []), ...(['/transactions','/reports/summary','/reports/by-category'].includes(path) && method === 'get' ? [{ name: 'startDate', in: 'query', required: false, schema: { type: 'string', format: 'date' } }, { name: 'endDate', in: 'query', required: false, schema: { type: 'string', format: 'date' } }] : []) ],
      responses
    };
    if (body && ['post','put'].includes(method)) operation.requestBody = { required: true, content: { 'application/json': { schema: { type: 'object', required: body.required, properties: body.properties }, example: Object.fromEntries(Object.entries(body.properties).map(([key, value]) => [key, value.example])) } } };
    if (authenticated) operation.security = [{ bearerAuth: [] }];
    swaggerSpec.paths[path][method] = operation;
  }
}
