import { BadRequestException, ConflictException, HttpException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
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

      if(existSupplier) throw new ConflictException('El nombre o ruc del  proveedor ya existe');

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

  async findAll(limit: number = 10, page: number = 1) {
    const take= limit;
    const skip = (page - 1) * limit;
  
    const supplier = await this.supplierRepositor.findAndCount({
      take,
      skip
    });
    const [suppliers, total] = supplier;
    return {suppliers, total, take, skip, lastPage : Math.ceil(total/take)}
  }

  async findOne(id: number) {
    try {
      const supplier = await this.supplierRepositor.findOne({
        where:{supplierId: id}
      });
      if(!supplier) throw new NotFoundException ('el id del Proveedor no existe');
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
      if(existSupplier) throw new ConflictException('El nombre del  proveedor ya existe')
    }
    if (updateSupplierDto.ruc) {
      const existSupplier = await this.supplierRepositor.exists({
        where:{ruc: updateSupplierDto.ruc,supplierId: Not(id)},
      })
      if(existSupplier) throw new ConflictException ('El ruc del proovedor ya esiste')
    }

    const isEquals = isEqueals(supplier, updateSupplierDto)
    if(isEquals) throw new BadRequestException('Los datos enviados son iguales a los registrados actualmente.')
    
      Object.assign(supplier, updateSupplierDto);
    return await this.supplierRepositor.save(supplier);
  }

  

  async active(id: number) {
    const supplier = await this.findOne(id);
      supplier.state = true;
      await this.supplierRepositor.save(supplier);
      return 'El estado del suppliers a sido activado'
  }

  async remove(id: number) {
    const supplier = await this.findOne(id);
      supplier.state = false;
      await this.supplierRepositor.save(supplier);
      return 'El proovedor ha sido Eliminado'
  }
}
