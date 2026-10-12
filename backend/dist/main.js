"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const DEFAULT_ORIGINS = ['http://localhost', 'http://localhost:3000', 'http://127.0.0.1'];
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const extraOrigins = (process.env.CORS_ORIGINS ?? '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
    const allowedOrigins = [...DEFAULT_ORIGINS, ...extraOrigins];
    app.enableCors({
        origin: (origin, cb) => {
            if (!origin || allowedOrigins.includes(origin))
                return cb(null, true);
            cb(new Error(`CORS: origin ${origin} не разрешён`));
        },
        methods: ['GET', 'POST', 'DELETE'],
        allowedHeaders: ['Content-Type'],
    });
    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    console.log(`Backend running on http://localhost:${port}`);
}
bootstrap();
//# sourceMappingURL=main.js.map