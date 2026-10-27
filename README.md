# Growhelper

A [Home Assistant](https://www.home-assistant.io/) custom integration, distributed via [HACS](https://hacs.xyz/), that gives a **Grow Box** a single management surface: a sidebar panel with the box's climate, plants and grow diary, a configuration flow for your entities and targets, and a markdown diary per cultivation run.

The control loop (automations, VPD alarm, PID controller) stays in Home Assistant — Growhelper is the management layer on top of it.

## Features (v1)

- Sidebar panel "Growhelper" mirroring your existing dashboard layout (overview, light & plants, climate, VPD)
- One config entry per Grow Box, created through the standard Home Assistant UI
- Dashboard sections for the camera, climate, VPD, light schedule, Plants, and Grow Diary

See `CONTEXT.md` for the domain glossary (Grow Box, Grow Run, Plant, Growth Phase, Target Profile, VPD, …) and `docs/adr/` for accepted architecture decisions.

## Installation

1. Open HACS → Integrations → ⋮ → Custom repositories
2. Add `https://github.com/10aka2/growhelper` with category **Integration**
3. Install **Growhelper** and restart Home Assistant
4. Go to Settings → Devices & Services → Add Integration → **Growhelper**, and name your Grow Box

## Development

Tests run against a real Home Assistant instance (`pytest-homeassistant-custom-component`, pinned to HA 2026.9.4). HA 2026.x requires **Python 3.14**.

```bash
# Python test environment (uv installs a standalone Python 3.14 if needed)
uv venv --python 3.14 .venv
uv pip install --python .venv/bin/python -r requirements_test.txt
.venv/bin/python -m pytest

# Typechecking (config in mypy.ini)
.venv/bin/python -m mypy custom_components/growhelper tests

# Frontend panel (bundled with esbuild)
npm ci
npm run build

# Docker integration and browser-level panel tests
npx playwright install chromium
docker compose -f tests/e2e/docker-compose.yml up -d
python tests/e2e/smoke.py
npm run test:e2e:panel
docker compose -f tests/e2e/docker-compose.yml down
```

Code follows the standards in `AGENTS.md` (documented, glossary-based naming, small units) and the domain language in `CONTEXT.md`.
