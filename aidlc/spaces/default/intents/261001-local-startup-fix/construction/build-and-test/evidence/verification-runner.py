from pathlib import Path
import json, os, signal, socket, subprocess, sys, tempfile, time, urllib.request, shutil

root = Path('/Users/dev/Development/waldorf-community-task-manager')
record = root/'aidlc/spaces/default/intents/261001-local-startup-fix/construction/build-and-test'
logs = record/'evidence'
logs.mkdir(exist_ok=True)
env = {k:os.environ[k] for k in ['HOME','TMPDIR','LANG','LC_ALL'] if k in os.environ}
env['PATH']='/opt/homebrew/opt/node@24/bin:/usr/bin:/bin:/usr/sbin:/sbin'
env['NEXT_TELEMETRY_DISABLED']='1'
env['WATCHPACK_POLLING']='true'
results=[]
def add(result):
    results.append(result)
    (logs/(sys.argv[1]+'.json')).write_text(json.dumps(results,indent=2))
    print(json.dumps(result),flush=True)
def command(name,args,cwd=root,timeout=300):
    with (logs/(name+'.log')).open('w') as log:
        child=subprocess.Popen(args,cwd=cwd,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
        try: code=child.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            os.killpg(child.pid,signal.SIGTERM)
            try: child.wait(timeout=5)
            except subprocess.TimeoutExpired: os.killpg(child.pid,signal.SIGKILL);child.wait()
            code='timeout'
    add({'check':name,'exit':code})
    return code==0
def server(name,cwd):
    with socket.socket() as probe: probe.bind(('127.0.0.1',3000))
    with (logs/(name+'.log')).open('w') as log:
        child=subprocess.Popen(['npm','run',name],cwd=cwd,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
        success=False
        try:
            deadline=time.monotonic()+120
            while time.monotonic()<deadline and child.poll() is None:
                try:
                    with urllib.request.urlopen('http://127.0.0.1:3000/api/readiness',timeout=2) as response:
                        body=json.load(response)
                        ready=response.status==200 and body=={'status':'ready','mode':'synthetic','marker':'waldorf-local-ready'}
                    with urllib.request.urlopen('http://127.0.0.1:3000',timeout=5) as response:
                        entry=response.status==200 and 'Helyi tesztprofil kiválasztása' in response.read().decode()
                    if ready and entry:
                        add({'check':name,'result':'ready','readiness':body,'root_marker':True,'runtime_mode_exported':False})
                        success=True;break
                except Exception: pass
                time.sleep(.25)
            if not success: add({'check':name,'result':'failed','exit':child.poll()})
        finally:
            try: os.killpg(child.pid,signal.SIGTERM)
            except ProcessLookupError: pass
            try: child.wait(timeout=5)
            except subprocess.TimeoutExpired: os.killpg(child.pid,signal.SIGKILL);child.wait()
            try: os.killpg(child.pid,signal.SIGKILL)
            except ProcessLookupError: pass
    return success
if sys.argv[1]=='checks':
    command('node-version',['node','--version'])
    command('npm-version',['npm','--version'])
    commands=[('toolchain',['npm','run','check:toolchain']),('format',['npm','run','format:check']),('lint',['npm','run','lint']),('typecheck',['npm','run','typecheck']),('runner',['npm','run','test:delivery','--','tests/unit/runtime-boundaries.test.ts']),('focused',['npm','run','test:delivery','--','tests/integration/runtime-config-cli.test.ts','tests/unit/toolchain-validation.test.ts','tests/unit/runtime-boundaries.test.ts']),('tests',['npm','test']),('coverage',['npm','run','test:coverage'])]
    for name,args in commands: command(name,args)
elif sys.argv[1]=='acceptance':
    application=Path(tempfile.mkdtemp(prefix='waldorf-build-test-',dir='/private/tmp'))
    (logs/'application-path.txt').write_text(str(application))
    try:
        for name in ['README.md','package.json','package-lock.json','.nvmrc','.npmrc','.env.example','next.config.ts','next-env.d.ts','tsconfig.json','eslint.config.mjs','.prettierrc.json','vitest.config.ts','playwright.config.ts','proxy.ts','app','src','scripts','tests','public','verification','.github']:
            source=root/name
            if not source.exists(): continue
            if source.is_dir(): shutil.copytree(source,application/name)
            else: shutil.copy2(source,application/name)
        subprocess.run(['cp','-cR',str(root/'node_modules'),str(application/'node_modules')],check=True)
        shutil.copy2(application/'.env.example',application/'.env.local')
        command('isolated-toolchain',['npm','run','check:toolchain'],application)
        server('dev',application)
        if command('build',['npm','run','build'],application):
            server('start',application)
            command('smoke',['npm','run','smoke:start'],application)
            command('browser',['npm','run','test:browser'],application)
            command('a11y',['npm','run','test:a11y'],application)
        for name in ['privacy','secrets','sast','no-deploy']:
            command(name,['node','--experimental-strip-types','scripts/verification/scan-artifacts.ts',name],application)
    finally:
        shutil.rmtree(application)
        add({'check':'owned-copy-cleanup','removed':not application.exists()})
        for port in [3000,3100,3101,3102,3210]:
            with socket.socket() as probe:
                try: probe.bind(('127.0.0.1',port));free=True
                except OSError: free=False
            add({'check':'port-cleanup','port':port,'free':free})
