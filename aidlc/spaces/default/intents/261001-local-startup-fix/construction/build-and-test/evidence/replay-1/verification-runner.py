from pathlib import Path
import hashlib, json, os, re, shutil, signal, socket, subprocess, sys, tempfile, time, urllib.request

ROOT = Path('/Users/dev/Development/waldorf-community-task-manager')
RECORD = ROOT/'aidlc/spaces/default/intents/261001-local-startup-fix'
STAGE = RECORD/'construction/build-and-test'
OUT = STAGE/'evidence/replay-1'
OUT.mkdir(parents=True, exist_ok=True)
ENV = {k: os.environ[k] for k in ['HOME', 'TMPDIR', 'LANG', 'LC_ALL'] if k in os.environ}
ENV.update(PATH='/opt/homebrew/opt/node@24/bin:/usr/bin:/bin:/usr/sbin:/sbin', NEXT_TELEMETRY_DISABLED='1', WATCHPACK_POLLING='true', npm_execpath='/opt/homebrew/opt/node@24/lib/node_modules/npm/bin/npm-cli.js')
RESULTS = []

def save_result(item):
    RESULTS.append(item)
    (OUT/(sys.argv[1]+'.json')).write_text(json.dumps(RESULTS, indent=2)+'\n')
    print(json.dumps(item), flush=True)

def command(name, args, cwd=ROOT, timeout=600, expected_exit=0, expected_tests=None):
    started = time.time()
    with (OUT/(name+'.log')).open('w') as log:
        child = subprocess.Popen(args, cwd=cwd, env=ENV, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        try:
            code = child.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, signal.SIGTERM)
            try: child.wait(timeout=5)
            except subprocess.TimeoutExpired: os.killpg(child.pid, signal.SIGKILL); child.wait()
            code = 'timeout'
    raw = (OUT/(name+'.log')).read_text()
    plain = re.sub(r'\x1b\[[0-9;]*m', '', raw)
    passed = code == expected_exit
    item = {'check':name, 'command':args, 'raw_exit':code, 'expected_exit':expected_exit, 'seconds':round(time.time()-started, 2)}
    if expected_exit == 1:
        # A declared negative measurement probe, never a waived acceptance gate.
        passed = passed and bool(re.search(r'Tests\s+'+str(expected_tests)+r' passed', plain)) and not bool(re.search(r'Tests\s+.*\d+ failed', plain))
        passed = passed and 'does not meet global threshold (80%)' in plain
        inventory = json.loads((ROOT/'coverage/production-inventory.json').read_text())
        mapping = json.loads((ROOT/'coverage/production-map.json').read_text())
        for entry in mapping.values():
            for key in ['s', 'f']:
                passed = passed and all(isinstance(n, int) and n >= 0 for n in entry[key].values())
            passed = passed and all(isinstance(n, int) and n >= 0 for ns in entry['b'].values() for n in ns)
        measured = {str(Path(p).relative_to(ROOT)) for p in mapping}
        runtime = {f['path'] for f in inventory['files'] if f['classification'] == 'runtime'}
        passed = passed and runtime.issubset(measured)
        item.update(negative_probe=True, expected_tests=expected_tests, measured_runtime_files=len(runtime))
    if '--coverage' in args or name == 'canonical-coverage':
        for source, suffix in [('production-map.json','map'), ('production-inventory.json','inventory'), ('coverage-summary.json','summary')]:
            src = ROOT/'coverage'/source
            if src.exists(): shutil.copy2(src, OUT/(name+'-'+suffix+'.json'))
    item['check_passed'] = passed
    save_result(item)
    return passed

