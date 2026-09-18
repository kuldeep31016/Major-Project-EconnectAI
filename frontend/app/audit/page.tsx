"use client";

import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { AppShell } from "@/components/dashboard/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { fetchAudit, type AuditItem } from "@/lib/api";

/** Append-only application audit log (state admin / senior officer). */
export default function AuditPage() {
  const { user, ready, can } = useAuth();
  const [rows, setRows] = useState<AuditItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!ready || !user) return;
    fetchAudit(500).then(setRows).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [ready, user]);
  return (
    <AppShell title="Audit trail" subtitle="Immutable record of who did what, when, and why — never edited by the application">
      <div className="p-4 sm:p-6">
        {!user && ready && <div className="text-[13px]">Sign in as a state administrator or senior officer.</div>}
        {user && !can("view_audit") && <div className="text-[13px] text-[#b45309]">Your role cannot view the audit log.</div>}
        {err && <div className="text-[12px] text-[#b91c1c]">{err}</div>}
        {rows && (
          <div className="overflow-x-auto rounded-2xl border border-foreground/[0.08] bg-card">
            <table className="w-full text-[11.5px]">
              <thead className="bg-foreground/[0.04] text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2 text-left">Time</th><th className="text-left">User</th><th className="text-left">Role</th><th className="text-left">Action</th><th className="text-left">Object</th><th className="text-left">Old → new</th><th className="text-left">Reason</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-foreground/[0.06] align-top">
                    <td className="whitespace-nowrap px-3 py-1.5 tabular">{new Date(r.ts).toLocaleString()}</td><td>{r.username}</td><td>{r.role}</td><td className="font-medium">{r.action}</td>
                    <td>{r.object_type ? `${r.object_type} ${r.object_id ?? ""}` : "—"}</td>
                    <td className="max-w-[360px] break-words text-muted-foreground">{r.old_state ? JSON.stringify(r.old_state) : ""}{r.old_state ? " → " : ""}{r.new_state ? JSON.stringify(r.new_state).slice(0, 160) : ""}</td>
                    <td className="text-muted-foreground">{r.reason ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center gap-2 px-3 py-2 text-[10.5px] text-muted-foreground"><ScrollText className="h-3 w-3" /> {rows.length} entries (latest 500)</div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
