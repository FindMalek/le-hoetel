import postgres from "postgres"
import { BASE_DATABASE_URL, E2E_DATABASE } from "./env"

const name = process.env.E2E_DATABASE_NAME || E2E_DATABASE

/** Runs before the api starts: an empty database, so every run signs up into a clean slate. */
const sql = postgres(BASE_DATABASE_URL, { max: 1, onnotice: () => {} })
try {
  await sql.unsafe(`drop database if exists ${name} with (force)`)
  await sql.unsafe(`create database ${name}`)
} catch (error) {
  console.error(`The smoke test needs Postgres: start it with pnpm db:up (${new URL(BASE_DATABASE_URL).host}).`)
  throw error
} finally {
  await sql.end()
}
