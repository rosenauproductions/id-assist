# ID Assist — Handoff for Claude

**Date:** 2026-09-15  
**Owner:** Christopher Rosenau  
**Repo path:** `Desktop/Personal - Chris/Cursor Projects/id-assist`  
**Status:** Local app working; git has **no commits yet** (everything untracked). Next.js 16 + Electron desktop shell.

Read `AGENTS.md` / `CLAUDE.md` first — this is **not** classic Next.js; check `node_modules/next/dist/docs/` before changing framework APIs.

---

## What this product is

**ID Assist** = local instructional-design compiler (HITL):

1. **Brief** (home form or `/wizard`) → quality-gated fields  
2. **Compile** → pedagogy outline (Bloom / ADDIE / Gagné), filters, production estimate  
3. **Human approve** outline  
4. **Create delivery files** → markdown build packs per channel (Rise, Canvas, Doc, Slides, Video, Tutor)  
5. **Live tutor** → Ollama coach teaching the approved outline  

Philosophy: outline is design; delivery files are **recipes** for humans to build in real tools — not finished `.rise` / LMS exports.

---

## How to run

```bash
cd "/Users/christopherrosenau/Desktop/Personal - Chris/Cursor Projects/id-assist"
npm install
npm run ollama:setup   # needs Ollama running + model
npm run dev            # http://127.0.0.1:3000
# or desktop window:
npm run desktop
# or double-click ID Assist.app / Desktop shortcut
```

Env: copy `.env.example` → `.env.local` (gitignored). Default provider is **Ollama** (`OLLAMA_MODEL=id-assist-tutor`).

Desktop notes:
- Electron entry: `desktop/main.mjs` (spawns `node` + Next bin `dev -p 3000 -H 127.0.0.1`)
- Rebuild app: `npm run launcher:app`
- Logs: `launcher/desktop.log`
- Past failure mode: “local server stopped unexpectedly” — fixed by direct node+next spawn (not fragile npm/detached)

---

## Data layout (important)

Projects live under **human-named folders**:

```
data/projects/<slug-from-title>/
  project.json
  artifacts/
    01-rise-build-sheet.md
    02-canvas-pages.md
    …
```

- Internal id stays `prj_…` in JSON / URLs; **Finder name** is `folderName` (slug of course title).
- Legacy `prj_xxx` folders and flat `prj_xxx.json` auto-migrate on load/save (`src/lib/id/store.ts`).
- Delete removes the whole folder. **Open folder** shells out (`open` / `explorer` / `xdg-open`).

Example on disk now: `data/projects/how-to-make-an-ai-bot/` (title: “how to make an AI bot”).

---

## Key code map

| Area | Path |
|------|------|
| Types | `src/lib/id/types.ts` |
| Persist / folders / open / delete | `src/lib/id/store.ts` |
| Brief → outline | `src/lib/id/compile.ts` |
| Quality filters | `src/lib/id/filters.ts` |
| Cost / time estimate | `src/lib/id/estimate.ts` |
| Delivery markdown packs | `src/lib/id/adapters.ts` |
| Wizard field rules | `src/lib/id/brief-validate.ts` |
| Suggest / develop-field coach | `src/lib/id/brief-coach.ts` |
| Coach API (rules + optional LLM) | `src/app/api/brief-coach/route.ts` |
| Ollama refine outline | `src/lib/id/refine.ts` |
| Model picker | `src/lib/id/model.ts` |
| Tutor system prompt | `src/lib/id/tutor-prompt.ts` |
| Server actions | `src/app/actions.ts` |
| Home + brief form | `src/app/page.tsx` |
| Wizard UI (2-col coach) | `src/app/wizard/brief-wizard.tsx` |
| Project workspace | `src/app/projects/[id]/project-workspace.tsx` |
| Project list (delete / open folder) | `src/app/projects/project-list.tsx` |
| Tutor API | `src/app/api/tutor/route.ts` |
| Artifact download | `src/app/api/projects/[id]/artifacts/[filename]/route.ts` |

---

## Product decisions already made

- **Two clocks:** learner seat time vs production hours/cost.  
- **SME:** W2 vs per-project fee on the team model.  
- **Outline gate:** weak briefs blocked; wizard has Check & continue + live coaching.  
- **Job task field:** “What must they be able to do after the course?” — suggests rewrites; **Help me develop this** asks Qs and drafts the field. Coach panel is **right column** on wide screens.  
- **Delivery files** (UI label; was “Generate artifacts”): only for channels in the brief’s build mix; markdown in `artifacts/`.  
- Optional Google Drive OAuth stubs in `.env.example` — **not implemented**.

---

## Known rough edges / next work

1. **Git:** nothing committed yet — first commit when Chris asks.  
2. **Sample project quality:** `how-to-make-an-ai-bot` brief is weak/typo-heavy; outline may need wizard re-entry or refine.  
3. **LLM coach quality:** `/api/brief-coach` can invent nonsense if the model goes off rails; rules fallback exists — may want tighter prompts / refuse garbage.  
4. **Google Drive** push of delivery files — deferred.  
5. **Desktop:** verify relaunch of `ID Assist.app` after folder/delete UX changes.  
6. Consider writing a short `HANDOFF.md` **into each course folder** on save (course-specific state for ID work) — not done yet; this file is **app** handoff only.

---

## User preferences (from this build thread)

- Human folder names (not `prj_99a7a0c7`).  
- Delete older drafts; open project folder in Finder.  
- Wizard coaching beside the field (right side).  
- Explain delivery files as human build packs, not finished assets.  
- Prefer concise agent communication; don’t commit unless asked.  
- Frontend: avoid generic AI-slop aesthetics when designing new surfaces (see Cursor user rules).

---

## Smoke checklist for the next agent

- [ ] `npm run dev` → home lists projects with **Open folder** / **Delete**  
- [ ] Open `how-to-make-an-ai-bot` → folder name shows as slug  
- [ ] `/wizard` → job task suggestions + develop panel on the right  
- [ ] Approve outline → **Create delivery files** → files under `data/projects/<slug>/artifacts/`  
- [ ] Open folder opens Finder to that slug directory  
- [ ] Delete confirms and removes the folder  
- [ ] Tutor only after approve; needs Ollama  

---

## One-liner for context reload

> Local Next 16 + Electron ID compiler: brief wizard with field coach → outline/filters/estimate → approve → markdown delivery packs in human-named `data/projects/<title-slug>/` → Ollama tutor. Persist in `store.ts`; UI in `project-workspace` + `brief-wizard`.
