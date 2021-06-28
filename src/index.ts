import Koa from 'koa';
import logger from 'koa-logger';
import json from 'koa-json';
import bodyParser from 'koa-bodyparser';
import Router from 'koa-router';

async function createApp() {
  const app = new Koa();

  /** Middlewares */
  app.use(json());
  app.use(logger());
  app.use(bodyParser());

  app.use(async (ctx, next) => {
    try {
      await next();
    } catch (err) {
      // console.error(err);
      ctx.status = err.statusCode || err.status || 500;
      ctx.body = {
        message: err.message,
        errors: err.errors ?? [],
      };
    }
  });

  /** Routes */
  const router = new Router();



  return app;
}

export default async function main() {
  const app = await createApp();
  const PORT = process.env.PORT;

  await app.listen(PORT);
  console.info(`Server started: http://localhost:${PORT}`);
  await new Promise((resolve) => process.on('SIGINT', resolve));
  return 0;
}

if (require.main === module) {
  main()
    .then((code) => {
      process.exit(code);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
