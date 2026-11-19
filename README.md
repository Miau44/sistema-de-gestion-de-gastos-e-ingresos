# Sistema de Gestión de Gastos e Ingresos

API REST del proyecto final del **Diplomado en Desarrollo Web Full Stack**, evolución del primer avance de Mauricio Gonzalo Morales Fernandez. El avance original conservaba únicamente `health` e `info`; esta versión incorpora autenticación, autorización, persistencia dual, operaciones financieras, reportes y documentación OpenAPI.

Repositorio personal: https://github.com/Miau44/sistema-de-gestion-de-gastos-e-ingresos
Referencia técnica de clases: https://github.com/loquendo2309/manager-expense-api. Se conservaron el enfoque de Clean Architecture y la distribución conceptual MongoDB/MySQL; la implementación es propia y el registro público ignora cualquier rol enviado por el cliente.

## Tecnologías y requisitos

- Node.js 20 o superior y npm
- Express 4, JavaScript ES Modules
- MongoDB y MySQL 8 (base de datos creada previamente)
- Mongoose, Sequelize y mysql2
- JWT, bcryptjs, Swagger UI/OpenAPI

## Arquitectura

```text
src/
  app.js                         Express configurable, sin abrir puerto
  index.js                       validación de entorno, conexiones y arranque
  domain/entities|errors/        reglas y errores del dominio
  application/services.js        casos de uso inyectables
  infrastructure/config/         Swagger
  infrastructure/database/       MongoDB, MySQL y adaptadores de repositorio
  presentation/api.js             rutas, autenticación y autorización
```

Las categorías son un catálogo **global** y solo ADMIN puede modificarlas. Las transacciones y presupuestos pertenecen al usuario del token. Los tipos de cambio son globales y su creación requiere ADMIN. No se cargan cotizaciones oficiales de forma automática; se registra el origen informado como `user-provided` y no se inventan tasas para monedas distintas de BOB.

## Instalación y configuración

```bash
npm install
```

Crea `.env` a partir de `.env.example` y configura `JWT_SECRET` con al menos 32 caracteres, `MONGO_URI` y los parámetros de MySQL. No publiques `.env`.

PowerShell:

```powershell
Copy-Item .env.example .env
```

Crea las bases vacías previamente (Sequelize crea tablas nuevas sin `alter` ni `force`; revisa y aplica migraciones manuales al cambiar esquemas):

```sql
CREATE DATABASE bd_gastos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

MongoDB crea la base indicada en `MONGO_URI` al insertar los primeros documentos. Completa en `.env`:

```dotenv
PORT=3000
NODE_ENV=development
PROJECT_NAME=Sistema de gestión de gastos e ingresos
AUTHOR_NAME=Mauricio Gonzalo Morales Fernandez
AUTHOR_GITHUB=https://github.com/Miau44
JWT_SECRET=REEMPLAZAR_POR_UN_SECRETO_ALEATORIO_DE_32_CARACTERES_O_MAS
JWT_EXPIRES_IN=1d
MONGO_URI=mongodb://127.0.0.1:27017/bd_gastos
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=tu_clave
MYSQL_DB=bd_gastos
```

El arranque valida las variables obligatorias, verifica ambas conexiones y termina con error si alguna base de datos no está disponible.

## Ejecutar

```bash
npm run dev       # nodemon, conecta DB y arranca
npm start         # servidor normal
npm test          # pruebas HTTP/unitarias con repositorios aislados en memoria
```

Swagger: http://localhost:3000/api-docs. Importa el token con **Authorize → Bearer JWT**.

## Autenticación y permisos

`POST /api/v1/auth/register` crea siempre un usuario `USER`; almacena bcrypt, nunca la contraseña original. `POST /api/v1/auth/login` devuelve JWT. `GET /api/v1/auth/me` necesita `Authorization: Bearer <token>`. Roles: `USER` y `ADMIN`; no hay endpoint público para elevar el rol. Crear el primer ADMIN se hace manualmente desde un proceso de administración seguro en MongoDB.

## Endpoints principales

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/v1/health`, `/api/v1/info` | Público |
| POST | `/api/v1/auth/register`, `/api/v1/auth/login` | Público |
| GET | `/api/v1/auth/me` | JWT |
| GET/POST | `/api/v1/categories` | JWT lectura; ADMIN escritura |
| PUT/DELETE | `/api/v1/categories/:id` | ADMIN |
| GET/POST | `/api/v1/transactions` | JWT, propio usuario |
| PUT/DELETE | `/api/v1/transactions/:id` | JWT, propietario |
| GET | `/api/v1/currencies`, `/api/v1/currencies/by-date?date=YYYY-MM-DD` | Público |
| POST | `/api/v1/currencies` | ADMIN |
| GET/POST | `/api/v1/budgets` | JWT, propio usuario |
| DELETE | `/api/v1/budgets/:id` | JWT, propietario |
| GET | `/api/v1/reports/summary`, `/by-category`, `/by-exchange-rate`, `/audits` | JWT, propio usuario |

Transacciones requieren `type` (`INCOME` o `EXPENSE`), `amount` mayor a cero y una categoría existente del mismo tipo. Ejemplo:

```json
{"type":"EXPENSE","amount":35.5,"currency":"BOB","categoryId":2,"description":"Almuerzo","date":"2026-11-19"}
```

Los presupuestos requieren `categoryId`, `month` (1–12), `year` y `amountLimit`. Las respuestas de reportes se calculan desde las transacciones y auditorías persistidas.

## Pruebas y límites del entorno

Las pruebas de `npm test` verifican endpoints HTTP, contraseñas/registro, duplicados, JWT válido/ausente/inválido, roles, propiedad de transacciones, validaciones, presupuestos, reportes y errores/rutas desconocidas con dobles de repositorio. No sustituyen pruebas de integración de infraestructura. Estas requieren levantar MongoDB y MySQL y configurar `.env`; no se ejecutan dentro de la suite para que `npm test` funcione en equipos sin bases instaladas.

Errores frecuentes: `ECONNREFUSED` indica que falta levantar MySQL/MongoDB; una base MySQL inexistente debe crearse primero; los puertos y credenciales deben coincidir con `.env`; un JWT corto impide el arranque.
