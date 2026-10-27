import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import {
  type Allowlist,
  FIXTURE_FOLDER,
  gitTrackedFiles,
  loadAllowlist,
  runScan,
  SCAN_MODES,
  scanPrivacy,
  scanSecrets,
} from "./scan-core.ts";

// Everything below is generated at run time and invented: no real person, address or key appears
// in this file, so the scans can run over it.
const at = "@";
const part = (character: string) => character.repeat(24);
const fakeJwt = () => ["eyJ" + part("a"), part("b"), part("c")].join(".");
const fakeEmail = () => `person${at}invented.invalid`;
const fakePhone = () => ["+36", "20", "123", "4567"].join(" ");
const otherPhone = () => ["+36", "70", "999", "8888"].join(" ");

const noAllowlist: Allowlist = {
  emailDomains: ["example.test"],
  emails: [],
  phoneNumbers: [],
  phoneAllowedPaths: [],
  allowedPaths: ["db/migrations/"],
  ignoredPrefixes: ["records/"],
  secretIgnoredPrefixes: ["records/"],
  defaultKeyHashes: [],
};

function withTree(files: Record<string, string>, check: (root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "scan-test-"));
  try {
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content);
    }
    check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const privacy = (root: string, allowlist = noAllowlist) =>
  scanPrivacy({ root, trackedFiles: undefined, allowlist }).findings;
const secrets = (root: string, allowlist = noAllowlist) =>
  scanSecrets({ root, allowlist }).findings;

