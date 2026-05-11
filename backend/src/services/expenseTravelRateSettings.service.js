import {
  getTravelRateSettings,
  putTravelRateSettings,
  EXPENSE_TRAVEL_RATES_SETTING_ID,
} from '../models/ExpenseTravelRateSettings.js';

export const DEFAULT_TRAVEL_RATES = {
  car: { petrolDieselRate: 0, electricRate: 0 },
  bike: { petrolDieselRate: 0, electricRate: 0 },
};

function clampNonNegativeNumber(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    const err = new Error('Each rate must be a non-negative finite number');
    err.statusCode = 400;
    throw err;
  }
  return n;
}

export async function getTravelRateSettingsForApi() {
  const row = await getTravelRateSettings();
  if (!row?.car || !row?.bike) {
    return {
      ...DEFAULT_TRAVEL_RATES,
      settingId: EXPENSE_TRAVEL_RATES_SETTING_ID,
      updatedAt: row?.updatedAt || null,
    };
  }
  return {
    car: {
      petrolDieselRate: Number(row.car.petrolDieselRate) || 0,
      electricRate: Number(row.car.electricRate) || 0,
    },
    bike: {
      petrolDieselRate: Number(row.bike.petrolDieselRate) || 0,
      electricRate: Number(row.bike.electricRate) || 0,
    },
    settingId: EXPENSE_TRAVEL_RATES_SETTING_ID,
    updatedAt: row.updatedAt || null,
  };
}

export async function saveTravelRateSettings(payload, actor) {
  const car = payload?.car || {};
  const bike = payload?.bike || {};
  const item = {
    settingId: EXPENSE_TRAVEL_RATES_SETTING_ID,
    car: {
      petrolDieselRate: clampNonNegativeNumber(car.petrolDieselRate ?? 0),
      electricRate: clampNonNegativeNumber(car.electricRate ?? 0),
    },
    bike: {
      petrolDieselRate: clampNonNegativeNumber(bike.petrolDieselRate ?? 0),
      electricRate: clampNonNegativeNumber(bike.electricRate ?? 0),
    },
    updatedAt: new Date().toISOString(),
    updatedByEmployeeCode: actor?.employeeCode || '',
    updatedByName: actor?.fullName || '',
  };
  await putTravelRateSettings(item);
  return getTravelRateSettingsForApi();
}
