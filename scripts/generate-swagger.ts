import swaggerJsdoc from 'swagger-jsdoc';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 2. Define the Swagger/OpenAPI Configuration
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'RoomReview',
      version: '1.0.0',
      description: 'API documentation for RoomReview',
    },
    servers: [
      {
        url: 'http://localhost:5000/api/v1',
        description: 'Development server',
      },
    ],
  },
  // Point to where your route files are located
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

// 3. Generate the specification
const openapiSpecification = swaggerJsdoc(options);

// 4. Write the specification to a file
const outputDir = path.join(__dirname, '../docs');
const outputPath = path.join(outputDir, 'swagger.json');

// Ensure the directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(
  outputPath,
  JSON.stringify(openapiSpecification, null, 2),
  'utf-8'
);

console.log(`✅ Swagger documentation generated successfully at ${outputPath}`);