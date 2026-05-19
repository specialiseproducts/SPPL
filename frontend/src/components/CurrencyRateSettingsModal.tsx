import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import type { ExchangeRatesMap } from '../types/salesForecast';

interface CurrencyRateSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRates: ExchangeRatesMap;
  onSave: (rates: ExchangeRatesMap) => void | Promise<void>;
}

const RATE_FIELDS: { key: string; label: string }[] = [
  { key: 'Euro', label: 'Euro to INR' },
  { key: 'US$', label: 'US$ to INR' },
  { key: 'GBP', label: 'GBP to INR' },
];

export default function CurrencyRateSettingsModal({
  isOpen,
  onClose,
  currentRates,
  onSave,
}: CurrencyRateSettingsModalProps) {
  const [rates, setRates] = useState<ExchangeRatesMap>({ ...currentRates });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setRates({ INR: 1, ...currentRates });
      setErrors({});
    }
  }, [isOpen, currentRates]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    for (const { key } of RATE_FIELDS) {
      const v = Number(rates[key]);
      if (!v || v <= 0) newErrors[key] = 'Rate must be greater than 0';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    await Promise.resolve(onSave({ ...rates, INR: 1 }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-[#212529]">Currency Rate Settings</h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                Rates convert line totals to INR for reporting. Values are stored in DynamoDB (sales master data).
              </p>
            </div>

            <div>
              <Label htmlFor="inr">INR (Base Currency)</Label>
              <Input id="inr" type="number" value={1} disabled className="bg-gray-100" />
              <p className="text-xs text-gray-500 mt-1">INR is the base currency (rate = 1)</p>
            </div>

            {RATE_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <Label htmlFor={key}>
                  {label} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id={key}
                  type="number"
                  step="0.01"
                  value={rates[key] ?? ''}
                  onChange={(e) => setRates({ ...rates, [key]: parseFloat(e.target.value) || 0 })}
                />
                {errors[key] && <p className="text-sm text-red-500 mt-1">{errors[key]}</p>}
                <p className="text-xs text-gray-500 mt-1">
                  1 {key} = {rates[key] ?? '—'} INR
                </p>
              </div>
            ))}
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
