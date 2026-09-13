const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const path = require('node:path');
const filename = path.resolve(__dirname, '../services/api-response.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod = new Module(filename, module); mod._compile(compiled, filename);
const { readApiResponse } = mod.exports;
test('HTML 404 produces an actionable error instead of JSON SyntaxError', async () => {
  await assert.rejects(readApiResponse(new Response('<html>Cannot POST /api/challenges/submit</html>',{status:404})), error => !(error instanceof SyntaxError) && error.message.includes('HTTP 404'));
});
test('HTML success and invalid JSON are not treated as a confirmed submission', async () => {
  for (const text of ['<html>Login</html>', '{broken', 'null', '[]']) await assert.rejects(readApiResponse(new Response(text)));
});
test('JSON API errors are preserved; successful responses stay intact', async () => {
  await assert.rejects(readApiResponse(Response.json({error:'Desafio encerrado.'},{status:409})),{message:'Desafio encerrado.'});
  await assert.rejects(readApiResponse(Response.json({success:false,error:'Recusado.'})),{message:'Recusado.'});
  assert.deepEqual(await readApiResponse(Response.json({success:true})),{success:true});
});
