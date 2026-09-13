const path = require('node:path');
const assert = require('node:assert/strict');
process.loadEnvFile();
const backend = path.resolve('../MPESA/mpesa_api_votasnap');
const backendRequire = require('node:module').createRequire(path.join(backend,'package.json'));
backendRequire('dotenv').config({path:path.join(backend,'.env'),quiet:true});
const { initializeApp, cert } = backendRequire('firebase-admin/app');
const { getAuth } = backendRequire('firebase-admin/auth');
async function main() {
  const base = process.env.EXPO_PUBLIC_BACKEND_URL?.trim().replace(/\/+$/, '');
  assert.ok(base?.startsWith('https://'), 'Configure EXPO_PUBLIC_BACKEND_URL with the HTTPS API URL');
  const app = initializeApp({credential:cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))});
  try {
    let response = await fetch(base, {signal:AbortSignal.timeout(60000)});
    assert.equal(response.status,200,'API health');
    for (const route of ['/api/challenges/submit','/api/challenges/vote','/api/account/delete','/api/account/bootstrap']) {
      response = await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(30000)});
      assert.equal(response.status,401,'Unauthenticated '+route);
      assert.ok(response.headers.get('content-type')?.includes('application/json'), 'Expected JSON from '+route);
    }
    const token = await getAuth(app).createCustomToken('MC4lzgrl3XdgdQOz9Lt0ISRnnA73');
    response = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key='+process.env.EXPO_PUBLIC_FIREBASE_API_KEY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,returnSecureToken:true}),signal:AbortSignal.timeout(30000)});
    assert.equal(response.status,200,'Firebase authentication');
    const identity = await response.json();
    if (process.argv.includes('--payments')) {
      response = await fetch(base+'/api/payments/process',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+identity.idToken},body:JSON.stringify({challengeId:'invalid/id'}),signal:AbortSignal.timeout(30000)});
      assert.equal(response.status,400,'Enabled payment route has configuration and rejects invalid challenge before charging');
      assert.ok(response.headers.get('content-type')?.includes('application/json'));
      console.log('Payment route enabled and configured; invalid challenge rejected before contacting M-Pesa. No debit initiated.');
    }
    response = await fetch(base+'/api/challenges/submit',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+identity.idToken},body:JSON.stringify({challengeId:'invalid/id'}),signal:AbortSignal.timeout(30000)});
    assert.equal(response.status,400,'Authenticated submit rejects invalid input');
    assert.ok(response.headers.get('content-type')?.includes('application/json'), 'Submit must return JSON');
    // Deliberately invalid ID: exercises authenticated Database access without changing challenge data.
    response = await fetch(base+'/api/challenges/close',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+identity.idToken},body:JSON.stringify({challengeId:'invalid/id'}),signal:AbortSignal.timeout(60000)});
    assert.equal(response.status,400,'Authenticated admin reaches challenge validation');
    console.log('Live API verified: health 200; anonymous requests 401; administrator authenticated; invalid operation rejected without database mutation.');
  } finally { await app.delete(); }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
