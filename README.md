# Voice continuity bench

**[Open the live app on Vercel](https://voice-continuity-bench.vercel.app/)** · [System design](https://voice-continuity-bench.vercel.app/#system) · [Project story](https://voice-continuity-bench.vercel.app/#story)

An independent TypeScript research app for exploring primary and backup microphone paths. Use generated test signals or connect microphones, deliberately introduce failures, and observe which input reaches the output. Audio stays in your browser.

## The Singapore GP story

On 11 October 2026, Max Verstappen finally won the Singapore Grand Prix at Marina Bay. During that winning drive, Red Bull also had a much less glamorous problem: race engineer Gianpiero "GP" Lambiase was struggling to hear Max over the radio. When GP wanted Max's thoughts about a possible Safety Car pit stop, getting an answer was suddenly difficult. The team also used the pit board to communicate. [Official F1 race report](https://www.formula1.com/en/latest/article/verstappen-seals-commanding-singapore-grand-prix-victory-from-leclerc-and-antonelli.49wDzysiVqi5cloGjle40A)

After the race, Max explained that GP had tried asking questions in code, said the radio had troubled him throughout the season, and joked that his engineer might have enjoyed the quieter channel. It was a memorable combination: a race win, a communication failure, and two people improvising to keep working together. [Post-race press conference transcript](https://www.grandprix.com/races/singapore-gp-2026-sunday-press-conference.html)

## Why we built this

That incident started our conversation about a practical engineering question: **what could keep a driver's voice available when the primary microphone path fails?** We explored a second microphone, separate wiring, and a selector feeding the prescribed voice system. We built this computer prototype to make those ideas testable before buying or designing hardware.

The bench lets us deliberately lose the primary input, move to a backup automatically or manually, and see why two microphones still cannot survive a failed shared output. It also preserves an important distinction: a quiet driver is not the same as a broken microphone, so silence alone never triggers failover.

Singapore is the inspiration, not a hardware diagnosis. The reports above do not establish exactly which component failed in Max's car. Our injected faults model possible failures; they do not reproduce Red Bull's equipment. This project has no affiliation with Formula 1, the FIA, Red Bull Racing, or Max Verstappen. Any on-car implementation would need the relevant supplier and FIA authorization.

## Using the app

Open the **[live Vercel app](https://voice-continuity-bench.vercel.app/)**. The project's deployment protection may require Vercel sign-in.

1. Leave the source on **Simulation** and the selection policy on **Automatic backup**.
2. Select **Start session**. Primary A feeds the output.
3. Select **Fail primary**. Backup B takes over.
4. Restore primary. The healthy backup stays selected until you deliberately select another route or it fails.
5. Try the manual and shared-link failure presets.

Listening is off by default. Enable **Listen to output** to hear the generated tones. For live voice, stop the session, select **Microphone inputs**, grant permission through **Find microphones**, and choose the available devices. Use headphones for microphone listening.

A single microphone supports one physical input only. The app rejects duplicate selections and matching resolved device IDs, but different operating-system device IDs do not prove electrical independence.

## Interface and motion

The app has three pages: **Bench**, **System design**, and **Project story**. A starting-light sequence and an animated open-wheel car introduce the app; the car also crosses the screen during page transitions. Navigation preserves an active audio session, with **Stop session** always available in the header.

Page transitions queue rapid navigation, support browser history, and move keyboard focus to the destination heading. Reduced-motion preferences skip the loading and car animations, including when the preference changes during a transition.

## Switching behavior and limits

- Automatic selection reacts to an injected fault or a source that explicitly reports itself unavailable.
- Quiet speech and silence do not trigger failover. A microphone that silently produces zeros without a fault indication is not automatically diagnosed.
- Recovery keeps the currently healthy route selected. Manual selection remains under the user's control.
- A shared output failure defeats both inputs.
- Stop releases microphone tracks and closes the audio context.
- The nominal **12 ms gain ramp** is a software setting, not a measured interruption limit, hardware latency, or real-time guarantee. Brief overlap may occur during the crossfade.

The app contains no speech recognition, audio recording, upload service, RF transmitter, backend, or database. Exported JSON contains session events, settings and limitations, not audio. The engineer-to-driver return path and FIA/broadcaster distribution are requirements in the hardware brief, not implemented network features.

## Development

Requirements: Node.js 22 or newer and npm.

```sh
npm ci
npm run typecheck
npm test
npm run build
npm start
```

TypeScript runs in strict mode. esbuild produces the browser bundle after type checking; Vercel publishes the generated `public/` directory. No API keys or environment variables are required by the app.

| Source | Responsibility |
| --- | --- |
| `src/router.ts` | Typed routing policy and immutable state snapshots |
| `src/app.ts` | Web Audio graph, input lifecycle, metering and controls |
| `src/motion.ts` | Page navigation, loading sequence and car transitions |
| `index.html`, `styles.css` | Accessible interface and responsive layout |
| `tests/` | Routing, input lifecycle and navigation tests |
| `build-site.cjs` | Static production build and isolated test bundles |
| `vercel.json` | Vercel build and publication settings |

`public/`, `.test-build/`, `node_modules/`, `.vercel/` and environment files are excluded from Git. The source tree is authoritative; generated JavaScript is build output.

## Design and verification

- [Hardware design brief](hardware-design.md): proposed capture paths, failure coverage and supplier/FIA review route.
- [Validation record](validation.md): checks performed and the limits of the prototype.

Browser tests of simulation do not validate real microphone hardware, cockpit use, intelligibility under noise, or end-to-end radio latency.

## References

- [FIA 2026 technical regulations, issue 20](https://www.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_c_technical_-_iss_20_-_2026-08-05.pdf), particularly C8.8 and C17.3.
- [MDN microphone access and permission requirements](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia).
- [MDN Web Audio microphone input](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaStreamSource).

Version 0.2 · Prepared 13 October 2026.
