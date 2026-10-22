import { describe, expect, it, vi } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { runAudit, formatAudit } from '../commands/audit/run.js';
import type { AuditReport } from '../commands/audit/types.js';

async function tempRepo(files: Record<string, string>): Promise<{
  root: string;
  cleanup: () => Promise<void>;
}> {
  const root = join(tmpdir(), `chiltepin-audit-${randomBytes(6).toString('hex')}`);
  for (const [rel, content] of Object.entries(files)) {
    const abs = join(root, rel);
    await mkdir(join(abs, '..'), { recursive: true });
    await writeFile(abs, content);
  }
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

/** A tiny express + prisma app — the builtin extractor's home turf. */
const EXPRESS_PRISMA: Record<string, string> = {
  'package.json': JSON.stringify({
    name: 'acme-api',
    main: 'src/index.ts',
    scripts: { start: 'node src/index.ts' },
  }),
  'src/index.ts': [
    "import express from 'express';",
    "import axios from 'axios';",
    "import { db } from './db.js';",
    'const app = express();',
    "app.get('/users', list);",
    "app.post('/users', create);",
    "app.get('/users/:id', show);",
    "app.put('/users/:id', update);",
    "app.delete('/users/:id', remove);",
    '',
  ].join('\n'),
  'src/db.ts': 'export const db = {};\n',
  'prisma/schema.prisma': 'model User {\n  id Int @id\n}\n',
};

describe('runAudit (builtin source)', () => {
  it('extracts evidence and derives cited recommendations from an express+prisma repo', async () => {
    const { root, cleanup } = await tempRepo(EXPRESS_PRISMA);
    try {
      const result = await runAudit({ cwd: root });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const report = result.report;

      expect(report.version).toBe(1);
      expect(report.source).toBe('builtin');
      // No graphify-out → the report hints at the richer audit.
      expect(report.notice).toContain('graphify');
      expect(report.stats.files).toBe(4);
      expect(report.stats.languages['ts']).toBe(2);

      // Evidence: routes with method + path + file.
      const get = report.evidence.routes.find((r) => r.method === 'GET' && r.path === '/users');
      expect(get?.file).toBe('src/index.ts');
      expect(report.evidence.routes.length).toBe(5);
      expect(report.evidence.schemas).toEqual([{ file: 'prisma/schema.prisma', kind: 'prisma' }]);
      expect(report.evidence.packages).toEqual([{ name: 'acme-api', dir: '.' }]);
      expect(report.evidence.entrypoints[0]).toEqual({
        file: 'src/index.ts',
        why: 'package.json main',
      });
      expect(report.evidence.externals.map((e) => e.name)).toContain('axios');

      // Recommendations: data-model high, request-flows high, api-reference
      // medium (5 routes, no OpenAPI), onboarding medium (no README).
      const byKind = new Map(report.recommendations.map((r) => [r.kind, r]));
      expect(byKind.get('data-model')?.confidence).toBe('high');
      expect(byKind.get('request-flows')?.confidence).toBe('high');
      expect(byKind.get('api-reference')?.confidence).toBe('medium');
      expect(byKind.get('onboarding-guide')?.confidence).toBe('medium');
      expect(byKind.has('architecture-overview')).toBe(false); // 1 package, 1 entrypoint
      expect(byKind.get('data-model')?.citations).toEqual(['prisma/schema.prisma']);
      expect(byKind.get('data-model')?.template).toBe('data-model');

      // Every citation names a real fixture file.
      for (const rec of report.recommendations) {
        expect(rec.citations.length).toBeGreaterThan(0);
        for (const c of rec.citations) expect(existsSync(join(root, c))).toBe(true);
        expect(rec.rationale.length).toBeGreaterThan(0);
      }

      // Human output: stats, table, and the Claude Code hint.
      const text = formatAudit(report, true);
      expect(text).toContain('source  builtin');
      expect(text).toContain('data-model');
      expect(text).toContain('chiltepin audit --json');
      expect(text).toContain('ask your agent to write the docs you pick');
      expect(text).toContain('note:');
    } finally {
      await cleanup();
    }
  });

  it('harvests no evidence from test/fixture files (they only count in stats)', async () => {
    // The only "routes" and the only SDK import live in a test file — the
    // audit must not report an HTTP API for this repo.
    const { root, cleanup } = await tempRepo({
      'package.json': JSON.stringify({ name: 'lib-only' }),
      'src/util.js': 'export const x = 1;\n',
      'src/util.test.js': [
        "import axios from 'axios';",
        'const app = mockServer();',
        "app.get('/users', list);",
        "app.post('/users', create);",
        "app.get('/users/:id', show);",
        '',
      ].join('\n'),
      '__tests__/routes.js': "app.put('/legacy', update);\n",
    });
    try {
      const result = await runAudit({ cwd: root });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const report = result.report;
      expect(report.evidence.routes).toEqual([]);
      expect(report.evidence.externals).toEqual([]);
      const kinds = report.recommendations.map((r) => r.kind);
      expect(kinds).not.toContain('request-flows');
      expect(kinds).not.toContain('api-reference');
      // Stats still see every file — only evidence harvesting skips them.
      expect(report.stats.files).toBe(4);
    } finally {
      await cleanup();
    }
  });

  it('counts newline-terminated README lines (no trailing-newline off-by-one)', async () => {
    const { root, cleanup } = await tempRepo({ 'README.md': '# tiny\n' });
    try {
      const result = await runAudit({ cwd: root });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const onboarding = result.report.recommendations.find((r) => r.kind === 'onboarding-guide');
      expect(onboarding?.rationale).toContain('only 1 line(s)');
    } finally {
      await cleanup();
    }
  });

  it('exits with an error on an unusable path', async () => {
    const result = await runAudit({ cwd: tmpdir(), path: `missing-${randomBytes(4).toString('hex')}` });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('not a directory');
  });
});

describe('runAudit (graphify source)', () => {
  it('derives stats and god nodes from a valid graph.json', async () => {
    // 16 modules import core/registry → in-degree 16 (≥15 → dependency-map).
    const importers = Array.from({ length: 16 }, (_, i) => i);
    const graph = {
      nodes: [
        { id: 'core', label: 'core/registry', source_file: 'src/registry.ts' },
        ...importers.map((i) => ({ id: `m${i}`, label: `mod ${i}`, source_file: `src/m${i}.ts` })),
      ],
      links: importers.map((i) => ({
        source: `m${i}`,
        target: 'core',
        relation: 'imports',
        confidence: 'EXTRACTED',
      })),
    };
    const { root, cleanup } = await tempRepo({
      'graphify-out/graph.json': JSON.stringify(graph),
      'README.md': '# tiny\n',
    });
    try {
      const result = await runAudit({ cwd: root });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const report = result.report;
      expect(report.source).toBe('graphify');
      // Stats come from node source_file values, not the fs walk.
      expect(report.stats.files).toBe(17);
      expect(report.stats.languages['ts']).toBe(17);
      // God node derived from link in-degree, named by label + source_file.
      expect(report.evidence.godNodes[0]).toEqual({
        name: 'core/registry',
        degree: 16,
        file: 'src/registry.ts',
      });
      const dep = report.recommendations.find((r) => r.kind === 'dependency-map');
      expect(dep?.confidence).toBe('medium');
      expect(dep?.citations).toEqual(['src/registry.ts']);
      expect(dep?.rationale).toContain('16');
    } finally {
      await cleanup();
    }
  });

  it('falls back to builtin with a notice when graph.json is corrupt', async () => {
    const { root, cleanup } = await tempRepo({
      'graphify-out/graph.json': '{ this is not json',
      'src/index.ts': 'export {};\n',
    });
    try {
      const result = await runAudit({ cwd: root });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.report.source).toBe('builtin');
      expect(result.report.notice).toContain('graph.json');
      expect(result.report.notice).toContain('builtin extractor');
    } finally {
      await cleanup();
    }
  });

  it('falls back with a notice when graph.json misses the node fields', async () => {
    const { root, cleanup } = await tempRepo({
      'graphify-out/graph.json': JSON.stringify({ nodes: [{ nope: true }], links: [] }),
    });
    try {
      const result = await runAudit({ cwd: root });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.report.source).toBe('builtin');
      expect(result.report.notice).toContain('id/label');
    } finally {
      await cleanup();
    }
  });
});

describe('chiltepin audit --json (CLI wiring)', () => {
  it('emits parseable version-1 JSON and exits 0', async () => {
    const { root, cleanup } = await tempRepo(EXPRESS_PRISMA);
    const chunks: string[] = [];
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk): boolean => {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    });
    try {
      const { main } = await import('../app.js');
      const code = await main(['node', 'chiltepin', 'audit', root, '--json']);
      expect(code).toBe(0);
      const parsed = JSON.parse(chunks.join('')) as AuditReport;
      expect(parsed.version).toBe(1);
      expect(parsed.source).toBe('builtin');
      expect(Array.isArray(parsed.recommendations)).toBe(true);
      expect(parsed.evidence.schemas[0]?.kind).toBe('prisma');
    } finally {
      spy.mockRestore();
      await cleanup();
    }
  });

  it('exits 2 on an unusable path', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { main } = await import('../app.js');
      const code = await main(['node', 'chiltepin', 'audit', '/definitely/not/a/dir', '--json']);
      expect(code).toBe(2);
    } finally {
      errSpy.mockRestore();
    }
  });
});
