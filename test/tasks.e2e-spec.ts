import { INestApplication, ValidationPipe } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { model, Types } from 'mongoose';
import request from 'supertest';
import { App } from 'supertest/types';
import { Task, TaskSchema } from '../src/tasks/schemas/task.schema';
import { TasksController } from '../src/tasks/tasks.controller';
import { TasksService } from '../src/tasks/tasks.service';
import { User } from '../src/users/schemas/user.schema';
import { UsersService } from '../src/users/users.service';

// Escenarios de los casos 1 a 4 sobre la app real (controladores, guard,
// pipe y servicios). Solo la persistencia se simula en memoria; el modelo de
// tareas usa el TaskSchema real, asi que `strict` se evalua de verdad.
describe('Parcial - casos 1 a 4 (e2e)', () => {
  let app: INestApplication<App>;
  const TOKEN = 'admin-secret-token';
  const existingUserId = new Types.ObjectId().toString();
  const stored: Record<string, unknown>[] = [];
  const TaskDoc = model('TaskE2E', TaskSchema);

  const taskModel = {
    create: (data: object) => {
      const doc = new TaskDoc(data).toObject();
      stored.push(doc);
      return Promise.resolve(doc);
    },
    find: () => ({ exec: () => Promise.resolve(stored) }),
    findById: (id: string) => ({
      exec: () =>
        Promise.resolve(stored.find((t) => String(t._id) === id) ?? null),
    }),
  };
  const userModel = {
    findById: (id: string) => ({
      exec: () =>
        Promise.resolve(
          id === existingUserId ? { _id: id, name: 'Ana' } : null,
        ),
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        TasksService,
        UsersService,
        { provide: getModelToken(Task.name), useValue: taskModel },
        { provide: getModelToken(User.name), useValue: userModel },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Caso 1: rechaza con 400 propiedades no autorizadas y no persiste nada', async () => {
    const res = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', TOKEN)
      .send({
        title: 'Revisión de infraestructura',
        userId: existingUserId,
        isAdmin: true,
        role: 'superuser',
        internalFlag: 'MODIFIED_BY_ATTACKER',
      })
      .expect(400);

    expect(JSON.stringify(res.body.message)).toContain(
      'property isAdmin should not exist',
    );
    expect(stored).toHaveLength(0);
  });

  it('Caso 1: el schema estricto descarta atributos fuera del modelo', () => {
    const doc = new TaskDoc({
      title: 't',
      userId: existingUserId,
      isAdmin: true,
      role: 'superuser',
    }).toObject();
    expect(doc).not.toHaveProperty('isAdmin');
    expect(doc).not.toHaveProperty('role');
    expect(doc).toHaveProperty('completed', false);
  });

  it('Casos 2 y 4: crea la tarea verificando el usuario via UsersService', async () => {
    const res = await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', TOKEN)
      .send({ title: 'Implementar pruebas', userId: existingUserId })
      .expect(201);

    expect(res.body).toMatchObject({
      title: 'Implementar pruebas',
      userId: existingUserId,
      completed: false,
    });
    expect(stored).toHaveLength(1);
  });

  it('Caso 2: usuario inexistente responde 404', async () => {
    await request(app.getHttpServer())
      .post('/tasks')
      .set('Authorization', TOKEN)
      .send({ title: 'x', userId: new Types.ObjectId().toString() })
      .expect(404);
  });

  it('Caso 3: GET /tasks y GET /tasks/:id son publicos', async () => {
    const list = await request(app.getHttpServer()).get('/tasks').expect(200);
    expect(list.body).toHaveLength(1);

    const id = String((stored[0] as { _id: unknown })._id);
    await request(app.getHttpServer()).get(`/tasks/${id}`).expect(200);
  });

  it('Caso 3: POST /tasks sin token responde 403 con ForbiddenException', async () => {
    const res = await request(app.getHttpServer())
      .post('/tasks')
      .send({ title: 'x', userId: existingUserId })
      .expect(403);

    expect(res.body).toEqual({
      message: 'Prohibido',
      error: 'Forbidden',
      statusCode: 403,
    });
  });
});
