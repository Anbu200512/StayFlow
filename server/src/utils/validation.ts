import { z } from 'zod';

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');

export const dateStringSchema = z.coerce.date();

export const dateRangeSchema = z.object({
  checkIn: dateStringSchema,
  checkOut: dateStringSchema,
}).superRefine((value, context) => {
  if (value.checkOut <= value.checkIn) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['checkOut'], message: 'Check-out must be after check-in' });
  }
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export function getPagination(input: z.infer<typeof paginationSchema>) {
  return { page: input.page, limit: input.limit, skip: (input.page - 1) * input.limit };
}
