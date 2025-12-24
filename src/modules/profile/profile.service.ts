import { pool } from "../../db";

export async function getMyProfile(userId: string) {
  const userRes = await pool.query(
    `SELECT id, name, phone_number, email, age, sex, location, avatar_img, role, joined_date, is_active
     FROM users
     WHERE id=$1`,
    [userId]
  );
  const user = userRes.rows[0];
  if (!user) return null;

  const petsRes = await pool.query(
    `SELECT
        p.*,
        pm.url AS profile_img
     FROM pets p
     LEFT JOIN LATERAL (
        SELECT url
        FROM pet_media
        WHERE pet_id = p.id AND is_profile = true
        ORDER BY created_at ASC
        LIMIT 1
     ) pm ON true
     WHERE p.created_by = $1
     ORDER BY p.created_at DESC`,
    [userId]
  );

  return { user, pets: petsRes.rows };
}

export async function updateMyProfile(params: {
  userId: string;
  name?: string;
  phone_number?: string;
  location?: string;
}) {
  const fields: string[] = [];
  const values: any[] = [];
  let i = 1;

  if (params.name !== undefined) {
    fields.push(`name = $${i++}`);
    values.push(params.name);
  }
  if (params.phone_number !== undefined) {
    fields.push(`phone_number = $${i++}`);
    values.push(params.phone_number);
  }
  if (params.location !== undefined) {
    fields.push(`location = $${i++}`);
    values.push(params.location);
  }

  if (fields.length === 0) return { updated: false };

  values.push(params.userId);

  const res = await pool.query(
    `UPDATE users
     SET ${fields.join(", ")}
     WHERE id = $${i}
     RETURNING id, name, phone_number, email, location, role`,
    values
  );

  return { updated: true, user: res.rows[0] };
}
