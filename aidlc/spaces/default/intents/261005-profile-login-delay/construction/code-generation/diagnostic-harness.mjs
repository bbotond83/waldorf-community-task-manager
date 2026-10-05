import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require = createRequire('/Users/dev/Development/waldorf-community-task-manager/package.json');
const { chromium } = require('playwright');
const profiles = [
 {id:'parent-local',label:'Szülő',path:'/szulo/feladatok',nav:'parent-duties',page:'parent-duties-page',heading:'Családi feladatok',content:['duties','duty-list'],control:'duty-filter-submit-button'},
 {id:'staff-local',label:'Munkatárs (csak olvasás)',path:'/munkatars/beosztas',nav:'staff-schedule',page:'staff-schedule-page',heading:'Beosztás',content:['staff-schedule','staff-schedule-table'],control:'staff-schedule-filter-submit-button'},
 ...['group-admin-local','kindergarten-admin-local','super-admin-local'].map((id,i)=>({id,label:['Csoportadminisztrátor','Óvodaadminisztrátor','Szuperadminisztrátor'][i],path:'/admin',nav:'admin-dashboard',page:'admin-dashboard-page',heading:'Áttekintés',content:['admin-dashboard-summary','admin-dashboard-records-state','admin-dashboard-tasks-state','admin-dashboard-queue-state'],control:'app-shell-navigation-admin-tasks'}))
];
const origin='http://127.0.0.1:3000';
const output='/private/tmp/waldorf-profile-baseline-261005.json';
const results=[];
const browser=await chromium.launch({channel:'chrome',headless:true});
console.log(JSON.stringify({event:'started',browser:browser.version(),origin}));
async function save(){await writeFile(output,JSON.stringify({origin,browser:browser.version(),recordedAt:new Date().toISOString(),results},null,2));}
async function signOut(page){await page.getByTestId('app-shell-switch-profile-button').click();await page.getByTestId('profile-selector').waitFor();}
async function measure(page,profile,kind,from){
 const segments=[]; const requests=new Map();
 const started=(request)=>requests.set(request,Date.now());
 const finished=(request)=>{segments.push({path:new URL(request.url()).pathname,method:request.method(),start:requests.get(request),end:Date.now(),timing:request.timing()});};
 page.on('request',started);page.on('requestfinished',finished);page.on('requestfailed',finished);
 const record={profile:profile.id,kind,from,destination:profile.path,startAt:new Date().toISOString(),segments};
 try{
  await page.evaluate(()=>document.addEventListener('submit',()=>sessionStorage.setItem('waldorf-measure-start',String(performance.timeOrigin+performance.now())),{once:true}));
  await page.getByTestId(`profile-selector-${profile.id}-button`).click();
  await page.getByRole('heading',{name:`Üdvözlünk, ${profile.label}!`,exact:true}).waitFor();
  await page.getByTestId(`app-shell-navigation-${profile.nav}`).click();
  await page.waitForURL(`${origin}${profile.path}`);
  await page.getByTestId(profile.page).waitFor();
  await page.getByRole('heading',{name:profile.heading,exact:true}).waitFor();
  for(const id of profile.content) await page.getByTestId(id).waitFor();
  const control=page.getByTestId(profile.control);
  if(!await control.isEnabled()) throw Error('primary control disabled');
  if(!(await page.getByTestId('app-shell-profile-summary').innerText()).includes(profile.label))throw Error('wrong profile');
  if(profile.id==='parent-local') {
   await page.getByTestId('duty-list').locator('li').first().waitFor();
   if(!await page.getByTestId('duty-filter-select').isEnabled())throw Error('parent filter disabled');
  }
  if(profile.id==='staff-local') {
   await page.getByTestId('staff-schedule-table').locator('tbody tr').first().waitFor();
   if(!await page.getByTestId('staff-schedule-group-select').isEnabled())throw Error('staff filter disabled');
  }
  if(profile.path==='/admin')for(const id of profile.content){if(!/^\d+$/.test((await page.getByTestId(id).innerText()).trim()))throw Error('non-numeric admin content');}
  record.elapsed=await page.evaluate(()=>performance.timeOrigin+performance.now()-Number(sessionStorage.getItem('waldorf-measure-start')));
  record.result=record.elapsed<=5000?'pass':'over-budget';
 }catch(error){record.result='failed';record.error=String(error);record.elapsed=await page.evaluate(()=>{const v=sessionStorage.getItem('waldorf-measure-start');return v===null?null:performance.timeOrigin+performance.now()-Number(v);}).catch(()=>null);}
 finally{page.off('request',started);page.off('requestfinished',finished);page.off('requestfailed',finished);results.push(record);await save();console.log(JSON.stringify({...record,segments:record.segments.length}));}
 return record;
}
try{
 for(let i=0;i<profiles.length;i++){
  const profile=profiles[i];const previous=profiles[(i+1)%profiles.length];
  const context=await browser.newContext();const page=await context.newPage();
  page.setDefaultTimeout(240000);page.setDefaultNavigationTimeout(240000);
  await page.goto(origin);await page.getByTestId('profile-selector').waitFor();
  for(let repeat=0;repeat<3;repeat++){
   const r=await measure(page,profile,repeat===0?'first':'first-repeat-'+repeat,null);
   if(r.result==='failed')throw Error('Readiness failed; preserve evidence and stop matrix');
   await signOut(page);
  }
  for(let repeat=0;repeat<3;repeat++){
   const setup=await measure(page,previous,'switch-source-setup',null);
   if(setup.result==='failed')throw Error('Switch source readiness failed');
   await signOut(page);
   const r=await measure(page,profile,repeat===0?'switch':'switch-repeat-'+repeat,previous.id);
   if(r.result==='failed')throw Error('Readiness failed; preserve evidence and stop matrix');
   await signOut(page);
  }
  await context.close();
 }
}finally{await save();await browser.close();}
