import {
  getTravelRateSettings,
  putTravelRateSettings,
  EXPENSE_TRAVEL_RATES_SETTING_ID,
} from '../models/ExpenseTravelRateSettings.js';

export const DEFAULT_TRAVEL_RATES = {
  car: { petrolDieselRate: 0, electricRate: 0 },
  bike: { petrolDieselRate: 0, electricRate: 0 },
};

function parseSafeNonNegative(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function clampNonNegativeNumber(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    const err = new Error('Each rate must be a non-negative finite number');
    err.statusCode = 400;
    throw err;
  }
  return n;
}

/** API payload shape (no Dynamo-only fields). */
function formatApiResponseFromStoredItem(item) {
  if (!item || typeof item !== 'object') {
    return {
      ...DEFAULT_TRAVEL_RATES,
      settingId: EXPENSE_TRAVEL_RATES_SETTING_ID,
      updatedAt: null,
      updatedBy: null,
    };
  }
  return {
    car: {
      petrolDieselRate: parseSafeNonNegative(item.car?.petrolDieselRate),
      electricRate: parseSafeNonNegative(item.car?.electricRate),
    },
    bike: {
      petrolDieselRate: parseSafeNonNegative(item.bike?.petrolDieselRate),
      electricRate: parseSafeNonNegative(item.bike?.electricRate),
    },
    settingId: EXPENSE_TRAVEL_RATES_SETTING_ID,
    updatedAt: item.updatedAt != null ? String(item.updatedAt) : null,
    updatedBy:
      item.updatedBy != null && String(item.updatedBy).trim() !== ''
        ? String(item.updatedBy).trim()
        : [item.updatedByName, item.updatedByEmployeeCode]
            .map((x) => (x != null ? String(x).trim() : ''))
            .filter(Boolean)
            .join(' ')
            .trim() || null,
  };
}

/**
 * GET /api/expenses/settings/travel-rates
 * Defaults (all zeros) only when there is no stored row for EXPENSE_TRAVEL_RATES_V1.
 */
export async function getTravelRateSettingsForApi() {
  const row = await getTravelRateSettings();
  if (!row || String(row.settingId || '').trim() !== EXPENSE_TRAVEL_RATES_SETTING_ID) {
    return {
      ...DEFAULT_TRAVEL_RATES,
      settingId: EXPENSE_TRAVEL_RATES_SETTING_ID,
      updatedAt: null,
      updatedBy: null,
    };
  }
  return formatApiResponseFromStoredItem(row);
}

function assertVehicleRates(label, obj) {
  if (!obj || typeof obj !== 'object') {
    const err = new Error(`${label} must be an object with petrolDieselRate and electricRate`);
    err.statusCode = 400;
    throw err;
  }
  if (obj.petrolDieselRate === undefined || obj.electricRate === undefined) {
    const err = new Error(`${label} must include petrolDieselRate and electricRate`);
    err.statusCode = 400;
    throw err;
  }
}

function buildUpdatedBy(actor) {
  if (!actor || typeof actor !== 'object') return 'unknown';
  const name = String(actor.fullName || '').trim();
  if (name) return name;
  const code = String(actor.employeeCode || '').trim();
  if (code) return code;
  const first = String(actor.firstName || '').trim();
  const last = String(actor.lastName || '').trim();
  const combo = `${first} ${last}`.trim();
  return combo || 'unknown';
}

/**
 * PUT /api/expenses/settings/travel-rates
 * Persists canonical item and returns the saved values (no follow-up read that can be stale).
 */
export async function saveTravelRateSettings(payload, actor) {
  if (!payload || typeof payload !== 'object') {
    const err = new Error('Request body is required');
    err.statusCode = 400;
    throw err;
  }
  const car = payload.car;
  const bike = payload.bike;
  assertVehicleRates('car', car);
  assertVehicleRates('bike', bike);

  const item = {
    settingId: EXPENSE_TRAVEL_RATES_SETTING_ID,
    car: {
      petrolDieselRate: clampNonNegativeNumber(car.petrolDieselRate),
      electricRate: clampNonNegativeNumber(car.electricRate),
    },
    bike: {
      petrolDieselRate: clampNonNegativeNumber(bike.petrolDieselRate),
      electricRate: clampNonNegativeNumber(bike.electricRate),
    },
    updatedAt: new Date().toISOString(),
    updatedBy: buildUpdatedBy(actor),
  };

  await putTravelRateSettings(item);
  return formatApiResponseFromStoredItem(item);
}
