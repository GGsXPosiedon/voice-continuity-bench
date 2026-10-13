# Validation record — version 0.2

Prepared 13 October 2026.

## Automated checks

The TypeScript source passes strict type checking. The production build generates the browser bundle and copies only the app HTML, stylesheet and hardware brief into `public/`.

**29 automated checks** cover the routing policy, microphone lifecycle, navigation and motion controls. Run `npm test` to build the same source used in production and execute the tests.

Coverage includes primary failure, backup recovery, manual control, shared output failure, no usable inputs, duplicate physical-device resolution, permission denial, cleanup after Stop or cancellation, and quiet input remaining available. Navigation tests cover deep links, startup completion, transition midpoint/completion, rapid navigation, normal modified-link behavior, browser history and reduced motion.

The application lifecycle suite uses a DOM/audio test harness with mocked media streams. These tests do not access a person's microphone or establish real audio performance. The navigation suite checks state and timing behavior; it does not measure visual animation quality.

## Browser verification

The previous deployed version was opened over HTTPS and its live simulation was exercised: primary input, automatic backup, recovery retaining backup, manual selection and no-output states were observed through the interface. Its meters showed generated audio levels and silence after a failed manual selection.

Version 0.2 is being verified on a staged Vercel deployment before promotion. The final results are recorded below after those checks.

## Physical limits

No physical contact microphone, selector circuit, helmet integration, RF transmitter or car connection was built or tested. No FIA approval is claimed.

Real microphone devices, physical disconnection, intelligibility under representative noise, switching artifacts and end-to-end radio latency require separate hardware testing. The nominal 12 ms gain ramp is a setting, not a verified interruption guarantee.
