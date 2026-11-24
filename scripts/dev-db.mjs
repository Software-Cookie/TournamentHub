// Local development PostgreSQL (no Docker needed). NOT used in production.
// Usage: npm run db:local   (keeps running; Ctrl+C to stop)
import EmbeddedPostgres from "embedded-postgres";
import fs from "node:fs";

const dir = "./.devdb/utf8";
const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user: "postgres",
  password: "postgres",
  port: 54330,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

fs.mkdirSync("./.devdb", { recursive: true });
if (!fs.existsSync(dir)) await pg.initialise();
await pg.start();
try { await pg.createDatabase("tournamenthub"); } catch { /* exists */ }
console.log("Local Postgres ready on postgresql://postgres:postgres@localhost:54330/tournamenthub");
const stop = async () => { await pg.stop(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
