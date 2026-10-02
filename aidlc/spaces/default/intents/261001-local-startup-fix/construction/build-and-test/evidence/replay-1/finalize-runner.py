from pathlib import Path
from datetime import datetime, timezone
import hashlib, json, re, shutil
from collections import Counter

root=Path('/Users/dev/Development/waldorf-community-task-manager')
record=root/'aidlc/spaces/default/intents/261001-local-startup-fix'
stage=record/'construction/build-and-test'
out=stage/'evidence/replay-1'
checks=json.loads((out/'checks.json').read_text())
acceptance=json.loads((out/'acceptance.json').read_text())
cleanup=json.loads((out/'cleanup.json').read_text())
assert all(x['check_passed'] for x in checks+acceptance+cleanup)
for name,count in [('browser',96),('a11y',15)]:
    text=(out/(name+'.log')).read_text()
    assert re.search(r'\b'+str(count)+r' passed\b',text)
    assert not re.search(r'\b[1-9]\d* (failed|skipped)\b',text)
audit=json.loads((out/'audit.log').read_text())
assert audit['metadata']['vulnerabilities']['high']==0 and audit['metadata']['vulnerabilities']['critical']==0
manifest=json.loads((record/'construction/code-generation/source-manifest.json').read_text())
for entry in manifest['writes']:
    assert hashlib.sha256((root/entry['path']).read_bytes()).hexdigest()==entry['sha256'],entry['path']
(out/'source-fingerprints.json').write_text(json.dumps(manifest,indent=2)+'\n')
assert hashlib.sha256((root/'package-lock.json').read_bytes()).hexdigest()==(out/'audited-lock-sha256.txt').read_text().strip()
totals=json.loads((out/'canonical-coverage-summary.json').read_text())['total']
assert all(totals[key]['pct']>=80 for key in ['lines','branches','functions'])
inventory=json.loads((out/'canonical-coverage-inventory.json').read_text())
mapping=json.loads((out/'canonical-coverage-map.json').read_text())
runtime=[f['path'] for f in inventory['files'] if f['classification']=='runtime']
paths={str(Path(p).relative_to(root)) for p in mapping}
assert set(runtime).issubset(paths)
for item in mapping.values():
    assert all(isinstance(n,int) and n>=0 for key in ['s','f'] for n in item[key].values())
    assert all(isinstance(n,int) and n>=0 for arr in item['b'].values() for n in arr)
native=(out/'native.log').read_text()
adapted=(out/'domain-negative-floor-verbose.log').read_text()
suites=set(re.findall(r'^\s*▶ (.*?)$',native,re.M))
native_names=[n for n in re.findall(r'^\s*✔ (.*?) \([\d.]+ms\)$',native,re.M) if n not in suites]
adapted_names=[n.split(' > ')[-1] for n in re.findall(r'^\s*✓\s+domain-coverage\s+.*?\.test\.ts > (.*?) \d+ms$',re.sub(r'\x1b\[[0-9;]*m','',adapted),re.M)]
assert len(native_names)==len(adapted_names)==128 and Counter(native_names)==Counter(adapted_names)
assert re.search(r'\btests\s+128\b',native)
assert re.search(r'Tests\s+128 passed',re.sub(r'\x1b\[[0-9;]*m','',adapted))
(out/'adapter-provenance.json').write_text(json.dumps({'native_cases':128,'adapted_cases':128,'same_case_name_multiset':True,'native_names':sorted(native_names),'adapted_names':sorted(adapted_names),'current_source_matches_approved_manifest':True},indent=2)+'\n')
shutil.copy2('/private/tmp/waldorf-build-test-replay.py',out/'verification-runner.py')
shutil.copy2(__file__,out/'finalize-runner.py')
for p in out.glob('*.log'):
    p.write_text(re.sub(r'\x1b\[[0-9;]*m','',p.read_text()))
