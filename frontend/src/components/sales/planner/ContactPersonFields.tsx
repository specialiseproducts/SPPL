import { MasterCombobox } from '../MasterCombobox';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';

const grid2 = 'grid grid-cols-1 gap-4 md:grid-cols-2';
const taAddress = 'min-h-[4.5rem] resize-y';

export type ContactPersonValues = {
  contactTitle: string;
  contactFullName: string;
  contactAddress: string;
  contactNumber: string;
  contactEmail: string;
};

interface ContactPersonFieldsProps {
  values: ContactPersonValues;
  onChange: (patch: Partial<ContactPersonValues>) => void;
  contactTitleOptions: string[];
  idPrefix?: string;
}

/** Shared contact person block — same fields as Create New Quotation. */
export default function ContactPersonFields({
  values,
  onChange,
  contactTitleOptions,
  idPrefix = 'cp',
}: ContactPersonFieldsProps) {
  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
      <h3 className="text-sm font-semibold text-[#212529]">Contact person</h3>
      <div className={grid2}>
        <MasterCombobox
          label="Title"
          value={values.contactTitle}
          onChange={(v) => onChange({ contactTitle: v })}
          options={contactTitleOptions}
          placeholder="Select title"
        />
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-cfn`}>Full name</Label>
          <Input
            id={`${idPrefix}-cfn`}
            value={values.contactFullName}
            onChange={(e) => onChange({ contactFullName: e.target.value })}
            placeholder="Full name"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-cad`}>Address</Label>
        <Textarea
          id={`${idPrefix}-cad`}
          className={taAddress}
          rows={3}
          value={values.contactAddress}
          onChange={(e) => onChange({ contactAddress: e.target.value })}
          placeholder="Street, city, postal code…"
        />
      </div>
      <div className={grid2}>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-cnum`}>Phone number</Label>
          <Input
            id={`${idPrefix}-cnum`}
            type="tel"
            value={values.contactNumber}
            onChange={(e) => onChange({ contactNumber: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-cem`}>Email</Label>
          <Input
            id={`${idPrefix}-cem`}
            type="email"
            value={values.contactEmail}
            onChange={(e) => onChange({ contactEmail: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
