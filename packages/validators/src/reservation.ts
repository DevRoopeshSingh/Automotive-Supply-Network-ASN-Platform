import { z } from "zod";

export const CreateStockReservationSchema = z.object({
  checkoutId: z.string().uuid(),
  holdDurationSeconds: z.number().int().min(180).max(420).default(300), // 3 to 7 minutes (default 5 min)
  items: z
    .array(
      z.object({
        supplierProductId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1, "Reservation requires at least one product item"),
});

export type CreateStockReservationInput = z.infer<
  typeof CreateStockReservationSchema
>;