describe("privacy scan", () => {
  it("fails for a planted workbook, spreadsheet, csv and sql dump outside the fixtures folder", () => {
    withTree(
      {
        "data/people.xlsx": "x",
        "data/old.xls": "x",
        "data/export.csv": "a,b",
        "dump/all.sql": "select 1",
        "data/sheet.ods": "x",
      },
      (root) => {
        const findings = privacy(root);
        for (const name of ["people.xlsx", "old.xls", "export.csv", "all.sql", "sheet.ods"]) {
          assert.ok(
            findings.some((finding) => finding.includes(name) && finding.includes("data file")),
            name,
          );
        }
      },
    );
  });

  it("fails for a planted email address and names the file", () => {
    withTree({ "docs/notes.md": `contact ${fakeEmail()} today` }, (root) => {
      assert.deepEqual(privacy(root), ["docs/notes.md contains an email address"]);
    });
  });

  it("fails for planted Hungarian and international phone numbers", () => {
    withTree(
      {
        "docs/a.md": `call ${fakePhone()}`,
        "docs/b.md": `call ${["06", "30", "555", "1234"].join("-")}`,
        "docs/c.md": `call ${["+44", "20", "7946", "0958"].join(" ")}`,
      },
      (root) => {
        assert.deepEqual(privacy(root), [
          "docs/a.md contains a phone number",
          "docs/b.md contains a phone number",
          "docs/c.md contains a phone number",
        ]);
      },
    );
  });

  it("allows example addresses, schema files in the allowed path and the fixtures folder", () => {
    withTree(
      {
        "docs/ok.md": `write to person${at}example.test`,
        "db/migrations/001.sql": "create table t (id int);",
        [`${FIXTURE_FOLDER}people.xlsx`]: "x",
        [`${FIXTURE_FOLDER}people.json`]: `{"mail": "${fakeEmail()}", "phone": "${fakePhone()}"}`,
        "records/notes.md": `${fakeEmail()} ${fakePhone()}`,
      },
      (root) => {
        assert.deepEqual(privacy(root), []);
      },
    );
  });

  it("skips lock files and generated folders", () => {
    withTree(
      {
        "package-lock.json": `{"author": "${fakeEmail()}"}`,
        "node_modules/pkg/index.js": fakeEmail(),
        "coverage/report.txt": fakeEmail(),
        ".next/build.js": fakeEmail(),
      },
      (root) => {
        assert.deepEqual(privacy(root, { ...noAllowlist }), []);
      },
    );
  });

  it("allows an exact allowlisted address anywhere and a listed phone number in test files and listed paths", () => {
    withTree(
      {
        "docs/a.md": fakeEmail(),
        "src/form.test.ts": fakePhone(),
        "tests/support/people.ts": fakePhone(),
        "seed/people.ts": fakePhone(),
      },
      (root) => {
        const allowlist = {
          ...noAllowlist,
          emails: [fakeEmail()],
          phoneNumbers: [fakePhone()],
          phoneAllowedPaths: ["seed/"],
        };
        assert.deepEqual(privacy(root, allowlist), []);
      },
    );
  });

  it("flags a listed phone number outside test files and the listed paths, and an unlisted one inside them", () => {
    withTree(
      {
        "src/form.ts": fakePhone(),
        "docs/a.md": fakePhone(),
        "src/other.test.ts": otherPhone(),
      },
      (root) => {
        const allowlist = {
          ...noAllowlist,
          phoneNumbers: [fakePhone()],
          phoneAllowedPaths: ["seed/"],
        };
        assert.deepEqual(privacy(root, allowlist), [
          "docs/a.md contains a phone number",
          "src/form.ts contains a phone number",
          "src/other.test.ts contains a phone number",
        ]);
      },
    );
  });

  it("does not mistake version numbers, hashes or package names for personal data", () => {
    withTree(
      {
        "docs/versions.md": `typescript${at}5.9.0 react${at}latest ${at}next/env 2026-10-12 ${"f".repeat(40)} 12345 67890`,
        "docs/code.ts": "const x = 1234567890; // build 2026.10.12 sha 0a1b2c3d4e5f",
      },
      (root) => {
        assert.deepEqual(privacy(root), []);
      },
    );
  });

  it("uses only the files that are tracked when a list is given", () => {
    withTree({ "docs/tracked.md": "fine", "docs/untracked.md": fakeEmail() }, (root) => {
      const result = scanPrivacy({
        root,
        trackedFiles: ["docs/tracked.md"],
        allowlist: noAllowlist,
      });
      assert.deepEqual(result.findings, []);
      assert.equal(result.scanned, 1);
    });
  });

  it("scans generated evidence folders even though they are not tracked", () => {
    withTree({ ".verification/logs/private.log": fakeEmail() }, (root) => {
      const findings = privacy(root);
      assert.ok(findings.some((finding) => finding.startsWith(".verification/logs/private.log")));
    });
  });

  it("ignores binary and oversized files and a missing tracked path", () => {
    withTree(
      {
        "assets/logo.png": fakeEmail(),
        "assets/big.txt": `${fakeEmail()}${" ".repeat(2 * 1024 * 1024)}`,
      },
      (root) => {
        const result = scanPrivacy({
          root,
          trackedFiles: ["assets/logo.png", "assets/big.txt", "gone.txt"],
          allowlist: noAllowlist,
        });
        assert.deepEqual(result.findings, []);
      },
    );
  });
});

