# Growhelper

The domain of one indoor grow box under Home Assistant: the box and its climate, the plants in it, the targets that steer each cultivation stage, and the diary kept about a run.

## Language

**Grow Box**:
The physical enclosed growing environment whose climate and devices are managed.
_Avoid_: Growroom, Gewächshaus, grow tent

**Grow Run**:
One complete cultivation cycle in a Grow Box, from sowing to dried harvest. A run owns exactly one Grow Diary file and one Target Profile per Growth Phase.
_Avoid_: grow (on its own), cycle

**Plant**:
A single plant growing in a Grow Box, identified by its soil sensor group (soil temperature, moisture, illuminance, conductivity) and by its tag in Grow Diary entries.
_Avoid_: flower, Blumensensor (the probe, not the plant)

**Cultivar**:
The variety of a Plant, e.g. "Banana Boogie Split".
_Avoid_: strain, breed

**Growth Phase**:
The single active cultivation stage of a Grow Run: `early-veg`, `late-veg`, `late-bloom`, `dry`, or `off`. Exactly one phase is active at a time.
_Avoid_: phase boolean, grow phase bool

**Target Profile**:
The climate targets for one Growth Phase: temperature range, humidity range, VPD range, and light on/off times.
_Avoid_: thresholds, settings

**VPD (Vapor Pressure Deficit)**:
The difference between the water vapor pressure at leaf temperature and in the surrounding air, measured in kPa. The primary climate target of a Grow Box; every Target Profile defines a VPD range.
_Avoid_: vapor deficit (sensor name), humidity target

**Entity Role**:
A canonical slot in a Grow Box's configuration that the user's own entity fills: canopy temperature, canopy humidity, VPD sensor, grow light, light schedule, humidifier, dehumidifier, exhaust fan, ventilation fan, camera, power sensors, or a Plant's soil sensor group.
_Avoid_: sensor, actor, device

**Grow Diary**:
The markdown journal of a Grow Run: one file per run on the Home Assistant filesystem. Entries are dated (`## DD.MM.YYYY`) with an optional event title (`####`), note bullets tagged with the Plant they concern (`- [Plant 1] …`, or `[all]` for box-level events), separated by `---`. Written by the user; kept in a format that agents can read, append to, and analyze.
_Avoid_: journal, log, notes

**Plant Health**:
The condition of a Plant over a Grow Run, assessed from Grow Diary entries and soil/climate sensor trends. The outcome the diary and its analysis exist to track.
_Avoid_: plant status, health score
