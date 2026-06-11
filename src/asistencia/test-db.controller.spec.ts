import { Test, TestingModule } from '@nestjs/testing';
import { TestDbController } from './test-db.controller';

describe('TestDbController', () => {
  let controller: TestDbController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestDbController],
    }).compile();

    controller = module.get<TestDbController>(TestDbController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
