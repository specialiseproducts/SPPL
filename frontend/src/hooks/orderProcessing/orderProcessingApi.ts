import type { OrderProcessingRecord, OrderFormData, OrderAttachment } from '../../types/orderProcessing';
import { apiFetch } from '../../services/api';

export async function fetchMyOrders(): Promise<OrderProcessingRecord[]> {
  const res = (await apiFetch('/api/order-processing')) as { data?: OrderProcessingRecord[] };
  return res?.data ?? [];
}

export async function fetchOrderById(id: string): Promise<OrderProcessingRecord> {
  const res = (await apiFetch(`/api/order-processing/${encodeURIComponent(id)}`)) as {
    data?: OrderProcessingRecord;
  };
  if (!res?.data) throw new Error('Order not found');
  return res.data;
}

export async function createOrder(data: OrderFormData): Promise<OrderProcessingRecord> {
  const res = (await apiFetch('/api/order-processing', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })) as { data?: OrderProcessingRecord };
  if (!res?.data) throw new Error('Create order failed');
  return res.data;
}

export async function updateOrder(
  id: string,
  data: Partial<OrderFormData>,
): Promise<OrderProcessingRecord> {
  const res = (await apiFetch(`/api/order-processing/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })) as { data?: OrderProcessingRecord };
  if (!res?.data) throw new Error('Update order failed');
  return res.data;
}

export async function deleteOrder(id: string): Promise<void> {
  await apiFetch(`/api/order-processing/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function uploadOrderFile(file: File): Promise<OrderAttachment> {
  const formData = new FormData();
  formData.append('file', file);
  const res = (await apiFetch('/api/order-processing/upload', {
    method: 'POST',
    body: formData,
  })) as { data?: OrderAttachment };
  if (!res?.data) throw new Error('File upload failed');
  return res.data;
}
