import { z } from 'zod';

export const serviceRequestTypeSchema = z.enum([
  'call_waiter',
  'request_water',
  'request_bill',
  'request_assistance',
  'request_napkins',
  'other',
]);
export type ServiceRequestType = z.infer<typeof serviceRequestTypeSchema>;

export const serviceRequestStatusSchema = z.enum([
  'open',
  'acknowledged',
  'resolved',
]);
export type ServiceRequestStatus = z.infer<typeof serviceRequestStatusSchema>;

export const serviceRequestSchema = z.object({
  id: z.string(),
  restaurantId: z.string(),
  tableId: z.string().nullable(),
  type: serviceRequestTypeSchema,
  note: z.string().default(''),
  status: serviceRequestStatusSchema,
  createdAt: z.string(),
});
export type ServiceRequest = z.infer<typeof serviceRequestSchema>;

export const createServiceRequestSchema = z.object({
  restaurantId: z.string(),
  tableId: z.string().nullable().default(null),
  type: serviceRequestTypeSchema,
  note: z.string().max(500).default(''),
});
export type CreateServiceRequest = z.infer<typeof createServiceRequestSchema>;
