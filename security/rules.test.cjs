const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('../.expo/security-tests/node_modules/@firebase/rules-unit-testing');
let env;
test.before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-votasnap', database: { host: '127.0.0.1', port: 9000, rules: fs.readFileSync('security/database.rules.json', 'utf8') }, storage: { host: '127.0.0.1', port: 9199, rules: fs.readFileSync('security/storage.rules', 'utf8') } });
  await env.withSecurityRulesDisabled(async context => {
    await context.database().ref().set({ users: { alice: { phone: 'private', snaps: 5 }, bob: { phone: 'private' } }, publicProfiles: { alice: { username: 'alice' } }, challenges: { c: { status: 'active' } }, entries: { c: { e: { userId: 'bob', votes: 0 } } } });
  });
});
test.after(async () => { if (env) await env.cleanup(); });
test('private data denied to anonymous and other accounts; public profiles readable', async () => {
  const anonymous = env.unauthenticatedContext().database();
  const user = env.authenticatedContext('alice').database();
  for (const path of ['/', 'users', 'users/alice', 'transactions', 'payment_intents']) await assertFails(anonymous.ref(path).once('value'));
  await assertFails(user.ref('users/bob').once('value'));
  await assertSucceeds(user.ref('users/alice').once('value'));
  const publicData = await assertSucceeds(anonymous.ref('publicProfiles/alice').once('value'));
  assert.equal(publicData.val().phone, undefined);
});
test('ordinary users cannot forge profiles, votes, payments, points or admins', async () => {
  const db = env.authenticatedContext('alice').database();
  for (const path of ['users/alice/snaps', 'users/alice/admin', 'users/alice/banned', 'users/alice/paidChallenges/c', 'publicProfiles/alice', 'votes/c/alice', 'entries/c/e/votes', 'challenges/c/status', 'transactions/x', 'accountDeletionJobs/alice']) await assertFails(db.ref(path).set(true));
  await assertFails(env.unauthenticatedContext().database().ref('challenges/c').remove());
  await assertSucceeds(db.ref('users/alice').update({pushToken: 'ExponentPushToken[test]', pushTokenUpdatedAt: Date.now()}));
});
test('blocks are private, owned, boolean and removable', async () => {
  const db = env.authenticatedContext('alice').database();
  await assertSucceeds(db.ref('blocks/alice/bob').set(true));
  await assertSucceeds(db.ref('blocks/alice').once('value'));
  await assertFails(env.authenticatedContext('bob').database().ref('blocks/alice').once('value'));
  await assertFails(db.ref('blocks/alice/alice').set(true));
  await assertFails(db.ref('blocks/alice/bob').set('yes'));
  await assertFails(db.ref('blocks/bob/alice').set(true));
  await assertSucceeds(db.ref('blocks/alice/bob').remove());
});
test('reports require real identity and cannot be overwritten by reporter', async () => {
  const db = env.authenticatedContext('alice').database();
  const report = {entryId:'e',challengeId:'c',reportedBy:'alice',reason:'Abuso',status:'pending',createdAt:Date.now()};
  await assertSucceeds(db.ref('reports/r').set(report));
  await assertFails(db.ref('reports/r').set({...report,reason:'Changed'}));
  await assertFails(db.ref('reports/forged').set({...report,reportedBy:'bob'}));
  await assertFails(db.ref('reports').once('value'));
  const admin = env.authenticatedContext('admin', {admin:true}).database();
  await assertSucceeds(admin.ref('reports/r/status').set('resolved'));
});
test('admin claim permits administration; user profile field does not', async () => {
  const admin = env.authenticatedContext('admin', {admin:true}).database();
  await assertSucceeds(admin.ref('users').once('value'));
  await assertSucceeds(admin.ref('challenges/c/title').set('Updated'));
  await assertFails(env.authenticatedContext('bob', {admin:false}).database().ref('challenges/c/title').set('Forged'));
});
test('Storage enforces ownership, MIME, size, and prevents replacing published entries', async () => {
  const user = env.authenticatedContext('alice').storage('gs://demo-votasnap.appspot.com');
  const anon = env.unauthenticatedContext().storage('gs://demo-votasnap.appspot.com');
  const body = new Uint8Array([1,2,3]);
  const photo = {contentType:'image/jpeg'};
  await assertFails(anon.ref('avatars/alice.jpg').put(body, photo));
  await assertFails(user.ref('avatars/bob.jpg').put(body, photo));
  await assertFails(user.ref('entries/c/bob/a.jpg').put(body, photo));
  await assertFails(user.ref('entries/c/alice/b.html').put(body, {contentType:'text/html'}));
  await assertFails(user.ref('avatars/alice.jpg').put(new Uint8Array(10*1024*1024+1),photo));
  await assertSucceeds(user.ref('avatars/alice.jpg').put(body, photo));
  await assertSucceeds(user.ref('entries/c/alice/a.jpg').put(body, photo));
  await assertFails(user.ref('entries/c/alice/a.jpg').put(body, photo));
  await assertFails(user.ref('entries/c/alice/a.jpg').delete());
});
