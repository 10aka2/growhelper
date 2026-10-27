"""End-to-end smoke test for the Growhelper integration.

Expects the Home Assistant container from tests/e2e/docker-compose.yml to be
running (locally or in CI):

    docker compose -f tests/e2e/docker-compose.yml up -d
    python tests/e2e/smoke.py
    docker compose -f tests/e2e/docker-compose.yml down

The test drives the integration exclusively through Home Assistant's public
REST API — the same surface the frontend panel uses:

1. Wait for Home Assistant to accept API requests.
2. Complete the onboarding (create the initial user) and get an access token.
3. Create the Growhelper config entry through the config flow.
4. Fill the options flow with the dummy Entity Roles from
   tests/e2e/config/configuration.yaml (sensors, switches, input helpers,
   demo camera) and one Plant with a soil sensor group.
5. Assert the entry is loaded, the three services are registered, the panel
   is registered (websocket get_panels) and its static JS is served.
6. Exercise the services: start_grow_run, add_diary_entry, set_growth_phase,
   and verify the input helpers written by the phase bridge (ADR-0002).
7. Verify the Grow Diary file (ADR-0001 format) in the bind-mounted config
   directory.
8. Publish the panel's documented frontend-config fixture as a Home Assistant
   state for the browser-level rendered-content test.

Requires the `requests` and `websocket-client` packages.
Configuration via environment:
    HA_BASE_URL   Home Assistant base URL (default http://127.0.0.1:8123)
    HA_USERNAME   onboarding user     (default growhelper-e2e)
    HA_PASSWORD   onboarding password (default growhelper-e2e)

Exit code 0 on success, 1 on the first failed check.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import Any

try:
    import requests
except ImportError:
    sys.exit("The smoke test requires the 'requests' package: pip install requests")

try:
    import websocket
except ImportError:
    sys.exit(
        "The smoke test requires the 'websocket-client' package: "
        "pip install websocket-client"
    )

BASE_URL = os.environ.get("HA_BASE_URL", "http://127.0.0.1:8123").rstrip("/")
USERNAME = os.environ.get("HA_USERNAME", "growhelper-e2e")
PASSWORD = os.environ.get("HA_PASSWORD", "growhelper-e2e")

GROW_BOX_NAME = "Grow Box"
SMOKE_RUN_NAME = "e2e_smoke_run"
DIARY_NOTE = "E2E smoke test entry"
# Fixed date so the Grow Diary content assertion is deterministic.
DIARY_DATE = "18.10.2026"

# Grow Diary files are written into the bind-mounted config directory.
DIARY_DIR = Path(__file__).resolve().parent / "config" / "growhelper"

# Entity Roles (ENTITY_ROLES in custom_components/growhelper/const.py) mapped
# to the dummy entities provided by tests/e2e/config/configuration.yaml. The
# camera role is resolved at runtime from /api/states (demo platform).
ROLE_ENTITY_IDS: dict[str, str] = {
    "canopy_temperature": "sensor.canopy_temperature",
    "canopy_humidity": "sensor.canopy_humidity",
    "vpd_sensor": "sensor.vpd",
    "humidifier": "switch.humidifier",
    "dehumidifier": "switch.dehumidifier",
    "exhaust_fan": "switch.exhaust_fan",
    "ventilation_fan": "switch.ventilation_fan",
    "grow_light": "switch.grow_light",
    "humidifier_power": "sensor.humidifier_power",
    "dehumidifier_power": "sensor.dehumidifier_power",
    "exhaust_fan_power": "sensor.exhaust_fan_power",
    "ventilation_fan_power": "sensor.ventilation_fan_power",
    "grow_light_power": "sensor.grow_light_power",
    "growth_phase_early_veg": "input_boolean.growth_phase_early_veg",
    "growth_phase_late_veg": "input_boolean.growth_phase_late_veg",
    "growth_phase_late_bloom": "input_boolean.growth_phase_late_bloom",
    "growth_phase_dry": "input_boolean.growth_phase_dry",
    "growth_phase_off": "input_boolean.growth_phase_off",
    "temperature_lower_threshold": "input_number.temperature_lower_threshold",
    "temperature_upper_threshold": "input_number.temperature_upper_threshold",
    "humidity_lower_threshold": "input_number.humidity_lower_threshold",
    "humidity_upper_threshold": "input_number.humidity_upper_threshold",
    "vpd_lower_threshold": "input_number.vpd_lower_threshold",
    "vpd_upper_threshold": "input_number.vpd_upper_threshold",
    "light_on_time": "input_datetime.light_on_time",
    "light_off_time": "input_datetime.light_off_time",
    # Soil sensor group of Plant 1.
    "plant_1_soil_temperature": "sensor.plant_1_soil_temperature",
    "plant_1_soil_moisture": "sensor.plant_1_soil_moisture",
    "plant_1_soil_illuminance": "sensor.plant_1_soil_illuminance",
    "plant_1_soil_conductivity": "sensor.plant_1_soil_conductivity",
}

# Services the integration registers (services.yaml).
EXPECTED_SERVICES = ("set_growth_phase", "start_grow_run", "add_diary_entry")

# Target Profile defaults the options flow schema offers; the smoke test
# submits them unchanged, so the phase bridge must write exactly these.
EXPECTED_TEMPERATURE_LOWER = 20.0
EXPECTED_VPD_UPPER = 1.2
EXPECTED_LIGHT_ON = "08:00"
EXPECTED_LIGHT_OFF = "20:00"


class SmokeFailure(AssertionError):
    """A smoke check failed."""


def check(condition: bool, message: str) -> None:
    """Raise SmokeFailure with a descriptive message when a check fails."""
    if not condition:
        raise SmokeFailure(message)


def write_step_summary(result: str) -> None:
    """Append the result to the GitHub Actions step summary when running in CI."""
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as file:
            file.write(f"## Growhelper E2E smoke test\n\n**Result:** {result}\n")


def wait_for_ha(session: requests.Session, timeout: float = 180.0) -> None:
    """Poll until Home Assistant answers API requests.

    A 401 without credentials means the HTTP server is up; a fresh container
    needs a while for its first boot, so connection errors are retried.
    """
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            response = session.get(f"{BASE_URL}/api/", timeout=5)
            if response.status_code in (200, 401):
                return
        except requests.RequestException:
            pass
        time.sleep(2)
    raise SmokeFailure(f"Home Assistant did not come up at {BASE_URL} within {timeout}s")


def fetch_token(session: requests.Session, code: str) -> str:
    """Exchange the onboarding auth code for an access token at /auth/token.

    The client id must be a URL (IndieAuth); the instance's own base URL is
    the natural choice for a test client.
    """
    response = session.post(
        f"{BASE_URL}/auth/token",
        data={
            "grant_type": "authorization_code",
            "client_id": f"{BASE_URL}/",
            "code": code,
        },
        timeout=10,
    )
    check(
        response.status_code == 200,
        f"getting an access token failed: {response.status_code} {response.text}",
    )
    return response.json()["access_token"]


def complete_onboarding(session: requests.Session) -> str:
    """Create the initial user through the onboarding API and return a token.

    A fresh Home Assistant container starts in onboarding mode. The user step
    is unauthenticated and returns an auth code, which is exchanged for an
    access token; the remaining steps (core_config, analytics, integration)
    require that token. Core config values come from configuration.yaml, so
    the core_config step takes no payload. HA 2026.9 only supports the
    authorization_code and refresh_token grants at /auth/token, so the
    container must be fresh — in CI it always is.
    """
    response = session.get(f"{BASE_URL}/api/onboarding", timeout=10)
    check(response.status_code == 200, f"onboarding status failed: {response.text}")
    pending = [step["step"] for step in response.json() if not step["done"]]
    check(
        "user" in pending,
        "onboarding user step is already done — restart with a fresh container "
        "(docker compose down, remove tests/e2e/config state, up again)",
    )

    response = session.post(
        f"{BASE_URL}/api/onboarding/users",
        json={
            "name": "E2E",
            "username": USERNAME,
            "password": PASSWORD,
            "client_id": f"{BASE_URL}/",
            "language": "en",
        },
        timeout=30,
    )
    check(
        response.status_code == 200,
        f"onboarding user step failed: {response.status_code} {response.text}",
    )
    token = fetch_token(session, code=response.json()["auth_code"])
    pending.remove("user")

    headers = {"Authorization": f"Bearer {token}"}
    for step_id in pending:
        # The integration step links a client app and verifies the redirect
        # URI via IndieAuth; a client id and redirect URI with the same scheme
        # and host pass without a fetch.
        payload = {}
        if step_id == "integration":
            payload = {
                "client_id": f"{BASE_URL}/",
                "redirect_uri": f"{BASE_URL}/auth-callback",
            }
        response = session.post(
            f"{BASE_URL}/api/onboarding/{step_id}",
            json=payload,
            headers=headers,
            timeout=30,
        )
        check(
            response.status_code == 200,
            f"onboarding step '{step_id}' failed: {response.status_code} {response.text}",
        )
    return token


def get_states(session: requests.Session, headers: dict[str, str]) -> dict[str, dict[str, Any]]:
    """Return all states keyed by entity id."""
    response = session.get(f"{BASE_URL}/api/states", headers=headers, timeout=10)
    check(response.status_code == 200, f"reading states failed: {response.text}")
    return {state["entity_id"]: state for state in response.json()}


def state_equals(expected: str):
    """Build a state predicate: the entity's state string equals `expected`."""
    return lambda state: state == expected


