// FS-36: what the tab bar does when a tab is pressed.
// - Every tab can register how to go back to its first page (useTabReset): pressing a tab always opens that page.
// - A challenge in progress registers a leave guard (useLeaveGuard): the tab bar pauses it and asks before leaving.
import { useEffect, useRef } from "react";

export type TabRoute = "index" | "manche" | "doigte" | "ear" | "settings";
export type LeaveGuard = { pause: () => void; resume: () => void; quit: () => void };

const resets = new Map<string, () => void>();
let guard: LeaveGuard | null = null;

/** Registers how this tab goes back to its first page (its library). */
export function useTabReset(route: TabRoute, reset: () => void) {
  const ref = useRef(reset);
  ref.current = reset;
  useEffect(() => {
    const fn = () => ref.current();
    resets.set(route, fn);
    return () => {
      if (resets.get(route) === fn) resets.delete(route);
    };
  }, [route]);
}
export const resetTab = (route: string) => resets.get(route)?.();

/** While `active` (a challenge running), leaving through the tab bar first pauses it and asks for confirmation. */
export function useLeaveGuard(active: boolean, handlers: LeaveGuard) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    if (!active) return;
    const g: LeaveGuard = { pause: () => ref.current.pause(), resume: () => ref.current.resume(), quit: () => ref.current.quit() };
    guard = g;
    return () => {
      if (guard === g) guard = null;
    };
  }, [active]);
}
export const currentGuard = () => guard;
