import test from 'node:test';
import assert from 'node:assert/strict';

// Evita que app.js abra su propio puerto mientras se ejecutan las pruebas.
process.env.NODE_ENV = 'test';
process.env.PROJECT_NAME = 'Proyecto de prueba';
process.env.AUTHOR_NAME = 'Estudiante de prueba';
process.env.AUTHOR_GITHUB = 'https://github.com/estudiante-de-prueba';

const { default: app } = await import('../src/app.js');

async function request(path) {
  const server = app.listen(0);
  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('GET /api/v1/health mantiene el estado de la API', async () => {
  const result = await request('/api/v1/health');
  assert.equal(result.status, 200);
  assert.equal(result.body.status, 'OK');
  assert.equal(result.body.message, 'API de Gestor de Gastos activa');
  assert.equal(result.body.proyecto, 'Proyecto de prueba');
});

test('GET /api/v1/info identifica el diplomado y el autor', async () => {
  const result = await request('/api/v1/info');
  assert.equal(result.status, 200);
  assert.equal(result.body.proyecto, 'Proyecto de prueba');
  assert.equal(result.body.autor, 'Estudiante de prueba');
  assert.equal(result.body.github, 'https://github.com/estudiante-de-prueba');
  assert.equal(result.body.programa, 'Diplomado en Desarrollo Web Full Stack');
});
