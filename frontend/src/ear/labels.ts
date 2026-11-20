// Display text for a recorded target (results, end-of-challenge progress, weak-point tags).
import { intervalName, positionText } from "@/src/ear/questions";
import type { Attempt } from "@/src/ear/stats";
import type { WeakReason } from "@/src/ear/weakness";
import { octaveOf, pcOf } from "@/src/music/theory";
import { getLang, tr } from "@/src/i18n";

export const secs = (ms: number) => {
  const t = (ms / 1000).toFixed(1);
  return `${getLang() === "fr" ? t.replace(".", ",") : t} s`;
};

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

export function targetName(a: Attempt, nameOf: (pc: number) => string) {
  if (a.midi !== undefined) return `${nameOf(pcOf(a.midi))}${octaveOf(a.midi)}`;
  if (a.s === "interval" && a.label) return intervalName(a.label);
  return cap(tr(a.label ?? "?"));
}

export function targetWhere(a: Attempt) {
  if (a.string !== undefined && a.fret !== undefined) return positionText({ string: a.string, fret: a.fret });
  if (a.s === "degree" && a.sub) return tr(a.sub);
  if (a.s === "interval" && a.label) return a.label;
  return "";
}

export function reasonText(r?: WeakReason) {
  if (!r) return "";
  switch (r.kind) {
    case "new":
      return tr("jamais demandée");
    case "few":
      return tr("encore peu jouée");
    case "missed":
      return tr("ratée {m} fois sur {n}", { m: r.missed, n: r.tries });
    case "slow":
      return tr("lente ({t})", { t: secs(r.ms) });
    case "forgot":
      return tr("pas revue depuis {n} jours", { n: r.days });
  }
}