def state_float_equals(expected: float):
    """Build a state predicate: the entity's state parses to `expected`."""

    def predicate(state: str) -> bool:
        try:
            return float(state) == expected
        except ValueError:
            return False

    return predicate


def wait_for_entity(
    session: requests.Session,
    headers: dict[str, str],
    entity_id: str,
    predicate,
    description: str,
    timeout: float = 15.0,
) -> None:
    """Poll until an entity's state satisfies the predicate.

    The phase bridge writes the input helpers via non-blocking service calls,
    so the effects land shortly after the service call returns.
    """
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        state = get_states(session, headers).get(entity_id, {}).get("state")
        if state is not None and predicate(state):
            return
        time.sleep(0.5)
    raise SmokeFailure(f"{entity_id} did not reach {description} within {timeout}s")


def find_grow_box_entry(
    session: requests.Session, headers: dict[str, str]
) -> dict[str, Any]:
    """Return the Growhelper config entry for the Grow Box, or an empty dict.

    HA 2026.9 lists entries at /api/config/config_entries/entry (the fragment
    carries entry_id, domain, title and the state enum value, e.g. "loaded").
    """
    response = session.get(
        f"{BASE_URL}/api/config/config_entries/entry",
        params={"domain": "growhelper"},
        headers=headers,
        timeout=10,
    )
    check(response.status_code == 200, f"reading config entries failed: {response.text}")
    for entry in response.json():
        if entry["domain"] == "growhelper" and entry["title"] == GROW_BOX_NAME:
            return entry
    return {}


