import { z } from "zod";

export const phoneSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s()-]/g, ""))
  .pipe(z.string().regex(/^\+?\d{10,14}$/, "Enter a valid phone number"));

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email").max(200);

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Enter a full name")
  .max(80)
  .regex(/^[^<>{}$\\]*$/, "Name contains invalid characters");

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export const dobSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date of birth")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    const age = (Date.now() - d.getTime()) / (365.25 * 864e5);
    return !Number.isNaN(d.getTime()) && age > 4 && age < 100;
  }, "Enter a valid date of birth");

export const genderSchema = z.enum(["MALE", "FEMALE", "OTHER"]);

/** Empty strings from forms → undefined, so optional fields validate only when filled in. */
const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

// Contact fields are optional at the schema level; which players must provide them depends on the
// category (all players in singles/doubles, the captain in larger squads) and is enforced in createRegistration.
export const playerSchema = z.object({
  fullName: nameSchema,
  email: z.preprocess(blankToUndefined, emailSchema.optional()),
  phone: z.preprocess(blankToUndefined, phoneSchema.optional()),
  dateOfBirth: z.preprocess(blankToUndefined, dobSchema.optional()),
  gender: genderSchema.optional(),
  city: z.string().trim().max(60).optional(),
  emergencyContactName: z.string().trim().max(80).optional(),
  emergencyContactPhone: z.string().trim().max(20).optional(),
  skillLevel: z.string().trim().max(40).optional(),
});
export type PlayerInput = z.infer<typeof playerSchema>;

export const registrationSchema = z.object({
  tournamentId: z.string().cuid(),
  categoryId: z.string().cuid(),
  team: z
    .object({
      name: z.string().trim().min(2, "Enter a team name").max(50).regex(/^[^<>{}$\\]*$/, "Invalid characters"),
      captainName: nameSchema,
      captainEmail: emailSchema,
      captainPhone: phoneSchema,
    })
    .optional(),
  players: z.array(playerSchema).min(1).max(30),
  answers: z.record(z.string(), z.union([z.string().max(1000), z.boolean()])).default({}),
  acceptTerms: z.literal(true, { error: "You must accept the terms and conditions" }),
});
export type RegistrationInput = z.infer<typeof registrationSchema>;

export type CustomQuestion = { id: string; label: string; type: "text" | "select" | "checkbox"; required: boolean; options?: string[] };

export function parseCustomQuestions(json: unknown): CustomQuestion[] {
  if (!Array.isArray(json)) return [];
  return json
    .filter((q): q is CustomQuestion => !!q && typeof q === "object" && typeof (q as CustomQuestion).id === "string" && typeof (q as CustomQuestion).label === "string")
    .map((q) => ({ id: q.id, label: q.label, type: q.type ?? "text", required: !!q.required, options: Array.isArray(q.options) ? q.options : undefined }));
}

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function zodFieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
