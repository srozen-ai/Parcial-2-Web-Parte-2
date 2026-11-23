# Proyecto Base — Parcial Práctico Backend (NestJS + MongoDB)

API REST en NestJS y Mongoose para la gestión de **Usuarios (`/users`)** y **Tareas (`/tasks`)**.

---

## Requisitos Previos

- **Node.js** 18+ y **npm**
- **Docker Desktop** (o instancia local de MongoDB en el puerto `27017`)

---

## Instalación y Puesta en Marcha

1. **Levantar la base de datos MongoDB:**
   ```bash
   docker compose up -d
   ```
   *(Si utilizas una instancia local o MongoDB Atlas diferente a `mongodb://localhost:27017/nest-parcial`, configura la variable `MONGODB_URI` en un archivo `.env` tomando como base `.env.example`.)*

2. **Instalar dependencias del proyecto:**
   ```bash
   npm install
   ```

3. **Iniciar la aplicación en modo desarrollo:**
   ```bash
   npm run start:dev
   ```
   El servidor quedará disponible en `http://localhost:3000`.

---

## Pruebas y Validación

- **Ejecutar pruebas unitarias:**
  ```bash
  npm test
  ```
- **Ejecutar pruebas end-to-end:**
  ```bash
  npm run test:e2e
  ```
- **Verificar compilación y linter:**
  ```bash
  npm run build
  npm run lint
  ```

---

## Endpoints del Sistema

| Método | Ruta | Acceso | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Público | Verificación básica del servidor |
| `POST` | `/users` | Público | Crear usuario (`name`, `email`) |
| `GET` | `/users` | Público | Listar usuarios registrados |
| `GET` | `/users/:id` | Público | Consultar usuario por ID |
| `GET` | `/tasks` | Público | Listar tareas registradas |
| `GET` | `/tasks/:id` | Público | Consultar tarea por ID |
| `POST` | `/tasks` | Restringido (`Authorization: admin-secret-token`) | Crear una tarea asociada a un usuario |

También puedes importar `nest-parcial.postman_collection.json` en Postman o utilizar `requests.http` con la extensión REST Client de VS Code para probar manualmente los endpoints.

---

## Refactorización del parcial (v1.0.0-parcial)

Cada caso quedó en su propio commit (`git log --oneline`). Para ejecutar: `docker compose up -d`, `npm install`, `npm run start:dev`.

### Caso 1 — Mass assignment

- `src/tasks/dto/create-task.dto.ts`: `CreateTaskDto` con `title`, `description`, `completed` y `userId` validados con `class-validator`.
- `src/main.ts`: `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted` y `transform`. Una propiedad no declarada produce `400 Bad Request`.
- `src/tasks/schemas/task.schema.ts`: se quitó `strict: false`; el esquema es `strict: true` y Mongoose descarta cualquier atributo fuera del modelo.

```bash
curl -i -X POST http://localhost:3000/tasks \
  -H "Authorization: admin-secret-token" -H "Content-Type: application/json" \
  -d '{"title":"Revisión de infraestructura","userId":"<id-usuario>","isAdmin":true,"role":"superuser","internalFlag":"MODIFIED_BY_ATTACKER"}'
```

Resultado: `400 Bad Request` con `property isAdmin should not exist`, `property role should not exist` y `property internalFlag should not exist`. No se inserta ningún documento en `db.tasks`.

### Caso 2 — Acoplamiento entre módulos

- `UsersModule` exporta `UsersService` (`exports: [UsersService]`).
- `TasksModule` ya no registra `User`/`UserSchema`; importa `UsersModule`.
- `TasksService` verifica el usuario con `UsersService.findById`, que lanza `404 Not Found` si no existe. Un `userId` inexistente responde `404` y no se crea la tarea.

### Caso 3 — Control de acceso

- Se eliminó `auth.middleware.ts` y su registro en `AppModule`.
- `src/auth.guard.ts`: `AuthGuard` valida `Authorization: admin-secret-token` y lanza `ForbiddenException`.
- `@UseGuards(AuthGuard)` solo está en `POST /tasks`.