def create_grow_box_entry(session: requests.Session, headers: dict[str, str]) -> str:
    """Create the Growhelper config entry via the config flow; return its id.

    Waits until the entry is LOADED, i.e. async_setup_entry has registered the
    services, the static path and the panel.
    """
    response = session.post(
        f"{BASE_URL}/api/config/config_entries/flow",
        json={"handler": "growhelper"},
        headers=headers,
        timeout=10,
    )
    check(response.status_code == 200, f"starting the config flow failed: {response.text}")
    flow = response.json()
    check(flow["step_id"] == "user", f"unexpected config flow step: {flow['step_id']}")

    response = session.post(
        f"{BASE_URL}/api/config/config_entries/flow/{flow['flow_id']}",
        json={"name": GROW_BOX_NAME},
        headers=headers,
        timeout=10,
    )
    check(response.status_code == 200, f"submitting the config flow failed: {response.text}")
    check(
        response.json()["type"] == "create_entry",
        f"the config flow did not create an entry: {response.text}",
    )

    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        entry = find_grow_box_entry(session, headers)
        if entry.get("state") == "loaded":
            return entry["entry_id"]
        time.sleep(1)
    raise SmokeFailure(f"config entry for '{GROW_BOX_NAME}' did not reach state loaded")


def submit_options(
    session: requests.Session, headers: dict[str, str], entry_id: str
) -> dict[str, Any]:
    """Fill the options flow with the dummy Entity Roles and one Plant.

    The payload is built from the flow's own schema: Entity Role pickers get
    the dummy entities, every other field (Target Profiles, camera rotation)
    keeps the schema default. That way the smoke test follows schema changes
    instead of hardcoding a second copy of the field list.
    """
    response = session.post(
        f"{BASE_URL}/api/config/config_entries/options/flow",
        json={"handler": entry_id},
        headers=headers,
        timeout=10,
    )
    check(response.status_code == 200, f"starting the options flow failed: {response.text}")
    flow = response.json()
    check(flow["step_id"] == "init", f"unexpected options flow step: {flow['step_id']}")

    # The camera role is the demo platform's camera. Demo sets up its config
    # entry in the background after boot, so poll until a camera appears.
    cameras: list[str] = []
    deadline = time.monotonic() + 60
    while not cameras and time.monotonic() < deadline:
        states = get_states(session, headers)
        cameras = sorted(entity_id for entity_id in states if entity_id.startswith("camera."))
        if not cameras:
            time.sleep(1)
    check(bool(cameras), "no camera entity found — is the demo platform loaded?")
    role_entity_ids = {**ROLE_ENTITY_IDS, "camera": cameras[0]}

    # The entity pickers only accept entities that exist and match their
    # domain filter, so a missing dummy entity fails here with a clear message.
    missing = sorted(
        entity_id for entity_id in role_entity_ids.values() if entity_id not in states
    )
    check(
        not missing,
        f"dummy entities missing from Home Assistant: {', '.join(missing)}",
    )

    # HA 2026.9 serializes the schema as a field list (probatio
    # to_field_list): one dict per field with name, required and default.
    payload: dict[str, Any] = {}
    for field in flow["data_schema"]:
        key = field["name"]
        if key in role_entity_ids:
            payload[key] = role_entity_ids[key]
        elif field.get("default") is not None:
            payload[key] = field["default"]
    uncovered = [
        field["name"]
        for field in flow["data_schema"]
        if field.get("required") and field["name"] not in payload
    ]
    check(
        not uncovered,
        f"no dummy value available for required options: {', '.join(uncovered)}",
    )
    # One Plant with a soil sensor group; a named Plant requires at least one
    # soil sensor (validated in the options flow).
    payload["plant_1_name"] = "Plant 1"
    payload["plant_1_cultivar"] = "Banana Boogie Split"
    for field in ("soil_temperature", "soil_moisture", "soil_illuminance", "soil_conductivity"):
        payload[f"plant_1_{field}"] = role_entity_ids[f"plant_1_{field}"]

    response = session.post(
        f"{BASE_URL}/api/config/config_entries/options/flow/{flow['flow_id']}",
        json=payload,
        headers=headers,
        timeout=10,
    )
    check(response.status_code == 200, f"submitting the options flow failed: {response.text}")
    check(
        response.json()["type"] == "create_entry",
        f"the options flow did not store options: {response.text}",
    )
    # Options are not exposed via the REST API in HA 2026.9; that they were
    # stored is proven behaviorally in exercise_services: start_grow_run only
    # turns on the phase boolean when the options map the Entity Roles.
    return payload


