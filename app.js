(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const router = new VoiceRouting.Router();
  const names = { primary: 'Primary', backup: 'Backup' };
  let context = null, inputs = {}, bus = null, linkGate = null;
  let outputAnalyser = null, monitor = null, outputSamples = null;
  let generation = 0, busy = false, sessionOrigin = performance.now();
  let events = [], last = router.snapshot();
  const fadeSeconds = 0.012; // A software gain-ramp setting, not measured failover latency.

  function addEvent(message, type = 'info') {
    const elapsed = Math.max(0, performance.now() - sessionOrigin);
    events.push({ elapsedMs: Math.round(elapsed), type, message });
    if (events.length > 200) events.shift();
    const item = document.createElement('li');
    const time = document.createElement('time');
    time.textContent = `${(elapsed / 1000).toFixed(1)}s`;
    const text = document.createElement('span');
    text.textContent = message;
    item.append(time, text);
    if ($('events').querySelector('.empty-log')) $('events').replaceChildren();
    $('events').prepend(item);
    while ($('events').children.length > 200) $('events').lastElementChild.remove();
    $('export').disabled = false;
  }
  function showError(message = '') {
    $('error').textContent = message;
    $('error').hidden = !message;
  }
  function ramp(param, value) {
    if (!context || context.state === 'closed') return;
    // cancelAndHoldAtTime retains continuity if the user switches mid-ramp.
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(context.currentTime);
    else { param.cancelScheduledValues(context.currentTime); param.setValueAtTime(param.value, context.currentTime); }
    param.linearRampToValueAtTime(value, context.currentTime + fadeSeconds);
  }
  function commit(reason) {
    const state = router.snapshot();
    for (const key of ['primary', 'backup']) {
      if (inputs[key]) {
        ramp(inputs[key].gate.gain, state.faults[key] ? 0 : 1);
        ramp(inputs[key].route.gain, state.output === key ? 1 : 0);
      }
    }
    if (linkGate) ramp(linkGate.gain, state.faults.link ? 0 : 1);
    if (state.output !== last.output || state.status !== last.status) {
      const label = state.output ? `${names[state.output]} routed to output` : {
        stopped: 'Bench stopped', 'shared-link-down': 'Output lost: shared link failed',
        'selected-input-down': 'Output lost: selected input unavailable', 'no-input': 'Output lost: no usable input',
      }[state.status];
      addEvent(`${label}${reason ? ` · ${reason}` : ''}`, state.output ? 'route' : 'status');
    }
    last = state;
    render(state);
  }
  function render(state = router.snapshot()) {
    const paused = state.running && context && context.state !== 'running';
    $('start').disabled = state.running || busy;
    $('stop').disabled = !state.running && !busy;
    $('resume').hidden = !paused;
    for (const id of ['source-mode', 'primary-device', 'backup-device', 'discover']) $(id).disabled = state.running || busy;
    $('routing-mode').disabled = busy;
    $('routing-mode').value = state.mode;
    for (const key of ['primary', 'backup']) {
      const health = $(key + '-health');
      health.textContent = !state.running ? 'Not started' : state.faults[key] ? 'Fault injected' : state.healthy[key] ? 'Available' : 'Unavailable';
      health.className = 'health ' + (state.running ? state.healthy[key] ? 'healthy' : 'failed' : '');
      $(key + '-card').classList.toggle('selected', state.output === key);
      $(key + '-card').classList.toggle('failed', state.running && !state.healthy[key]);
      $('fault-' + key).setAttribute('aria-pressed', String(state.faults[key]));
      $('fault-' + key).textContent = state.faults[key] ? `Restore ${key}` : `Fail ${key}`;
      $('fault-' + key).disabled = !state.running || !state.ready[key];
      $('select-' + key).disabled = !state.running || !state.ready[key];
      $('select-' + key).setAttribute('aria-pressed', String(state.running && state.selected === key));
    }
    $('fault-link').disabled = !state.running;
    $('fault-link').setAttribute('aria-pressed', String(state.faults.link));
    $('fault-link').textContent = state.faults.link ? 'Restore shared output link' : 'Fail shared output link';
    $('restore').disabled = !state.running;
    for (const id of ['scenario-primary', 'scenario-manual', 'scenario-shared']) $(id).disabled = !state.running;
    $('bench-status-text').textContent = busy ? 'Preparing inputs…' : paused ? 'Audio engine paused' : !state.running ? 'Bench stopped' : state.output ? 'Voice path connected' : 'Output unavailable';
    $('bench-status').className = 'status-pill ' + (state.running && !paused ? state.output ? 'active' : 'failed' : '');
    $('output-letter').textContent = state.output === 'primary' ? 'A' : state.output === 'backup' ? 'B' : '—';
    $('output-name').textContent = state.output ? `${names[state.output]} input` : 'No active input';
    $('output-detail').textContent = paused ? 'Press Resume audio to continue' : !state.running ? 'Waiting to start' : state.output ? (state.mode === 'auto' ? 'Automatic backup armed · current healthy route retained' : 'Manual route · driver selection retained') : state.status === 'shared-link-down' ? 'A second microphone cannot bypass a failed shared link' : state.status === 'selected-input-down' ? 'Select the available input or enable automatic backup' : 'No usable microphone or signal is available';
    $('route-summary').textContent = paused ? 'Audio paused — press Resume audio.' : !state.running ? 'Start the bench to route a signal.' : state.output ? `${names[state.output]} → local output · ${state.mode === 'auto' ? 'automatic backup' : 'manual selection'}` : 'No signal reaches the output.';
  }
  function updateMonitor() {
    const value = Number($('volume').value);
    $('volume-value').textContent = `${value}%`;
    if (monitor) ramp(monitor.gain, $('listen').checked ? value / 100 : 0);
  }
  function stopTracks(stream) { if (stream) stream.getTracks().forEach((track) => { track.onended = null; track.onmute = null; track.onunmute = null; track.stop(); }); }
  function stopBench(log = true) {
    generation++;
    busy = false;
    for (const input of Object.values(inputs)) {
      stopTracks(input.stream);
      if (input.oscillator) { try { input.oscillator.stop(); } catch (_) {} }
    }
    inputs = {};
    if (context) { context.onstatechange = null; context.close().catch(() => {}); }
    context = null; bus = null; linkGate = null; outputAnalyser = null; monitor = null;
    router.setRunning(false);
    router.setReady('primary', false);
    router.setReady('backup', false);
    if (log) commit('Inputs released');
    else { last = router.snapshot(); render(last); }
  }
  function createInput(key, stream, token) {
    const amplitude = context.createGain();
    const gate = context.createGain();
    const analyser = context.createAnalyser();
    const route = context.createGain();
    analyser.fftSize = 1024;
    route.gain.value = 0;
    const input = { amplitude, gate, analyser, route, samples: new Float32Array(1024), stream };
    if (stream) {
      input.source = context.createMediaStreamSource(stream);
      const track = stream.getAudioTracks()[0];
      if (!track || track.readyState !== 'live') throw new Error(`${names[key]} microphone is not available.`);
      input.track = track;
      $(key + '-label').textContent = track.label || `${names[key]} microphone`;
      track.onended = () => {
        if (generation !== token) return;
        router.setReady(key, false);
        addEvent(`${names[key]} device disconnected or ended`, 'device');
        commit('Device reported unavailable');
      };
      track.onmute = () => {
        if (generation !== token) return;
        router.setReady(key, false);
        addEvent(`${names[key]} source reports no media data`, 'device');
        commit('Source reported muted');
      };
      track.onunmute = () => {
        if (generation !== token || track.readyState !== 'live') return;
        router.setReady(key, true);
        addEvent(`${names[key]} source recovered; current route retained`, 'device');
        commit('Source recovered');
      };
      amplitude.gain.value = 1;
      router.setReady(key, !track.muted);
    } else {
      input.oscillator = context.createOscillator();
      input.oscillator.frequency.value = key === 'primary' ? 210 : 310;
      input.source = input.oscillator;
      amplitude.gain.value = 0.14;
      input.oscillator.start();
      router.setReady(key, true);
    }
    input.source.connect(amplitude).connect(gate).connect(analyser).connect(route).connect(bus);
    inputs[key] = input;
    return input;
  }
  async function getInput(deviceId, token) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: deviceId === 'default' ? undefined : { exact: deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false,
    });
    if (generation !== token) { stopTracks(stream); return null; }
    return stream;
  }
  function microphoneError(error) {
    return {
      NotAllowedError: 'Microphone access was denied. Allow microphone access in your browser, or use simulation.',
      NotFoundError: 'No microphone was found. Connect one or use simulation.',
      NotReadableError: 'The microphone is busy or unavailable. Close other audio apps and retry.',
      OverconstrainedError: 'That microphone is no longer available. Find microphones again.',
    }[error.name] || error.message || 'Unable to start the audio bench.';
  }
  async function startBench() {
    showError();
    const sourceMode = $('source-mode').value;
    const policy = $('routing-mode').value;
    const primaryId = $('primary-device').value;
    const backupId = $('backup-device').value;
    if (sourceMode === 'microphone' && !navigator.mediaDevices?.getUserMedia) {
      showError('Microphone access is unavailable here. Use current Chrome or Edge over HTTPS or localhost, or choose simulation.'); return;
    }
    if (sourceMode === 'microphone' && backupId && primaryId === backupId) {
      showError('Choose two different input devices. A duplicate microphone is not an independent backup.'); return;
    }
    stopBench(false);
    const token = generation;
    busy = true;
    sessionOrigin = performance.now(); events = [];
    $('events').replaceChildren(); $('export').disabled = true;
    router.clearFaults(); router.select('primary'); router.setMode(policy);
    render();
    try {
      const AudioContextType = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextType) throw new Error('This browser does not support Web Audio. Try current Chrome or Edge.');
      context = new AudioContextType({ latencyHint: 'interactive' });
      await context.resume();
      if (generation !== token) return;
      bus = context.createGain(); linkGate = context.createGain();
      outputAnalyser = context.createAnalyser(); outputAnalyser.fftSize = 1024;
      outputSamples = new Float32Array(1024);
      monitor = context.createGain(); monitor.gain.value = 0;
      bus.connect(linkGate).connect(outputAnalyser).connect(monitor).connect(context.destination);
      context.onstatechange = () => { if (generation === token) render(); };
      if (sourceMode === 'simulation') {
        createInput('primary', null, token); createInput('backup', null, token);
        addEvent('Simulation started: two generated tones, not recorded speech', 'session');
      } else {
        const primaryStream = await getInput(primaryId, token);
        if (!primaryStream) return;
        try { createInput('primary', primaryStream, token); }
        catch (error) { stopTracks(primaryStream); throw error; }
        if (backupId) {
          try {
            const backupStream = await getInput(backupId, token);
            if (!backupStream) return;
            const primarySettings = primaryStream.getAudioTracks()[0].getSettings();
            const backupSettings = backupStream.getAudioTracks()[0].getSettings();
            if (primarySettings.deviceId && primarySettings.deviceId === backupSettings.deviceId) {
              stopTracks(backupStream);
              addEvent('Backup rejected: both selections resolve to the same microphone', 'device');
              showError('Both inputs resolve to the same microphone. Primary is available; an independent backup is not connected.');
            } else {
              try { createInput('backup', backupStream, token); }
              catch (error) { stopTracks(backupStream); throw error; }
            }
          } catch (error) {
            if (generation !== token) return;
            addEvent(`Backup unavailable: ${microphoneError(error)}`, 'device');
            showError('The backup microphone could not start. The primary path is available.');
          }
        }
        if (generation !== token) return;
        if (!inputs.backup) $('backup-label').textContent = 'No independent backup connected';
        addEvent(`Microphone bench started: ${inputs.backup ? 'two device inputs' : 'primary only'}`, 'session');
      }
      busy = false;
      router.setRunning(true);
      updateMonitor();
      commit('Session started');
    } catch (error) {
      if (generation !== token) return;
      stopBench(false);
      showError(microphoneError(error));
      addEvent(`Start failed: ${microphoneError(error)}`, 'error');
    }
  }
  function updateSourceUI() {
    const simulation = $('source-mode').value === 'simulation';
    $('microphone-setup').hidden = simulation;
    $('source-description').textContent = simulation ? 'Generated test signals · no microphone access' : 'Local microphone audio · no recording or upload';
    $('primary-label').textContent = simulation ? 'Generated signal · 210 Hz' : 'Microphone not connected';
    $('backup-label').textContent = simulation ? 'Generated signal · 310 Hz' : 'Second microphone not connected';
    showError();
  }
  async function updateDevices() {
    const all = await navigator.mediaDevices.enumerateDevices();
    const audio = all.filter((device) => device.kind === 'audioinput');
    const physical = audio.filter((device) => !['default', 'communications'].includes(device.deviceId));
    const devices = physical.length ? physical : audio.filter((device) => device.deviceId !== 'communications');
    const previous = { primary: $('primary-device').value, backup: $('backup-device').value };
    for (const key of ['primary', 'backup']) {
      const select = $(key + '-device');
      select.replaceChildren();
      if (key === 'backup') select.append(new Option('No second microphone', ''));
      if (!devices.length && key === 'primary') select.append(new Option('Default microphone', 'default'));
      devices.forEach((device, index) => select.append(new Option(device.label || `Microphone ${index + 1}`, device.deviceId)));
      if ([...select.options].some((option) => option.value === previous[key])) select.value = previous[key];
      else if (key === 'backup') select.value = '';
    }
    $('device-note').textContent = `${devices.length} input ${devices.length === 1 ? 'device' : 'devices'} found. ${devices.length < 2 ? 'A second independent microphone is needed for a physical backup.' : 'Choose two separate physical microphones; different device names alone do not prove electrical independence.'}`;
  }
  async function discover() {
    if (!navigator.mediaDevices?.getUserMedia) { showError('Microphone access is unavailable here. Use current Chrome or Edge over HTTPS or localhost, or choose simulation.'); return; }
    const token = ++generation;
    busy = true; showError(); render();
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (generation !== token) return;
      await updateDevices();
    } catch (error) { if (generation === token) showError(microphoneError(error)); }
    finally { stopTracks(stream); if (generation === token) { busy = false; render(); } }
  }
  function fault(key) {
    const value = !router.faults[key];
    router.setFault(key, value);
    addEvent(`${key === 'link' ? 'Shared output link' : names[key] + ' input'} ${value ? 'fault injected' : 'fault restored'}`, 'fault');
    commit('Fault control');
  }
  function scenario(type) {
    router.clearFaults(); router.select('primary');
    if (type === 'primary') { router.setMode('auto'); router.setFault('primary', true); }
    if (type === 'manual') { router.setMode('manual'); router.setFault('primary', true); }
    if (type === 'shared') { router.setMode('auto'); router.setFault('link', true); }
    addEvent(`Scenario: ${type === 'shared' ? 'shared link lost' : type === 'manual' ? 'primary lost with manual selection' : 'primary lost with automatic backup'}`, 'scenario');
    commit('Scenario applied');
  }
  function exportReport() {
    const report = {
      prototype: 'Voice continuity bench v0.1', exportedAt: new Date().toISOString(),
      sourceMode: $('source-mode').value, state: router.snapshot(),
      gainRampSettingMs: fadeSeconds * 1000,
      timingNote: 'Event timestamps use the browser clock. They do not measure audio gap or end-to-end radio latency.',
      limitations: ['Local software demonstrator, not FIA-approved equipment', 'No RF transmission', 'Generated tones in simulation, not human speech', 'No audio recording', 'Shared computer, audio engine and output remain common points of failure'],
      events: events.map((event) => ({ ...event })),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'voice-bench-report.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function draw(canvas, samples, color) {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (!width || !height) return;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    }
    const pen = canvas.getContext('2d'); pen.setTransform(ratio, 0, 0, ratio, 0, 0);
    pen.clearRect(0, 0, width, height); pen.strokeStyle = '#263643'; pen.lineWidth = 1;
    pen.beginPath();
    for (let x = 0; x < 5; x++) { pen.moveTo(width * x / 4, 0); pen.lineTo(width * x / 4, height); }
    pen.moveTo(0, height / 2); pen.lineTo(width, height / 2); pen.stroke();
    pen.strokeStyle = color; pen.lineWidth = 1.5; pen.beginPath();
    for (let i = 0; i < width; i++) {
      const value = samples ? samples[Math.floor(i / width * samples.length)] : 0;
      const y = Math.max(3, Math.min(height - 3, height / 2 - value * height * 1.8));
      if (i === 0) pen.moveTo(i, y); else pen.lineTo(i, y);
    }
    pen.stroke();
  }
  function showLevel(key, samples) {
    let rms = 0;
    if (samples) { for (const value of samples) rms += value * value; rms = Math.sqrt(rms / samples.length); }
    const db = rms > 0.00003 ? Math.max(-90, 20 * Math.log10(rms)) : -90;
    $(key + '-db').textContent = db <= -90 ? '−∞ dBFS' : `${db.toFixed(1)} dBFS`;
    $(key + '-meter').value = Math.max(0, Math.min(1, (db + 60) / 60));
  }
  function frame(now) {
    for (const key of ['primary', 'backup']) {
      const input = inputs[key];
      if (input) {
        if (input.oscillator && context?.state === 'running') input.amplitude.gain.setTargetAtTime(0.08 + 0.09 * (0.5 + 0.5 * Math.sin(now / 350 + (key === 'primary' ? 0 : 1.7))), context.currentTime, 0.03);
        input.analyser.getFloatTimeDomainData(input.samples);
      }
      draw($(key + '-wave'), input?.samples, router.snapshot().output === key ? '#a9efcc' : '#7899ad');
      showLevel(key, input?.samples);
    }
    if (outputAnalyser) outputAnalyser.getFloatTimeDomainData(outputSamples);
    draw($('output-wave'), outputAnalyser ? outputSamples : null, '#a9efcc');
    showLevel('output', outputAnalyser ? outputSamples : null);
    requestAnimationFrame(frame);
  }
  $('start').addEventListener('click', startBench);
  $('stop').addEventListener('click', () => stopBench());
  $('resume').addEventListener('click', () => context?.resume().then(() => render()).catch((error) => showError(error.message)));
  $('source-mode').addEventListener('change', updateSourceUI);
  $('routing-mode').addEventListener('change', () => { router.setMode($('routing-mode').value); addEvent(`${router.mode === 'auto' ? 'Automatic backup' : 'Manual selection'} enabled`, 'policy'); commit('Policy changed'); });
  for (const key of ['primary', 'backup']) {
    $('select-' + key).addEventListener('click', () => { router.select(key); addEvent(`${names[key]} selected manually`, 'selection'); commit('Driver selection'); });
    $('fault-' + key).addEventListener('click', () => fault(key));
  }
  $('fault-link').addEventListener('click', () => fault('link'));
  $('restore').addEventListener('click', () => { router.clearFaults(); addEvent('All injected faults restored; current healthy route retained', 'fault'); commit('Faults restored'); });
  $('discover').addEventListener('click', discover);
  for (const type of ['primary', 'manual', 'shared']) $('scenario-' + type).addEventListener('click', () => scenario(type));
  $('listen').addEventListener('change', updateMonitor); $('volume').addEventListener('input', updateMonitor);
  $('export').addEventListener('click', exportReport); $('export').disabled = true;
  navigator.mediaDevices?.addEventListener('devicechange', () => {
    if (router.running || busy) addEvent('Device inventory changed; existing tracks remain selected', 'device');
    else if ($('source-mode').value === 'microphone') updateDevices().catch(() => {});
  });
  window.addEventListener('pagehide', () => stopBench(false));
  // A read-only snapshot allows deterministic browser QA without exposing audio.
  window.voiceBench = { snapshot: () => router.snapshot(), reportEvents: () => events.map((event) => ({ ...event })) };
  render(); requestAnimationFrame(frame);
})();