timestamp=datetime.now(timezone.utc).isoformat()
(out/'browser-accessibility-results.json').write_text(json.dumps({'browser':{'command':'npm run test:browser','raw_exit':0,'passed':96,'failed':0,'skipped':0,'port':3100},'accessibility':{'command':'npm run test:a11y','raw_exit':0,'passed':15,'failed':0,'skipped':0,'port':3210},'installed_browsers_only':True,'authorized_cache_metadata_escalation':True},indent=2)+'\n')
rows=[
('T01','requirements.md FR1/NFR3','Node24/npm11; unsupported versions rejected','24.21.0/11.19.0; toolchain/regressions pass','node-version.log,npm-version.log,toolchain.log,startup.log'),
('T02','Testing Contract team Code Style','Formatter/linter pass including ignored owned files','All exit0','format.log,owned-format.log,lint.log'),
('T03','Testing Contract team Testing Posture','Strict typecheck pass','Exit0','typecheck.log'),
('T04','requirements.md FR2/FR4/NFR1','Loading/precedence/rejection/redaction regressions pass','49 passed','startup.log'),
('T05','Testing Contract scope floor','Existing and new suites green','128 native +271 delivery=399;0 failed/skipped','tests.log'),
('T06','current coverage config / Testing Contract','Native and full-instrumented configured gates pass','Both exit0; native93.51/85.16/90.67','canonical-coverage.log,explicit-coverage.log'),
('T07','requirements.md NFR3 / Testing Contract team/project','80% lines/branches/functions across complete production scope','94.18% lines1781/1891;80.14% branches1465/1828;92.30% functions624/676;124 runtime files/141 candidates','canonical-coverage-map.json,canonical-coverage-inventory.json,canonical-coverage-summary.json'),
('T08','requirements.md FR3/NFR3','Production build pass','Exit0','build.log'),
('T09','requirements.md FR3','Dev/start synthetic readiness/root without mode export','HTTP200 ready/synthetic/waldorf-local-ready and root marker;documented polling','acceptance.json,dev.log,start.log'),
('T10','Testing Contract team Testing Posture','Deterministic start smoke pass','Exit0','smoke.log'),
('T11','Testing Contract team Testing Posture','Critical browser flow passes','96 passed;0 failed/skipped','browser.log,browser-accessibility-results.json'),
('T12','Testing Contract team Testing Posture','Zero serious/critical automated a11y violations','15 passed;0 failed/skipped;existing axe assertions pass','a11y.log'),
('T13','requirements.md NFR1 / project Mandated','Privacy/secrets/SAST/no-deploy scans pass','All four exit0','privacy.log,secrets.log,sast.log,no-deploy.log'),
('T14','requirements.md NFR3 / Testing Contract team/project','No high/critical dependency findings','Audit exit0;zero vulnerabilities;541 dependencies;final lock hash verified','audit.log,audited-lock-sha256.txt'),
('T15','requirements.md NFR2/Constraints + Package + audit','Synthetic loopback and authorized npm registry only;cleanup;no production/deploy/global changes','23 source hashes match copy;owned copy removed;7 ports have no listeners','acceptance-source-binding.json,cleanup.json,checks.json')]
matrix='| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |\n|---|---|---|---|---|---|---|\n'+''.join('| '+' | '.join([i,src,expected,actual,'evidence/replay-1/'+evidence,'Build and Test','Met'])+' |\n' for i,src,expected,actual,evidence in rows)
sources='Source-complete inventory: current `../code-generation/code-generation-plan.md` Testing Contract, `../code-generation/unit-test-instructions.md`, `../code-generation/code-summary.md`, `../../inception/requirements-analysis/requirements.md`, and active team/project quality rules. No Unit DAG/story AC/NFR Requirements/NFR Design artifacts exist for this zero-Unit bugfix. No numerical performance target applies.\n'
summary='# Local Startup Build and Test — Passing Replay\n\n## Sources and Instruction Inventory\n\n'+sources+'\nInstruction sets cover build, upstream functional/measurement commands, integration/browser/a11y, security and performance applicability. Upstream Code Generation outputs remained frozen and all23 source hashes were rechecked.\n\n## Final Readiness\n\n**Overall result: successful. All15 applicable targets are Met; no Pending/Not Met/Unverified target remains.** All acceptance commands and expectation-check wrappers passed. The three declared negative subset-measurement probes returned their required raw exit1 with every selected test passing, valid complete maps and only the documented global-floor diagnostic. They are verified negative checks, never T07 evidence. Complete explicit and canonical coverage commands separately exited0 at unchanged floors.\n\nThe default documented synthetic dev/build/start route passes with process-local Homebrew PATH and documented polling. Dependency audit used the user-authorized npm registry exception; no automatic fixes, production integration, deployment or global shell edit occurred. This stage supports local build/test readiness, not a deployment claim.\n\n## Target Verification Matrix\n\n'+matrix+'\n## Evidence and Limits\n\nAll current evidence is under evidence/replay-1/ with a SHA256 index. Native/delivery unique suite totals are399; scoped/coverage repeats are not summed. Browser96 and accessibility15 are separate overlapping runs. All runtime candidates are covered by the complete map;17 zero-runtime declarations/barrels and CSS are transparently inventoried. Linked production integrations and Safari remain outside this authorized task. The prior failed run and its append-only Loop-Back Log remain preserved.\n'
(stage/'build-and-test-summary.md').write_text(summary)
ledger=(out/'loop-back-ledger.txt').read_text()
results='# Local Startup Build and Test Results\n\n## Current Replay Execution\n\nVerified at '+timestamp+' on bugfix/local-startup-fix with process-local Node24.21.0/npm11.19.0. Each distinct upstream functional/coverage command executed once; coverage commands serialized. Explicit npm_execpath satisfies direct-node prehook prerequisites. Every acceptance command exited0. Three negative coverage-probe child commands exited1 as expected; their wrappers asserted passed tests, the unchanged global-floor rejection, complete maps and nonnegative counters. Raw exits and logs remain visible.\n\nFull tests128 native+271 delivery=399; startup49, support9, application117, boundaries47. Full explicit and canonical instrumented runs each pass399; these are repeated cases, not extra tests. Browser96/a11y15 pass. Build/dev/start/smoke and local scans pass; actual final-lock audit has zero vulnerabilities.\n\n## Target Verification Matrix\n\n'+matrix+'\n## Provenance and Cleanup\n\nAll23 application/test/config hashes match the approved manifest and acceptance copy. The contributor .env.local was never copied or read; only synthetic .env.example-derived configuration was used. No APP_RUNTIME_MODE/NODE_ENV export was provided to dev/start. Installed-browser/cache escalation was already authorized; no download occurred. Owned copy removed; seven ports confirmed not listening. No unrelated process was killed. Current instruction sets specify npm registry scope explicitly.\n\n## Prior Failed Run\n\nHistorical evidence and original matrix: evidence/replay-1/previous-test-results.md and previous-summary.md. Its T07/T14 gaps are closed by current full-scope instrumentation/tests and the authorized real registry audit. No new loop-back was necessary;one of three loop-backs was used.\n\n'+ledger
assert results[results.index('## Loop-Back Log'):]==ledger
(stage/'test-results.md').write_text(results)
tr=json.loads((record/'construction/code-generation/traceability.json').read_text())
entries={x['id']:x for x in tr['coverage']}
ids=['FR1','FR2','FR3','FR4','NFR1','NFR2','NFR3']
assert all(entries[i]['status']=='OK' and (root/entries[i]['target']).exists() for i in ids)
cross='# Final Requirement Coverage\n\n## Scope and Sources\n\nAll FR/NFR IDs from ../../inception/requirements-analysis/requirements.md are enumerated below. User Stories and Unit generation were skipped;there are no applicable ACs or Unit entries. Source: ../code-generation/traceability.json and actual current target files.\n\n## Per-ID Coverage\n\n| ID | Status | Owning Stage/Unit | Target |\n|---|---|---|---|\n'+''.join('| '+i+' | OK | Code Generation/stage-level | `'+entries[i]['target']+'` |\n' for i in ids)+'\n## Verdict\n\nPASS:7/7 requirements covered;all targets exist. No uncovered element. The quality matrix separately verifies actual gates.\n'
(stage/'cross-unit-traceability.md').write_text(cross)
for filename in ['build-instructions.md','integration-test-instructions.md']:
    p=stage/filename
    p.write_text(p.read_text().replace('python3 evidence/replay-1/verification-runner.py','python3 '+str(out/'verification-runner.py')))
index=[]
for p in sorted(out.iterdir()):
    if p.is_file() and p.name!='index.json':
        data=p.read_bytes();index.append({'path':p.name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
(out/'index.json').write_text(json.dumps({'recorded_at':timestamp,'files':index},indent=2)+'\n')
print(json.dumps({'targets_met':15,'requirement_ids_covered':7,'tests_unique':399,'browser':96,'a11y':15,'coverage':{k:totals[k]['pct'] for k in ['lines','branches','functions']},'audit_vulnerabilities':audit['metadata']['vulnerabilities']['total'],'evidence_files':len(index),'loopback_ledger_preserved':True}))
