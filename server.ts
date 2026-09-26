import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { apiRouter } from './src/server/routes/api.routes.ts';
import { SeedService } from './src/server/services/seed.service.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Initialize seed database
  SeedService.initSeedData();

  // Basic security headers
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json());

  // Mount API endpoints
  app.use('/api', apiRouter);

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      service: 'AegisPass Concurrency Engine',
    });
  });

  const distPath = path.resolve(__dirname, 'dist');
  const isProduction = process.env.NODE_ENV === 'production' && fs.existsSync(distPath);

  if (!isProduction) {
    // Development mode: Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[AegisPass] Running in development mode with Vite middleware.');
  } else {
    // Production mode: Serve built static assets
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
    console.log('[AegisPass] Running in production mode serving dist assets.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AegisPass] Server active at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[AegisPass] Startup error:', err);
  process.exit(1);
});
