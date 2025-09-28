import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap(){
  const app = await NestFactory.create(AppModule, { cors: true });
  const cfg = new DocumentBuilder().setTitle('Infotier API').setDescription('Identity Verification API').setVersion('1.0.0').addBearerAuth().build();
  const doc = SwaggerModule.createDocument(app, cfg);
  SwaggerModule.setup('docs', app, doc);
  await app.listen(process.env.PORT || 3000);
  console.log('API http://localhost:3000  Docs /docs');
}
bootstrap();
