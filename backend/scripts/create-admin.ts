// scripts/create-admin.ts
import { pool } from "../src/db/pool";
import { hashPassword } from "../src/modules/auth/password.util";

async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error("Usage: npm run create-admin -- <email> <password>");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  await pool.query(
    "INSERT INTO staff_users (email, password_hash) VALUES ($1, $2)",
    [email, passwordHash]
  );

  console.log(`Created admin user: ${email}`);
  await pool.end();
}

main().catch((err) => {
  console.error("Failed to create admin user:", err);
  process.exit(1);
});