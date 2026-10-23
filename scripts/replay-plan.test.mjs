import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { replayPlan, repairStages } from './data-api-grants/replay-plan.mjs'
import { buildApplyTransaction } from './data-api-grants/transaction.mjs'
import { categories, summarize } from './data-api-grants/metadata.mjs'
import { findGrantProblems } from './check-migration-grants.mjs'

test('replay keeps recovery before baseline and all new SQL after it, including catalog fixtures', () => {
  const config = { historical: { '20260101_old.sql': 'hash' },
    baseline: '20261022000000_grants.sql', preBaselineMigrations: ['20261021000000_recovery.sql'],
    catalogFixtures: ['catalog.sql'] }
  const result = replayPlan(config, ['20261023120000_later.sql', config.baseline,
    '20261023_early.sql', '20260101_old.sql', '20261021000000_recovery.sql', 'README.md'])
  assert.deepEqual(result.before, ['20260101_old.sql', '20261021000000_recovery.sql'])
  assert.deepEqual(result.after, ['20261023_early.sql', '20261023120000_later.sql'])
})

test('DO-wrapped default grants and routine object creation cannot evade the source guard', () => {
  assert.ok(findGrantProblems('do $$ begin alter default privileges in schema public grant select on tables to anon; end $$;')
    .some((x) => x.includes('blanket default')))
  assert.ok(findGrantProblems('do $block$ begin create function public.bad() returns void language plpgsql as $body$ begin create table public.runtime(id int); end $body$; end $block$;')
    .some((x) => x.includes('runtime object DDL')))
  assert.deepEqual(findGrantProblems('do $$ declare saved int; begin select 1 into saved; end $$;'), [])
})

test('transaction uses null-safe guards and includes the snapshot body when choosing dollar tags', async () => {
  let sql = await readFile(new URL('./data-api-grants/snapshot.sql', import.meta.url), 'utf8')
  sql = sql.replace('-- Read metadata only.', '-- $production_grants_apply$ Read metadata only.')
  const expected = Object.fromEntries([...categories, 'defaults'].map((name) => [name, []]))
  const transaction = buildApplyTransaction(sql, expected, [{ version: '20260101000000' }],
    [{ filename: '20261022000000_safe.sql', sql: 'grant select on public.example to anon;' }], summarize(expected))
  assert.equal(transaction.split(' is distinct from ').length - 1, 3)
  assert.ok(transaction.includes('do $production_grants_apply_$'))
  assert.ok(transaction.includes('$production_grants_apply_$;'))
})


test('intentional changes require an independently reviewed post-state contract', async () => {
  const sql = await readFile(new URL('./data-api-grants/snapshot.sql', import.meta.url), 'utf8')
  const before = Object.fromEntries([...categories, 'defaults'].map((name) => [name, []]))
  const after = { ...before, routines: [{ name: 'reviewed_repair' }] }
  const ledger = [{ version: '20260101000000' }]
  const migrations = [{ filename: '20261023010000_repair.sql', sql: 'select 1;' }]
  assert.throws(() => buildApplyTransaction(sql, before, ledger, migrations, summarize(before),
    { snapshot: after, summary: summarize(before) }), /Permission contract mismatch: routines/)
  const transaction = buildApplyTransaction(sql, before, ledger, migrations, summarize(before),
    { snapshot: after, summary: summarize(after) })
  assert.ok(transaction.includes('expected_after jsonb := '))
  assert.ok(transaction.includes('if observed is distinct from expected_after then'))
})

test('RPC repair post-state must preserve production defaults and table grants', async () => {
  const sql = await readFile(new URL('./data-api-grants/snapshot.sql', import.meta.url), 'utf8')
  const before = Object.fromEntries([...categories, 'defaults'].map(name => [name, []]))
  for (const category of ['defaults', 'relation_acl']) {
    const after = { ...before, [category]: [{ unreviewed: true }] }
    assert.throws(() => buildApplyTransaction(sql, before, [{ version: '20260101000000' }],
      [{ filename: '20261023010000_repair.sql', sql: 'select 1;' }], summarize(before),
      { snapshot: after, summary: summarize(after) }), /must preserve current production metadata/)
  }
})

test('later table and index migrations run after the pinned RPC repair checkpoint', () => {
  const repair = '20261023010000_rpc_repair.sql'
  const later = ['20261024000000_new_table.sql', '20261025000000_new_index.sql']
  assert.deepEqual(repairStages([repair, ...later], [repair]), { repair: [repair], later })
})
test('unreviewed SQL cannot slip before or replace the RPC checkpoint', () => {
  const repair = '20261023010000_rpc_repair.sql'
  for (const files of [[], ['20261023000000_unreviewed.sql', repair], ['20261023010000_other.sql']]) {
    assert.throws(() => repairStages(files, [repair]), /first exact post-baseline checkpoint/)
  }
})
