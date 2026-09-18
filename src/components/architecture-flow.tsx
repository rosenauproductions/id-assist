import { StatusIcon } from "@/components/status";
import type { ArchStage } from "@/lib/architecture-status";

// Real flowchart for the /architecture page's Pipeline section — fixed-size
// stage boxes on a row, connected by SVG arrows, with a dashed loop-back
// showing the soft approval gate. Same coordinate-math approach as
// components/flowchart-map.tsx (absolute-positioned boxes over an absolute
// SVG in a shared coordinate space) so the two flowcharts in this app read
// as one visual language.

const BOX_W = 208;
const BOX_H = 260;
const GAP_X = 56;
const MARGIN = 24;

function stageX(index: number) {
  return MARGIN + index * (BOX_W + GAP_X);
}

export function ArchitectureFlow({ stages }: { stages: ArchStage[] }) {
  const rowY = MARGIN;
  const centerY = rowY + BOX_H / 2;
  const loopBaseline = rowY + BOX_H + 56;
  const width = MARGIN * 2 + stages.length * BOX_W + (stages.length - 1) * GAP_X;
  const height = loopBaseline + 40;

  const arrows = stages.slice(0, -1).map((stage, i) => ({
    key: `arrow-${stage.id}`,
    x1: stageX(i) + BOX_W,
    x2: stageX(i + 1),
    y: centerY,
  }));

  // Loop-back: the soft approval gate resets status (and wipes artifacts)
  // back toward Organize/Scrutinize whenever anything downstream changes —
  // drawn as a dashed arc dipping below the row from the last stage back
  // to the second one.
  const loopToIndex = Math.min(1, stages.length - 1);
  const loopFromX = stageX(stages.length - 1) + BOX_W / 2;
  const loopToX = stageX(loopToIndex) + BOX_W / 2;
  const loopFromY = rowY + BOX_H;
  const loopPath = `M ${loopFromX} ${loopFromY} C ${loopFromX} ${loopBaseline}, ${loopToX} ${loopBaseline}, ${loopToX} ${loopFromY}`;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="relative" style={{ width, height }}>
        <svg
          width={width}
          height={height}
          className="pointer-events-none absolute inset-0"
        >
          <defs>
            <marker
              id="arch-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="var(--line)" />
            </marker>
            <marker
              id="arch-arrow-danger"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="var(--danger)" />
            </marker>
          </defs>
          {arrows.map((arrow) => (
            <line
              key={arrow.key}
              x1={arrow.x1}
              y1={arrow.y}
              x2={arrow.x2 - 6}
              y2={arrow.y}
              stroke="var(--line)"
              strokeWidth={1.5}
              markerEnd="url(#arch-arrow)"
            />
          ))}
          <path
            d={loopPath}
            fill="none"
            stroke="var(--danger)"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            markerEnd="url(#arch-arrow-danger)"
          />
        </svg>

        {stages.map((stage, index) => (
          <div
            key={stage.id}
            className="absolute flex flex-col gap-2 rounded-xl border border-line bg-card p-4"
            style={{
              left: stageX(index),
              top: rowY,
              width: BOX_W,
              height: BOX_H,
            }}
          >
            <span className="font-mono text-xs text-muted">
              {String(stage.order).padStart(2, "0")}
            </span>
            <h3 className="text-base font-semibold">{stage.title}</h3>
            <p className="font-mono text-[11px] leading-snug text-muted">
              {stage.file}
            </p>
            <ul className="mt-1 flex flex-col gap-1.5">
              {stage.chips.map((chip) => (
                <li
                  key={chip.label}
                  className="flex items-start gap-2 text-xs text-muted"
                >
                  <StatusIcon
                    status={chip.status}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  />
                  <span>{chip.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
