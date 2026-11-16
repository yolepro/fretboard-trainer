import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { storage } from "@/src/utils/storage";
import { noteName, type Accidental, type Notation } from "@/src/music/theory";
import { DEFAULT_FRETBOARD_STYLE, isFretboardStyle, type FretboardStyleId } from "@/src/fretboardStyles";

export type Settings = {
  fretboardStyle: FretboardStyleId;
  notation: Notation;
  accidental: Accidental;
  labelMode: "note" | "degree";
  /** Score under the fretboard: show the tablature line too. */
  showTab: boolean;
  /** Landscape: show the score under the fretboard. */
  showScoreLandscape: boolean;
  showNeutral: boolean;
  soundOnTap: boolean;
  volume: number;
  a4: number;
  /** Set once the 1.20 defaults (score + tab shown in both orientations) were applied to saved settings. */
  scoreDefaultsV: number;
};

const DEFAULTS: Settings = {
  fretboardStyle: DEFAULT_FRETBOARD_STYLE,
  notation: "english",
  accidental: "sharp",
  labelMode: "note",
  showTab: true,
  showScoreLandscape: true,
  showNeutral: false,
  soundOnTap: true,
  volume: 0.8,
  a4: 440,
  scoreDefaultsV: 1,
};

const KEY = "fretstudio_settings_v2";

type Ctx = {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  nameOf: (pc: number) => string;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    storage.getItem(KEY, null).then((raw) => {
      if (typeof raw === "string") {
        try {
          const saved = JSON.parse(raw);
          const merged: Settings = {
            ...DEFAULTS,
            ...saved,
            fretboardStyle: isFretboardStyle(saved?.fretboardStyle) ? saved.fretboardStyle : DEFAULT_FRETBOARD_STYLE,
          };
          // 1.20: score + tablature are now shown by default in both orientations (also for already saved settings).
          if (!saved?.scoreDefaultsV) {
            merged.showScoreLandscape = true;
            merged.showTab = true;
            merged.scoreDefaultsV = 1;
            storage.setItem(KEY, JSON.stringify(merged));
          }
          setSettings(merged);
        } catch {
          // keep defaults
        }
      }
    });
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      storage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const nameOf = useCallback(
    (pc: number) => noteName(pc, settings.notation, settings.accidental),
    [settings.notation, settings.accidental],
  );

  const value = useMemo(() => ({ settings, update, nameOf }), [settings, update, nameOf]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings outside SettingsProvider");
  return ctx;
}
