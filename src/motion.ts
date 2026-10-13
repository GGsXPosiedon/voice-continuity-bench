export type Page = 'bench' | 'system' | 'story';
const pages: Page[] = ['bench', 'system', 'story'];
const titles: Record<Page, string> = { bench: 'Routing bench', system: 'System design', story: 'The Singapore story' };

function isPage(value: string): value is Page { return pages.includes(value as Page); }

/** Navigation owns presentation only. An active audio session survives navigation. */
export function initializeNavigation(): void {
  const loading = document.getElementById('startup');
  const transition = document.getElementById('page-transition');
  const transitionLabel = document.getElementById('transition-label');
  const root = document.getElementById('page-content');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let current: Page = 'bench';
  let busy = false;
  let queued: { page: Page; history: boolean } | null = null;
  let startupTimer: number | undefined;
  let midpointTimer: number | undefined;
  let finishTimer: number | undefined;

  function show(page: Page, focus = false): void {
    current = page;
    for (const candidate of pages) {
      const section = document.getElementById(`page-${candidate}`);
      if (section) section.hidden = candidate !== page;
    }
    for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-route]')) {
      if (link.dataset.route === page) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    document.title = `${titles[page]} · Voice continuity`;
    if (focus) document.getElementById(`heading-${page}`)?.focus({ preventScroll: true });
  }
  function finish(): void {
    busy = false;
    if (transition) { transition.hidden = true; transition.classList.remove('running'); }
    root?.removeAttribute('aria-busy');
    const next = queued; queued = null;
    if (next) navigate(next.page, next.history);
  }
  function navigate(page: Page, updateHistory = true): void {
    if (busy) { queued = { page, history: updateHistory }; return; }
    if (page === current) return;
    if (updateHistory) window.history.pushState({ page }, '', `#${page}`);
    if (reducedMotion.matches || !transition) { show(page, true); return; }
    busy = true;
    if (transitionLabel) transitionLabel.textContent = titles[page];
    root?.setAttribute('aria-busy', 'true');
    transition.hidden = false;
    transition.classList.add('running');
    midpointTimer = window.setTimeout(() => show(page, true), 260);
    finishTimer = window.setTimeout(finish, 720);
  }
  for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-route]')) {
    link.addEventListener('click', (event: MouseEvent) => {
      // Modified clicks keep normal browser link behavior.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      const page = link.dataset.route;
      if (!page || !isPage(page)) return;
      event.preventDefault(); navigate(page);
    });
  }
  const hash = window.location.hash.slice(1);
  show(isPage(hash) ? hash : 'bench');
  window.addEventListener('hashchange', () => {
    const target = window.location.hash.slice(1);
    navigate(isPage(target) ? target : 'bench', false);
  });
  function dismissStartup(): void {
    if (startupTimer) window.clearTimeout(startupTimer);
    if (loading) loading.hidden = true;
    document.body.classList.remove('booting');
  }
  if (reducedMotion.matches) dismissStartup();
  else startupTimer = window.setTimeout(dismissStartup, 1150);
  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    dismissStartup();
    if (busy) {
      if (midpointTimer) window.clearTimeout(midpointTimer);
      if (finishTimer) window.clearTimeout(finishTimer);
      const target = window.location.hash.slice(1);
      show(isPage(target) ? target : current);
      finish();
    }
  });
}
