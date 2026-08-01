import PincodeTabs from "./pincode-tabs"

export default function PincodesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex-1 bg-slate-50">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-base font-bold text-slate-900">Pincodes</h1>
      </div>
      <PincodeTabs />
      {children}
    </div>
  )
}
