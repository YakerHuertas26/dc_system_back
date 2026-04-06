import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { Categories } from './entities/categories.entity';
import { UpdateCategoryDto } from './dto/update-category.dto';

const mockCategoriesService = {
  create:  jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update:  jest.fn(),
  active:  jest.fn(),
  remove:  jest.fn(),
};

const mockCategory: Categories = {
  category_id: 1,
  name:        'Electrónica',
  code:        '0001',
  state:       true,
};


describe('CategoriesController', () => {
  let controller: CategoriesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{
        provide: CategoriesService,
        useValue: mockCategoriesService,
      }],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', ()=>{
    it('llamar al servicio create y retornar el resultado', async ()=>{
      // ARRAGE
      const category : CreateCategoryDto = {name: 'hogar'};
      mockCategoriesService.create.mockResolvedValue(mockCategory);
      
      // ACT
      const result = await controller.create(category);
      
      // ASSERT
      expect(result).toEqual(mockCategory);
      expect(mockCategoriesService.create).toHaveBeenCalledWith(category);
      expect(mockCategoriesService.create).toHaveBeenCalledTimes(1);
    })
  });

  describe('findAll', () =>{
    it('llarmar al servicio findAll sin paramerter', async ()=>{
      // ARRANGE
      mockCategoriesService.findAll.mockResolvedValue([mockCategory]);

      // ACT
      const result = await controller.findAll(undefined);

      // ASSERT
      expect(result).toEqual([mockCategory]);
      expect(mockCategoriesService.findAll).toHaveBeenCalledWith(undefined);
    });

    it('llamar al servicio findAll con parametro true', async ()=> {
      // ARRANGE
      mockCategoriesService.findAll.mockResolvedValue([mockCategory]);

      // ACT
      const result = await controller.findAll(true);

      // ASSERT
      expect(result).toEqual([mockCategory]);
      expect(mockCategoriesService.findAll).toHaveBeenCalledWith(true);
    });

    it('llamar al servicio findAll con parametro false', async ()=> {
      // ARRANGE
      mockCategoriesService.findAll.mockResolvedValue([]);

      // ACT
      const result = await controller.findAll(false);

      // ASSERT
      expect(result).toEqual([]);
      expect(mockCategoriesService.findAll).toHaveBeenCalledWith(false);
    })
  });

  describe ('findOne', ()=>{
    it('buscara por id', async ()=>{
      // ARRANGE
      mockCategoriesService.findOne.mockResolvedValue(mockCategory);
      
      // ACT
      const result= await controller.findOne('1');

      // ASSERT
      expect(result).toEqual(mockCategory);
      expect(mockCategoriesService.findOne).toHaveBeenCalledWith(1);
    });
  });

  describe ('active', ()=>{
    it('llamar al service active', async()=>{
      // ARRANGE
      const falseCategorie: Categories = {... mockCategory, state: true};
      mockCategoriesService.active.mockResolvedValue(falseCategorie);

      // ACT
      const result = await controller.active('1');

      // ASSERT
      expect(result).toEqual(falseCategorie);
      expect(mockCategoriesService.active).toHaveBeenLastCalledWith(1);
    })
  });

  describe('update', ()=>{
    it('llamar al service update', async ()=>{
      // arrange
      const categorieDto: UpdateCategoryDto= {name: 'Niño'};
      const updateCategories : Categories = {...mockCategory, name : 'Niño'};
      mockCategoriesService.update.mockResolvedValue(updateCategories);

      // act
      const result = await controller.update('1', categorieDto);

      // assert
      expect(result).toEqual(updateCategories);
      expect(mockCategoriesService.update).toHaveBeenCalledWith(1, categorieDto);
    })
  });

  describe('remove', ()=>{
    it('llamar al servicio remove', async ()=>{
      // ARRANGE
      const removeCategorie: Categories = {...mockCategory, state: false};
      mockCategoriesService.remove.mockResolvedValue(removeCategorie);

      // Act
      const result = await controller.remove('1');

      // assert
      expect(result).toEqual(removeCategorie);
      expect(mockCategoriesService.remove).toHaveBeenCalledWith(1);
    })
  });
});
