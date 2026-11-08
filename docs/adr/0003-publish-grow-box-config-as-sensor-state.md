---
Status: accepted
---

# The Grow Box configuration is published to the frontend as sensor state

Config entry options are not exposed to the Home Assistant frontend, but the panel needs the Grow Box configuration — Entity Roles, camera rotation, Target Profiles per Growth Phase, Plants — plus the active Grow Run and the current Growth Phase. The integration therefore publishes all of it as the attributes of one `sensor.growhelper_config` state per config entry (further entries get `_2`, `_3`, …, which the panel's prefix match covers). The sensor is event-driven, not polled: it refreshes when the config entry is updated (options flow, active Grow Run changes via `async_update_entry`) and when a phase input helper changes state (ADR-0002). The accepted trade-off: the configuration is duplicated into the state machine instead of the frontend reading the entry directly — unavoidable, because Home Assistant does not expose options to the frontend. The E2E tests previously pushed this state through the REST API as a placeholder; that placeholder is gone now that the backend publishes the real sensor. A reasonable reader would assume the frontend can read config entries — it cannot, which is exactly why this is recorded here.
