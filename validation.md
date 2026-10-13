# Validation record — 13 October 2026

## Passed

**22 automated tests:** 12 routing-policy tests and 10 application lifecycle tests. Command:

    node --test tests/routing.test.cjs tests/app-lifecycle.test.cjs

The lifecycle suite executes the app's actual event handlers against a minimal DOM, Web Audio and media-device test harness. Its microphone streams and audio nodes are mocked. These tests do not access the user's microphone or prove real browser audio performance.

Coverage includes:

- Primary-to-backup selection after a known fault.
- Recovery retaining the healthy selected input.
- Automatic recovery to primary if the selected backup subsequently fails.
- Manual selection retaining driver control.
- Both inputs unavailable and shared output-link failure.
- Correct single-microphone behavior: no independent backup.
- Device-ended notifications, duplicate device selections and duplicate resolved device IDs.
- Permission denial and recovery to simulation mode.
- Temporary discovery streams released after enumeration.
- Microphone tracks released and audio context closed on Stop.
- Late microphone acquisition after cancellation immediately released.
- Backup acquisition failure retaining an available primary.
- Zero sample levels leaving a quiet microphone selected and available.
- Invalid routing controls rejected and snapshot state protected from external mutation.

JavaScript syntax checks and self-contained artifact checks also passed. The standalone artifact embeds the same application and routing sources; it has no external script or stylesheet dependencies.

## Unverified

Live browser QA could not be completed. The shell sandbox prevented the localhost readiness connection and the installed browser automation process did not initialize successfully. The browser tool then explicitly blocked navigation to a local-file URL under its security policy. No alternate browser route was used to bypass that block.

Therefore these remain unverified:

- Actual rendering and responsive layout in Chrome/Edge.
- Microphone permission and device behavior in a real browser.
- Actual output audio, waveform accuracy and transition artifacts.
- Two physical microphone inputs, physical disconnection and acoustic feedback behavior.
- Audible gap or end-to-end latency.

The local server was stopped after the preview attempt. The app can be opened from standalone.html; the optional server can be started by the user with START.cmd if file-origin microphone access is unavailable.

## Not part of this prototype

No physical contact microphone, selector electronics, helmet integration, RF transmitter or race-car connection was constructed or tested. No claim of FIA authorization is made. The hardware brief describes proposed work and the supplier/FIA review route.

The nominal 12 ms gain ramp is a software parameter, not a verified interruption limit or real-time guarantee.
