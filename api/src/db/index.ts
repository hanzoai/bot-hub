import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://hub:hub@localhost:5432/hub'

const client = postgres(connectionString, { max: 20 })
export const db = drizzle(client, { schema })
export type DB = typeof db
