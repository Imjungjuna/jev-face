import { defineConfig, loadEnv } from 'vite';
import { evaluateText } from './api/evaluate.js';

/*
 * NOTE: Vercel serves api/evaluate.js as a function in production. The dev
 * server has no such convention, so the same handler is mounted by hand here.
 */
function devApi() {
  return {
    name: 'jev-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/evaluate', (req, res) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', async () => {
          res.setHeader('Content-Type', 'application/json');
          try {
            const { text } = JSON.parse(Buffer.concat(chunks).toString());
            res.end(JSON.stringify(await evaluateText(String(text).slice(0, 2000))));
          } catch (error) {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: String(error.message) }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return { plugins: [devApi()], server: { port: 5180 } };
});
