import { pool } from "../../db";
import { deleteManyFromS3ByUrls } from "../../utils/s3";

type Role = "USER" | "ADMIN";

type CreatePetInput = {
  name: string;
  birth_date?: string | null;
  age?: number | null;
  sex?: "MALE" | "FEMALE" | null;

  breed?: string | null;
  adoption_fee?: number | null;

  category: "STRAY" | "OWNED";
  type: "DOG" | "CAT";

  location?: string | null;
  about?: string | null;
  contact_info?: string | null;

  vaccinated?: boolean | null;
  dewormed?: boolean | null;
  sprayed?: boolean | null;

  is_active?: boolean | null;

  media?: Array<{ media_type: "IMAGE" | "VIDEO"; url: string; is_profile?: boolean | null }> | null;
};

type UpdatePetInput = Partial<Omit<CreatePetInput, "media">>;

async function getPetOwner(petId: string) {
  const res = await pool.query(`SELECT created_by FROM pets WHERE id=$1`, [petId]);
  return res.rows[0] as { created_by: string | null } | undefined;
}

export async function assertCanEditOrThrow(params: { petId: string; userId: string; role: Role }) {
  if (params.role === "ADMIN") return;

  const owner = await getPetOwner(params.petId);
  if (!owner) throw Object.assign(new Error("Pet not found"), { statusCode: 404 });

  // created_by can be null (if user deleted); in that case only ADMIN should edit
  if (!owner.created_by || owner.created_by !== params.userId) {
    throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
  }
}

