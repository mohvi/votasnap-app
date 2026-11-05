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
  for (const path of ['adminAudit', 'adminNotes', 'adminNotes/alice']) await assertFails(user.ref(path).once('value'));
  const publicData = await assertSucceeds(anonymous.ref('publicProfiles/alice').once('value'));
  assert.equal(publicData.val().phone, undefined);
});
test('ordinary users cannot forge profiles, votes, payments, points or admins', async () => {
  const db = env.authenticatedContext('alice').database();
  for (const path of ['users/alice/snaps', 'users/alice/admin', 'users/alice/banned', 'users/alice/bannedUntil', 'users/alice/warnings/w', 'users/alice/warningsCount', 'adminAudit/x', 'adminNotes/alice/n', 'snaps_history/alice/x', 'users/alice/paidChallenges/c', 'publicProfiles/alice', 'votes/c/alice', 'entries/c/e/votes', 'challenges/c/status', 'transactions/x', 'accountDeletionJobs/alice']) await assertFails(db.ref(path).set(true));
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
test('sponsor names are public; contacts and deals are admin-only', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await context.database().ref().update({ 'sponsors/s': { name: 'Marca', active: true }, 'sponsorPrivate/s': { contactPhone: '840000000' }, 'challengeDeals/c': { sponsorId: 's', amountMzn: 5000, paymentStatus: 'pending' } });
  });
  const anonymous = env.unauthenticatedContext().database();
  const user = env.authenticatedContext('alice').database();
  await assertSucceeds(anonymous.ref('sponsors/s').once('value'));
  for (const db of [anonymous, user]) {
    for (const path of ['sponsorPrivate', 'sponsorPrivate/s', 'challengeDeals', 'challengeDeals/c']) await assertFails(db.ref(path).once('value'));
    for (const path of ['sponsors/s/name', 'sponsorPrivate/s/notes', 'challengeDeals/c/paymentStatus']) await assertFails(db.ref(path).set('forged'));
  }
  const admin = env.authenticatedContext('admin', {admin:true}).database();
  await assertSucceeds(admin.ref('challengeDeals/c').once('value'));
  await assertSucceeds(admin.ref('challengeDeals/c/paymentStatus').set('paid'));
  await assertSucceeds(admin.ref('sponsorPrivate/s/notes').set('ok'));
  await assertFails(admin.ref('challengeDeals/c/paymentStatus').set('maybe'));
  await assertFails(admin.ref('challengeDeals/c/amountMzn').set(-1));
});
test('admin writes keep Snaps, history and audit consistent', async () => {
  const admin = env.authenticatedContext('admin', {admin:true}).database();
  const ts = {'.sv': 'timestamp'};
  await assertFails(admin.ref('users/alice/snaps').set(-1));
  await assertSucceeds(admin.ref('snaps_history/alice/t1').set({amount: 5, type: 'admin_adjustment', reason: 'Bónus', by: 'admin@test'}));
  await assertFails(admin.ref('snaps_history/alice/t1').set({amount: 500, type: 'admin_adjustment', reason: 'Bónus', by: 'admin@test'}));
  await assertFails(admin.ref('snaps_history/alice/t2').set({amount: 5, type: 'admin_adjustment'}));
  await assertSucceeds(admin.ref('adminAudit/a1').set({action: 'user.snaps', by: {uid: 'admin'}, at: ts}));
  await assertFails(admin.ref('adminAudit/a1').set({action: 'edited', by: {uid: 'admin'}, at: ts}));
  await assertFails(admin.ref('adminAudit/a2').set({action: 'user.ban', by: {uid: 'someone-else'}, at: ts}));
  await assertFails(admin.ref('adminAudit/a3').set({action: 'user.ban', by: {uid: 'admin'}, at: 1}));
  await assertFails(admin.ref('users/alice/warnings/w0').set({reason: 'ok', createdAt: 1}));
  await assertSucceeds(admin.ref('users/alice/warnings/w').set({reason: 'Fora do tema', createdAt: 1}));
  await assertFails(admin.ref('users/alice/warnings/w').set({reason: 'Motivo alterado', createdAt: 1}));
});
test('a tie can only be resolved once', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await context.database().ref('challenges/t').set({status: 'pending_confirmation', isTie: true});
  });
  const admin = env.authenticatedContext('admin', {admin:true}).database();
  const resolve = (uid) => admin.ref().update({'challenges/t/winnerId': uid, 'challenges/t/isTie': false, 'challenges/t/tieResolvedAt': {'.sv': 'timestamp'}, [`users/${uid}/wins`]: 1});
  await assertSucceeds(resolve('alice'));
  await assertFails(resolve('bob'));
});
test('votes are private to the voter; lastLogin only takes server time', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await context.database().ref('votes/c').set({alice: {entryId: 'e'}, bob: {entryId: 'e'}});
  });
  const alice = env.authenticatedContext('alice').database();
  await assertSucceeds(alice.ref('votes/c/alice').once('value'));
  for (const path of ['votes', 'votes/c', 'votes/c/bob']) await assertFails(alice.ref(path).once('value'));
  await assertFails(env.unauthenticatedContext().database().ref('votes/c/alice').once('value'));
  await assertSucceeds(alice.ref('users/alice/lastLogin').set({'.sv': 'timestamp'}));
  await assertFails(alice.ref('users/alice/lastLogin').set(1));
  await assertFails(alice.ref('users/bob/lastLogin').set({'.sv': 'timestamp'}));
});
test('timed bans stop blocking once they expire', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await context.database().ref('users').update({
      carol: {banned: true, bannedUntil: Date.now() - 1000},
      dave: {banned: true, bannedUntil: Date.now() + 86400000},
    });
  });
  await assertSucceeds(env.authenticatedContext('carol').database().ref('users/carol/pushToken').set('ExponentPushToken[c]'));
  await assertFails(env.authenticatedContext('dave').database().ref('users/dave/pushToken').set('ExponentPushToken[d]'));
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
  await assertFails(user.ref('sponsors/s/logo.png').put(body, {contentType:'image/png'}));
  await assertSucceeds(env.authenticatedContext('admin', {admin:true}).storage('gs://demo-votasnap.appspot.com').ref('sponsors/s/logo.png').put(body, {contentType:'image/png'}));
});
