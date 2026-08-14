/** Allowed quotation edit-permission request types. */
export const EDIT_REQUEST_TYPES = [
  'Price',
  'Warranty',
  'Decision Expected By',
  'Part Number',
  'Probability',
];

export const EDIT_REQUEST_ADMIN_EMAIL = 'mridulverma@specialiseproducts.com';

export function isValidEditRequestType(type) {
  return EDIT_REQUEST_TYPES.includes(String(type || '').trim());
}
