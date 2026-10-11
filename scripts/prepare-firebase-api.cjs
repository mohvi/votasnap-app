// Stage an explicit source allowlist: no local credentials or payment secrets are uploaded.
const fs = require('node:fs');
const path = require('node:path');
const backend = path.resolve(process.argv[2] || '../MPESA/mpesa_api_votasnap');
const target = path.resolve('.firebase-api');
fs.mkdirSync(target, { recursive: true });
for (const file of ['index.js', 'challenge-routes.js', 'challenge-operations.js', 'account-routes.js', 'account-operations.js']) fs.copyFileSync(path.join(backend, file), path.join(target, file));
const dependencies = Object.fromEntries(['axios', 'cors', 'dotenv', 'express', 'express-rate-limit', 'firebase-admin'].map(name => [name, require(path.join(backend, 'node_modules', name, 'package.json')).version]));
dependencies['firebase-functions'] = '^6.6.0';
fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({name:'votasnap-api',private:true,main:'functions.cjs',engines:{node:'22'},dependencies},null,2));
fs.writeFileSync(path.join(target, 'functions.cjs'), "const { onRequest } = require('firebase-functions/v2/https');\nexports.votasnapApi = onRequest({ region: 'us-central1', minInstances: 0, maxInstances: 1, concurrency: 20, memory: '256MiB', timeoutSeconds: 120, invoker: 'public', secrets: ['VOTASNAP_MPESA_API_KEY'] }, require('./index'));\n" +
  "const { onSchedule } = require('firebase-functions/v2/scheduler');\n" +
  "// Closes challenges once their deadline passes (idempotent; already processed challenges are skipped).\n" +
  "exports.closeExpiredChallenges = onSchedule({ schedule: 'every 5 minutes', region: 'us-central1', maxInstances: 1, memory: '256MiB', timeoutSeconds: 120 }, async () => {\n" +
  "  const closed = await require('./index').closeExpiredChallenges();\n" +
  "  if (closed.length) console.log('Closed expired challenges:', closed.join(', '));\n" +
  "});\n");
console.log('API source staged without secrets.');
