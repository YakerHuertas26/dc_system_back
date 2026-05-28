import { ConflictException, HttpException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Supplier } from './entities/supplier.entity';
import {  Not, Repository } from 'typeorm';
import { isEqueals } from '@/common/utils/compare';


@Injectable()
export class SuppliersService {
  constructor (
    @InjectRepository(Supplier)
    private readonly supplierRepositor: Repository<Supplier>
  ){}

  async create(createSupplierDto: CreateSupplierDto) {
    try {
      const existSupplier = await this.supplierRepositor.exists({
        where:[{ name: createSupplierDto.name }, { ruc: createSupplierDto.ruc }]
      }) 

      if(existSupplier) throw new ConflictException('El proveedor con nombre o ruc ya existe');

      const supplier = this.supplierRepositor.create(createSupplierDto);
      return await this.supplierRepositor.save(supplier);

    } catch (error : any) {
      if(error instanceof HttpException) throw error;
      if(error?.code==="ER_DUP_ENTRY"){
        throw new ConflictException('El proveedor ya existe')
      }
      throw new InternalServerErrorException('Error al crear un proveedor')
    }
  }

  findAll() {
    return this.supplierRepositor.find();
  }

  async findOne(id: number) {
    try {
      const supplier = await this.supplierRepositor.findOne({
        where:{supplierId: id}
      });
      if(!supplier) throw new NotFoundException ('Proveedor no encontrado');
      return supplier;

    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error al obtener el producto');
    }
    
  }

  async update(id: number, updateSupplierDto: UpdateSupplierDto) {
    const supplier = await this.findOne(id);
    if (updateSupplierDto.name) {
      const existSupplier = await this.supplierRepositor.exists({
        where:{name: updateSupplierDto.name,supplierId: Not(id)},
      })
      if(existSupplier) throw new ConflictException ('Ya existe un proveedor con ese nombre')
    }
    if (updateSupplierDto.ruc) {
      const existSupplier = await this.supplierRepositor.exists({
        where:{ruc: updateSupplierDto.ruc,supplierId: Not(id)},
      })
      if(existSupplier) throw new ConflictException ('Ya existe un proveedor con ese ruc')
    }

    const noChanges = isEqueals(supplier, updateSupplierDto)

    if(noChanges) throw new ConflictException('No se han realizado cambios')
    
      Object.assign(supplier, updateSupplierDto);
    return await this.supplierRepositor.save(supplier);
  }

  

  async active(id: number) {
    const supplier = await this.findOne(id);
      supplier.state = true;
      await this.supplierRepositor.save(supplier);
      return 'Proveedor activado correctamente'
  }

  async remove(id: number) {
    const supplier = await this.findOne(id);
      supplier.state = false;
      await this.supplierRepositor.save(supplier);
      return 'Eliminado correctamente'
  }
}
