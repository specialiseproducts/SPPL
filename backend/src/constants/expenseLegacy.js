/**
 * Legacy DynamoDB attribute that stored "location + purpose" in one field.
 * Old items may still have this key; new writes use `location` and `purpose` only.
 */
export const EXPENSE_LEGACY_COMBINED_LOCATION_ATTR = 'locationPurpose';
