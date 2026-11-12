# API de Control de Gastos - Diplomado Full Stack

Adaptación académica de un proyecto de API REST desarrollado en **Node.js + Express** para el **Diplomado en Desarrollo Web Full Stack**.



## Estado real del proyecto

Esta versión inicia un servidor HTTP y expone **dos endpoints informativos**. Las dependencias para bases de datos, autenticación y documentación están declaradas en `package.json`, pero **la conexión a MySQL/MongoDB y el CRUD de gastos no se han implementado en este proyecto mínimo**.

## Tecnologías

- Node.js (recomendado 20 o superior)
- Express 4 y JavaScript con ES Modules
- dotenv, CORS y Morgan
- Mongoose, mysql2, Sequelize, JWT y Swagger (preparadas como dependencias; sin integración)

## Instalación

```bash
npm install
```

Copia `.env.example` a `.env` y escribe tu nombre en `AUTHOR_NAME` y un título en `PROJECT_NAME`.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Mac/Linux:

```bash
cp .env.example .env
```

Ejecuta:

```bash
npm run dev
```

Para ejecución normal usa `npm start`. Por defecto, la aplicación escucha en el puerto 3000.

## Endpoints

| Método | Ruta | Uso |
| ------ | ---- | --- |
| GET | `/api/v1/health` | Comprueba que el servidor responde |
| GET | `/api/v1/info` | Muestra nombre del proyecto, autor, diplomado y versión |

Ejemplo de respuesta de `/api/v1/health`:

```json
{
  "status": "OK",
  "message": "API de Gestor de Gastos activa",
  "proyecto": "Mi API de Control de Gastos"
}
```

Prueba desde navegador o Postman:

- http://localhost:3000/api/v1/health
- http://localhost:3000/api/v1/info

Las pruebas automatizadas se ejecutan con `npm test` (tras instalar dependencias).

## Personalización realizada

1. Identificación del proyecto y su autor a través de `.env`.
2. Nuevo endpoint `GET /api/v1/info`, manteniendo el endpoint original.
3. Un script `npm start` y dos pruebas simples.
4. Archivo `.env.example` y protección de `.env` en `.gitignore`.
5. Pequeña mejora de seguridad: se oculta la cabecera `X-Powered-By`.