def publish_panel_config(
    session: requests.Session, headers: dict[str, str], options: dict[str, Any]
) -> None:
    """Expose the configured Grow Box to the panel through its test fixture.

    The panel currently reads its frontend configuration from the documented
    `sensor.growhelper_config` placeholder. Publishing the options through
    Home Assistant's state API lets the browser test exercise that loading
    path without changing private component state.
    """
    response = session.post(
        f"{BASE_URL}/api/states/sensor.growhelper_config",
        json={
            "state": "configured",
            "attributes": {**options, "active_grow_run": SMOKE_RUN_NAME},
        },
        headers=headers,
        timeout=10,
    )
    check(
        response.status_code in (200, 201),
        f"publishing the panel config fixture failed: {response.status_code} {response.text}",
    )


def assert_panel_registered(token: str) -> None:
    """Assert the growhelper panel is registered.

    HA 2026.9 no longer serves /api/panels over REST; the frontend reads
    panels over the websocket API (get_panels command of the frontend
    component), so the smoke test does the same.
    """
    ws_url = (
        f"{BASE_URL.replace('http://', 'ws://').replace('https://', 'wss://')}"
        "/api/websocket"
    )
    connection = websocket.create_connection(ws_url, timeout=10)
    try:
        greeting = json.loads(connection.recv())
        check(
            greeting.get("type") == "auth_required",
            f"unexpected websocket greeting: {greeting}",
        )
        # The auth message carries no id — only commands do.
        connection.send(json.dumps({"type": "auth", "access_token": token}))
        auth_result = json.loads(connection.recv())
        check(
            auth_result.get("type") == "auth_ok",
            f"websocket auth failed: {auth_result}",
        )

        connection.send(json.dumps({"id": 2, "type": "get_panels"}))
        while True:
            message = json.loads(connection.recv())
            if message.get("id") == 2:
                break
        check(message.get("success"), f"get_panels failed: {message}")
        panels = message["result"]
        panel = panels.get("growhelper")
        check(
            panel is not None,
            f"the growhelper panel is not registered, panels: {sorted(panels)}",
        )
        # Custom panels report component_name "custom"; the webcomponent name
        # and module URL live under config._panel_custom.
        custom = panel.get("config", {}).get("_panel_custom", {})
        check(
            custom.get("name") == "growhelper-panel",
            f"unexpected panel webcomponent: {panel}",
        )
        check(
            custom.get("module_url") == "/growhelper_static/growhelper-panel.js",
            f"unexpected panel module url: {panel}",
        )
        check(panel.get("title") == "Growhelper", f"unexpected panel title: {panel}")
    finally:
        connection.close()


