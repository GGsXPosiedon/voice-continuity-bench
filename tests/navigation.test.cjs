'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness(reduced = false, hash = '') {
  const elements = new Map();
  const timers = new Map();
  let clock = 0, counter = 0;
  function element(id) {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, { hidden: false, attributes: {}, handlers: {}, classes, textContent: '', focusCount: 0,
        classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
        setAttribute(name, value) { this.attributes[name] = value; }, removeAttribute(name) { delete this.attributes[name]; },
        addEventListener(type, callback) { this.handlers[type] = callback; }, focus() { this.focusCount++; } });
    }
    return elements.get(id);
  }
  const links = ['bench', 'system', 'story'].map((route) => Object.assign(element(`nav-${route}`), { dataset: { route } }));
  const query = { matches: reduced, addEventListener(_type, callback) { this.change = callback; } };
  const window = { location: { hash }, handlers: {}, matchMedia: () => query,
    history: { pushState(_state, _unused, value) { window.location.hash = value; } },
    addEventListener(type, callback) { this.handlers[type] = callback; },
    setTimeout(callback, delay) { const id = ++counter; timers.set(id, { callback, due: clock + delay }); return id; },
    clearTimeout(id) { timers.delete(id); } };
  const exports = {};
  element('page-transition').hidden = true;
  const sandbox = { module: { exports }, exports, window, document: { body: element('body'), getElementById: element, querySelectorAll: () => links } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../.test-build/motion.cjs'), 'utf8'), sandbox);
  sandbox.module.exports.initializeNavigation();
  function advance(duration) {
    const end = clock + duration;
    while (true) {
      const next = [...timers].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
      if (!next) break;
      clock = next[1].due; timers.delete(next[0]); next[1].callback();
    }
    clock = end;
  }
  function click(route, overrides = {}) {
    const event = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, prevented: false, preventDefault() { this.prevented = true; }, ...overrides };
    element(`nav-${route}`).handlers.click(event); return event;
  }
  return { element, window, query, advance, click };
}
test('initial hash opens the requested page and marks only that navigation link', () => {
  const h = harness(true, '#story');
  assert.equal(h.element('page-story').hidden, false);
  assert.equal(h.element('page-bench').hidden, true);
  assert.equal(h.element('nav-story').attributes['aria-current'], 'page');
  assert.equal(h.element('nav-bench').attributes['aria-current'], undefined);
});
test('startup loading sequence completes and never blocks reduced-motion users', () => {
  const h = harness(); assert.equal(h.element('startup').hidden, false);
  h.advance(1149); assert.equal(h.element('startup').hidden, false);
  h.advance(1); assert.equal(h.element('startup').hidden, true);
  assert.equal(harness(true).element('startup').hidden, true);
});
test('car transition changes content at midpoint then removes the overlay', () => {
  const h = harness(); h.advance(1150); h.click('system');
  assert.equal(h.element('page-transition').hidden, false);
  assert.equal(h.element('page-content').attributes['aria-busy'], 'true');
  h.advance(260); assert.equal(h.element('page-system').hidden, false);
  assert.equal(h.element('heading-system').focusCount, 1);
  h.advance(460); assert.equal(h.element('page-transition').hidden, true);
  assert.equal(h.element('page-content').attributes['aria-busy'], undefined);
});
test('rapid navigation queues the latest page instead of overlapping transitions', () => {
  const h = harness(); h.advance(1150); h.click('system'); h.click('story');
  h.advance(720); assert.equal(h.window.location.hash, '#story');
  h.advance(720); assert.equal(h.element('page-story').hidden, false);
  assert.equal(h.element('page-transition').hidden, true);
});
test('modified clicks preserve normal browser link behavior', () => {
  const h = harness(true); const event = h.click('system', { ctrlKey: true });
  assert.equal(event.prevented, false); assert.equal(h.window.location.hash, '');
});
test('reduced motion skips the car transition and hash changes support browser history', () => {
  const h = harness(true); h.click('system'); assert.equal(h.element('page-system').hidden, false);
  h.window.location.hash = '#story'; h.window.handlers.hashchange();
  assert.equal(h.element('page-story').hidden, false); assert.equal(h.element('page-transition').hidden, true);
  assert.equal(h.element('page-transition').classes.has('running'), false);
});
test('enabling reduced motion during a transition releases its overlay immediately', () => {
  const h = harness(); h.advance(1150); h.click('system');
  h.query.matches = true; h.query.change();
  assert.equal(h.element('page-system').hidden, false);
  assert.equal(h.element('page-transition').hidden, true);
  assert.equal(h.element('page-content').attributes['aria-busy'], undefined);
});
