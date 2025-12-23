import { pool } from "../../db";
import { config } from "../../config";
import { hashPassword, verifyPassword } from "../../utils/password";
import { randomToken, sha256 } from "../../utils/hash";

function refreshExpiresAt(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export async function createUser(input: {
  name: string;
  phone_number: string;
  email?: string | null;
  password: string;
  age?: number | null;
  sex?: "MALE" | "FEMALE" | null;
  location?: string | null;
}) {
  const passwordHash = await hashPassword(input.password);

  const res = await pool.query(
    `INSERT INTO users (name, phone_number, email, password, age, sex, location)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, role, name, phone_number, email`,
    [
      input.name,
      input.phone_number,
      input.email ?? null,
      passwordHash,
      input.age ?? null,
      input.sex ?? null,
      input.location ?? null
    ]
  );

  return res.rows[0] as { id: string; role: "USER" | "ADMIN" };
}

export async function validateLogin(phone_number: string, password: string) {
  const res = await pool.query(
    `SELECT id, password, role, is_active FROM users WHERE phone_number=$1`,
    [phone_number]
  );

  const user = res.rows[0] as
    | { id: string; password: string; role: "USER" | "ADMIN"; is_active: boolean }
    | undefined;

  if (!user) return { ok: false as const, reason: "Invalid credentials" };
  if (!user.is_active) return { ok: false as const, reason: "User is inactive" };

  const ok = await verifyPassword(password, user.password);
  if (!ok) return { ok: false as const, reason: "Invalid credentials" };

  return { ok: true as const, user: { id: user.id, role: user.role } };
}

export async function issueRefreshToken(params: {
  userId: string;
  userAgent?: string | null;
  ip?: string | null;
}) {
  const token = randomToken(64);      // raw refresh token
  const tokenHash = sha256(token);    // store hash only
  const exp = refreshExpiresAt(config.REFRESH_TOKEN_DAYS);

  await pool.query(
    `INSERT INTO user_refresh_tokens (user_id, token_hash, expires_at, user_agent, ip)
     VALUES ($1,$2,$3,$4,$5)`,
    [params.userId, tokenHash, exp, params.userAgent ?? null, params.ip ?? null]
  );

  return { token, expiresAt: exp };
}

export async function rotateRefreshToken(params: {
  refreshToken: string;
  userAgent?: string | null;
  ip?: string | null;
}) {
  const tokenHash = sha256(params.refreshToken);

  const rtRes = await pool.query(
    `SELECT id, user_id, expires_at, revoked_at
     FROM user_refresh_tokens
     WHERE token_hash=$1`,
    [tokenHash]
  );

  const rt = rtRes.rows[0] as
    | { id: string; user_id: string; expires_at: Date; revoked_at: Date | null }
    | undefined;

  if (!rt) return { ok: false as const, reason: "Invalid refresh token" };
  if (rt.revoked_at) return { ok: false as const, reason: "Refresh token revoked" };
  if (new Date(rt.expires_at).getTime() < Date.now())
    return { ok: false as const, reason: "Refresh token expired" };

  const uRes = await pool.query(`SELECT id, role, is_active FROM users WHERE id=$1`, [rt.user_id]);
  const user = uRes.rows[0] as
    | { id: string; role: "USER" | "ADMIN"; is_active: boolean }
    | undefined;

  if (!user || !user.is_active) return { ok: false as const, reason: "User not available" };

  // insert new refresh row
  const newToken = randomToken(64);
  const newHash = sha256(newToken);
  const newExp = refreshExpiresAt(config.REFRESH_TOKEN_DAYS);

  const inserted = await pool.query(
    `INSERT INTO user_refresh_tokens (user_id, token_hash, expires_at, user_agent, ip)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id`,
    [user.id, newHash, newExp, params.userAgent ?? null, params.ip ?? null]
  );
  const newId = inserted.rows[0].id as string;

  // revoke old
  await pool.query(
    `UPDATE user_refresh_tokens
     SET revoked_at=now(), replaced_by_token_id=$2
     WHERE id=$1`,
    [rt.id, newId]
  );

  return {
    ok: true as const,
    user: { id: user.id, role: user.role },
    newRefresh: { token: newToken, expiresAt: newExp }
  };
}

export async function revokeRefreshToken(refreshToken: string) {
  const tokenHash = sha256(refreshToken);
  await pool.query(
    `UPDATE user_refresh_tokens
     SET revoked_at=now()
     WHERE token_hash=$1 AND revoked_at IS NULL`,
    [tokenHash]
  );
}
