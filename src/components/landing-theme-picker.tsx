"use client";

import { useState } from "react";
import { LANDING_THEME_PRESETS, type FontFamilyId } from "@/lib/platform/settings";

const FONT_LABELS: Record<FontFamilyId, string> = {
  sans: "Sans (default)",
  serif: "Serif",
  mono: "Mono",
  display: "Display",
};

// Bundles background + accent + font into one click (see
// LandingThemePreset in lib/platform/settings.ts for why they're bundled
// rather than three independent pickers), with the three underlying form
// fields still editable afterward for fine-tuning — picking "Forest" and
// then nudging just the accent hex doesn't reset the background or font.
export function LandingThemePicker({
  defaultAccentColor,
  defaultBackgroundColor,
  defaultFontFamily,
}: {
  defaultAccentColor: string;
  defaultBackgroundColor: string;
  defaultFontFamily: FontFamilyId;
}) {
  const matchedPreset = LANDING_THEME_PRESETS.find(
    (preset) =>
      preset.accentColor === defaultAccentColor &&
      preset.backgroundColor === defaultBackgroundColor &&
      preset.fontFamily === defaultFontFamily,
  );
  const [selectedId, setSelectedId] = useState(matchedPreset?.id ?? "");
  const [accentColor, setAccentColor] = useState(defaultAccentColor);
  const [backgroundColor, setBackgroundColor] = useState(defaultBackgroundColor);
  const [fontFamily, setFontFamily] = useState<FontFamilyId>(defaultFontFamily);

  function applyPreset(preset: (typeof LANDING_THEME_PRESETS)[number]) {
    setSelectedId(preset.id);
    setAccentColor(preset.accentColor);
    setBackgroundColor(preset.backgroundColor);
    setFontFamily(preset.fontFamily);
  }

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {LANDING_THEME_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            title={preset.name}
            onClick={() => applyPreset(preset)}
            className={`flex items-center gap-2 rounded-lg border p-2 text-left text-xs transition-colors ${
              selectedId === preset.id
                ? "border-accent ring-1 ring-accent"
                : "border-line hover:border-accent/40"
            }`}
          >
            <span
              className="h-6 w-6 shrink-0 rounded-full border border-line/60"
              style={{
                background: preset.backgroundColor || "var(--background)",
                boxShadow: `inset 0 0 0 3px ${preset.accentColor || "var(--accent)"}`,
              }}
            />
            <span className="truncate font-medium">{preset.name}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-xs">
          <span className="font-medium text-muted">Accent color</span>
          <input
            name="accentColor"
            value={accentColor}
            onChange={(event) => {
              setSelectedId("");
              setAccentColor(event.target.value);
            }}
            placeholder="#1f6b5a"
            className="field"
          />
        </label>
        <label className="grid gap-1 text-xs">
          <span className="font-medium text-muted">Background color</span>
          <input
            name="backgroundColor"
            value={backgroundColor}
            onChange={(event) => {
              setSelectedId("");
              setBackgroundColor(event.target.value);
            }}
            placeholder="#ffffff"
            className="field"
          />
        </label>
        <label className="grid gap-1 text-xs">
          <span className="font-medium text-muted">Font</span>
          <select
            name="fontFamily"
            value={fontFamily}
            onChange={(event) => {
              setSelectedId("");
              setFontFamily(event.target.value as FontFamilyId);
            }}
            className="field"
          >
            {Object.entries(FONT_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
