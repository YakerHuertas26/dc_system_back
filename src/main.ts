import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
// import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true
  }));

  // Serialización global (para @Exclude en las entidades)
  // app.useGlobalInterceptors(
  //   new ClassSerializerInterceptor(app.get(Reflector))
  // );

  // // Guard JWT global 
  // // Todas las rutas requieren autenticación por defecto
  // // A menos que tengan el decorador @Public()
  // const reflector = app.get(Reflector);
  // app.useGlobalGuards(new JwtAuthGuard(reflector));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
