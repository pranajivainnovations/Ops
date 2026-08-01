import { STATUS_VALUES } from "./constants"

interface DefaultValues {
  name?: string | null
  contact_person?: string | null
  phone?: string | null
  whatsapp_number?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  service_radius_km?: number | null
  serviceable_pincodes?: string[] | null
  status?: string | null
  source?: string | null
  assigned_to?: string | null
  notes?: string | null
  wholesale_pricing_notes?: string | null
  avg_turnaround_hours?: number | null
  specialty_tags?: string[] | null
  reliability_rating?: number | null
  is_public?: boolean | null
  bio?: string | null
  blue_tick?: boolean | null
  trust_badge?: boolean | null
  is_active?: boolean | null
}

interface Props {
  action: (formData: FormData) => void | Promise<void>
  defaultValues?: DefaultValues
  submitLabel: string
}

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  )
}

export default function BakerForm({ action, defaultValues = {}, submitLabel }: Props) {
  const dv = defaultValues

  return (
    <form action={action} className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Identity</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name *">
            <input name="name" required defaultValue={dv.name ?? ""} className={inputClass} />
          </Field>
          <Field label="Contact person">
            <input name="contact_person" defaultValue={dv.contact_person ?? ""} className={inputClass} />
          </Field>
          <Field label="Phone">
            <input name="phone" defaultValue={dv.phone ?? ""} className={inputClass} />
          </Field>
          <Field label="WhatsApp number">
            <input name="whatsapp_number" defaultValue={dv.whatsapp_number ?? ""} className={inputClass} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" defaultValue={dv.email ?? ""} className={inputClass} />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Geography</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Address">
            <input name="address" defaultValue={dv.address ?? ""} className={inputClass} />
          </Field>
          <Field label="City">
            <input name="city" defaultValue={dv.city ?? ""} className={inputClass} />
          </Field>
          <Field label="State">
            <input name="state" defaultValue={dv.state ?? ""} className={inputClass} />
          </Field>
          <Field label="Pincode">
            <input name="pincode" maxLength={6} defaultValue={dv.pincode ?? ""} className={inputClass} />
          </Field>
          <Field label="Service radius (km)">
            <input
              name="service_radius_km"
              type="number"
              step="0.1"
              defaultValue={dv.service_radius_km ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Other serviceable pincodes (comma-separated)">
            <input
              name="serviceable_pincodes"
              defaultValue={dv.serviceable_pincodes?.join(", ") ?? ""}
              className={inputClass}
              placeholder="201016, 201009"
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">Onboarding / CRM</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Status">
            <select name="status" defaultValue={dv.status ?? "prospect"} className={inputClass}>
              {STATUS_VALUES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Source">
            <input
              name="source"
              defaultValue={dv.source ?? ""}
              className={inputClass}
              placeholder="e.g. NCR Maps sweep"
            />
          </Field>
          <Field label="Assigned to">
            <input name="assigned_to" defaultValue={dv.assigned_to ?? ""} className={inputClass} />
          </Field>
        </div>
        <Field label="Notes">
          <textarea name="notes" defaultValue={dv.notes ?? ""} rows={3} className={inputClass} />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
          Fulfillment / commerce
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Avg turnaround (hours)">
            <input
              name="avg_turnaround_hours"
              type="number"
              defaultValue={dv.avg_turnaround_hours ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Internal reliability rating (0-5)">
            <input
              name="reliability_rating"
              type="number"
              step="0.1"
              min="0"
              max="5"
              defaultValue={dv.reliability_rating ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Specialty tags (comma-separated)">
            <input
              name="specialty_tags"
              defaultValue={dv.specialty_tags?.join(", ") ?? ""}
              className={inputClass}
              placeholder="eggless, fondant"
            />
          </Field>
        </div>
        <Field label="Wholesale pricing notes">
          <textarea
            name="wholesale_pricing_notes"
            defaultValue={dv.wholesale_pricing_notes ?? ""}
            rows={2}
            className={inputClass}
          />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
          Directory (Phase 3, dormant)
        </h2>
        <Field label="Bio">
          <textarea name="bio" defaultValue={dv.bio ?? ""} rows={2} className={inputClass} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="is_public" defaultChecked={dv.is_public ?? false} />
          Public in directory (Phase 3 — has no effect yet)
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400">
          Trust signals &amp; visibility
        </h2>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="trust_badge" defaultChecked={dv.trust_badge ?? false} />
          Trust Badge — formally affiliated with CrossFriend (Flow A/B eligible)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="blue_tick" defaultChecked={dv.blue_tick ?? false} />
          Blue Tick — has their own store page with their own products (grant only after review)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="is_active" defaultChecked={dv.is_active ?? true} />
          Active — visible to customers. Uncheck to soft-offboard without deleting anything.
        </label>
      </section>

      <button
        type="submit"
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        {submitLabel}
      </button>
    </form>
  )
}
