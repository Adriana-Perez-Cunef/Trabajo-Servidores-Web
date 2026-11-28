# HIVE · Madrid clubs

Aplicación web de **eventos y discotecas con red social**. Los usuarios descubren eventos (con filtros por fecha, precio y ciudad, y calendario), marcan a cuáles asisten, siguen a otras personas y ven los planes de sus amigos. Incluye perfiles, ajustes de privacidad y un panel de administración.

Stack: HTML/CSS/JavaScript (frontend SPA) · Node.js + Express (backend, estructura MVC) · PostgreSQL · JWT + bcrypt · Docker.

## Funcionalidades

- **Cuenta:** registro (con confirmación de contraseña) e inicio de sesión con JWT; contraseñas con bcrypt.
- **Inicio:** evento del día, recomendados (más populares) y planes de tus amigos.
- **Buscador:** búsqueda por texto, filtros de **fecha** (calendario con días que tienen eventos), **precio** ($, $$, $$$) y **ciudad**, También busca personas.
- **Eventos:** crear evento, ficha de detalle, marcar "Asistiré", borrar (creador o admin).
- **Red social:** seguir usuarios, solicitudes de seguimiento (cuentas privadas), lista de amigos con su próximo evento, perfil con seguidores y eventos anteriores.
- **Privacidad:** cuenta privada, permitir solicitudes y compartir actividad.
- **Roles:** `user` y `admin` (el admin gestiona usuarios y puede borrar cualquier evento).

## Estructura

```
src/
  config/        configuración y conexión a la BD
  models/        acceso a datos (consultas SQL parametrizadas)
  controllers/   lógica de cada endpoint
  routes/        rutas y validación de entrada
  middlewares/   autenticación, roles, validación, errores
  bootstrap.js   datos de demostración
public/          frontend (index.html, styles.css, app.js)
db/init.sql      esquema de la base de datos
docs/openapi.yaml  documentación de la API
```

## Instalación y uso con Docker (recomendado)

Requisitos: Docker y Docker Compose.

```bash
cp .env.example .env
# Edita .env y define un JWT_SECRET largo y aleatorio
docker compose up --build
```

- Aplicación: http://localhost:3000 (escribe `http://`, no `https://`)
- Documentación de la API (Swagger UI): http://localhost:3000/api-docs

Para parar: `Ctrl+C`. Para parar y **borrar todos los datos**: `docker compose down -v`.

> Si vienes de una versión anterior del proyecto con otra base de datos, ejecuta antes `docker compose down -v` para que se cree el esquema nuevo.

### Datos de demostración

Al arrancar con la base de datos vacía se crean 8 eventos de ejemplo (con fechas relativas a hoy) y estos usuarios:

| Usuario | Correo | Contraseña |
|---|---|---|
| hive_admin (administrador) | admin@hive.local | `ADMIN_PASSWORD` del `.env` (por defecto `HiveAdmin123!`) |
| claudia_perez | claudia@hive.local | `Demo1234!` |
| alvaro_soriano | alvaro@hive.local | `Demo1234!` |
| sofia_martin | sofia@hive.local | `Demo1234!` |

Para desactivarlos, pon `SEED_DEMO_DATA=false` en `.env`. Cambia `ADMIN_PASSWORD` antes de usar la app fuera de local.

## Ejecución en local (sin Docker para la app)

Requisitos: Node.js 20+ y una instancia de PostgreSQL.

```bash
npm install
cp .env.example .env          # ajusta DATABASE_URL y JWT_SECRET
psql "$DATABASE_URL" -f db/init.sql
npm run dev
```

## API

Resumen (detalle completo en `/api-docs`):

| Método | Ruta | Descripción | Acceso |
|--------|------|-------------|--------|
| POST | /api/auth/register | Crear cuenta | Público |
| POST | /api/auth/login | Iniciar sesión | Público |
| GET | /api/events | Buscar eventos (q, from, to, price, city, order, limit) | Autenticado |
| GET | /api/events/home | Inicio: del día, recomendados y amigos | Autenticado |
| POST | /api/events | Crear evento | Autenticado |
| GET | /api/events/:id | Detalle y amigos que asisten | Autenticado |
| DELETE | /api/events/:id | Borrar evento | Creador / admin |
| POST / DELETE | /api/events/:id/attend | Asistiré / cancelar | Autenticado |
| GET / PATCH | /api/users/me | Mi cuenta / editar perfil | Autenticado |
| PATCH | /api/users/me/settings | Ajustes de privacidad | Autenticado |
| GET | /api/users/me/friends | Usuarios que sigo | Autenticado |
| GET | /api/users/me/requests | Solicitudes pendientes | Autenticado |
| POST / DELETE | /api/users/me/requests/:id(/accept) | Aceptar / rechazar solicitud | Autenticado |
| GET | /api/users/search?q= | Buscar personas | Autenticado |
| GET | /api/users/:id | Perfil de un usuario | Autenticado |
| POST / DELETE | /api/users/:id/follow | Seguir / dejar de seguir | Autenticado |
| GET | /api/admin/users | Listar usuarios | Admin |
| DELETE | /api/admin/users/:id | Eliminar usuario | Admin |

## Seguridad

- Contraseñas con hash bcrypt, nunca en texto plano. Mismo mensaje de error para correo o contraseña incorrectos.
- JWT con caducidad; autorización por rol (`admin`) y por propiedad (solo el creador borra su evento).
- Privacidad aplicada en el servidor: cuentas privadas, solicitudes de seguimiento y actividad no compartida no se filtran por la API.
- Validación y saneado de entradas con express-validator; consultas SQL **parametrizadas** (previene inyección SQL).
- `helmet` (cabeceras seguras y CSP) y límite de tamaño del body.
- El frontend construye la interfaz con `textContent` (previene XSS) y el contenedor corre como usuario sin privilegios.
- Secretos en variables de entorno (`.env` está en `.gitignore`).

### Limitaciones conocidas

- HSTS y la redirección a HTTPS están desactivados porque la app se sirve por HTTP en local; en producción irían detrás de un proxy con HTTPS.
- El token JWT se guarda en `localStorage` (simplificación habitual en proyectos académicos).
- No hay límite de intentos de login (protección contra fuerza bruta), ni subida de imágenes ni mapa.

## Trabajo en equipo con Git

- Rama `main` protegida; una rama por funcionalidad (`feature/...`) y pull requests con revisión de otro miembro.
- Commits pequeños y descriptivos (por ejemplo: `feat: filtros del buscador`).