export async function createPetWithMedia(params: { createdBy: string; input: CreatePetInput }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const p = params.input;

    const petRes = await client.query(
      `INSERT INTO pets (
        name, birth_date, age, sex, breed, adoption_fee,
        category, type, location, about, contact_info,
        vaccinated, dewormed, sprayed,
        created_by, is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *`,
      [
        p.name,
        p.birth_date ?? null,
        p.age ?? null,
        p.sex ?? null,
        p.breed ?? null,
        p.adoption_fee ?? 0,

        p.category,
        p.type,

        p.location ?? null,
        p.about ?? null,
        p.contact_info ?? null,

        p.vaccinated ?? false,
        p.dewormed ?? false,
        p.sprayed ?? false,

        params.createdBy,
        p.is_active ?? true
      ]
    );

    const pet = petRes.rows[0];

    // insert media if provided
    if (p.media && p.media.length > 0) {
      // ensure only one profile in input (optional check)
      const profileCount = p.media.filter((m) => m.is_profile === true).length;
      if (profileCount > 1) {
        throw Object.assign(new Error("Only one media can be profile"), { statusCode: 400 });
      }

      for (const m of p.media) {
        await client.query(
          `INSERT INTO pet_media (pet_id, media_type, url, is_profile)
           VALUES ($1,$2,$3,$4)`,
          [pet.id, m.media_type, m.url, m.is_profile ?? false]
        );
      }
    }

    await client.query("COMMIT");

    const mediaRes = await pool.query(`SELECT * FROM pet_media WHERE pet_id=$1 ORDER BY created_at ASC`, [pet.id]);
    return { pet, media: mediaRes.rows };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function listPets(query: {
  type?: "DOG" | "CAT";
  category?: "STRAY" | "OWNED";
  sex?: "MALE" | "FEMALE";
  location?: string;

  is_active?: boolean;
  sprayed?: boolean;
  vaccinated?: boolean;
  dewormed?: boolean;

  min_age?: number;
  max_age?: number;

  created_by?: string;
  search?: string;

  limit?: number;
  offset?: number;
}) {
  const where: string[] = [];
  const values: any[] = [];

  const add = (cond: string, val?: any) => {
    where.push(cond);
    if (val !== undefined) values.push(val);
  };

  // enums
  if (query.type) add(`p.type = $${values.length + 1}`, query.type);
  if (query.category) add(`p.category = $${values.length + 1}`, query.category);
  if (query.sex) add(`p.sex = $${values.length + 1}`, query.sex);

  // booleans
  if (typeof query.is_active === "boolean") add(`p.is_active = $${values.length + 1}`, query.is_active);
  if (typeof query.sprayed === "boolean") add(`p.sprayed = $${values.length + 1}`, query.sprayed);
  if (typeof query.vaccinated === "boolean") add(`p.vaccinated = $${values.length + 1}`, query.vaccinated);
  if (typeof query.dewormed === "boolean") add(`p.dewormed = $${values.length + 1}`, query.dewormed);

  // owner
  if (query.created_by) add(`p.created_by = $${values.length + 1}`, query.created_by);

  // location filter (ILIKE)
  if (query.location && query.location.trim()) {
    add(`p.location ILIKE $${values.length + 1}`, `%${query.location.trim()}%`);
  }

  // age range
  if (typeof query.min_age === "number" && !Number.isNaN(query.min_age)) {
    add(`p.age >= $${values.length + 1}`, query.min_age);
  }
  if (typeof query.max_age === "number" && !Number.isNaN(query.max_age)) {
    add(`p.age <= $${values.length + 1}`, query.max_age);
  }

  // search across name/breed/location/about/contact_info
  if (query.search && query.search.trim()) {
    const term = `%${query.search.trim()}%`;
    values.push(term);
    const idx = values.length; // single placeholder index
    where.push(
      `(p.name ILIKE $${idx} OR p.breed ILIKE $${idx} OR p.location ILIKE $${idx} OR p.about ILIKE $${idx} OR p.contact_info ILIKE $${idx})`
    );
  }

  const limit = Math.min(query.limit ?? 20, 100);
  const offset = query.offset ?? 0;

  values.push(limit, offset);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const res = await pool.query(
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
     ${whereSql}
     ORDER BY p.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return res.rows;
}


export async function getPetById(petId: string) {
  const petRes = await pool.query(`SELECT * FROM pets WHERE id=$1`, [petId]);
  const pet = petRes.rows[0];
  if (!pet) return null;

  const mediaRes = await pool.query(`SELECT * FROM pet_media WHERE pet_id=$1 ORDER BY is_profile DESC, created_at ASC`, [petId]);
  return { pet, media: mediaRes.rows };
}

export async function updatePet(petId: string, patch: UpdatePetInput) {
  const allowed = [
    "name", "birth_date", "age", "sex",
    "breed", "adoption_fee",
    "category", "type",
    "location", "about", "contact_info",
    "vaccinated", "dewormed", "sprayed",
    "is_active"
  ] as const;

  const sets: string[] = [];
  const values: any[] = [];

  for (const key of allowed) {
    if (key in patch) {
      values.push((patch as any)[key]);
      sets.push(`${key} = $${values.length}`);
    }
  }

  if (sets.length === 0) {
    throw Object.assign(new Error("No fields to update"), { statusCode: 400 });
  }

  values.push(petId);

  const res = await pool.query(
    `UPDATE pets SET ${sets.join(", ")}
     WHERE id = $${values.length}
     RETURNING *`,
    values
  );

  return res.rows[0] ?? null;
}

export async function replacePetMedia(
  petId: string,
  media: Array<{ media_type: "IMAGE" | "VIDEO"; url: string; is_profile?: boolean | null }>
) {
  const oldRes = await pool.query(`SELECT url FROM pet_media WHERE pet_id=$1`, [petId]);
  const oldUrls: string[] = oldRes.rows.map((r: any) => r.url).filter(Boolean);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`DELETE FROM pet_media WHERE pet_id=$1`, [petId]);

    const profileCount = media.filter((m) => m.is_profile === true).length;
    if (profileCount > 1) {
      throw Object.assign(new Error("Only one media can be profile"), { statusCode: 400 });
    }

    for (const m of media) {
      await client.query(
        `INSERT INTO pet_media (pet_id, media_type, url, is_profile)
         VALUES ($1,$2,$3,$4)`,
        [petId, m.media_type, m.url, m.is_profile ?? false]
      );
    }

    await client.query("COMMIT");

    if (oldUrls.length > 0) {
      await deleteManyFromS3ByUrls(oldUrls);
    }

    const mediaRes = await pool.query(
      `SELECT * FROM pet_media WHERE pet_id=$1 ORDER BY is_profile DESC, created_at ASC`,
      [petId]
    );
    return mediaRes.rows;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function deletePetHard(petId: string) {
  // 1) get media URLs BEFORE deleting pet (because cascade will delete rows)
  const mediaRes = await pool.query(`SELECT url FROM pet_media WHERE pet_id=$1`, [petId]);
  const urls: string[] = mediaRes.rows.map((r: any) => r.url).filter(Boolean);

  // 2) delete pet (will cascade delete pet_media rows)
  const res = await pool.query(`DELETE FROM pets WHERE id=$1 RETURNING id`, [petId]);
  const deleted = res.rows[0] ?? null;

  // 3) delete from S3 (best effort)
  if (deleted && urls.length > 0) {
    await deleteManyFromS3ByUrls(urls);
  }

  return deleted;
}
