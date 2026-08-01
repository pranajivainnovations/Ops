import { logoutAction } from "@/app/login/actions"
import SidebarNav from "./sidebar-nav"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="px-5 py-5">
          <p className="text-sm font-bold text-slate-900">CrossFriend Ops</p>
        </div>
        <SidebarNav />
        <div className="border-t border-slate-200 p-3">
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  )
}
