import { z } from "zod";

/** 出発地と車の既定値の入力。本人の /me と、配車係の代理入力・CSV 取り込みで共通 */
export const originInputSchema = z
  .object({
    addressInput: z.string().trim().min(1, "出発地の住所を入れてください").max(200, "住所は200文字までです"),
    canDrive: z.boolean(),
    vehicleCapacity: z.number().int().min(1, "定員は1人以上にしてください").max(15, "定員は15人までです").nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.canDrive && v.vehicleCapacity === null) {
      ctx.addIssue({ code: "custom", path: ["vehicleCapacity"], message: "車を出せるときは定員（運転する人を含む）を入れてください" });
    }
  })
  .transform((v) => ({ ...v, vehicleCapacity: v.canDrive ? v.vehicleCapacity : null }));

export type OriginInput = z.input<typeof originInputSchema>;