def assert_integration_surface(
    session: requests.Session, headers: dict[str, str], token: str
) -> None:
    """Assert services are registered, the panel is registered and served."""
    response = session.get(f"{BASE_URL}/api/services", headers=headers, timeout=10)
    check(response.status_code == 200, f"reading services failed: {response.text}")
    # HA 2026.9 returns a list of {"domain": ..., "services": {...}} entries.
    domain_services = {}
    for domain_entry in response.json():
        if domain_entry["domain"] == "growhelper":
            domain_services = domain_entry["services"]
            break
    missing = [name for name in EXPECTED_SERVICES if name not in domain_services]
    check(not missing, f"growhelper services missing: {', '.join(missing)}")

    assert_panel_registered(token)

    response = session.get(
        f"{BASE_URL}/growhelper_static/growhelper-panel.js", headers=headers, timeout=10
    )
    check(response.status_code == 200, f"panel JS not served: {response.status_code}")
    check(
        "growhelper-panel" in response.text,
        "the served panel JS does not look like the growhelper panel bundle",
    )


def exercise_services(session: requests.Session, headers: dict[str, str]) -> None:
    """Call the three services and verify the phase bridge (ADR-0002)."""
    # Remove leftovers from a previous local run so start_grow_run is
    # idempotent (it refuses to overwrite an existing Grow Run).
    diary_file = DIARY_DIR / f"{SMOKE_RUN_NAME}.md"
    diary_file.unlink(missing_ok=True)

    response = session.post(
        f"{BASE_URL}/api/services/growhelper/start_grow_run",
        json={"name": SMOKE_RUN_NAME},
        headers=headers,
        timeout=30,
    )
    check(
        response.status_code == 200,
        f"start_grow_run failed: {response.status_code} {response.text}",
    )

    # start_grow_run sets the early-veg phase through the phase bridge
    # (ADR-0002). The boolean only turns on when the options stored by the
    # options flow map the Entity Roles, so this also proves the options
    # landed. The inner service calls are non-blocking, hence the polling.
    wait_for_entity(
        session,
        headers,
        "input_boolean.growth_phase_early_veg",
        state_equals("on"),
        "phase boolean 'on'",
    )

    response = session.post(
        f"{BASE_URL}/api/services/growhelper/add_diary_entry",
        json={
            "note": DIARY_NOTE,
            "plant_tag": "all",
            "event_title": "Smoke Test",
            "date": DIARY_DATE,
        },
        headers=headers,
        timeout=30,
    )
    check(
        response.status_code == 200,
        f"add_diary_entry failed: {response.status_code} {response.text}",
    )

    # Switching to late-veg must turn exactly that phase boolean on and write
    # the Target Profile of the late-veg phase into the input helpers.
    response = session.post(
        f"{BASE_URL}/api/services/growhelper/set_growth_phase",
        json={"phase": "late-veg"},
        headers=headers,
        timeout=30,
    )
    check(
        response.status_code == 200,
        f"set_growth_phase failed: {response.status_code} {response.text}",
    )

    wait_for_entity(
        session,
        headers,
        "input_boolean.growth_phase_late_veg",
        state_equals("on"),
        "phase boolean 'on'",
    )
    wait_for_entity(
        session,
        headers,
        "input_boolean.growth_phase_early_veg",
        state_equals("off"),
        "phase boolean 'off'",
    )
    wait_for_entity(
        session,
        headers,
        "input_number.temperature_lower_threshold",
        state_float_equals(EXPECTED_TEMPERATURE_LOWER),
        f"threshold {EXPECTED_TEMPERATURE_LOWER}",
    )
    wait_for_entity(
        session,
        headers,
        "input_number.vpd_upper_threshold",
        state_float_equals(EXPECTED_VPD_UPPER),
        f"threshold {EXPECTED_VPD_UPPER}",
    )
    wait_for_entity(
        session,
        headers,
        "input_datetime.light_on_time",
        lambda state: state.startswith(EXPECTED_LIGHT_ON),
        f"light on {EXPECTED_LIGHT_ON}",
    )
    wait_for_entity(
        session,
        headers,
        "input_datetime.light_off_time",
        lambda state: state.startswith(EXPECTED_LIGHT_OFF),
        f"light off {EXPECTED_LIGHT_OFF}",
    )

    # Restore early-veg so the browser check exercises its German dashboard
    # label after the late-veg target-profile assertions above.
    response = session.post(
        f"{BASE_URL}/api/services/growhelper/set_growth_phase",
        json={"phase": "early-veg"},
        headers=headers,
        timeout=30,
    )
    check(
        response.status_code == 200,
        f"restoring early-veg failed: {response.status_code} {response.text}",
    )
    wait_for_entity(
        session,
        headers,
        "input_boolean.growth_phase_early_veg",
        state_equals("on"),
        "restored early-veg phase boolean 'on'",
    )
    wait_for_entity(
        session,
        headers,
        "input_boolean.growth_phase_late_veg",
        state_equals("off"),
        "restored late-veg phase boolean 'off'",
    )


