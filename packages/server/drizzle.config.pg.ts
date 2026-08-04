import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.pg.ts',
  out: '../../drizzle/migrations/postgres',
  dialect: 'postgresql',
});
