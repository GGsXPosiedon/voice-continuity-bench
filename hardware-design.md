# Proposed backup voice path — laboratory design brief

Status: concept plus computer audio demonstrator. No physical hardware has been built or approved. No claim is made that the current F1 system lacks any of the redundancy proposed here.

## Intended behavior

Preserve intelligible driver speech after a primary microphone or its dedicated cable fails. Start with two capture paths feeding the prescribed voice system. Work with its designated supplier on the audio interface and any hardware changes.

This first design does not solve every communication failure. It must be evaluated against the diagnosed failure, including the microphone, connector, input electronics, transmitter, antenna, trackside reception and pit-wall audio routing.

## Architecture

    Primary speech microphone → dedicated cable/connector → input conditioning A ─┐
                                                                                ├→ approved selector → prescribed voice radio
    Backup contact microphone → dedicated cable/connector → input conditioning B ─┘

    Existing voice system → engineer + required FIA/broadcaster monitoring
    Engineer return audio → driver listening transducers

The actual radio pinout, microphone bias, impedance, signal level, connector and permitted control interface must come from the supplier. This is a functional diagram, not an installation wiring diagram.

The selector should preserve normal push-to-talk behavior, let the driver select the backup, and expose faults at the pit wall. If automatic selection is used, switching needs an explicit health signal and a driver override. Low audio energy alone cannot distinguish a quiet driver from a failed microphone.

The browser demo uses short gain ramps; a hardware design must separately decide how to control clicks, accidental mixing, delay and loss of power. Do not assume a browser crossfade meets hardware switching requirements.

## Capture options to evaluate

1. A second conventional microphone: straightforward speech reference, but it may share environmental failure modes with primary.
2. A throat/contact microphone: captures bodily speech vibrations and offers different exposure to airborne noise. Contact quality, speech bandwidth, sweat, movement and intelligibility need validation.
3. A skull-contact microphone: another existing capture technology. Any helmet integration requires manufacturer involvement; this document specifies no helmet modification.

Existing manufacturer references establish that these technologies exist; they do not establish F1 approval or performance in an F1 cockpit:

- Savox TC-1 Ex / TM-1: https://www.savox.com/products/headsets/tc-1_ex
- CeoTronics CT-SkullMike: https://www.ceotronics.com/cms/upload/Downloads/Produktbroschueren/CT-SkullMike_EN.pdf

## Failure coverage

| Failure | Two capture paths, shared radio | Additional work |
| --- | --- | --- |
| Primary microphone fails | Potentially covered if backup and selector remain functional | Diagnose and verify detection |
| Primary cable/connector fails | Potentially covered with truly separate wiring | Avoid shared connector or vulnerable cable section |
| Primary produces silence but reports healthy | Manual selection can help; current automatic policy cannot detect it | Develop and validate an electrical/self-test health signal |
| Backup loses skin contact | Not inherently covered | Intelligibility/contact validation and clear driver selection |
| Selector or its power fails | Not covered | Supplier-designed fail-safe behavior or independent path |
| Radio transmitter, antenna or reception fails | Not covered | Supplier/FIA evaluation of a separate complete voice path |
| Driver earpiece/return path fails | Not covered by outgoing microphone duplication | Evaluate receive-path redundancy separately |
| Shared computer, USB hub or audio engine fails | Not covered by this software bench | Independent hardware architecture |

## Next physical lab prototype

Start on a desk with two separate USB microphone inputs and headphones. This lets the existing software test two live capture paths before custom electronics are purchased.

For a contact-microphone experiment, use a contact sensor with an audio interface explicitly matched to its power, bias, impedance and connector requirements. There is no universal throat-mic-to-USB wiring assumed here. The laptop, browser and output remain common points of failure.

Candidate later components are two independently conditioned microphone inputs, an audio selector, dedicated connectors, a permitted driver control and an output matched to the supplier's radio interface. These are functional requirements, not a finalized bill of materials. Selecting parts requires the actual supplier interface specifications.

## Validation before vehicle integration

Define acceptance thresholds with the relevant supplier before testing; none are claimed as FIA limits here. Measure rather than infer:

- Intelligibility of short operational phrases with each microphone, under representative noise and vibration.
- Audible gap and switching transients, using an independent output recorder/analyser.
- Behavior after each microphone, cable, selector power or output path is interrupted separately.
- Behavior during quiet speech, long silence and rapid faults; no silent automatic return that surprises the driver.
- Connector retention, sweat exposure, power transients and electromagnetic compatibility.
- Driver control use with gloves, cockpit access, helmet fit and manufacturer safety requirements.

The computer demonstrator does not perform these physical/environmental tests or measure end-to-end radio latency.

## Route to FIA compliance

The public regulations provide a route to propose reliability changes, not automatic permission to install this design:

- C8.8.1 requires the FIA-designated supplier's specified voice system.
- C8.8.2 requires the prescribed separation from other data systems, subject to its stated exceptions, and access to communications for the FIA and broadcasters.
- Driver radio is listed as a Standard Supply Component in Appendix C6.
- C17.3.3 requires standard components to be installed and operated as specified. Teams can raise reliability, compatibility and safety issues with the supplier while keeping the FIA informed; the FIA can authorize specified alternatives in exceptional circumstances.
- C17.3.4 normally prohibits duplicating or complementing a standard component's function without authorization.

Accordingly, first confirm the current equipment's existing redundancy and the actual failure. Submit the functional design and failure analysis through the supplier/team/FIA process. Determine which changes fit the existing specification and which need a revised specification or explicit authorization. Confirm helmet/manufacturer requirements and any applicable spectrum permissions for subsequent transmitter changes. Bench testing does not establish on-car compliance.

Regulatory source: FIA 2026 Formula 1 Technical Regulations, issue 20, 5 August 2026:
https://www.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_c_technical_-_iss_20_-_2026-08-05.pdf

Prepared 13 October 2026. Verify the regulations and supplier specifications applicable at the time of any proposed integration.