def assert_grow_diary() -> None:
    """Assert the Grow Diary file exists and follows the ADR-0001 format."""
    diary_file = DIARY_DIR / f"{SMOKE_RUN_NAME}.md"
    check(diary_file.is_file(), f"the diary file was not created at {diary_file}")
    content = diary_file.read_text(encoding="utf-8")
    check(f"## {DIARY_DATE}" in content, "the diary is missing the date header")
    check("#### Smoke Test" in content, "the diary is missing the event subheader")
    check(f"- [all] {DIARY_NOTE}" in content, "the diary is missing the note bullet")
    check("---" in content, "the diary is missing the entry separator")


def main() -> int:
    """Run all smoke checks; return the process exit code."""
    session = requests.Session()
    try:
        print(f"[1/8] Waiting for Home Assistant at {BASE_URL}")
        wait_for_ha(session)

        print("[2/8] Completing onboarding and getting an access token")
        token = complete_onboarding(session)
        headers = {"Authorization": f"Bearer {token}"}

        print(f"[3/8] Creating the '{GROW_BOX_NAME}' config entry via the config flow")
        entry_id = create_grow_box_entry(session, headers)

        print(f"[4/8] Filling the options flow with dummy Entity Roles (entry {entry_id})")
        options = submit_options(session, headers, entry_id)

        print("[5/8] Checking services, panel and static assets")
        assert_integration_surface(session, headers, token)

        print("[6/8] Exercising services (start_grow_run, add_diary_entry, set_growth_phase)")
        exercise_services(session, headers)

        print("[7/8] Checking the Grow Diary file")
        assert_grow_diary()

        print("[8/8] Publishing the configured panel fixture through Home Assistant")
        publish_panel_config(session, headers, options)
    except SmokeFailure as error:
        print(f"FAIL: {error}", file=sys.stderr)
        write_step_summary(f"failed — {error}")
        return 1

    print("OK: all smoke checks passed")
    write_step_summary("passed — all smoke checks green")
    return 0


if __name__ == "__main__":
    sys.exit(main())
