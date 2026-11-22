---
title: cadence
weight: 9
summary: A lamp that listens — speech transcribed on-device, Claude turning "something warmer" into light, a bulb driven over the LAN. Nothing about your evening leaves the house.
stack: [Python, mlx-whisper, Claude API, python-kasa, WebSockets]
metrics:
  - mlx-whisper large-v3 runs locally on the Apple Silicon GPU; Claude Haiku makes one forced tool call with the room's current state in the prompt
  - LIVE mode maps loudness to brightness and timbre to colour, measured in decibels against a slow average of your own voice
  - fades are overlapping keyframes, not commands — the bulb takes about eight writes a second and stalls, so sending fewer looks smoother
links:
  note: personal project · private repo
---

Overhead light is a blunt instrument: on is wrong, off is also wrong, and the fix is three
taps deep in an app you don't want to be holding. Cadence is for the rest of the evening.
Say *"make it cosy"*, *"a bit dimmer"*, *"five shades of blue over ten seconds"* or *"stop"*,
the way you'd say it to a person, and the room answers.

Nothing is a preset. The model reads the lamp's current state first, so *"warmer"* means
warmer than this and *"faster"* changes the sequence that's already running. Speech is
transcribed on the machine with mlx-whisper; Claude turns the phrasing into a concrete plan
through one forced tool call; `python-kasa` drives a TP-Link KL125 over the local network.

**LIVE** stops the conversation being with the lamp. Press it and keep talking: loudness
becomes brightness and timbre becomes colour, continuously. It listens the way ears do,
in decibels against a slow sense of how loudly you've been speaking, so it re-centres on
whoever is in the room. Colour rides one arc from amber through red and violet to blue; a
voice mapped onto the whole wheel just looks random. The light runs about a second behind
you on purpose, because the bulb is slow and chasing it looks worse than following it.

The counterintuitive part is the timing. The bulb accepts roughly eight writes a second and
stalls unpredictably, so a fade is never one command. It's a schedule of waypoints, each
carrying a transition longer than the gap to the next, so something is always in flight and
the firmware does the interpolating. Sending fewer commands is what makes it look fluid.

There is also a browser dashboard that draws brightness, hue, saturation and colour
temperature as sweeping traces with an erase gap ahead of the pen, like a bedside monitor.
It is completely unnecessary and it is the best part.
