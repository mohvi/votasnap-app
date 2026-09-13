// Reuse local M-Pesa configuration. Secret bytes travel only in memory to Secret Manager.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const backend = path.resolve('../MPESA/mpesa_api_votasnap');
const backendRequire = require('node:module').createRequire(path.join(backend,'package.json'));
async function main() {
  const envPath = path.join(backend,'.env');
  const original = fs.readFileSync(envPath,'utf8');
  const env = backendRequire('dotenv').parse(original);
  const provider = env.MPESA_SERVICE_PROVIDER || env.SERVICE_PROVIDER_CODE;
  assert.ok(env.MPESA_API_KEY && provider && env.MPESA_ENDPOINT, 'Existing M-Pesa configuration is incomplete');
  assert.equal(new URL(env.MPESA_ENDPOINT).protocol,'https:');
  assert.match(provider,/^\d+$/);
  if (process.argv.includes('--publish-secret')) {
    const cli = path.join(process.env.APPDATA,'npm/node_modules/firebase-tools/lib');
    require(path.join(cli,'logger')).logger.silent = true;
    const tokens = require(path.join(cli,'configstore')).configstore.get('tokens');
    assert.ok(tokens?.refresh_token,'Firebase CLI login required');
    const {access_token} = await require(path.join(cli,'auth')).getAccessToken(tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform']);
    const base='https://secretmanager.googleapis.com/v1/projects/votasnap/secrets';
    const name='VOTASNAP_MPESA_API_KEY';
    async function call(url,method,body) {
      const response=await fetch(url,{method,headers:{Authorization:'Bearer '+access_token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
      return response;
    }
    const service='https://serviceusage.googleapis.com/v1/projects/votasnap/services/secretmanager.googleapis.com';
    let response=await call(service,'GET');
    assert.ok(response.ok,'Secret Manager service status HTTP '+response.status);
    if ((await response.json()).state !== 'ENABLED') {
      response=await call(service+':enable','POST',{});
      assert.ok(response.ok,'Secret Manager enable HTTP '+response.status);
      const operation=await response.json();
      for(let attempt=0; attempt<12; attempt++) {
        await new Promise(resolve=>setTimeout(resolve,2000));
        const check=await call('https://serviceusage.googleapis.com/v1/'+operation.name,'GET');
        const progress=await check.json();
        if(progress.done){assert.ok(!progress.error,'Secret Manager activation failed');break;}
      }
    }
    response=await call(base+'/'+name,'GET');
    if (response.status===404) {
      response=await call(base+'?secretId='+name,'POST',{replication:{automatic:{}}});
      assert.ok(response.ok,'Secret creation HTTP '+response.status);
    } else assert.ok(response.ok,'Secret lookup HTTP '+response.status);
    response=await call(base+'/'+name+':addVersion','POST',{payload:{data:Buffer.from(env.MPESA_API_KEY).toString('base64')}});
    assert.ok(response.ok,'Secret version HTTP '+response.status);
    console.log('Existing M-Pesa key stored in Secret Manager.');
  }
  fs.mkdirSync('.firebase-api',{recursive:true});
  const config={ENABLE_PAID_CHALLENGES:'true',MPESA_ENDPOINT:env.MPESA_ENDPOINT,SERVICE_PROVIDER_CODE:provider};
  fs.writeFileSync('.firebase-api/.env.votasnap',Object.entries(config).map(([key,value])=>key+'='+JSON.stringify(value)).join('\n')+'\n');
  const flag='ENABLE_PAID_CHALLENGES=true';
  fs.writeFileSync(envPath,/^ENABLE_PAID_CHALLENGES=.*$/m.test(original)?original.replace(/^ENABLE_PAID_CHALLENGES=.*$/m,flag):original+'\n'+flag+'\n');
  console.log('Existing endpoint and merchant configured; paid registrations enabled for next deployment.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
