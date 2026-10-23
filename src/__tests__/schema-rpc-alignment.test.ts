import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const allMigrationSql = readdirSync(migrationsDir)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(join(migrationsDir, file), "utf8"))
  .join("\n\n");

describe("schema/RPC migration alignment", () => {
  it("includes teams.logo_url used by team logo routes", () => {
    expect(allMigrationSql).toMatch(
      /alter\s+table\s+(?:public\.)?teams\s+add\s+column\s+(?:if\s+not\s+exists\s+)?logo_url\s+text/i
    );
  });

  it("includes create_bundle_atomic args used by bundle create flows", () => {
    expect(allMigrationSql).toMatch(
      /create\s+or\s+replace\s+function\s+public\.create_bundle_atomic\([\s\S]*p_normalize_viewbox\s+boolean[\s\S]*p_target_viewbox\s+text/i
    );
  });

  it("includes list_api_sessions RPC used by token listing API", () => {
    expect(allMigrationSql).toMatch(
      /create\s+or\s+replace\s+function\s+public\.list_api_sessions\s*\(\s*p_user_id\s+uuid\s*\)/i
    );
  });

  it("includes create_api_token_direct RPC used by token creation API", () => {
    expect(allMigrationSql).toMatch(
      /create\s+or\s+replace\s+function\s+public\.create_api_token_direct\s*\(\s*p_user_id\s+uuid[\s\S]*p_name\s+text[\s\S]*p_scope\s+text[\s\S]*\)\s*returns\s+jsonb/i
    );
  });
});
