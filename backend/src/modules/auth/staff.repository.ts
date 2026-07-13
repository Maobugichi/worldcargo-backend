import { pool } from "../../db/pool";

export interface StaffUser {
  id: string;
  email: string;
  passwordHash: string;
}

export async function findStaffUserByEmail(email: string): Promise<StaffUser | null> {
  const result = await pool.query<{ id: string; email: string; password_hash: string }>(
    "SELECT id, email, password_hash FROM staff_users WHERE email = $1",
    [email]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return { id: row.id, email: row.email, passwordHash: row.password_hash };
}