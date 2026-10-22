import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { auditMigrationGrants, findGrantProblems } from './check-migration-grants.mjs'
import { assertRoutineAccess } from './data-api-grants/routine-access.mjs'

test('RPC execution contracts reject extra client access and missing server access', () => {
  const expected = { 'public.locked(value text)': {
    owner: 'postgres', security_definer: true,
    execute: { anon: false, authenticated: false, service_role: true },
  } }
  const snapshot = { routines: [{ schema: 'public', name: 'locked', arguments: 'value text',
    owner: 'postgres', security_definer: true, effective_execute: [
      { role: 'anon', execute: false }, { role: 'authenticated', execute: false },
      { role: 'service_role', execute: true },
    ] }] }
  assertRoutineAccess(snapshot, expected)
  for (const index of [0, 1, 2]) {
    const changed = structuredClone(snapshot)
    changed.routines[0].effective_execute[index].execute = index !== 2
    assert.throws(() => assertRoutineAccess(changed, expected), /Reviewed RPC execution differs/)
  }
  assert.throws(() => assertRoutineAccess({ routines: [] }, expected), /Routine inventory changed/)
})

const digest = (sql) => createHash('sha256').update(sql).digest('hex')
async function fixture(config, files, run) {
  const root = await mkdtemp(join(tmpdir(), 'grants-history-'))
  try {
    await mkdir(join(root, 'scripts'))
    await mkdir(join(root, 'migrations'))
    const baseline = '20261022000000_baseline.sql'
    await writeFile(join(root, 'migrations', baseline), '-- named grants')
    await writeFile(join(root, 'scripts/migration-grants.config.json'),
      JSON.stringify({ mode: 'migrations', directory: 'migrations', baseline, historical: {}, ...config }))
    for (const [file, sql] of Object.entries(files)) {
      const path = join(root, file)
      await mkdir(join(path, '..'), { recursive: true })
      await writeFile(path, sql)
    }
    await run(root)
  } finally { await rm(root, { recursive: true, force: true }) }
}

test('ALTER TABLE ONLY and IF EXISTS ONLY serial columns require sequence decisions', () => {
  for (const clause of ['only', 'if exists only']) {
    const sql = `alter table ${clause} public.events add column id bigserial;`
    assert.ok(findGrantProblems(sql).some((x) => x.includes('events_id_seq')))
    assert.deepEqual(findGrantProblems(sql + 'revoke all on sequence public.events_id_seq from anon;'), [])
  }
})

test('an exact historical short filename works without allowing new short names', async () => {
  const name = '20260204_legacy.sql'
  await fixture({ legacyFilenames: [name], historical: { [name]: digest('-- original') } },
    { ['migrations/' + name]: '-- original' }, async (root) => {
      assert.deepEqual((await auditMigrationGrants(root)).errors, [])
      await writeFile(join(root, 'migrations/20261023_new.sql'), '-- new')
      assert.ok((await auditMigrationGrants(root)).errors.some((x) => x.includes('unsupported')))
      await writeFile(join(root, 'migrations', name), '-- changed')
      assert.ok((await auditMigrationGrants(root)).errors.some((x) => x.includes('historical migration changed')))
    })
})

test('date adapter permits pinned same-day history and checks new date-only SQL', async () => {
  const historical = Object.fromEntries(['20251217_a.sql', '20251217_b.sql', 'schema.sql']
    .map((name) => [name, digest('-- original')]))
  const files = Object.fromEntries(Object.keys(historical).map((name) => ['migrations/' + name, '-- original']))
  await fixture({ dateVersions: true, legacyFilenames: ['schema.sql'], historical }, files, async (root) => {
    assert.deepEqual((await auditMigrationGrants(root)).errors, [])
    await writeFile(join(root, 'migrations/20261023_missing.sql'), 'create table public.future(id int);')
    assert.ok((await auditMigrationGrants(root)).errors.some((x) => x.includes('without a matching')))
    await writeFile(join(root, 'migrations/20261023_missing.sql'),
      'create table public.future(id int); revoke all on public.future from anon;')
    assert.deepEqual((await auditMigrationGrants(root)).errors, [])
    await writeFile(join(root, 'migrations/20261023000000_duplicate.sql'), '-- duplicate')
    assert.ok((await auditMigrationGrants(root)).errors.some((x) => x.includes('duplicate')))
    await writeFile(join(root, 'migrations/20261021_backdated.sql'), '-- backdated')
    assert.ok((await auditMigrationGrants(root)).errors.some((x) => x.includes('backdated')))
    await writeFile(join(root, 'migrations/no_version.sql'), '-- unsupported')
    assert.ok((await auditMigrationGrants(root)).errors.some((x) => x.includes('unsupported')))
  })
})

test('preserved reference SQL is immutable and rejects unregistered additions', async () => {
  await fixture({ legacyDirectory: 'legacy', legacyHashes: { 'old.sql': digest('-- old') } },
    { 'legacy/old.sql': '-- old' }, async (root) => {
      assert.deepEqual((await auditMigrationGrants(root)).errors, [])
      await writeFile(join(root, 'legacy/old.sql'), '-- changed')
      assert.ok((await auditMigrationGrants(root)).errors.some((x) => x.includes('historical reference changed')))
      await writeFile(join(root, 'legacy/new.sql'), '-- added')
      assert.ok((await auditMigrationGrants(root)).errors.some((x) => x.includes('unregistered')))
    })
})

test('catalog fixture inventory and bytes are pinned separately from migration history', async () => {
  await fixture({ catalogFixtures: ['catalog/schema.sql'],
    fixtureHashes: { 'catalog/schema.sql': digest('-- catalog') } },
    { 'catalog/schema.sql': '-- catalog' }, async (root) => {
      assert.deepEqual((await auditMigrationGrants(root)).errors, [])
      await writeFile(join(root, 'catalog/schema.sql'), '-- modified')
      assert.ok((await auditMigrationGrants(root)).errors.some((x) => x.includes('catalog fixture changed')))
      await writeFile(join(root, 'catalog/new.sql'), '-- unexpected')
      assert.ok((await auditMigrationGrants(root)).errors.some((x) => x.includes('unregistered catalog fixture')))
    })
})

