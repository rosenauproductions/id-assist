"use client";

import { useState } from "react";
import type { LoginEventPoint } from "@/lib/admin/login-events";

// A hand-rolled equirectangular scatter plot — no mapping library in the
// codebase and no way to visually verify a real cartographic SVG in this
// dev setup, so this favors a projection that's simple, obviously correct,
// and easy to read (a lat/long graticule plus plotted points) over
// unverifiable country-border path data. "Globe" plots the whole world;
// "US" is the same projection cropped to the continental US's bounding box.

type ViewMode = "globe" | "us";

const BOUNDS: Record<ViewMode, { lonMin: number; lonMax: number; latMin: number; latMax: number }> = {
  globe: { lonMin: -180, lonMax: 180, latMin: -60, latMax: 75 },
  us: { lonMin: -125, lonMax: -66, latMin: 24, latMax: 50 },
};

const WIDTH = 720;
const HEIGHT = 380;

function project(
  lat: number,
  lng: number,
  bounds: (typeof BOUNDS)[ViewMode],
): { x: number; y: number } {
  const x = ((lng - bounds.lonMin) / (bounds.lonMax - bounds.lonMin)) * WIDTH;
  const y =
    ((bounds.latMax - lat) / (bounds.latMax - bounds.latMin)) * HEIGHT;
  return { x, y };
}

function graticuleLines(
  bounds: (typeof BOUNDS)[ViewMode],
  step: number,
): { lats: number[]; lons: number[] } {
  const lats: number[] = [];
  for (let lat = Math.ceil(bounds.latMin / step) * step; lat <= bounds.latMax; lat += step) {
    lats.push(lat);
  }
  const lons: number[] = [];
  for (let lon = Math.ceil(bounds.lonMin / step) * step; lon <= bounds.lonMax; lon += step) {
    lons.push(lon);
  }
  return { lats, lons };
}

export function LoginMap({ points }: { points: LoginEventPoint[] }) {
  const [view, setView] = useState<ViewMode>("globe");
  const [hoverId, setHoverId] = useState<string | null>(null);
  const bounds = BOUNDS[view];
  const { lats, lons } = graticuleLines(bounds, view === "globe" ? 30 : 10);

  const plotted = points.filter(
    (point): point is LoginEventPoint & { lat: number; lng: number } =>
      point.lat !== null &&
      point.lng !== null &&
      point.lng >= bounds.lonMin &&
      point.lng <= bounds.lonMax &&
      point.lat >= bounds.latMin &&
      point.lat <= bounds.latMax,
  );

  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-line p-0.5 text-sm">
          {(["globe", "us"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={`rounded px-3 py-1 font-medium transition-colors ${
                view === mode
                  ? "bg-accent/10 text-accent"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {mode === "globe" ? "Globe" : "US"}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted">
          {plotted.length} of {points.length} shown in this view
        </p>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mt-3 w-full rounded-lg border border-line bg-background"
        role="img"
        aria-label={`Login locations, ${view === "globe" ? "world" : "US"} view`}
      >
        {lats.map((lat) => {
          const { y } = project(lat, bounds.lonMin, bounds);
          return (
            <line
              key={`lat-${lat}`}
              x1={0}
              x2={WIDTH}
              y1={y}
              y2={y}
              stroke="var(--line)"
              strokeWidth={lat === 0 ? 1.2 : 0.6}
              opacity={lat === 0 ? 0.6 : 0.35}
            />
          );
        })}
        {lons.map((lon) => {
          const { x } = project(bounds.latMax, lon, bounds);
          return (
            <line
              key={`lon-${lon}`}
              x1={x}
              x2={x}
              y1={0}
              y2={HEIGHT}
              stroke="var(--line)"
              strokeWidth={lon === 0 ? 1.2 : 0.6}
              opacity={lon === 0 ? 0.6 : 0.35}
            />
          );
        })}

        {plotted.map((point) => {
          const { x, y } = project(point.lat, point.lng, bounds);
          const isHovered = hoverId === point.id;
          return (
            <g key={point.id}>
              <circle
                cx={x}
                cy={y}
                r={isHovered ? 6 : 4}
                fill="var(--accent)"
                fillOpacity={isHovered ? 0.9 : 0.65}
                stroke="var(--card)"
                strokeWidth={1}
                onMouseEnter={() => setHoverId(point.id)}
                onMouseLeave={() => setHoverId((current) => (current === point.id ? null : current))}
              >
                <title>
                  {[point.email, point.workspaceName, [point.city, point.region, point.country].filter(Boolean).join(", ")]
                    .filter(Boolean)
                    .join(" · ")}
                  {" — "}
                  {new Date(point.createdAt).toLocaleString()}
                </title>
              </circle>
            </g>
          );
        })}
      </svg>

      {plotted.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          No located logins in this window and view. Hover a dot for details
          once there are some.
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted">
          Hover a dot for who, where, and when.
        </p>
      )}
    </div>
  );
}
