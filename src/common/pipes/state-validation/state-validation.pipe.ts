import { ArgumentMetadata, BadRequestException, Injectable, ParseBoolPipe, PipeTransform } from '@nestjs/common';

@Injectable()
export class StateValidationPipe extends ParseBoolPipe {
  constructor(){
    super({
      optional: true ,
      exceptionFactory:()=> new BadRequestException('Solicitud inválida')
    })
  }
}
