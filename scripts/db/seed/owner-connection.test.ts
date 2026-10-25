import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/**
 * The seed and the reset reach the database only through the owner connection of `DATABASE_URL` (NFR6.28, NFR1.64):
 * one `connectLocalStack` call that checks the address and the identity of the database first, and never the data
 * service connection the application uses. A source check, because the rule is about what the code is allowed to
 * name, and the behaviour (guard first, nothing changed on refusal) is proved by `commands.test.ts`.
 */
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SEED = code(read("../seed.ts"));
const RESET = code(read("../reset.ts"));
const WRITE = code(read("./write.ts"));
const GUARD = code(read("../local-guard.ts"));
const COMMON = code(read("../common.ts"));

describe("the owner connection of the seed and the reset", () => {
  it("opens the database in exactly one place per command, through the guarded owner connection", () => {
    for (const [name, source] of [
      ["seed.ts", SEED],
      ["reset.ts", RESET],
    ] as const) {
      assert.equal(
        [...source.matchAll(/connectLocalStack\(settings, deps\.connect\)/g)].length,
        1,
        name,
      );
      assert.equal(
        /deps\.connect\(/.test(source),
        false,
        `${name} connects only through the guard`,
      );
      assert.equal(/new (pg\.)?Client|Pool\(/.test(source), false, name);
    }
    assert.match(GUARD, /connect\(settings\.databaseUrl\)/);
    assert.match(COMMON, /pick\("DATABASE_URL"\)/);
  });

  it("never uses the data service connection to write the seed or to empty tables", () => {
    for (const [name, source] of [
      ["reset.ts", RESET],
      ["write.ts", WRITE],
    ] as const) {
      assert.equal(
        /createDatabaseClient|publicKey|SUPABASE_ANON_KEY|\/rest\/v1|\.rpc\(|fetch\(/.test(source),
        false,
        `${name} holds no data service call`,
      );
    }
  });

  it("calls the sign-in service only through the account administrator, for users and never for records", () => {
    assert.match(SEED, /deps\.createAdmin\(\{ url: settings\.apiUrl, serviceKey \}\)/);
    assert.equal(/\.rpc\(|\/rest\/v1/.test(SEED), false);
  });
});
