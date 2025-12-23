import { pool } from "../../db";

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
  is_active?: boolean;
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

  if (query.type) add(`type = $${values.length + 1}`, query.type);
  if (query.category) add(`category = $${values.length + 1}`, query.category);
  if (typeof query.is_active === "boolean") add(`is_active = $${values.length + 1}`, query.is_active);
  if (query.created_by) add(`created_by = $${values.length + 1}`, query.created_by);

  if (query.search) {
    // simple search on name/breed/location/about
    const term = `%${query.search}%`;
    add(`(name ILIKE $${values.length + 1} OR breed ILIKE $${values.length + 1} OR location ILIKE $${values.length + 1} OR about ILIKE $${values.length + 1})`, term);
  }

  const limit = Math.min(query.limit ?? 20, 100);
  const offset = query.offset ?? 0;

  values.push(limit, offset);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const res = await pool.query(
    `SELECT *
     FROM pets
     ${whereSql}
     ORDER BY created_at DESC
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

export async function replacePetMedia(petId: string, media: Array<{ media_type: "IMAGE" | "VIDEO"; url: string; is_profile?: boolean | null }>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // delete old
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

    const mediaRes = await pool.query(`SELECT * FROM pet_media WHERE pet_id=$1 ORDER BY is_profile DESC, created_at ASC`, [petId]);
    return mediaRes.rows;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function deletePetHard(petId: string) {
  // pet_media will cascade delete automatically
  const res = await pool.query(`DELETE FROM pets WHERE id=$1 RETURNING id`, [petId]);
  return res.rows[0] ?? null;
}
