import { SearchableCombobox } from './SearchableCombobox';

interface OrganizationComboboxProps {
  label: string;
  value: string;
  options: string[];
  getAddressForOrganization: (name: string) => string;
  onChange: (organizationName: string, address: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function OrganizationCombobox({
  label,
  value,
  options,
  getAddressForOrganization,
  onChange,
  placeholder = 'Search or select organization…',
  disabled = false,
}: OrganizationComboboxProps) {
  return (
    <SearchableCombobox
      label={label}
      value={value}
      options={options}
      onChange={(name) => onChange(name, getAddressForOrganization(name))}
      placeholder={placeholder}
      disabled={disabled}
      emptyMessage="No matching organizations."
    />
  );
}
