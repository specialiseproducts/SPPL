import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import type { CurrencyRates } from './SalesForecastingTab';

interface CurrencyRateSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRates: CurrencyRates;
  onSave: (rates: CurrencyRates) => void;
}

export default function CurrencyRateSettingsModal({
  isOpen,
  onClose,
  currentRates,
  onSave,
}: CurrencyRateSettingsModalProps) {
  const [rates, setRates] = useState<CurrencyRates>(currentRates);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setRates(currentRates);
      setErrors({});
    }
  }, [isOpen, currentRates]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!rates.Euro || rates.Euro <= 0) {
      newErrors.Euro = 'Euro rate must be greater than 0';
    }
    if (!rates.USD || rates.USD <= 0) {
      newErrors.USD = 'USD rate must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    onSave(rates);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-[#212529]">Currency Rate Settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                These rates are used to convert foreign currency amounts to INR for sales forecasting calculations.
              </p>
            </div>

            <div>
              <Label htmlFor="inr">INR (Base Currency)</Label>
              <Input id="inr" type="number" value={1} disabled className="bg-gray-100" />
              <p className="text-xs text-gray-500 mt-1">INR is the base currency (rate = 1)</p>
            </div>

            <div>
              <Label htmlFor="euro">
                Euro to INR Rate <span className="text-red-500">*</span>
              </Label>
              <Input
                id="euro"
                type="number"
                step="0.01"
                value={rates.Euro}
                onChange={(e) => setRates({ ...rates, Euro: parseFloat(e.target.value) || 0 })}
                placeholder="95"
              />
              {errors.Euro && <p className="text-sm text-red-500 mt-1">{errors.Euro}</p>}
              <p className="text-xs text-gray-500 mt-1">1 Euro = {rates.Euro} INR</p>
            </div>

            <div>
              <Label htmlFor="usd">
                USD to INR Rate <span className="text-red-500">*</span>
              </Label>
              <Input
                id="usd"
                type="number"
                step="0.01"
                value={rates.USD}
                onChange={(e) => setRates({ ...rates, USD: parseFloat(e.target.value) || 0 })}
                placeholder="86"
              />
              {errors.USD && <p className="text-sm text-red-500 mt-1">{errors.USD}</p>}
              <p className="text-xs text-gray-500 mt-1">1 USD = {rates.USD} INR</p>
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
