'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Router } = require('../routing-core.js');
function running(primary = true, backup = true) {
  const router = new Router();
  router.setReady('primary', primary); router.setReady('backup', backup);
  router.setRunning(true); return router;
}
test('starts on primary; known primary failure switches to backup', () => {
  const router = running(); assert.equal(router.snapshot().output, 'primary');
  assert.equal(router.setFault('primary', true).output, 'backup');
});
test('primary recovery retains backup until the user switches', () => {
  const router = running(); router.setFault('primary', true);
  assert.equal(router.clearFaults().output, 'backup');
  assert.equal(router.select('primary').output, 'primary');
});
test('a newly failed backup switches to a recovered primary in automatic mode', () => {
  const router = running(); router.setFault('primary', true); router.setFault('primary', false);
  assert.equal(router.setFault('backup', true).output, 'primary');
});
test('manual mode does not override the selected failed path', () => {
  const router = running(); router.setMode('manual');
  assert.equal(router.setFault('primary', true).output, null);
  assert.equal(router.snapshot().status, 'selected-input-down');
  assert.equal(router.select('backup').output, 'backup');
});
test('both input failures produce no output, and an available path can recover', () => {
  const router = running(); router.setFault('primary', true); router.setFault('backup', true);
  assert.equal(router.snapshot().status, 'no-input');
  assert.equal(router.setFault('primary', false).output, 'primary');
});
test('shared link failure defeats either microphone', () => {
  const router = running(); router.setFault('link', true);
  assert.equal(router.snapshot().output, null);
  assert.equal(router.select('backup').status, 'shared-link-down');
  assert.equal(router.clearFaults().output, 'backup');
});
test('one microphone cannot become its own backup', () => {
  const router = running(true, false);
  assert.equal(router.setFault('primary', true).status, 'no-input');
});
test('device-ended notification triggers failover, recovery does not return automatically', () => {
  const router = running(); assert.equal(router.setReady('primary', false).output, 'backup');
  assert.equal(router.setReady('primary', true).output, 'backup');
});
test('quiet audio has no role in the routing policy', () => {
  const router = running();
  for (let i = 0; i < 1000; i++) assert.equal(router.snapshot().output, 'primary');
});
test('stopping always produces no output, including with faults present', () => {
  const router = running(); router.setFault('primary', true);
  assert.equal(router.setRunning(false).status, 'stopped');
  assert.equal(router.snapshot().output, null);
});
test('snapshot does not permit callers to mutate input health or faults', () => {
  const router = running(); const state = router.snapshot();
  state.faults.primary = true; state.ready.primary = false;
  assert.equal(router.snapshot().output, 'primary');
});
test('invalid channel, mode and fault inputs are rejected', () => {
  const router = running();
  assert.throws(() => router.select('other')); assert.throws(() => router.setMode('unknown'));
  assert.throws(() => router.setReady('link', true)); assert.throws(() => router.setFault('other', true));
});
