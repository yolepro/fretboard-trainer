import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { storage } from "@/src/utils/storage";
import { noteName, type Accidental, type Notation } from "@/src/music/theory";
import { DEFAULT_FRETBOARD_STYLE, isFretboardStyle, type FretboardStyleId } from "@/src/fretboardStyles";

export type Settings = {
  fretboardStyle: FretboardStyleId;
  notation: Notation;
  accidental: Accidental;
  labelMode: "note" | "degree";
  showNeutral: boolean;
  soundOnTap: boolean;
  volume: number;
  a4: number;
};

const DEFAULTS: Settings = {
  fretboardStyle: DEFAULT_FRETBOARD_STYLE,
  notation: "english",
  accidental: "sharp",
  labelMode: "note",
  showNeutral: false,
  soundOnTap: true,
  volume: 0.8,
  a4: 440,
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
          setSettings({
            ...DEFAULTS,
            ...saved,
            fretboardStyle: isFretboardStyle(saved?.fretboardStyle) ? saved.fretboardStyle : DEFAULT_FRETBOARD_STYLE,
          });
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
