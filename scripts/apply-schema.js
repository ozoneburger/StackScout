import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadEnv } from "./env.js";

loadEnv();

const schemaPath = join(process.cwd(), "supabase", "schema.sql");

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!existsSync(schemaPath)) {
  fail(`Missing schema file: ${schemaPath}`);
}

if (!process.env.DATABASE_URL) {
  fail(
    [
      "Missing DATABASE_URL.",
      "Add your Supabase Postgres URI to .env, then rerun npm run db:schema.",
      "Supabase path: Project Settings -> Database -> Connection string -> URI.",
    ].join("\n"),
  );
}

const child = spawn("psql", [process.env.DATABASE_URL, "-v", "ON_ERROR_STOP=1", "-f", schemaPath], {
  stdio: "inherit",
});

child.on("error", (error) => {
  if (error.code === "ENOENT") {
    fail(
      [
        "psql is not installed or not on PATH.",
        "Install PostgreSQL client tools, or paste supabase/schema.sql into Supabase SQL Editor.",
      ].join("\n"),
    );
  }
  fail(error.message);
});

child.on("exit", (code) => {
  if (code === 0) {
    console.log("Supabase schema applied successfully.");
    return;
  }
  process.exit(code ?? 1);
});
