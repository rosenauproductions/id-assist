"use client";

import { useState } from "react";

// A handful of one-click presets on top of the existing free-text hex
// field, so "offer themes" doesn't require redesigning the landing page's
// settings model — the accent color was already the only themeable knob,
// this just makes picking one easier than knowing hex codes by heart.

const THEMES: { name: string; color: string }[] = [
  { name: "Default", color: "" },
  { name: "Forest", color: "#1f6b5a" },
  { name: "Indigo", color: "#4f46e5" },
  { name: "Slate", color: "#334155" },
  { name: "Sunset", color: "#c2410c" },
  { name: "Crimson", color: "#b91c1c" },
  { name: "Ocean", color: "#0369a1" },
];

export function AccentThemePicker({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {THEMES.map((theme) => (
          <button
            key={theme.name}
            type="button"
            title={theme.name}
            aria-label={theme.name}
            onClick={() => setValue(theme.color)}
            className={`h-7 w-7 rounded-full border-2 transition-transform ${
              value === theme.color
                ? "border-foreground scale-110"
                : "border-line hover:scale-105"
            }`}
            style={{ background: theme.color || "var(--accent)" }}
          />
        ))}
      </div>
      <input
        name="accentColor"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="#1f6b5a"
        className="field"
      />
    </div>
  );
}
