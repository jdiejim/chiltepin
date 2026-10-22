/**
 * Store behaviour: applyOp undo/redo + error handling, and the SSE →
 * conflict/refetch flows, with `fetch` stubbed to an in-memory server.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DOC_TEMPLATES, insertBlock, removeSegment, replaceProse, templateBody } from 'chiltepin-core';
import { firstContentIndex } from '../lib/docTemplates.js';
import { newDocTemplate, useStudio } from './store.js';

const DOC = '```meta\ntitle: T\n```\n\nHello prose.\n';

/** In-memory doc server backing the stubbed fetch. */
let server: { source: string; hash: string };
/** Version `/api/meta` reports (the stale-tab guard compares against it). */
let serverVersion = '1.0.0';

function stubFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const json = (body: unknown, status = 200): Response =>
        new Response(JSON.stringify(body), { status });
      if (url === '/api/meta') {
        return Promise.resolve(json({ version: serverVersion, docsDir: 'docs' }));
      }
      if (url === '/api/docs') {
        return Promise.resolve(json([{ slug: 'guide', file: 'guide.md', title: 'T', mtimeMs: 1 }]));
      }
      if (url.startsWith('/api/doc/')) {
        if (init?.method === 'PUT') {
          const body = JSON.parse(String(init.body)) as { source: string; baseHash?: string };
          if (body.baseHash !== undefined && body.baseHash !== server.hash && !url.includes('force=1')) {
            return Promise.resolve(json({ currentHash: server.hash, currentSource: server.source }, 409));
          }
          server = { source: body.source, hash: `h-${server.hash}-next` };
          return Promise.resolve(json({ hash: server.hash, mtimeMs: 2 }));
        }
        return Promise.resolve(json({ source: server.source, hash: server.hash, mtimeMs: 1 }));
      }
      return Promise.resolve(json({}, 404));
    }),
  );
}

function resetStore(): void {
  useStudio.setState({
    meta: null,
    docs: [],
    currentSlug: 'guide',
    source: DOC,
    savedSource: DOC,
    baseHash: 'h1',
    dirty: false,
    review: null,
    pendingDelete: null,
    mode: 'home',
    saving: false,
    savedAt: null,
    autosave: false, // keep timers out of these tests
    selection: null,
    partSel: null,
    conflict: null,
    undoStack: [],
    redoStack: [],
    toasts: [],
    sheet: null,
    sheetDirty: false,
    loaded: true,
    initialVersion: '1.0.0',
    updateAvailable: false,
  });
}

beforeEach(() => {
  server = { source: DOC, hash: 'h1' };
  serverVersion = '1.0.0';
  stubFetch();
  resetStore();
});

afterEach(() => vi.unstubAllGlobals());

