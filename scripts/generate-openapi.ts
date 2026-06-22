// https://docs.nestjs.com/openapi/introduction#bootstrap
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';

async function generateSpec() {
    // Bootstrap the Nest application context without starting the HTTP listener
    const app = await NestFactory.create(AppModule, { logger: false });

    const config = new DocumentBuilder()
        .setTitle('API Spec')
        .setDescription('Auto-generated OpenAPI contract')
        .setVersion('1.0')
        .build();

    // Generate the full OpenAPI Document object
    const document = SwaggerModule.createDocument(app, config);

    // Write the file to your disk safely
    const outputPath = path.resolve(process.cwd(), 'generated/openapi.json');
    writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf8');

    // Teardown the app context cleanly so the terminal process exits gracefully
    await app.close();
}

generateSpec().catch((err) => {
    console.error('Failed to generate spec:', err);
    process.exit(1);
});