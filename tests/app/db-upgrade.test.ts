import { describe, expect, it } from 'vitest';
import { DB_VERSION, STORES, upgradePlan } from '../../src/app/db';

const all = Object.keys(STORES);
const v2 = ['boards', 'frames', 'notes', 'files', 'handles', 'projects', 'placements'];

describe('upgradePlan', () => {
  it('is version 3 with an agents store', () => {
    expect(DB_VERSION).toBe(3);
    expect(STORES.agents.keyPath).toBe('id');
  });
  it('a new database gets every store and no migration', () => {
    const p = upgradePlan([]);
    expect([...p.create].sort()).toEqual([...all].sort());
    expect(p.migrateToProjects).toBe(false);
  });
  it('a service-worker-made empty database gets every store and no migration', () => {
    const p = upgradePlan([]);
    expect(p.create).toContain('agents');
    expect(p.create).toContain('files');
    expect(p.migrateToProjects).toBe(false);
  });
  it('a v1 database with frames migrates to projects', () => {
    const p = upgradePlan(['boards', 'frames', 'notes', 'files', 'handles']);
    expect([...p.create].sort()).toEqual(['agents', 'placements', 'projects']);
    expect(p.migrateToProjects).toBe(true);
  });
  it('a canon-mcp v2 database (agents, no projects) gets projects and placements and migrates', () => {
    const p = upgradePlan(['boards', 'frames', 'notes', 'files', 'handles', 'agents']);
    expect([...p.create].sort()).toEqual(['placements', 'projects']);
    expect(p.migrateToProjects).toBe(true);
  });
  it('a current v2 database gets only agents', () => {
    const p = upgradePlan(v2);
    expect(p.create).toEqual(['agents']);
    expect(p.migrateToProjects).toBe(false);
  });
});