async function flush(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

describe('applyOp', () => {
  it('applies a pure op, marks dirty, and pushes an undo snapshot', () => {
    const ok = useStudio
      .getState()
      .applyOp((src, doc) => insertBlock(src, doc, 2, 'callout', templateBody('callout')));
    expect(ok).toBe(true);
    const s = useStudio.getState();
    expect(s.dirty).toBe(true);
    expect(s.source).toContain('```callout');
    expect(s.undoStack).toEqual([DOC]);
    expect(s.redoStack).toEqual([]);
  });

  it('a prose edit keeps inline styling byte for byte (the ProseEditor commit)', () => {
    const text = 'Ship ==today==: [Beta]{.pill .current} :rocket: [Esc]{.kbd}\n\\==not== and `:x:`.';
    const ok = useStudio.getState().applyOp((src, doc) => {
      const i = doc.segments.findIndex((seg) => seg.kind === 'markdown' && seg.text.includes('Hello prose.'));
      return replaceProse(src, doc, i, text);
    });
    expect(ok).toBe(true);
    expect(useStudio.getState().source).toContain(text);
    expect(useStudio.getState().source).not.toContain('Hello prose.');
  });

  it('catches a thrown RangeError and surfaces a toast instead of crashing', () => {
    const ok = useStudio.getState().applyOp((src, doc) => removeSegment(src, doc, 99));
    expect(ok).toBe(false);
    const s = useStudio.getState();
    expect(s.source).toBe(DOC); // untouched
    expect(s.dirty).toBe(false);
    expect(s.toasts.some((t) => t.tone === 'error')).toBe(true);
  });

  it('undo/redo walk the snapshot stacks', () => {
    const st = useStudio.getState();
    st.applyOp((src, doc) => removeSegment(src, doc, 1));
    const edited = useStudio.getState().source;
    expect(edited).not.toBe(DOC);
    useStudio.getState().undo();
    expect(useStudio.getState().source).toBe(DOC);
    expect(useStudio.getState().redoStack).toEqual([edited]);
    useStudio.getState().redo();
    expect(useStudio.getState().source).toBe(edited);
  });
});

describe('handleServerEvent (fs)', () => {
  it('own echo: leaves the doc alone', async () => {
    useStudio.getState().handleServerEvent({ type: 'fs', slug: 'guide', hash: 'h1' });
    await flush();
    const s = useStudio.getState();
    expect(s.source).toBe(DOC);
    expect(s.conflict).toBeNull();
  });

  it('foreign change on a clean doc: silent refetch + repaint', async () => {
    server = { source: DOC + '\nMore.\n', hash: 'h2' };
    useStudio.getState().handleServerEvent({ type: 'fs', slug: 'guide', hash: 'h2' });
    await flush();
    const s = useStudio.getState();
    expect(s.source).toBe(server.source);
    expect(s.baseHash).toBe('h2');
    expect(s.dirty).toBe(false);
    expect(s.conflict).toBeNull();
  });

  it('foreign change under local edits: sets conflict with their content', async () => {
    useStudio.setState({ dirty: true, source: DOC + '\nMine.\n' });
    server = { source: DOC + '\nTheirs.\n', hash: 'h2' };
    useStudio.getState().handleServerEvent({ type: 'fs', slug: 'guide', hash: 'h2' });
    await flush();
    const s = useStudio.getState();
    expect(s.conflict).toEqual({ currentHash: 'h2', currentSource: DOC + '\nTheirs.\n' });
    expect(s.source).toBe(DOC + '\nMine.\n'); // local edits preserved
  });

  it('other slug: only the doc list refreshes', async () => {
    useStudio.setState({ dirty: true });
    server = { source: 'x', hash: 'hX' };
    useStudio.getState().handleServerEvent({ type: 'fs', slug: 'other', hash: 'hX' });
    await flush();
    const s = useStudio.getState();
    expect(s.source).toBe(DOC);
    expect(s.conflict).toBeNull();
    expect(s.docs.length).toBe(1);
  });

  it('resolveConflict(theirs) adopts disk content and clears dirty', () => {
    useStudio.setState({
      dirty: true,
      conflict: { currentHash: 'h9', currentSource: 'their source' },
    });
    useStudio.getState().resolveConflict('theirs');
    const s = useStudio.getState();
    expect(s.source).toBe('their source');
    expect(s.baseHash).toBe('h9');
    expect(s.dirty).toBe(false);
    expect(s.conflict).toBeNull();
    expect(s.undoStack.length).toBe(1); // old local source is undoable
  });
});

describe('edit sheet draft flow', () => {
  const BLOCK_DOC = DOC + '\n```callout\ntone: note\ntitle: Hi\n```\n';

  beforeEach(() => {
    server = { source: BLOCK_DOC, hash: 'h1' };
    useStudio.setState({ source: BLOCK_DOC, baseHash: 'h1' });
  });

  it('openSheet selects the block; commitSheet applies ONE op and closes', () => {
    useStudio.getState().openSheet(2);
    expect(useStudio.getState().sheet).toBe(2);
    expect(useStudio.getState().selection).toBe(2);
    const ok = useStudio.getState().commitSheet('tone: tip\ntitle: Bye');
    expect(ok).toBe(true);
    const s = useStudio.getState();
    expect(s.sheet).toBeNull();
    expect(s.sheetDirty).toBe(false);
    expect(s.source).toContain('tone: tip');
    expect(s.source).not.toContain('title: Hi');
    expect(s.undoStack).toEqual([BLOCK_DOC]); // exactly one undo step
    expect(s.dirty).toBe(true);
  });

  it('a foreign fs change while the sheet draft is dirty does NOT clobber the doc', async () => {
    useStudio.getState().openSheet(2);
    useStudio.getState().setSheetDirty(true);
    server = { source: BLOCK_DOC + '\nTheirs.\n', hash: 'h2' };
    useStudio.getState().handleServerEvent({ type: 'fs', slug: 'guide', hash: 'h2' });
    await flush();
    const s = useStudio.getState();
    expect(s.source).toBe(BLOCK_DOC); // draft kept the doc hostage
    expect(s.baseHash).toBe('h1'); // stale base → Done's save will 409 → conflict flow
    expect(s.conflict).toBeNull();
  });

  it('a foreign fs change while the sheet is open but pristine refetches silently', async () => {
    useStudio.getState().openSheet(2);
    server = { source: BLOCK_DOC + '\nTheirs.\n', hash: 'h2' };
    useStudio.getState().handleServerEvent({ type: 'fs', slug: 'guide', hash: 'h2' });
    await flush();
    const s = useStudio.getState();
    expect(s.source).toBe(BLOCK_DOC + '\nTheirs.\n');
    expect(s.baseHash).toBe('h2');
  });

  it('commitSheet on a vanished block fails with a toast, not a crash', () => {
    useStudio.setState({ sheet: 99 });
    const ok = useStudio.getState().commitSheet('tone: tip');
    expect(ok).toBe(false);
    expect(useStudio.getState().source).toBe(BLOCK_DOC);
    expect(useStudio.getState().toasts.some((t) => t.tone === 'error')).toBe(true);
  });

  it('openDoc resets any open sheet', async () => {
    useStudio.getState().openSheet(2);
    useStudio.getState().setSheetDirty(true);
    await useStudio.getState().openDoc('guide');
    expect(useStudio.getState().sheet).toBeNull();
    expect(useStudio.getState().sheetDirty).toBe(false);
  });
});

describe('part selection lifecycle', () => {
  it('setPartSel stores it; selecting a DIFFERENT block clears it', () => {
    useStudio.getState().select(1);
    useStudio.getState().setPartSel({ seg: 1, path: 'actors.0' });
    expect(useStudio.getState().partSel).toEqual({ seg: 1, path: 'actors.0' });
    // Re-selecting the SAME block keeps it (part clicks re-select the block).
    useStudio.getState().select(1);
    expect(useStudio.getState().partSel).not.toBeNull();
    useStudio.getState().select(2);
    expect(useStudio.getState().partSel).toBeNull();
  });

  it('deselecting, opening the sheet, and undo all clear it', () => {
    useStudio.getState().select(1);
    useStudio.getState().setPartSel({ seg: 1, path: 'actors.0' });
    useStudio.getState().select(null);
    expect(useStudio.getState().partSel).toBeNull();

    useStudio.getState().select(1);
    useStudio.getState().setPartSel({ seg: 1, path: 'actors.0' });
    useStudio.getState().openSheet(1);
    expect(useStudio.getState().partSel).toBeNull();
    useStudio.getState().closeSheet();

    useStudio.setState({ undoStack: ['old source'], partSel: { seg: 1, path: 'actors.0' } });
    useStudio.getState().undo();
    expect(useStudio.getState().partSel).toBeNull();
  });
});

describe('moveBlock (meta lock)', () => {
  // segments: 0 = meta, 1 = prose, 2 = callout
  const BLOCK_DOC = DOC + '\n```callout\ntone: note\ntitle: Hi\n```\n';

  beforeEach(() => {
    useStudio.setState({ source: BLOCK_DOC });
  });

  it('refuses to move the meta cover', () => {
    expect(useStudio.getState().moveBlock(0, 3)).toBe(false);
    const s = useStudio.getState();
    expect(s.source).toBe(BLOCK_DOC);
    expect(s.dirty).toBe(false);
    expect(s.undoStack).toEqual([]);
  });

  it('refuses to move any block above the meta cover', () => {
    expect(useStudio.getState().moveBlock(2, 0)).toBe(false);
    expect(useStudio.getState().source).toBe(BLOCK_DOC);
    expect(useStudio.getState().undoStack).toEqual([]);
  });

  it('moves blocks normally below the cover (one undo step, selection follows)', () => {
    expect(useStudio.getState().moveBlock(2, 1)).toBe(true);
    const s = useStudio.getState();
    expect(s.source).not.toBe(BLOCK_DOC);
    expect(s.source.indexOf('```callout')).toBeLessThan(s.source.indexOf('Hello prose.'));
    expect(s.source.indexOf('```meta')).toBe(0);
    expect(s.selection).toBe(1);
    expect(s.undoStack).toEqual([BLOCK_DOC]);
  });

  it('rejects no-op moves without touching the undo stack', () => {
    expect(useStudio.getState().moveBlock(2, 2)).toBe(false);
    expect(useStudio.getState().moveBlock(2, 3)).toBe(false);
    expect(useStudio.getState().undoStack).toEqual([]);
  });
});

describe('checkVersion (stale-tab guard)', () => {
  it('flags updateAvailable when the server version moved on', async () => {
    serverVersion = '1.1.0';
    await useStudio.getState().checkVersion();
    expect(useStudio.getState().updateAvailable).toBe(true);
  });

  it('stays quiet on the same version', async () => {
    await useStudio.getState().checkVersion();
    expect(useStudio.getState().updateAvailable).toBe(false);
  });

  it('does nothing before init recorded a baseline', async () => {
    useStudio.setState({ initialVersion: null });
    serverVersion = '9.9.9';
    await useStudio.getState().checkVersion();
    expect(useStudio.getState().updateAvailable).toBe(false);
  });

  it('survives a fetch failure (offline focus event)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('down'))));
    await useStudio.getState().checkVersion();
    expect(useStudio.getState().updateAvailable).toBe(false);
  });
});