| Petición | Resultado |
| :--- | :--- |
| `GET /tasks` sin cabeceras | `200 OK` |
| `GET /tasks/:id` sin cabeceras | `200 OK` |
| `POST /tasks` sin token | `403` `{"message":"Prohibido","error":"Forbidden","statusCode":403}` |
| `POST /tasks` con token y body válido | `201 Created` |

### Caso 4 — Controlador delgado

- `TasksController` solo inyecta `TasksService`; no hay `TaskModel` ni `UserModel`.
- `TasksService.create(dto)` valida el usuario y persiste la tarea.
- `POST /tasks` recibe `CreateTaskDto` y delega en `tasksService.create`.
- `src/tasks/tasks.controller.spec.ts` instancia el controlador mockeando únicamente `TasksService`.

### Evidencia de pruebas

```bash
npm run build                                                  # compila sin errores
npm test                                                       # 7 pruebas unitarias
npx jest --config ./test/jest-e2e.json test/tasks.e2e-spec.ts  # 6 escenarios e2e de los casos 1 a 4
```

- Unitarias: 3 suites, 7 pruebas en verde (controlador y servicio de tareas, y la prueba base de `AppController`).
- E2E (`test/tasks.e2e-spec.ts`): 6 pruebas en verde con supertest sobre `TasksController`, `AuthGuard`, el `ValidationPipe` y los servicios reales. Cubren el `400` por propiedades extra, que el esquema estricto descarta `isAdmin` y `role`, el `201` con usuario válido, el `404` con usuario inexistente, los `GET` públicos y el `403` del `POST` sin token. La persistencia usa un doble en memoria con el `TaskSchema` real.

### Evidencia de funcionamiento (ejecución real con MongoDB en Docker)

Usuario creado previamente con `POST /users` (`_id` `6b0451ff062c53adfb953ebc`).

**Caso 1 — propiedades no autorizadas (`isAdmin`, `role`, `internalFlag`)**

```
POST /tasks  (Authorization: admin-secret-token)
HTTP/1.1 400 Bad Request
{"message":["property isAdmin should not exist","property role should not exist","property internalFlag should not exist"],"error":"Bad Request","statusCode":400}
```

**Casos 1, 2 y 4 — tarea válida creada vía `TasksService.create`**

```
POST /tasks  (Authorization: admin-secret-token)
HTTP/1.1 201 Created
{"title":"Implementar pruebas","completed":false,"userId":"6b0451ff062c53adfb953ebc","_id":"6b045266062c53adfb953ec1","createdAt":"2026-11-23T14:49:10.436Z","updatedAt":"2026-11-23T14:49:10.436Z","__v":0}
```

**Caso 2 — usuario inexistente validado por `UsersService`**

```
POST /tasks  (userId: 600000000000000000000000)
HTTP/1.1 404 Not Found
{"message":"Usuario con ID 600000000000000000000000 no encontrado","error":"Not Found","statusCode":404}
```

**Caso 3 — acceso público en lectura y restringido en escritura**

```
GET /tasks  (sin cabeceras)            -> HTTP/1.1 200 OK
POST /tasks (sin Authorization)        -> HTTP/1.1 403 Forbidden
{"message":"Prohibido","error":"Forbidden","statusCode":403}
```

**Persistencia — `db.tasks.find()` tras las pruebas**

```
[
  {
    _id: ObjectId('6b045266062c53adfb953ec1'),
    title: 'Implementar pruebas',
    completed: false,
    userId: ObjectId('6b0451ff062c53adfb953ebc'),
    createdAt: ISODate('2026-11-23T14:49:10.436Z'),
    updatedAt: ISODate('2026-11-23T14:49:10.436Z'),
    __v: 0
  }
]
```

La petición con `isAdmin`, `role` e `internalFlag` no dejó ningún documento: solo existe la tarea válida, sin atributos fuera del modelo.
