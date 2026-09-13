// Uses the backend credential locally; never prints or copies credentials.
const fs = require('node:fs');
const path = require('node:path');
const backend = path.resolve('../MPESA/mpesa_api_votasnap');
const backendRequire = require('node:module').createRequire(path.join(backend, 'package.json'));
backendRequire('dotenv').config({ path: path.join(backend, '.env'), quiet: true });
const { initializeApp, cert } = backendRequire('firebase-admin/app');
const { getDatabase } = backendRequire('firebase-admin/database');
const { publicProfile } = require(path.join(backend, 'account-operations'));
async function main() {
  const credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  const url = process.env.FIREBASE_DATABASE_URL;
  const app = initializeApp({credential, databaseURL:url});
  try {
    if (['backup', 'verify'].includes(process.argv[2])) {
      const verify = process.argv[2] === 'verify';
      const assert = require('node:assert/strict');
      const { access_token } = await credential.getAccessToken();
      const read = async url => {
        let response;
        for (let attempt = 0; attempt < 3; attempt++) {
          try { response = await fetch(url, {headers:{Authorization:'Bearer '+access_token},signal:AbortSignal.timeout(30000)}); break; }
          catch (error) { if (attempt === 2) throw Error('Backup failed for '+new URL(url).hostname+': '+(error.cause?.code || error.message)); }
        }
        if (!response.ok) throw Error('Backup HTTP '+response.status);
        return response.text();
      };
      fs.mkdirSync('.expo/security-backups', {recursive:true});
      const stamp = new Date().toISOString().replaceAll(/[:.]/g,'-');
      const databaseRules = await read(url.replace(/\/$/,'')+'/.settings/rules.json');
      if (verify) assert.deepEqual(JSON.parse(databaseRules), JSON.parse(fs.readFileSync('security/database.rules.json','utf8')), 'Published Database rules must match tested rules');
      else fs.writeFileSync('.expo/security-backups/database-'+stamp+'.json', databaseRules);
      const releases = JSON.parse(await read('https://firebaserules.googleapis.com/v1/projects/votasnap/releases'));
      for (const release of releases.releases || []) if (release.name.includes('firebase.storage')) {
        const rules = await read('https://firebaserules.googleapis.com/v1/'+release.rulesetName);
        if (verify) assert.equal(JSON.parse(rules).source.files[0].content.trim(), fs.readFileSync('security/storage.rules','utf8').trim(), 'Published Storage rules must match tested rules');
        else fs.writeFileSync('.expo/security-backups/storage-'+stamp+'.json', rules);
      }
      if (verify) {
        assert.ok(releases.releases?.some(release => release.name.includes('firebase.storage')), 'Storage rules release exists');
        const response = await fetch(url.replace(/\/$/,'')+'/users.json', {signal:AbortSignal.timeout(30000)});
        assert.ok([401,403].includes(response.status), 'Anonymous private-profile access must be denied');
        console.log('Published Database and Storage rules match tested files; anonymous private-profile access denied.');
      } else console.log('Current Database and available Storage rules backed up locally.');
    } else if (process.argv[2] === 'migrate-public-profiles') {
      const db = getDatabase(app);
      const users = (await db.ref('users').once('value')).val() || {};
      const updates = Object.fromEntries(Object.entries(users).map(([uid,user])=>['publicProfiles/'+uid,publicProfile(user)]));
      if (Object.keys(updates).length) await db.ref().update(updates);
      console.log('Public profiles migrated: '+Object.keys(updates).length+'; private fields excluded.');
    } else throw Error('Use backup, verify or migrate-public-profiles.');
  } finally { await app.delete(); }
}
main().catch(error => {console.error(error.code || error.message);process.exitCode=1;});