describe('review-before-write (autosave off)', () => {
  const EDITED = DOC + '\nAn edit.\n';

  beforeEach(() => {
    useStudio.setState({ source: EDITED, dirty: true });
  });

  it('save() routes to the review instead of writing', async () => {
    await useStudio.getState().save();
    const s = useStudio.getState();
    expect(s.review).toBe('save');
    expect(s.dirty).toBe(true);
    expect(s.saving).toBe(false);
    expect(server.source).toBe(DOC); // nothing hit the disk
  });

  it('applyReview writes through the normal save path and clears state', async () => {
    await useStudio.getState().save();
    await useStudio.getState().applyReview();
    const s = useStudio.getState();
    expect(s.review).toBeNull();
    expect(s.dirty).toBe(false);
    expect(s.savedSource).toBe(EDITED);
    expect(s.baseHash).toBe(server.hash);
    expect(server.source).toBe(EDITED);
  });

  it('cancelReview keeps the doc dirty and the file untouched', async () => {
    await useStudio.getState().save();
    useStudio.getState().cancelReview();
    const s = useStudio.getState();
    expect(s.review).toBeNull();
    expect(s.dirty).toBe(true);
    expect(server.source).toBe(DOC);
  });

  it('a stale base still 409s into the conflict flow on Apply', async () => {
    useStudio.setState({ baseHash: 'stale' });
    await useStudio.getState().save();
    await useStudio.getState().applyReview();
    const s = useStudio.getState();
    expect(s.conflict).toEqual({ currentHash: 'h1', currentSource: DOC });
    expect(server.source).toBe(DOC);
  });

  it('save(force) bypasses the review (conflict "keep mine" path)', async () => {
    await useStudio.getState().save(true);
    expect(useStudio.getState().review).toBeNull();
    expect(server.source).toBe(EDITED);
  });

  it('REGRESSION: with autosave ON, save() writes instantly and never sets review', async () => {
    useStudio.setState({ autosave: true });
    await useStudio.getState().save();
    const s = useStudio.getState();
    expect(s.review).toBeNull();
    expect(s.dirty).toBe(false);
    expect(server.source).toBe(EDITED);
  });

  it('re-enabling autosave while dirty routes through the review; Apply commits both', async () => {
    useStudio.getState().setAutosave(true);
    let s = useStudio.getState();
    expect(s.review).toBe('enable-autosave');
    expect(s.autosave).toBe(false); // the toggle only commits on Apply
    expect(server.source).toBe(DOC);
    await useStudio.getState().applyReview();
    s = useStudio.getState();
    expect(s.autosave).toBe(true);
    expect(s.review).toBeNull();
    expect(server.source).toBe(EDITED);
  });

  it('cancelling the autosave re-enable leaves the toggle OFF and writes nothing', () => {
    useStudio.getState().setAutosave(true);
    useStudio.getState().cancelReview();
    const s = useStudio.getState();
    expect(s.autosave).toBe(false);
    expect(s.dirty).toBe(true);
    expect(server.source).toBe(DOC);
  });

  it('re-enabling autosave on a CLEAN doc flips the toggle directly', () => {
    useStudio.setState({ source: DOC, dirty: false });
    useStudio.getState().setAutosave(true);
    expect(useStudio.getState().autosave).toBe(true);
    expect(useStudio.getState().review).toBeNull();
  });

  it('openDoc drops a pending review', async () => {
    await useStudio.getState().save();
    expect(useStudio.getState().review).toBe('save');
    await useStudio.getState().openDoc('guide');
    const s = useStudio.getState();
    expect(s.review).toBeNull();
    expect(s.savedSource).toBe(DOC);
  });
});

