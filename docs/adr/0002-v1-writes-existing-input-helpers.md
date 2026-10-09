---
Status: accepted
---

# v1 applies Target Profiles by writing the user's existing input helpers

When the Growth Phase changes, the addon writes the user's existing `input_number`, `input_datetime`, and `input_boolean` helpers rather than exposing its own entities, so the existing automations keep working untouched. This is a deliberate v1 bridge: the obvious design — addon-owned select/number/time entities — is the destination for the deferred public stage, where the addon must not depend on one user's helpers. A reasonable reader would assume the opposite, which is exactly why it is recorded here.
