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

The ledger also omits later production RPC changes. A guarded recovery migration restores the two exported definitions only when their current definition differs; both production definition guards already match. Named EXECUTE revokes/grants restore the existing service-only restrictions on six RPCs in fresh rebuilds. No production function definition or RPC permission may change when applying the recovery.

The only pending production files are 20261022233613_recover_current_rpc_contract.sql and 20261022233614_explicit_data_api_grants.sql. A dry run must list exactly those files. Full historical replay plus recovery matches all 21 production routines and every relation/policy/access category.

## Production procedure

1. Review the PR, exact SQL, history manifest and successful database proof.
2. Refresh main, the complete live ledger and the production snapshot. Stop if
   any current permission or source definition differs from the reviewed state.
3. Confirm that the pending set contains exactly the files documented above.
4. Apply only that reviewed set, recording exact versions, names and SQL in the
   migration ledger. Never reset production or replay catalog fixtures there.
   Use `transaction.mjs` to build the apply SQL from the fresh snapshot and full
   ledger. It checks both before any SQL and checks every permission category
   again before commit. Any drift rolls back the migrations and ledger entries.
   CI executes that transaction and proves an ACL mutation rolls back its ledger
   entry too. This is required even for CMSTABLE's catalog-based proof.
5. Compare complete sorted tuples before and after. Only the ledger may change.
6. Merge only after reviewer approval and green CI, then verify the production
   deployment and representative application reads.

Use inspect.mjs summary/grants/compare with private snapshot files. Raw catalogs
and database credentials belong outside Git. Do not refresh expected digests to
make unexplained differences pass.

