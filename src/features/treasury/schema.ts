import { z } from "zod";
import {
  ASSET_TYPES,
  MOVEMENT_KINDS,
  ORTAK_MOVEMENT_TYPES,
} from "@/lib/supabase/types";

const requiredString = (msg: string) =>
  z.string().trim().min(1, msg);

const positiveNumber = (msg = "Must be greater than zero") =>
  z.preprocess((v) => {
    if (v === "" || v === null || v === undefined) return undefined;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : NaN;
  }, z.number({ error: "Must be a number" }).positive(msg));

const signedNonZeroNumber = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : NaN;
}, z
  .number({ error: "Must be a number" })
  .refine((n) => n !== 0, "Cannot be zero"));

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

const optionalOrtak = z
  .enum(ORTAK_MOVEMENT_TYPES)
  .nullable()
  .optional();

export const addHoldingSchema = z.object({
  account_name: requiredString("Account name is required"),
  asset_code: requiredString("Asset code is required"),
  asset_type: z.enum(ASSET_TYPES),
  custody_location_id: requiredString("Pick a custody location"),
  custody_requires_movement_type: z.boolean(),
  quantity: positiveNumber("Opening quantity must be positive"),
  movement_date: dateString,
  ortak_movement_type: optionalOrtak,
  notes: z.string().optional().default(""),
}).superRefine((v, ctx) => {
  if (v.custody_requires_movement_type && !v.ortak_movement_type) {
    ctx.addIssue({
      path: ["ortak_movement_type"],
      code: z.ZodIssueCode.custom,
      message: "Required for this custody",
    });
  }
});

export type AddHoldingValues = z.input<typeof addHoldingSchema>;
export type AddHoldingOutput = z.output<typeof addHoldingSchema>;

const movementCommonFields = {
  movement_date: dateString,
  notes: z.string().optional().default(""),
  ortak_movement_type: optionalOrtak,
  any_leg_requires_movement_type: z.boolean(),
};

export const movementSchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("opening"),
      account_id: requiredString("Pick an account"),
      quantity: positiveNumber(),
      ...movementCommonFields,
    }),
    z.object({
      kind: z.literal("deposit"),
      account_id: requiredString("Pick an account"),
      quantity: positiveNumber(),
      ...movementCommonFields,
    }),
    z.object({
      kind: z.literal("withdraw"),
      account_id: requiredString("Pick an account"),
      quantity: positiveNumber(),
      ...movementCommonFields,
    }),
    z.object({
      kind: z.literal("adjustment"),
      account_id: requiredString("Pick an account"),
      quantity: signedNonZeroNumber,
      ...movementCommonFields,
    }),
    z.object({
      kind: z.literal("transfer"),
      from_account_id: requiredString("Pick a source account"),
      to_account_id: requiredString("Pick a destination account"),
      quantity: positiveNumber(),
      from_asset_code: z.string(),
      to_asset_code: z.string(),
      ...movementCommonFields,
    }),
    z.object({
      kind: z.literal("trade"),
      from_account_id: requiredString("Pick a source account"),
      to_account_id: requiredString("Pick a destination account"),
      quantity_from: positiveNumber("Source quantity must be positive"),
      quantity_to: positiveNumber("Destination quantity must be positive"),
      from_asset_code: z.string(),
      to_asset_code: z.string(),
      ...movementCommonFields,
    }),
  ])
  .superRefine((v, ctx) => {
    if (v.any_leg_requires_movement_type && !v.ortak_movement_type) {
      ctx.addIssue({
        path: ["ortak_movement_type"],
        code: z.ZodIssueCode.custom,
        message: "Required when Ortak is involved",
      });
    }
    if (v.kind === "transfer") {
      if (v.from_account_id === v.to_account_id) {
        ctx.addIssue({
          path: ["to_account_id"],
          code: z.ZodIssueCode.custom,
          message: "Pick a different destination",
        });
      }
      if (
        v.from_asset_code &&
        v.to_asset_code &&
        v.from_asset_code !== v.to_asset_code
      ) {
        ctx.addIssue({
          path: ["to_account_id"],
          code: z.ZodIssueCode.custom,
          message: "Transfer requires the same asset on both sides",
        });
      }
    }
    if (v.kind === "trade") {
      if (v.from_account_id === v.to_account_id) {
        ctx.addIssue({
          path: ["to_account_id"],
          code: z.ZodIssueCode.custom,
          message: "Pick a different destination",
        });
      }
      if (
        v.from_asset_code &&
        v.to_asset_code &&
        v.from_asset_code === v.to_asset_code
      ) {
        ctx.addIssue({
          path: ["to_account_id"],
          code: z.ZodIssueCode.custom,
          message: "Trade requires different assets on each side",
        });
      }
    }
  });

export type MovementValues = z.input<typeof movementSchema>;
export type MovementOutput = z.output<typeof movementSchema>;

export const MOVEMENT_KIND_SCHEMA = z.enum(MOVEMENT_KINDS);
