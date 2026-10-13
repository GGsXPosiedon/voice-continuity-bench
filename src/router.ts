export type Channel = 'primary' | 'backup';
export type RoutingMode = 'auto' | 'manual';
export type FaultTarget = Channel | 'link';
export type RouterStatus = 'stopped' | 'active' | 'shared-link-down' | 'selected-input-down' | 'no-input';
export interface RoutingSnapshot {
  running: boolean;
  mode: RoutingMode;
  selected: Channel;
  ready: Record<Channel, boolean>;
  faults: Record<FaultTarget, boolean>;
  healthy: Record<Channel, boolean>;
  output: Channel | null;
  status: RouterStatus;
}

export class Router {
  running = false;
  mode: RoutingMode = 'auto';
  selected: Channel = 'primary';
  ready: Record<Channel, boolean> = { primary: false, backup: false };
  faults: Record<FaultTarget, boolean> = { primary: false, backup: false, link: false };

  setRunning(value: boolean): RoutingSnapshot { this.running = Boolean(value); return this.snapshot(); }
  setMode(value: RoutingMode): RoutingSnapshot {
    if (!['auto', 'manual'].includes(value)) throw new Error('Invalid routing mode');
    this.mode = value; return this.snapshot();
  }
  select(channel: Channel): RoutingSnapshot {
    if (!['primary', 'backup'].includes(channel)) throw new Error('Invalid input');
    this.mode = 'manual'; this.selected = channel; return this.snapshot();
  }
  setReady(channel: Channel, value: boolean): RoutingSnapshot {
    if (!['primary', 'backup'].includes(channel)) throw new Error('Invalid input');
    this.ready[channel] = Boolean(value); return this.snapshot();
  }
  setFault(target: FaultTarget, value: boolean): RoutingSnapshot {
    if (!Object.hasOwn(this.faults, target)) throw new Error('Invalid fault target');
    this.faults[target] = Boolean(value); return this.snapshot();
  }
  clearFaults(): RoutingSnapshot {
    this.faults = { primary: false, backup: false, link: false }; return this.snapshot();
  }
  snapshot(): RoutingSnapshot {
    const healthy = {
      primary: this.ready.primary && !this.faults.primary,
      backup: this.ready.backup && !this.faults.backup,
    };
    let output: Channel | null = null;
    let status: RouterStatus = 'stopped';
    if (this.running) {
      if (this.faults.link) status = 'shared-link-down';
      else {
        // Only explicit unavailability triggers a switch. Silence is normal.
        // Recovery retains a healthy route until deliberate selection or failure.
        if (this.mode === 'auto' && !healthy[this.selected]) {
          const other: Channel = this.selected === 'primary' ? 'backup' : 'primary';
          if (healthy[other]) this.selected = other;
        }
        if (healthy[this.selected]) { output = this.selected; status = 'active'; }
        else status = healthy.primary || healthy.backup ? 'selected-input-down' : 'no-input';
      }
    }
    return { running: this.running, mode: this.mode, selected: this.selected,
      ready: { ...this.ready }, faults: { ...this.faults }, healthy, output, status };
  }
}
