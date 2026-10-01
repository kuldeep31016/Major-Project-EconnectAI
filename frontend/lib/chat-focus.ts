import { useSyncExternalStore } from "react";

/** What the user is looking at outside the shared analysis state (e.g. the restoration candidate open on
 *  /restoration), so the assistant can resolve "this" / "why this location?". */
let focus: { candidate: string | null } = { candidate: null };
const subs = new Set<() => void>();

export function setChatFocus(next: { candidate: string | null }) {
  if (next.candidate === focus.candidate) return;
  focus = next;
  subs.forEach((f) => f());
}

export function useChatFocus() {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => focus, () => focus);
}
