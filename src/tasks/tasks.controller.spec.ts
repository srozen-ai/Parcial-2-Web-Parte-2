import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';

describe('TasksController', () => {
  let controller: TasksController;
  const tasksService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [{ provide: TasksService, useValue: tasksService }],
    }).compile();

    controller = module.get<TasksController>(TasksController);
  });

  it('se resuelve mockeando unicamente TasksService', () => {
    expect(controller).toBeDefined();
  });

  it('create delega el DTO a TasksService.create', async () => {
    const dto: CreateTaskDto = {
      title: 'Revisión de infraestructura',
      userId: '6af691f7ad6c0c0e2753eaf2',
    };
    tasksService.create.mockResolvedValue({ _id: 't1', ...dto });

    const result = await controller.create(dto);

    expect(tasksService.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ _id: 't1', ...dto });
  });

  it('findAll delega en TasksService.findAll', async () => {
    tasksService.findAll.mockResolvedValue([]);
    await expect(controller.findAll()).resolves.toEqual([]);
    expect(tasksService.findAll).toHaveBeenCalled();
  });
});