def server(name, application):
    with socket.socket() as probe: probe.bind(('127.0.0.1', 3000))
    with (OUT/(name+'.log')).open('w') as log:
        child = subprocess.Popen(['npm','run',name], cwd=application, env=ENV, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        success = False
        try:
            deadline = time.monotonic()+120
            while time.monotonic() < deadline and child.poll() is None:
                try:
                    with urllib.request.urlopen('http://127.0.0.1:3000/api/readiness', timeout=2) as response:
                        body = json.load(response)
                        ready = response.status == 200 and body == {'status':'ready','mode':'synthetic','marker':'waldorf-local-ready'}
                    with urllib.request.urlopen('http://127.0.0.1:3000', timeout=5) as response:
                        entry = response.status == 200 and 'Helyi tesztprofil kiválasztása' in response.read().decode()
                    if ready and entry:
                        success = True
                        save_result({'check':name, 'check_passed':True, 'readiness':body, 'root_marker':True, 'runtime_mode_exported':False, 'node_env_exported':False})
                        break
                except Exception: pass
                time.sleep(.25)
            if not success: save_result({'check':name, 'check_passed':False, 'raw_exit':child.poll()})
        finally:
            try: os.killpg(child.pid, signal.SIGTERM)
            except ProcessLookupError: pass
            try: child.wait(timeout=5)
            except subprocess.TimeoutExpired: os.killpg(child.pid, signal.SIGKILL); child.wait()
            try: os.killpg(child.pid, signal.SIGKILL)
            except ProcessLookupError: pass
    return success

mode = sys.argv[1]
if mode == 'prepare':
    original = (STAGE/'test-results.md').read_text()
    ledger = original[original.index('## Loop-Back Log'):]
    (OUT/'previous-test-results.md').write_text(original)
    (OUT/'previous-summary.md').write_text((STAGE/'build-and-test-summary.md').read_text())
    (OUT/'loop-back-ledger.txt').write_text(ledger)
    (OUT/'verification-runner.py').write_text(Path(__file__).read_text())
    common = 'Use Node24/npm11 through current-process Homebrew PATH. Installed dependencies/browsers only; npm registry exception permits read-only audit, not fixes. Contributor env files are never copied. Preserve every80/80/80 floor and the complete production inventory.\n'
    (STAGE/'build-instructions.md').write_text('# Replay Build Instructions\n\n## Prerequisites\n\n'+common+'\n## Commands\n\nRun `python3 evidence/replay-1/verification-runner.py acceptance` from the workspace root using the absolute script path. The runner copies all manifest paths and cloned installed dependencies, prepares synthetic .env.local, then runs `npm run check:toolchain`, `npm run build`, actual `npm run dev` and `npm run start`, and `npm run smoke:start`. Current-process WATCHPACK_POLLING=true is the documented host fallback. Verify readiness JSON and root marker without mode exports.\n')
    (STAGE/'integration-test-instructions.md').write_text('# Replay Test Instructions\n\n## Unit and Integration Commands\n\n'+common+'Run `python3 evidence/replay-1/verification-runner.py checks` by absolute path. It deduplicates upstream functional commands, runs each once, and serializes all coverage outputs. Direct Vitest commands receive the documented process-local npm_execpath. Full suites, explicit complete coverage and canonical coverage must exit0.\n\n## Declared Negative Measurement Probes\n\nThe three upstream subset-coverage commands deliberately exercise the global floor rejection. Each is executed exactly once by the expectation-check wrapper: require raw exit1, all selected tests passing, the explicit80% global-threshold diagnostic, complete runtime inventory and no invalid counters. Preserve raw exit/log/map. A different failure makes the wrapper fail; these probes never supply T07. Only the separate complete coverage commands establish the full-source target.\n\n## Browser and Accessibility\n\nRun `npm run test:browser` and `npm run test:a11y` in the owned synthetic application copy. Installed browsers, loopback only, no downloads. Authorized escalation may repair the known sandbox cache-metadata restriction. Record original failures and retries separately.\n')
    (STAGE/'performance-test-instructions.md').write_text('# Performance Applicability\n\n## Source Inventory\n\nNo numerical latency, load, availability or scalability requirement exists in this bugfix; NFR Requirements/NFR Design were skipped.\n\n## Boundary\n\nNo performance target is invented or deferred. Readiness is a functional target, measured by actual loopback checks.\n')
    (STAGE/'security-test-instructions.md').write_text('# Replay Security Instructions\n\n## Local Checks\n\nRun the existing privacy, secrets, SAST and no-deploy scanners in the synthetic copy. The startup regression command asserts redacted dummy-secret errors, invalid config rejection and toolchain enforcement.\n\n## Authorized Dependency Check\n\nRun `npm audit --audit-level=high --registry=https://registry.npmjs.org --json` once on the final lock with Node24/npm11. Capture exit, findings and lock SHA256. High/critical findings block; perform no automatic fixes. The user explicitly selected Package + audit. No other external target, deployment or global setting change is authorized.\n')
    ids = ['T'+str(i).zfill(2) for i in range(1,16)]
    pending = '| Target ID | Source | Expected | Actual | Evidence | Owning Stage | Verdict |\n|---|---|---|---|---|---|---|\n' + ''.join('| '+i+' | current requirements/Testing Contract | retained target | Pending | Pending | Build and Test | Pending |\n' for i in ids)
    (STAGE/'build-and-test-summary.md').write_text('# Replay Build and Test Summary\n\n## Source-Complete Target Inventory\n\nSources: current code-generation plan Testing Contract, unit-test instructions, code summary; requirements FR1–FR4/NFR1–NFR3; active team/project rules. No Unit DAG/story AC/NFR-design artifacts exist. T01 tools,T02format/lint,T03types,T04regressions,T05suites,T06configuredcoverage,T07complete80/80/80,T08build,T09readiness,T10smoke,T11browser,T12a11y,T13scans,T14audit,T15isolation. Registry exception is the explicit Package + audit choice.\n\n## Target Verification Matrix\n\n'+pending+'\n## Readiness\n\nVerification in progress. No target is declared Met before execution. Prior failed-stage evidence and append-only Loop-Back Log are retained.\n')
    print('Prepared instructions, target inventory and immutable historical snapshots', flush=True)
elif mode == 'checks':
    for name, args in [('node-version',['node','--version']),('npm-version',['npm','--version']),('toolchain',['npm','run','check:toolchain']),('format',['npm','run','format:check']),('owned-format',['node','node_modules/prettier/bin/prettier.cjs','--check','--ignore-path','/dev/null','tests/coverage/**/*.ts','tests/coverage/**/*.tsx','vitest.config.ts']),('lint',['npm','run','lint']),('typecheck',['npm','run','typecheck']),('startup',['npm','run','test:delivery','--','tests/integration/runtime-config-cli.test.ts','tests/unit/toolchain-validation.test.ts','tests/unit/runtime-boundaries.test.ts']),('support',['npm','run','test:delivery','--','tests/coverage/domain-adapter.test.ts','tests/coverage/production-inventory.test.ts']),('native',['node','--experimental-strip-types','--test','src/**/*.test.ts']),('application',['npm','run','test:delivery','--','tests/coverage/app-entrypoints.test.tsx','tests/coverage/admin-pages.test.tsx','tests/coverage/parent-pages.test.tsx','tests/coverage/staff-pages.test.tsx','tests/coverage/admin-actions.test.ts','tests/coverage/parent-actions.test.ts','tests/coverage/app-session-boundaries.test.ts']),('boundaries',['npm','run','test:delivery','--','tests/coverage/framework-entrypoints.test.ts','tests/coverage/runtime-cli-instrumentation.test.ts','tests/coverage/smoke-entrypoint.test.ts','tests/coverage/verification-entrypoints.test.ts'])]:
        command(name,args)
    prefix = ['node','node_modules/vitest/vitest.mjs','run','--config','vitest.config.ts','--coverage']
    command('admin-negative-floor',prefix+['--project','delivery','tests/coverage/admin-actions.test.ts'],expected_exit=1,expected_tests=28)
    command('domain-negative-floor-verbose',prefix+['--project','domain-coverage','--reporter','verbose','--reporter','./tests/coverage/support/production-coverage-reporter.ts'],expected_exit=1,expected_tests=128)
    command('domain-negative-floor',prefix+['--project','domain-coverage'],expected_exit=1,expected_tests=128)
    command('tests',['npm','test'])
    command('explicit-coverage',prefix+['--project','delivery','--project','domain-coverage'])
    command('canonical-coverage',['npm','run','test:coverage'])
    command('audit',['npm','audit','--audit-level=high','--registry=https://registry.npmjs.org','--json'])
    (OUT/'audited-lock-sha256.txt').write_text(hashlib.sha256((ROOT/'package-lock.json').read_bytes()).hexdigest()+'\n')
elif mode == 'acceptance':
    application = Path(tempfile.mkdtemp(prefix='waldorf-build-test-replay-',dir='/private/tmp'))
    (OUT/'application-path.txt').write_text(str(application))
    for name in ['README.md','package.json','package-lock.json','.nvmrc','.npmrc','.env.example','next.config.ts','next-env.d.ts','tsconfig.json','eslint.config.mjs','.prettierrc.json','vitest.config.ts','playwright.config.ts','proxy.ts','app','src','scripts','tests','public','verification','.github']:
        source=ROOT/name
        if not source.exists(): continue
        if source.is_dir(): shutil.copytree(source,application/name)
        else: shutil.copy2(source,application/name)
    subprocess.run(['cp','-cR',str(ROOT/'node_modules'),str(application/'node_modules')],check=True)
    shutil.copy2(application/'.env.example',application/'.env.local')
    manifest=json.loads((RECORD/'construction/code-generation/source-manifest.json').read_text())
    bindings=[]
    for entry in manifest['writes']:
        copied=hashlib.sha256((application/entry['path']).read_bytes()).hexdigest()
        assert copied==entry['sha256'], entry['path']
        bindings.append({'path':entry['path'],'sha256':copied})
    (OUT/'acceptance-source-binding.json').write_text(json.dumps(bindings,indent=2)+'\n')
    command('isolated-toolchain',['npm','run','check:toolchain'],application)
    server('dev',application)
    if command('build',['npm','run','build'],application):
        server('start',application)
        command('smoke',['npm','run','smoke:start'],application)
    for name in ['privacy','secrets','sast','no-deploy']:
        command(name,['node','--experimental-strip-types','scripts/verification/scan-artifacts.ts',name],application)
elif mode == 'cleanup':
    application=Path((OUT/'application-path.txt').read_text())
    assert application.parent==Path('/private/tmp') and application.name.startswith('waldorf-build-test-replay-')
    shutil.rmtree(application)
    save_result({'check':'owned-copy-cleanup','check_passed':not application.exists(),'application':str(application)})
    for port in [3000,3100,3101,3102,3210,3211,3212]:
        with socket.socket() as probe:
            probe.settimeout(1)
            listening=probe.connect_ex(('127.0.0.1',port))==0
        save_result({'check':'listener-cleanup','port':port,'check_passed':not listening})
sys.exit(0 if all(r.get('check_passed',True) for r in RESULTS) else 1)
