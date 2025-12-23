export const registerBodySchema = {
  type: "object",
  required: ["name", "phone_number", "password"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1 },
    phone_number: { type: "string", minLength: 6 },
    email: { type: "string", format: "email", nullable: true },
    password: { type: "string", minLength: 8 },
    age: { type: "integer", nullable: true },
    sex: { type: "string", enum: ["MALE", "FEMALE"], nullable: true },
    location: { type: "string", nullable: true }
  }
} as const;

export const loginBodySchema = {
  type: "object",
  required: ["phone_number", "password"],
  additionalProperties: false,
  properties: {
    phone_number: { type: "string", minLength: 6 },
    password: { type: "string", minLength: 8 }
  }
} as const;

export const accessTokenResponseSchema = {
  type: "object",
  required: ["accessToken"],
  properties: { accessToken: { type: "string" } }
} as const;
