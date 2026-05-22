import { ConflictException, HttpException, Injectable } from '@nestjs/common';
import { CreateColorDto } from './dto/create-color.dto';
import { UpdateColorDto } from './dto/update-color.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Color } from './entities/color.entity';
import { Repository } from 'typeorm';

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

  findOne(id: number) {
    return `This action returns a #${id} color`;
  }

  update(id: number, updateColorDto: UpdateColorDto) {
    return `This action updates a #${id} color`;
  }

  remove(id: number) {
    return `This action removes a #${id} color`;
  }
}