describe('pending delete confirm', () => {
  it('confirmDelete runs the armed closure exactly once and clears', () => {
    const run = vi.fn();
    useStudio.getState().requestDelete({ label: 'Alpha', anchor: { x: 1, y: 2 }, run });
    expect(useStudio.getState().pendingDelete?.label).toBe('Alpha');
    useStudio.getState().confirmDelete();
    expect(run).toHaveBeenCalledTimes(1);
    expect(useStudio.getState().pendingDelete).toBeNull();
    useStudio.getState().confirmDelete(); // idempotent when nothing is pending
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('cancelDelete clears without running', () => {
    const run = vi.fn();
    useStudio.getState().requestDelete({ label: 'Alpha', anchor: { x: 1, y: 2 }, run });
    useStudio.getState().cancelDelete();
    expect(run).not.toHaveBeenCalled();
    expect(useStudio.getState().pendingDelete).toBeNull();
  });
});

describe('handleServerEvent (meta)', () => {
  it('refetches meta and flags a stale tab when the server version moved on', async () => {
    serverVersion = '2.0.0';
    useStudio.getState().handleServerEvent({ type: 'meta' });
    await flush();
    const s = useStudio.getState();
    expect(s.meta?.version).toBe('2.0.0');
    expect(s.updateAvailable).toBe(true);
  });

  it('a meta event with the same version stays quiet', async () => {
    useStudio.getState().handleServerEvent({ type: 'meta' });
    await flush();
    const s = useStudio.getState();
    expect(s.meta?.version).toBe('1.0.0');
    expect(s.updateAvailable).toBe(false);
    expect(s.toasts).toHaveLength(0);
  });
});

describe('mode switching', () => {
  it('defaults to edit and switches surfaces without touching edit state', () => {
    const s = useStudio.getState();
    expect(s.mode).toBe('home');
    s.applyOp((src, d) => insertBlock(src, d, d.segments.length, 'callout', templateBody('callout')), 1);
    const dirtySource = useStudio.getState().source;
    useStudio.getState().setMode('present');
    expect(useStudio.getState().mode).toBe('present');
    expect(useStudio.getState().source).toBe(dirtySource);
    expect(useStudio.getState().dirty).toBe(true);
    expect(useStudio.getState().selection).toBe(1); // editor state preserved
    useStudio.getState().setMode('edit');
    expect(useStudio.getState().selection).toBe(1);
  });

  it('closes the sheet via its cancel path (draft, no data loss) on switch', () => {
    useStudio.getState().openSheet(1);
    useStudio.getState().setSheetDirty(true);
    const before = useStudio.getState().source;
    useStudio.getState().setMode('present');
    const s = useStudio.getState();
    expect(s.sheet).toBeNull();
    expect(s.sheetDirty).toBe(false);
    expect(s.source).toBe(before); // nothing committed
  });

  it('dismisses an open review and a pending delete on switch', () => {
    useStudio.setState({ review: 'save' });
    useStudio.getState().requestDelete({ label: 'x', anchor: { x: 0, y: 0 }, run: () => {} });
    useStudio.getState().setMode('present');
    expect(useStudio.getState().review).toBeNull();
    expect(useStudio.getState().pendingDelete).toBeNull();
    expect(useStudio.getState().dirty).toBe(false); // review cancel: nothing written
  });

  it('drops part selection when leaving edit', () => {
    useStudio.getState().select(1);
    useStudio.getState().setPartSel({ seg: 1, path: 'p0' });
    useStudio.getState().setMode('present');
    expect(useStudio.getState().partSel).toBeNull();
  });
});

describe('newDocTemplate', () => {
  it('derives a humanised title from the slug tail', () => {
    expect(newDocTemplate('guides/getting-started')).toContain('title: Getting started');
    expect(newDocTemplate('x')).toContain('title: X');
  });
});

/**
 * `?template=<name>` — the link the website's templates gallery points at.
 * `window` is stubbed because these tests run in the node environment; the
 * point is that boot reads the query, imports that template and lands on it.
 */
describe('init with ?template=', () => {
  function stubWindow(search: string): void {
    vi.stubGlobal('window', {
      location: { href: `https://studio.chiltepin.dev/${search}`, search, pathname: '/' },
      history: { replaceState: vi.fn() },
    });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    stubFetch();
  });

  it('opens the named template, filled in, in edit mode', async () => {
    stubWindow('?template=migration-plan');
    useStudio.setState({ currentSlug: null, mode: 'home' });
    await useStudio.getState().init();

    const s = useStudio.getState();
    expect(s.mode).toBe('edit');
    expect(s.currentSlug).toBe('migration-plan');
    expect(s.source).toBe(DOC_TEMPLATES['migration-plan']);
  });

  it('says so when the template does not exist, and still boots', async () => {
    stubWindow('?template=nope');
    useStudio.setState({ currentSlug: null, mode: 'home' });
    await useStudio.getState().init();

    const s = useStudio.getState();
    expect(s.loaded).toBe(true);
    expect(s.toasts.some((t) => t.message.includes('nope'))).toBe(true);
    expect(s.mode).toBe('home');
  });

  it('ignores the query when there is nothing to open', async () => {
    stubWindow('');
    useStudio.setState({ currentSlug: null, mode: 'home' });
    await useStudio.getState().init();

    expect(useStudio.getState().currentSlug).toBe('guide');
    expect(useStudio.getState().mode).toBe('home');
  });
});

describe('newDoc', () => {
  it('a blank doc opens the cover editor in fresh mode', async () => {
    await useStudio.getState().newDoc('fresh-blank');
    const s = useStudio.getState();
    expect(s.currentSlug).toBe('fresh-blank');
    expect(s.sheet).toBe(0);
    expect(s.sheetFresh).toBe(true);
  });

  it('a template doc opens its FIRST content block in the Edit Sheet', async () => {
    const source = (DOC_TEMPLATES['adr'] as string) ?? '';
    await useStudio.getState().newDoc('decisions/adr-001', source);
    const s = useStudio.getState();
    expect(s.currentSlug).toBe('decisions/adr-001');
    expect(s.source).toBe(source);
    expect(s.sheet).toBe(firstContentIndex(source, 'decisions/adr-001'));
    expect(s.sheet).toBeGreaterThan(0);
    expect(s.selection).toBe(s.sheet);
    expect(s.sheetFresh).toBe(true);
  });
});

describe('insert picker', () => {
  it('openPicker closes transient chrome via cancel paths', () => {
    useStudio.setState({ sheet: 2, sheetDirty: true, sheetFresh: true, review: 'save' });
    useStudio.getState().openPicker({ view: 'compact', index: 3, anchor: { x: 10, y: 20 } });
    const s = useStudio.getState();
    expect(s.picker).toEqual({ view: 'compact', index: 3, anchor: { x: 10, y: 20 } });
    expect(s.sheet).toBeNull();
    expect(s.sheetDirty).toBe(false);
    expect(s.sheetFresh).toBe(false);
    expect(s.review).toBeNull();
    expect(s.source).toBe(DOC); // the discarded draft never touched the doc
  });

  it('openPicker defaults: centered compact with a derived insert index', () => {
    useStudio.getState().openPicker();
    expect(useStudio.getState().picker).toEqual({ view: 'compact', index: null, anchor: null });
  });

  it('openLibrary is the picker straight into browse view', () => {
    useStudio.getState().openLibrary();
    expect(useStudio.getState().picker).toEqual({ view: 'browse', index: null, anchor: null });
  });

  it('expandPicker goes compact → browse in place, keeping the pinned index', () => {
    useStudio.setState({ picker: { view: 'compact', index: 3, anchor: { x: 10, y: 20 } } });
    useStudio.getState().expandPicker();
    expect(useStudio.getState().picker).toEqual({ view: 'browse', index: 3, anchor: null });
    // Already browse (or closed): a no-op.
    useStudio.getState().expandPicker();
    expect(useStudio.getState().picker).toEqual({ view: 'browse', index: 3, anchor: null });
    useStudio.setState({ picker: null });
    useStudio.getState().expandPicker();
    expect(useStudio.getState().picker).toBeNull();
  });

  it('closePicker drops the state and nothing else', () => {
    useStudio.setState({
      picker: { view: 'browse', index: null, anchor: null },
      selection: 1,
      mode: 'present',
    });
    useStudio.getState().closePicker();
    const s = useStudio.getState();
    expect(s.picker).toBeNull();
    expect(s.selection).toBe(1);
    expect(s.mode).toBe('present');
  });
});
