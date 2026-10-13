'use strict';
// These tests execute the app's event handlers against a small DOM/audio stub.
// They test lifecycle and routing decisions, not browser rendering or real PCM.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness() {
  const elements = new Map();
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag; this.value = ''; this.textContent = ''; this.children = [];
      this.disabled = false; this.hidden = false; this.checked = false; this.handlers = {};
      this.attributes = {}; this.className = ''; this.classes = new Set();
      this.clientWidth = 500; this.clientHeight = 80; this.width = 500; this.height = 80;
      this.classList = { toggle: (name, value) => value ? this.classes.add(name) : this.classes.delete(name), add: (name) => this.classes.add(name), remove: (name) => this.classes.delete(name) };
    }
    addEventListener(type, action) { (this.handlers[type] ||= []).push(action); }
    async emit(type) { await Promise.all((this.handlers[type] || []).map((action) => action())); }
    append(...children) { children.forEach((child) => { child.parent = this; this.children.push(child); }); }
    prepend(child) { child.parent = this; this.children.unshift(child); }
    replaceChildren(...children) { this.children = []; this.append(...children); }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    querySelector() { return null; }
    get options() { return this.children; }
    get lastElementChild() { return this.children.at(-1); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this); }
    click() {}
    getContext() { return { setTransform() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {} }; }
  }
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  for (const match of html.matchAll(/id="([^"]+)"/g)) elements.set(match[1], new Element());
  const el = (id) => { assert.ok(elements.has(id), `Missing DOM element ${id}`); return elements.get(id); };
  el('source-mode').value = 'simulation'; el('routing-mode').value = 'auto';
  el('primary-device').value = 'default'; el('backup-device').value = ''; el('volume').value = '20';
  const params = () => ({ value: 0, cancelAndHoldAtTime() {}, cancelScheduledValues() {}, setValueAtTime(value) { this.value = value; }, linearRampToValueAtTime(value) { this.value = value; }, setTargetAtTime(value) { this.value = value; } });
  const contexts = [], streams = [], mediaHandlers = {}, animationCallbacks = [];
  function node(extra = {}) { return { connections: [], connect(next) { this.connections.push(next); return next; }, ...extra }; }
  class AudioContext {
    constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = node(); this.nodes = []; contexts.push(this); }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
    createGain() { const value = node({ gain: params() }); this.nodes.push(value); return value; }
    createAnalyser() { return node({ fftSize: 1024, getFloatTimeDomainData(samples) { samples.fill(0); } }); }
    createMediaStreamSource(stream) { return node({ stream }); }
    createOscillator() { return node({ frequency: { value: 0 }, start() {}, stop() {} }); }
  }
  function makeStream(id = 'physical-primary') {
    const track = { label: 'Virtual microphone', readyState: 'live', muted: false,
      getSettings: () => ({ deviceId: id }), stop() { this.readyState = 'ended'; },
    };
    const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
    streams.push(stream); return stream;
  }
  const mediaDevices = {
    getUserMedia: async () => makeStream(),
    enumerateDevices: async () => [{ kind: 'audioinput', deviceId: 'physical-primary', label: 'Virtual microphone' }],
    addEventListener(type, callback) { mediaHandlers[type] = callback; },
  };
  const window = { AudioContext, addEventListener() {}, location: { hash: '' }, matchMedia: () => ({ matches: true, addEventListener() {} }) };
  const sandbox = {
    window, navigator: { mediaDevices },
    document: { getElementById: el, createElement: (tag) => new Element(tag), querySelectorAll: () => [], body: new Element('body') },
    Option: class extends Element { constructor(label, value) { super('option'); this.textContent = label; this.value = value; } },
    performance: { now: () => 1000 }, requestAnimationFrame(callback) { animationCallbacks.push(callback); },
    Blob, URL, setTimeout, Float32Array, console,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8'), sandbox, { filename: 'app.js' });
  return { el, window, mediaDevices, contexts, streams, makeStream, frame: () => animationCallbacks.shift()(1000), snapshot: () => window.voiceBench.snapshot() };
}
const click = (h, id) => h.el(id).emit('click');
async function microphoneMode(h, primary = 'primary', backup = '') {
  h.el('source-mode').value = 'microphone'; await h.el('source-mode').emit('change');
  h.el('primary-device').value = primary; h.el('backup-device').value = backup;
}
test('app wires controls to primary, backup, manual and shared-failure states', async () => {
  const h = harness(); await click(h, 'start');
  assert.equal(h.snapshot().output, 'primary');
  await click(h, 'fault-primary'); assert.equal(h.snapshot().output, 'backup');
  await click(h, 'fault-primary'); assert.equal(h.snapshot().output, 'backup');
  await click(h, 'scenario-manual'); assert.equal(h.snapshot().output, null);
  await click(h, 'select-backup'); assert.equal(h.snapshot().output, 'backup');
  await click(h, 'scenario-shared'); assert.equal(h.snapshot().status, 'shared-link-down');
  await click(h, 'restore'); assert.equal(h.snapshot().output, 'primary');
  await click(h, 'stop'); assert.equal(h.snapshot().status, 'stopped');
  assert.equal(h.contexts[0].state, 'closed');
});
test('microphone discovery releases its temporary permission stream', async () => {
  const h = harness(); await microphoneMode(h); await click(h, 'discover');
  assert.equal(h.streams.length, 1);
  assert.equal(h.streams[0].getAudioTracks()[0].readyState, 'ended');
  assert.equal(h.el('discover').disabled, false);
});
test('permission denial is visible and leaves the audio engine closed', async () => {
  const h = harness(); await microphoneMode(h);
  h.mediaDevices.getUserMedia = async () => { const error = new Error('Denied'); error.name = 'NotAllowedError'; throw error; };
  await click(h, 'start');
  assert.equal(h.snapshot().running, false);
  assert.match(h.el('error').textContent, /denied/);
  assert.equal(h.contexts[0].state, 'closed');
  h.el('source-mode').value = 'simulation'; await h.el('source-mode').emit('change');
  await click(h, 'start'); assert.equal(h.snapshot().output, 'primary'); await click(h, 'stop');
});
test('one microphone is not represented as two; stop releases the live stream', async () => {
  const h = harness(); await microphoneMode(h); await click(h, 'start');
  assert.equal(h.snapshot().output, 'primary'); assert.equal(h.snapshot().ready.backup, false);
  await click(h, 'fault-primary'); assert.equal(h.snapshot().output, null);
  await click(h, 'stop'); assert.equal(h.streams[0].getTracks()[0].readyState, 'ended');
});
test('reported device end switches to a separate backup stream', async () => {
  const h = harness(); await microphoneMode(h, 'primary', 'backup');
  h.mediaDevices.getUserMedia = async (constraints) => h.makeStream(constraints.audio.deviceId.exact);
  await click(h, 'start'); assert.equal(h.snapshot().ready.backup, true);
  const primaryTrack = h.streams[0].getTracks()[0]; primaryTrack.readyState = 'ended'; primaryTrack.onended();
  assert.equal(h.snapshot().output, 'backup');
  await click(h, 'stop'); assert.ok(h.streams.every((stream) => stream.getTracks()[0].readyState === 'ended'));
});
test('zero audio samples do not mark a quiet microphone unavailable', async () => {
  const h = harness(); await microphoneMode(h, 'primary', 'backup');
  h.mediaDevices.getUserMedia = async (constraints) => h.makeStream(constraints.audio.deviceId.exact);
  await click(h, 'start'); assert.equal(h.snapshot().output, 'primary');
  // The mock analyser produces only zeros; health comes from track events.
  h.frame(); h.frame();
  assert.equal(h.el('primary-meter').value, 0);
  assert.equal(h.snapshot().output, 'primary');
  assert.equal(h.snapshot().healthy.primary, true); await click(h, 'stop');
});
test('two selected aliases resolving to the same microphone do not create a backup', async () => {
  const h = harness(); await microphoneMode(h, 'default', 'alias'); await click(h, 'start');
  assert.equal(h.snapshot().output, 'primary'); assert.equal(h.snapshot().ready.backup, false);
  assert.equal(h.streams[1].getTracks()[0].readyState, 'ended');
  assert.match(h.el('error').textContent, /same microphone/); await click(h, 'stop');
});
test('duplicate device choices are rejected before acquiring microphone permission', async () => {
  const h = harness(); await microphoneMode(h, 'same', 'same'); await click(h, 'start');
  assert.equal(h.streams.length, 0); assert.equal(h.contexts.length, 0);
  assert.match(h.el('error').textContent, /two different/);
});
test('a microphone acquired after cancellation is immediately released', async () => {
  const h = harness(); await microphoneMode(h);
  let resolve;
  h.mediaDevices.getUserMedia = () => new Promise((done) => { resolve = done; });
  const start = click(h, 'start');
  await new Promise((done) => setImmediate(done));
  assert.equal(typeof resolve, 'function');
  await click(h, 'stop'); const stream = h.makeStream(); resolve(stream); await start;
  assert.equal(stream.getTracks()[0].readyState, 'ended'); assert.equal(h.snapshot().running, false);
});
test('backup acquisition failure preserves a working primary and explains the limitation', async () => {
  const h = harness(); await microphoneMode(h, 'primary', 'backup');
  h.mediaDevices.getUserMedia = async (constraints) => {
    if (constraints.audio.deviceId.exact === 'backup') { const error = new Error('Gone'); error.name = 'NotFoundError'; throw error; }
    return h.makeStream('primary');
  };
  await click(h, 'start'); assert.equal(h.snapshot().output, 'primary');
  assert.equal(h.snapshot().ready.backup, false); assert.match(h.el('error').textContent, /backup microphone could not start/);
  await click(h, 'stop');
});
