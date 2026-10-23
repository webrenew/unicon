# Explicit Data API grants

The baseline records the existing production permissions before Supabase stops
automatically exposing new public relations on October 30, 2026. It preserves
legacy privileges, including privileges that RLS does not constrain; it is not
a least-privilege redesign. Narrowing that access requires separate review:
[unicon #243](https://github.com/webrenew/unicon/issues/243).

## Verification

Run from the repository root:

```sh
pnpm security:migration-grants
pnpm test:migration-grants
pnpm test:data-api-grants --snapshot-dir /private/tmp/data-api-grants
```

For the last command, direct Node invocation also works:

```sh
node scripts/test-data-api-grants.mjs --snapshot-dir /private/tmp/data-api-grants
```

The database proof needs Docker and Supabase CLI 2.120.0. It creates a unique
disposable project on ports 56320–56322 with Postgres 17, revokes automatic
relation grants before application DDL, and stops only its own project. Run
proofs sequentially on one host. Snapshots must remain outside Git.

The contract covers the object inventory, direct relation/column ACLs and grant
options, effective table/column/sequence privileges for all three API roles,
schema ACLs, role inheritance, RLS, full policies, views and public/private
routine definitions and EXECUTE permissions. Production comparisons also
include default privileges. Only the disposable simulation changes defaults.

The readable role and RPC plans are checked independently of summary digests.
SQL files use `*.sql -text` so Git preserves their pinned bytes on every platform.
The fast checks also run in the existing lint job; the standalone database proof
uses Node 24, while the existing CI runtime remains covered.
Security negative controls disable RLS, introduce a client write policy, alter
a policy expression and introduce an owner-rights view inside rolled-back
transactions. A server SELECT revoke must fail and the exact baseline grant
must restore it. Post-replay sentinels test every supported relation and
sequence privilege, including INSERT-only and sequence SELECT-only defaults.

## Source guard

Each new public table, view, replacement view, materialized view or sequence
needs a named GRANT or REVOKE in the same SQL file. Serial/identity columns,
including ALTER TABLE ONLY, require sequence decisions too. DO-block DDL is
inspected. Dynamic EXECUTE, unsupported runtime DDL, blanket relation grants,
public schema CREATE and restored permissive defaults fail closed.

Historical files are exceptions only while their exact hashes match.
The guard is a lexical check. The database contract verifies actual access.

## Repository-specific history

None of the original 10 local migration versions matched the 15 production ledger versions. The original files are preserved byte-for-byte in supabase/legacy-migrations and checked as immutable references. They must never be pushed. supabase/migrations now contains the 15 recorded production SQL bodies with their real versions and names. scripts/data-api-grants/applied-history.json records the ledger statement hashes for review; scripts/migration-grants.config.json enforces the immutable source hashes.

Databases initialized from the old ten files need separate handling. For a disposable local database, preserve any needed data first, then explicitly run `supabase db reset` to rebuild from the recovered history. Never replay the fifteen files over an existing schema or delete/repair ledger rows blindly. A persistent staging or preview database needs its own schema/ledger comparison and reviewed reconciliation before the next push; stop on legacy versions rather than applying pending SQL. Production is already on the recovered fifteen-version history.

The ledger also omits later production RPC changes. A guarded recovery migration restores the two exported definitions only when their current definition differs; both production definition guards already match. Named EXECUTE revokes/grants restore the existing service-only restrictions on six RPCs in fresh rebuilds. No production function definition or RPC permission may change when applying the recovery.

The pending production files are 20261022233613_recover_current_rpc_contract.sql, 20261022233614_explicit_data_api_grants.sql, then 20261023010000_secure_bundle_rpc.sql. A dry run must list exactly those three files. Full historical replay plus recovery matches all 21 production routines and every relation/policy/access category.

## Production procedure

The owner approved the specific RPC authorization repair after review and CI.
Table grants, RLS, policies, views, defaults and unrelated routine definitions
must remain unchanged. The exact pending set is the recovery files (if any),
the baseline, then `reviewedChangeMigrations` from the checked-in configuration.
Never replay historical or catalog-fixture SQL on production.

1. Obtain independent approval and green required CI on the exact PR head.
2. Refresh the live project identity, complete ledger and permission snapshot.
   Require conformance to `before-rpc-repair-summary.json`, not the post-state.
3. Confirm that the pending set contains exactly the configured reviewed files.
4. Build the guarded transaction below using the fresh full snapshot/ledger and
   the independently reviewed post-state. Both states must match their checked-in
   summaries. Only the named RPC changes may differ; defaults and table ACLs
   must be identical. The transaction records the exact source/version/name of
   every pending file and rolls back all SQL/ledger writes on a mismatch.
5. Compare fresh complete tuples after application. Accept only the named RPC
   changes; verify every old ledger row and exact newly recorded source.
6. Merge only after review and required CI, then verify the matching production
   deployment and representative application reads.

The database proof executes this intentional transition and proves that an extra
anonymous EXECUTE grant rolls back the repair and its ledger entry. Empty ledgers
and NULL snapshots also abort before SQL. The builder defaults to a no-op
permission transition only when no reviewed post-state is supplied.

Use inspect.mjs summary/grants/compare with private snapshot files. Raw catalogs
and database credentials belong outside Git. Do not refresh expected digests to
make unexplained differences pass.

For a runnable build command, save the fresh snapshot, a JSON array of full
ledger rows and the independently reviewed post-state outside Git, then run from the repository root:

```sh
umask 077
node --input-type=module - /private/tmp/before.json /private/tmp/ledger.json /private/tmp/reviewed-after.json > /private/tmp/reviewed-apply.sql <<'JS'
import { readFileSync } from 'node:fs'
import { buildApplyTransaction } from './scripts/data-api-grants/transaction.mjs'
const [snapshotFile, ledgerFile, afterFile] = process.argv.slice(2)
const raw = JSON.parse(readFileSync(snapshotFile, 'utf8'))
const snapshot = raw.rows?.[0]?.snapshot ?? raw.snapshot ?? raw
const ledger = JSON.parse(readFileSync(ledgerFile, 'utf8'))
const config = JSON.parse(readFileSync('scripts/migration-grants.config.json', 'utf8'))
const migrations = [...(config.preBaselineMigrations ?? []), config.baseline, ...config.reviewedChangeMigrations].map(filename => ({
  filename, sql: readFileSync(config.directory + '/' + filename, 'utf8'),
}))
process.stdout.write(buildApplyTransaction(readFileSync('scripts/data-api-grants/snapshot.sql', 'utf8'),
  snapshot, ledger, migrations,
  JSON.parse(readFileSync('scripts/data-api-grants/before-rpc-repair-summary.json', 'utf8')),
  { snapshot: JSON.parse(readFileSync(afterFile, 'utf8')),
    summary: JSON.parse(readFileSync('scripts/data-api-grants/expected-summary.json', 'utf8')) }))
JS
```

This prepares SQL only. Submit it only after reviewing the exact file set and
confirming the correct live project, current commit, ledger and snapshot.
Later migrations always replay after the baseline in CI, including catalog-fixture
proofs; the baseline is never reapplied over a later intentional privilege change.

## Proposed RPC authorization repair

This rollout includes `20261023010000_secure_bundle_rpc.sql` for #243.
It revokes anonymous bundle creation, binds authenticated callers to their own
user ID, and restricts token validation to the server's service role. The existing
web session and trusted MCP paths remain supported. Table grants stay unchanged.
The owner approved this specific permission change after review and CI.
The three-file apply order is RPC recovery, grants baseline, then this repair.

The builder accepts a sixth argument `{ snapshot, summary }` for an independently
reviewed post-state. Both states must have complete snapshots and matching pinned
summaries. `before-rpc-repair-summary.json` pins the parent baseline, while
`expected-summary.json` pins the repair. The database proof checks the intended
transition, actual caller authorization, and complete rollback when an extra
anonymous EXECUTE grant is injected. Applying the parent plus repair together
must guard the current production snapshot/ledger and this exact post-state;
never use equal before/after expectations for this permission-changing repair.


