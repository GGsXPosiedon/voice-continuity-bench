(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.VoiceRouting = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  class Router {
    constructor() {
      this.running = false;
      this.mode = 'auto';
      this.selected = 'primary';
      this.ready = { primary: false, backup: false };
      this.faults = { primary: false, backup: false, link: false };
    }
    setRunning(value) { this.running = Boolean(value); return this.snapshot(); }
    setMode(value) {
      if (!['auto', 'manual'].includes(value)) throw new Error('Invalid routing mode');
      this.mode = value;
      return this.snapshot();
    }
    select(channel) {
      if (!['primary', 'backup'].includes(channel)) throw new Error('Invalid input');
      this.mode = 'manual';
      this.selected = channel;
      return this.snapshot();
    }
    setReady(channel, value) {
      if (!['primary', 'backup'].includes(channel)) throw new Error('Invalid input');
      this.ready[channel] = Boolean(value);
      return this.snapshot();
    }
    setFault(target, value) {
      if (!Object.hasOwn(this.faults, target)) throw new Error('Invalid fault target');
      this.faults[target] = Boolean(value);
      return this.snapshot();
    }
    clearFaults() {
      this.faults = { primary: false, backup: false, link: false };
      return this.snapshot();
    }
    snapshot() {
      const healthy = {
        primary: this.ready.primary && !this.faults.primary,
        backup: this.ready.backup && !this.faults.backup,
      };
      let output = null;
      let status = 'stopped';
      if (this.running) {
        if (this.faults.link) status = 'shared-link-down';
        else {
          // Fail over on explicit availability, never on audio volume. A quiet
          // driver is not evidence of failed hardware. Recovery does not cause
          // an automatic switch back to primary.
          if (this.mode === 'auto' && !healthy[this.selected]) {
            const other = this.selected === 'primary' ? 'backup' : 'primary';
            if (healthy[other]) this.selected = other;
          }
          if (healthy[this.selected]) { output = this.selected; status = 'active'; }
          else status = healthy.primary || healthy.backup ? 'selected-input-down' : 'no-input';
        }
      }
      return {
        running: this.running, mode: this.mode, selected: this.selected,
        ready: { ...this.ready }, faults: { ...this.faults }, healthy,
        output, status,
      };
    }
  }
  return { Router };
});
