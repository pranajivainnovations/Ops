"use client"

import { useState, useTransition } from "react"
import { simulatePrice, type SimulatorResult } from "./actions"

interface Option {
  value: string
  label: string
}

interface Props {
  weights: Option[]
  tiers: Option[]
  shapes: Option[]
  styles: Option[]
  flavors: Option[]
}

export default function SimulatorForm({ weights, tiers, shapes, styles, flavors }: Props) {
  const [weight, setWeight] = useState(weights[0]?.value ?? "")
  const [tier, setTier] = useState(tiers[0]?.value ?? "")
  const [shape, setShape] = useState(shapes[0]?.value ?? "")
  const [style, setStyle] = useState(styles[0]?.value ?? "")
  const [flavor, setFlavor] = useState(flavors[0]?.value ?? "")
  const [expressDelivery, setExpressDelivery] = useState(false)
  const [midnightDelivery, setMidnightDelivery] = useState(false)
  const [messageOnCake, setMessageOnCake] = useState(false)
  const [photoOnCake, setPhotoOnCake] = useState(false)
  const [pincode, setPincode] = useState("")

  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<SimulatorResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCalculate = () => {
    setError(null)
    setResult(null)
    if (pincode && !/^\d{6}$/.test(pincode)) {
      setError("Pincode must be 6 digits, or left blank.")
      return
    }
    startTransition(async () => {
      const res = await simulatePrice({
        weight,
        tiers: tier || undefined,
        shape: shape || undefined,
        style: style || undefined,
        flavor: flavor || undefined,
        expressDelivery,
        midnightDelivery,
        messageOnCake,
        photoOnCake,
        pincode: pincode || undefined,
      })
      if ("error" in res) {
        setError(res.error)
      } else {
        setResult(res)
      }
    })
  }

  const selectClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-bold text-slate-900">Selections</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Weight</label>
            <select className={selectClass} value={weight} onChange={(e) => setWeight(e.target.value)}>
              {weights.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Tiers</label>
            <select className={selectClass} value={tier} onChange={(e) => setTier(e.target.value)}>
              {tiers.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Shape</label>
            <select className={selectClass} value={shape} onChange={(e) => setShape(e.target.value)}>
              {shapes.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Style</label>
            <select className={selectClass} value={style} onChange={(e) => setStyle(e.target.value)}>
              {styles.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Flavor</label>
            <select className={selectClass} value={flavor} onChange={(e) => setFlavor(e.target.value)}>
              {flavors.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input type="checkbox" checked={expressDelivery} onChange={(e) => setExpressDelivery(e.target.checked)} />
              Express Delivery
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input type="checkbox" checked={midnightDelivery} onChange={(e) => setMidnightDelivery(e.target.checked)} />
              Midnight Delivery
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input type="checkbox" checked={messageOnCake} onChange={(e) => setMessageOnCake(e.target.checked)} />
              Message on Cake
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input type="checkbox" checked={photoOnCake} onChange={(e) => setPhotoOnCake(e.target.checked)} />
              Photo on Cake
            </label>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Pincode <span className="font-normal text-slate-400">(optional — tests region overrides)</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="e.g. 201016"
              className={selectClass}
            />
          </div>

          <button
            type="button"
            onClick={handleCalculate}
            disabled={isPending || !weight}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {isPending ? "Calculating…" : "Calculate Price"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-bold text-slate-900">Result</h2>
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
        )}
        {!error && !result && (
          <p className="text-xs text-slate-400">Pick a combination and calculate to see the price here.</p>
        )}
        {result && (
          <div>
            <p className="text-2xl font-bold text-slate-900">₹{result.total.toLocaleString("en-IN")}</p>
            <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
              {result.breakdown.map((line, i) => (
                <div key={i} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-600">{line.label}</span>
                  <span className="font-medium text-slate-900">₹{line.amount.toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
