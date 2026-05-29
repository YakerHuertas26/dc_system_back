import { BadRequestException, ConflictException, HttpException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { CreateColorDto } from './dto/create-color.dto';
import { UpdateColorDto } from './dto/update-color.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Color } from './entities/color.entity';
import { Not, Repository } from 'typeorm';
import { isEqueals } from '@/common/utils/compare';

@Injectable()
export class ColorsService {
  constructor(
    @InjectRepository(Color)
      private readonly colorRepository: Repository<Color>
    ){}

  async create(createColorDto: CreateColorDto) {
    try {
      const existNameColor = await this.colorRepository.exists({
        where:{name:createColorDto.name}
      })
      if(existNameColor) throw new ConflictException('El nombre del color ya existe')
  
      const existNameCode = await this.colorRepository.exists({
        where:{code:createColorDto.code}
      })
      if(existNameCode) throw new ConflictException('El código del color ya existe')
      
      const color = this.colorRepository.create(createColorDto);
      return this.colorRepository.save(color);
    } catch (error:any) {
      if(error instanceof HttpException) throw error;
      if(error.code==="ER_DUP_ENTRY") throw new ConflictException('El color ya existe')
      throw new InternalServerErrorException('Error al crear un color');
    }
  }

  async findAll(limit:number = 10 , page: number = 1) {
    const take =  limit;
    const skip = (page - 1) * limit;
    const colors= await this.colorRepository.findAndCount({
      take,
      skip
    });
    const [data, total] = colors;
    return {data, total, page,limit, lastPage: Math.ceil(total/take)}
  }

  async findOne(id: number) {
    try {
      const color = await this.colorRepository.findOne({
        where:{colorId:id}
      })
      if(!color) throw new NotFoundException('El color no existe')
        return color;
    } catch (error) {
      if(error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error al obtener el color');
    }
  }

  async update(id: number, updateColorDto: UpdateColorDto) {
    try {
      const color = await this.findOne(id);
      const isEquals = isEqueals(color, updateColorDto);
      if(isEquals) throw new BadRequestException('No se registraron cambios');

      if (updateColorDto.name) {
        const existsName= await this.colorRepository.exists({
          where:{
            name:updateColorDto.name,
            colorId: Not(id),
          }
        })
        if(existsName) throw new ConflictException('Ya existe un código registrado con ese nombre');
      }
  
      if (updateColorDto.code) {
        const existsCode = await this.colorRepository.exists({
          where:{
            code:updateColorDto.code,
            colorId: Not(id),
          }
        })
        if(existsCode) throw new ConflictException('Ya existe código registrado con ese color RGB');
      }
      Object.assign(color,updateColorDto);
      return await this.colorRepository.save(color);
    } catch (error) {
      if(error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error al actualizar el color')
    }
  }

  async remove(id: number) {
    const color = await this.findOne(id);
    await this.colorRepository.remove(color);
    return {message: 'Color eliminado correctamente'}
  }
}
