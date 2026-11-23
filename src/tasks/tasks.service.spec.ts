import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../users/users.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { Task } from './schemas/task.schema';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;
  const taskModel = { create: jest.fn(), find: jest.fn(), findById: jest.fn() };
  const usersService = { findById: jest.fn() };
  const dto: CreateTaskDto = {
    title: 'Revisión de infraestructura',
    userId: '6af691f7ad6c0c0e2753eaf2',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getModelToken(Task.name), useValue: taskModel },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  it('create verifica el usuario con UsersService y persiste la tarea', async () => {
    usersService.findById.mockResolvedValue({ _id: dto.userId });
    taskModel.create.mockResolvedValue({ _id: 't1', ...dto });

    const result = await service.create(dto);

    expect(usersService.findById).toHaveBeenCalledWith(dto.userId);
    expect(taskModel.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ _id: 't1', ...dto });
  });

  it('create no persiste si el usuario no existe', async () => {
    usersService.findById.mockRejectedValue(new NotFoundException());

    await expect(service.create(dto)).rejects.toBeInstanceOf(NotFoundException);
    expect(taskModel.create).not.toHaveBeenCalled();
  });

  it('findById lanza NotFoundException si la tarea no existe', async () => {
    taskModel.findById.mockReturnValue({ exec: () => Promise.resolve(null) });

    await expect(service.findById('x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
