export const createPetBodySchema = {
  type: "object",
  required: ["name", "category", "type"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1 },
    birth_date: { type: "string", format: "date", nullable: true },
    age: { type: "integer", nullable: true },
    sex: { type: "string", enum: ["MALE", "FEMALE"], nullable: true },

    breed: { type: "string", nullable: true },
    adoption_fee: { type: "number", nullable: true },

    category: { type: "string", enum: ["STRAY", "OWNED"] },
    type: { type: "string", enum: ["DOG", "CAT"] },

    location: { type: "string", nullable: true },
    about: { type: "string", nullable: true },
    contact_info: { type: "string", nullable: true },

    vaccinated: { type: "boolean", nullable: true },
    dewormed: { type: "boolean", nullable: true },
    sprayed: { type: "boolean", nullable: true },

    is_active: { type: "boolean", nullable: true },

    media: {
      type: "array",
      nullable: true,
      items: {
        type: "object",
        required: ["media_type", "url"],
        additionalProperties: false,
        properties: {
          media_type: { type: "string", enum: ["IMAGE", "VIDEO"] },
          url: { type: "string", minLength: 1 },
          is_profile: { type: "boolean", nullable: true }
        }
      }
    }
  }
} as const;

export const updatePetBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, nullable: true },
    birth_date: { type: "string", format: "date", nullable: true },
    age: { type: "integer", nullable: true },
    sex: { type: "string", enum: ["MALE", "FEMALE"], nullable: true },

    breed: { type: "string", nullable: true },
    adoption_fee: { type: "number", nullable: true },

    category: { type: "string", enum: ["STRAY", "OWNED"], nullable: true },
    type: { type: "string", enum: ["DOG", "CAT"], nullable: true },

    location: { type: "string", nullable: true },
    about: { type: "string", nullable: true },
    contact_info: { type: "string", nullable: true },

    vaccinated: { type: "boolean", nullable: true },
    dewormed: { type: "boolean", nullable: true },
    sprayed: { type: "boolean", nullable: true },

    is_active: { type: "boolean", nullable: true }
  }
} as const;

export const addOrReplaceMediaBodySchema = {
  type: "object",
  required: ["media"],
  additionalProperties: false,
  properties: {
    // Replaces all media (simple & clean). If you want partial add/remove, tell me.
    media: {
      type: "array",
      minItems: 0,
      items: {
        type: "object",
        required: ["media_type", "url"],
        additionalProperties: false,
        properties: {
          media_type: { type: "string", enum: ["IMAGE", "VIDEO"] },
          url: { type: "string", minLength: 1 },
          is_profile: { type: "boolean", nullable: true }
        }
      }
    }
  }
} as const;
