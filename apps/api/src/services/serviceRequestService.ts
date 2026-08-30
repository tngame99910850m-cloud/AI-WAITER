import type { CreateServiceRequest, ServiceRequest, ServiceRequestStatus } from '@ai-waiter/shared';
import { randomUUID } from 'node:crypto';
import { store } from '../data/store.js';
import { audit } from './auditService.js';
import { persistence } from '../db/txnRepo.js';

export async function createServiceRequest(input: CreateServiceRequest): Promise<ServiceRequest> {
  const t = store.tenant(input.restaurantId);
  const req: ServiceRequest = {
    id: randomUUID(),
    restaurantId: input.restaurantId,
    tableId: input.tableId ?? null,
    type: input.type,
    note: input.note,
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  t.serviceRequests.set(req.id, req);
  await persistence().saveServiceRequest(req);
  audit(input.restaurantId, 'customer', 'service_request.create', req.id, { type: req.type });
  return req;
}

export function listServiceRequests(restaurantId: string): ServiceRequest[] {
  return [...store.tenant(restaurantId).serviceRequests.values()].sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt),
  );
}

export async function updateServiceRequestStatus(
  restaurantId: string,
  id: string,
  status: ServiceRequestStatus,
): Promise<ServiceRequest | null> {
  const t = store.tenant(restaurantId);
  const req = t.serviceRequests.get(id);
  if (!req) return null;
  const updated = { ...req, status };
  t.serviceRequests.set(id, updated);
  await persistence().updateServiceRequestStatus(restaurantId, id, status);
  audit(restaurantId, 'admin', 'service_request.status', id, { status });
  return updated;
}
