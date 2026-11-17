import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, realpathSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { isDeepStrictEqual, parseArgs } from 'node:util'
import { categories, summarize } from './metadata.mjs'

export const proofUsage = `Usage: node scripts/test-data-api-grants.mjs [--snapshot-dir DIR]
Requires Supabase CLI, Docker, and free local ports 56320–56322.
Run sequentially on each host; unique project IDs isolate cleanup, not ports.
Uses only its unique disposable project. Optional private snapshots are saved
in a unique directory under DIR, outside Git, for comparisons and diagnosis.
`

export function parseProofArguments(args) {
  const { values } = parseArgs({ args, options: {
    help: { type: 'boolean', short: 'h' },
    'snapshot-dir': { type: 'string' },
  } })
  return { help: values.help, snapshotDirectory: values['snapshot-dir'] }
}

// Function definitions, policy expressions and identity arguments are rendered
// text, and a role, database or session setting can change that text without
// any catalog change (#245). Every snapshot and apply transaction pins the two
// settings that affect rendering, and refuses another PostgreSQL major version:
// an upgrade needs a reviewed refresh of the pinned definition hashes.
export const POSTGRES_MAJOR_VERSION = 17
export const RENDERING_PREAMBLE = [
  'set local quote_all_identifiers = off;',
  'set local standard_conforming_strings = on;',
  "do $postgres_major$ begin if current_setting('server_version_num')::int / 10000 <> "
    + POSTGRES_MAJOR_VERSION + " then raise exception 'PostgreSQL major version changed; "
    + "review catalog rendering and pinned definition hashes before using this snapshot'; end if; end $postgres_major$;",
].join('\n')

const snapshotBegin = 'begin isolation level repeatable read read only;'

export function snapshotQueryBody(sql) {
  const begin = /^begin isolation level repeatable read read only;$/gm
  const commit = /^commit;$/gm
  assert.equal([...sql.matchAll(begin)].length, 1, 'Expected one read-only snapshot BEGIN wrapper')
  assert.equal([...sql.matchAll(commit)].length, 1, 'Expected one snapshot COMMIT wrapper')
  assert.ok(sql.includes(snapshotBegin + '\n' + RENDERING_PREAMBLE + '\n'),
    'Snapshot must pin catalog rendering settings right after BEGIN')
  const body = sql.replace(snapshotBegin + '\n' + RENDERING_PREAMBLE + '\n', '').replace(commit, '')
  assert.doesNotMatch(body, /^\s*(?:begin|commit|set\s+transaction)\b/im, 'Unexpected transaction statement in snapshot query')
  assert.doesNotMatch(body, /\b(?:quote_all_identifiers|standard_conforming_strings|server_version_num)\b/i,
    'Catalog rendering settings belong only in the pinned preamble')
  return body
}

export function proofDirectory(directory, scratch) {
  const path = privateSnapshotPath(directory ?? scratch)
  if (!directory) return path
  mkdirSync(path, { recursive: true, mode: 0o700 })
  return mkdtempSync(join(path, 'proof-'))
}

function privateSnapshotPath(directory) {
  let ancestor = resolve(directory)
  const suffix = []
  while (!existsSync(ancestor)) {
    suffix.unshift(basename(ancestor))
    ancestor = dirname(ancestor)
  }
  assert.ok(statSync(ancestor).isDirectory(), 'Snapshot parent must be a directory')
  ancestor = realpathSync(ancestor)
  try {
    execFileSync('git', ['-C', ancestor, 'rev-parse', '--absolute-git-dir'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, LC_ALL: 'C' } })
  } catch (error) {
    const outside = /^fatal: not a git repository \((?:or any of the parent directories|or any parent up to mount point [^\r\n]+)\)(?:: \.git)?$/m
    if (error.status === 128 && outside.test(error.stderr)) return join(ancestor, ...suffix)
    throw error
  }
  throw new Error('Snapshot output must be outside Git repositories, including symlink targets')
}

export function writeProofSnapshot(directory, name, snapshot) {
  const path = join(directory, `${name}.json`)
  writeFileSync(path, JSON.stringify(snapshot, null, 2) + '\n', { mode: 0o600 })
  return path
}

export function assertSnapshotContract(snapshot, expected, path, selected = categories) {
  assert.deepEqual(Object.keys(expected).sort(), [...selected].sort(),
    'Expected contract must contain exactly the selected permission categories')
  const actual = summarize(snapshot)
  const changed = selected.filter((category) => !isDeepStrictEqual(actual[category], expected[category]))
  if (!changed.length) return
  throw new Error(`Permission contract mismatch: ${changed.join(', ')}.\n`
    + `Actual rows: ${path}\n`
    + 'Compare with reviewed production rows: node scripts/data-api-grants/inspect.mjs compare PRODUCTION_SNAPSHOT ACTUAL_SNAPSHOT\n'
    + 'See scripts/data-api-grants/README.md before updating expected-summary.json.')
}

function databaseContainerExists(container, run) {
  try {
    run('docker', ['container', 'inspect', container])
    return true
  } catch { return false }
}

export function stopProofDatabase(state, run) {
  if (!state.startAttempted) return
  if (!state.started && !databaseContainerExists(state.container, run)) return
  run('supabase', ['stop', '--project-id', state.project, '--no-backup', '--workdir', state.scratch])
}
