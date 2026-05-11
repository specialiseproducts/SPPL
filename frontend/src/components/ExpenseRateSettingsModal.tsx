/**
 * Expense per-km rate settings — UX mirrors Sales Forecasting `CurrencyRateSettingsModal`
 * (fixed overlay, header bar, helper panel, footer Save/Cancel).
 * Future: auto travel amount = f(vehicle subCategory, fuelType, km, these rates).
 */
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

export interface ExpenseTravelRateSettings {
  car: { petrolDieselRate: number; electricRate: number };
  bike: { petrolDieselRate: number; electricRate: number };
}

interface ExpenseRateSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRates: ExpenseTravelRateSettings;
  onSave: (rates: ExpenseTravelRateSettings) => void | Promise<void>;
}

export default function ExpenseRateSettingsModal({
  isOpen,
  onClose,
  initialRates,
  onSave,
}: ExpenseRateSettingsModalProps) {
  const [rates, setRates] = useState<ExpenseTravelRateSettings>(initialRates);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setRates(initialRates);
      setErrors({});
    }
  }, [isOpen, initialRates]);

  const validateForm = () => {
    const next: Record<string, string> = {};
    const vehicles: (keyof ExpenseTravelRateSettings)[] = ['car', 'bike'];
    for (const vehicle of vehicles) {
      for (const field of ['petrolDieselRate', 'electricRate'] as const) {
        const v = rates[vehicle][field];
        if (!Number.isFinite(v) || v < 0) {
          next[`${vehicle}.${field}`] = 'Enter a valid non-negative number';
        }
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      await Promise.resolve(onSave(rates));
    } catch {
      /* parent shows toast */
    }
  };

  if (!isOpen) return null;

  const setRate = (vehicle: 'car' | 'bike', field: 'petrolDieselRate' | 'electricRate', raw: string) => {
    const n = parseFloat(raw);
    setRates((prev) => ({
      ...prev,
      [vehicle]: {
        ...prev[vehicle],
        [field]: Number.isNaN(n) ? 0 : Math.max(0, n),
      },
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-[#212529]">Expense Rate Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                These rates will be used for automatic travel expense amount calculation.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#212529] mb-3 border-b pb-2">Car</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="car-pd">Petrol/Diesel — Rate per KM</Label>
                  <Input
                    id="car-pd"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={rates.car.petrolDieselRate}
                    onChange={(e) => setRate('car', 'petrolDieselRate', e.target.value)}
                  />
                  {errors['car.petrolDieselRate'] && (
                    <p className="text-sm text-red-500 mt-1">{errors['car.petrolDieselRate']}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="car-el">Electric — Rate per KM</Label>
                  <Input
                    id="car-el"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={rates.car.electricRate}
                    onChange={(e) => setRate('car', 'electricRate', e.target.value)}
                  />
                  {errors['car.electricRate'] && (
                    <p className="text-sm text-red-500 mt-1">{errors['car.electricRate']}</p>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-[#212529] mb-3 border-b pb-2">Bike</h3>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="bike-pd">Petrol/Diesel — Rate per KM</Label>
                  <Input
                    id="bike-pd"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={rates.bike.petrolDieselRate}
                    onChange={(e) => setRate('bike', 'petrolDieselRate', e.target.value)}
                  />
                  {errors['bike.petrolDieselRate'] && (
                    <p className="text-sm text-red-500 mt-1">{errors['bike.petrolDieselRate']}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="bike-el">Electric — Rate per KM</Label>
                  <Input
                    id="bike-el"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={rates.bike.electricRate}
                    onChange={(e) => setRate('bike', 'electricRate', e.target.value)}
                  />
                  {errors['bike.electricRate'] && (
                    <p className="text-sm text-red-500 mt-1">{errors['bike.electricRate']}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="bg-[#007BFF] hover:bg-[#0056b3]">
              Save Rates
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