describe("secret scan", () => {
  it("fails for a planted JWT-shaped string, a stack key and a private key header", () => {
    withTree(
      {
        "src/a.ts": `const token = "${fakeJwt()}";`,
        "src/b.ts": `const key = "${["sb", "secret", part("x")].join("_")}";`,
        "src/c.pem": `-----BEGIN ${"PRIVATE"} KEY-----`,
      },
      (root) => {
        assert.deepEqual(secrets(root), [
          "src/a.ts contains a JWT-shaped string",
          "src/b.ts contains a stack key",
          "src/c.pem contains a private key header",
        ]);
      },
    );
  });

  it("fails for a service-role key name with a value, in env and code forms", () => {
    const name = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");
    withTree(
      {
        ".env.sample": `${name}=${part("k")}`,
        "src/config.ts": `const ${["service", "Role", "Key"].join("")} = "x"; export default { ${name}: "${part("v")}" };`,
      },
      (root) => {
        assert.deepEqual(secrets(root), [
          ".env.sample contains a service-role key name with a value",
          "src/config.ts contains a service-role key name with a value",
        ]);
      },
    );
  });

  it("allows names without values, placeholders, environment reads and identifiers", () => {
    const name = ["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_");
    withTree(
      {
        ".env.example": `# ${name}=\n${name}=\n`,
        "src/a.ts": `const a = process.env.${name}; const b = { ${name}: process.env.${name} };`,
        "src/b.ts": `const c = { ${name}: values.serviceKey };`,
        "docs/c.md": `${name}=<your-key-here> and ${name}=\${VALUE}`,
      },
      (root) => {
        assert.deepEqual(secrets(root), []);
      },
    );
  });

  it("allows a documented default key by its hash, but not another key", () => {
    const documented = fakeJwt();
    const other = ["eyJ" + part("d"), part("e"), part("f")].join(".");
    const allowlist = {
      ...noAllowlist,
      defaultKeyHashes: [createHash("sha256").update(documented).digest("hex")],
    };
    withTree({ "docs/default.md": `default key ${documented}` }, (root) => {
      assert.deepEqual(secrets(root, allowlist), []);
    });
    withTree({ "docs/default.md": `default key ${documented}`, "docs/other.md": other }, (root) => {
      assert.deepEqual(secrets(root, allowlist), ["docs/other.md contains a JWT-shaped string"]);
    });
  });

  it("allows a documented default value assigned to a service-role key name", () => {
    const documented = fakeJwt();
    const name = ["SERVICE", "ROLE", "KEY"].join("_");
    const allowlist = {
      ...noAllowlist,
      defaultKeyHashes: [createHash("sha256").update(documented).digest("hex")],
    };
    withTree({ ".env.docs": `${name}="${documented}"` }, (root) => {
      assert.deepEqual(secrets(root, allowlist), []);
    });
  });

  it("skips record folders and generated folders", () => {
    withTree({ "records/a.md": fakeJwt(), "node_modules/x/index.js": fakeJwt() }, (root) => {
      assert.deepEqual(secrets(root), []);
    });
  });
});

describe("scan configuration and timing", () => {
  it("ships an allowlist with the documented default key hashes and the example domains", () => {
    const allowlist = loadAllowlist();
    assert.equal(allowlist.defaultKeyHashes.length, 4);
    for (const hash of allowlist.defaultKeyHashes) assert.match(hash, /^[a-f0-9]{64}$/);
    assert.ok(allowlist.emailDomains.includes("example.test"));
    assert.ok(allowlist.allowedPaths.includes("supabase/migrations/"));
  });

  it("treats a missing list in the allowlist file as empty", () => {
    withTree({ "list.json": "{}" }, (root) => {
      const allowlist = loadAllowlist(new URL(`file://${root}/list.json`));
      assert.deepEqual(allowlist, {
        emailDomains: [],
        emails: [],
        phoneNumbers: [],
        phoneAllowedPaths: [],
        allowedPaths: [],
        ignoredPrefixes: [],
        secretIgnoredPrefixes: [],
        defaultKeyHashes: [],
      });
    });
  });

  // A generous runner timeout: the 15 s scan target below is what the test itself asserts.
  it(
    "runs every mode on this repository and the privacy and secret scans finish within the target",
    { timeout: 60_000 },
    () => {
      const root = new URL("../../", import.meta.url).pathname;
      const started = Date.now();
      const privacyResult = runScan("privacy", { root });
      const secretResult = runScan("secrets", { root });
      const elapsed = Date.now() - started;
      console.log(
        `# privacy and secret scans together: ${(elapsed / 1000).toFixed(1)} s (target 15 s)`,
      );
      assert.deepEqual(
        privacyResult.findings.filter((finding) => finding.includes("scan-")),
        [],
      );
      assert.deepEqual(secretResult.findings, []);
      assert.ok(elapsed < 15_000, `scans took ${elapsed} ms`);
      for (const mode of SCAN_MODES)
        assert.ok(Array.isArray(runScan(mode, { root, trackedFiles: [] }).findings));
    },
  );

  it("lists tracked files through git and reports unavailable git as undefined", () => {
    const root = new URL("../../", import.meta.url).pathname;
    assert.ok(gitTrackedFiles(root)?.includes("package.json"));
    withTree({ "a.txt": "x" }, (directory) => {
      assert.equal(gitTrackedFiles(directory), undefined);
    });
  });
});
