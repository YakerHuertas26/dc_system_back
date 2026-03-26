import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Categories } from './entities/categories.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { mock } from 'node:test';
import { ConflictException, InternalServerErrorException, NotFoundException } from '@nestjs/common';

const mockCategoryRepository= {
  exists: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
  findOneBy: jest.fn(),
}

const mockCategory : Categories = {
  category_id: 1,
  name: 'Categoria1',
  code: '0001',
  state: true
}

const mockInactuveCategory: Categories = {
category_id: 2,
  name: 'Categoria2',
  code: '0002',
  state: false
}

describe('CategoriesService', () => {
  let service: CategoriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoriesService,{ provide : getRepositoryToken(Categories), useValue: mockCategoryRepository }],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  afterEach(()=>{
    jest.clearAllMocks();
  })

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create',()=>{
    const categoryDto : CreateCategoryDto = {name: 'Electrónica'};
    
    it('crea una categoria, con codigo generado', async ()=>{
      // ARRENGE
      const saveWithId= {...mockCategory, code:''};
      const saveWithCode= {...mockCategory};

        //--Verficación del exist 
        mockCategoryRepository.exists.mockResolvedValue(false);
        
        // --Creación de la categoria 
        mockCategoryRepository.create.mockReturnValue(saveWithId);

        mockCategoryRepository.save
          .mockResolvedValueOnce(saveWithId)
          .mockResolvedValueOnce(saveWithCode);

        // ACT
        const result=  await service.create(categoryDto);

        // ASSERT
          // Verificar que se haya verificado la existencia del nombre
        expect(mockCategoryRepository.exists).toHaveBeenCalledWith({where:{name: categoryDto.name}});

          // Verificar que se haya creado la categoría con el DTO
        expect(mockCategoryRepository.create).toHaveBeenCalledWith(categoryDto);

          // verficar que se haya guardado la categoría dos veces (una para obtener el ID y otra para actualizar el código)
        expect(mockCategoryRepository.save).toHaveBeenCalledTimes(2);

          // Verificar que se haya guardado la categoría con el ID generado
        expect(result).toEqual(saveWithCode);

          // Verificar que el código se haya generado correctamente
        expect(result.code).toBe(saveWithId.category_id.toString().padStart(4, '0'));
    });

    it('lanzar una excepción si ya existe nombre de categoria', async ()=>{
      // ARRAGE
      mockCategoryRepository.exists.mockResolvedValue(true);

      // ACT & ASSERT
        // verificar que lance un error de conflicto 
      await expect(service.create(categoryDto)).rejects.toThrow(new ConflictException('El nombre de la categoría ya existe'));

      // verificar que no se haya intentado guardar 
      expect(mockCategoryRepository.save).not.toHaveBeenCalled();
    });

    it ('lanzar una excepción si ocurre un error inesperado', async()=>{
      // ARRANGE
      mockCategoryRepository.exists.mockResolvedValue(false);
      mockCategoryRepository.create.mockReturnValue({name: categoryDto.name});
      mockCategoryRepository.save.mockRejectedValue(new Error('Error al crear categorías'))

      // ACT 
      const result= service.create(categoryDto);
      //  ASSERT
      await expect(result).rejects.toThrow(new InternalServerErrorException('Error al crear categorías'))
    })
  });

  describe('finAll',()=>{
    it('listar todas las categorias asc sin filtros',async()=>{
      // ARRANGE
      const listCategories= [mockCategory, mockInactuveCategory];
      mockCategoryRepository.find.mockResolvedValue(listCategories);

      // ACT
      const result= await service.findAll();

      // ASSERT
        // verifica si el resultado es igual a la lista de categorias mockeada
      expect(result).toEqual(listCategories);
      
        // verifica que se haya llamado con los argumentos correctos
      expect(mockCategoryRepository.find).toHaveBeenCalledWith({order:{state: 'DESC'}});
    });

    it('listar categorias por estado', async()=>{
      // ARRANGE
      mockCategoryRepository.find.mockResolvedValue([mockCategory]);

      // ACT
      const result= await service.findAll(true);

      // ASSERT
      expect(result).toEqual([mockCategory]);
      expect(mockCategoryRepository.find).toHaveBeenCalledWith({where: {state: true}});
    });

    it('lanzar una exepción si ocurre un error inesperado', async()=>{
      // ARRANGE
      mockCategoryRepository.find.mockRejectedValue(new Error('Error al obtener categorías'));
      
      // ACT 
      const result = service.findAll();
      // ASSERT
      await expect(result).rejects.toThrow(new InternalServerErrorException('Error al obtener categorías'));
    })
  });

  describe('findOne', ()=>{
    it('obtener categoria por id', async()=>{
      // ARRANGE
      mockCategoryRepository.findOneBy.mockResolvedValue(mockCategory);

      // ACT
      const result= await service.findOne(mockCategory.category_id);

      // ASSERT
      expect(result).toEqual(mockCategory);
      expect(mockCategoryRepository.findOneBy).toHaveBeenCalledWith({category_id: mockCategory.category_id})
    });

    it('lanzar una excepción si la categoría no existe', async()=>{
      // ARRANGE
      mockCategoryRepository.findOneBy.mockResolvedValue(null);

      // ACT
      const result = service.findOne(-1);

      // ASSERT
      await expect(result).rejects.toThrow(new NotFoundException('La categoría no existe'));
    });

    it('lanzar una excepción si ocurre un error inesperado', async()=>{
      // ARRANGE
      mockCategoryRepository.findOneBy.mockRejectedValue(new Error('Error al obtener categoría'));

      // ACT
      const result= service.findOne(1);

      // ASSERT
      await expect(result).rejects.toThrow(new InternalServerErrorException('Error al obtener categoría'));
    });
  })
});
