import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: '../../drizzle/migrations/sqlite',
  dialect: 'sqlite',
});
