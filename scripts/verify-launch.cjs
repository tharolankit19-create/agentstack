const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(id => {
    if (id === 'server-only') return {};
    if (id in mocks) return mocks[id];
    throw new Error(`Unexpected dependency: ${id}`);
  }, module, module.exports);
  return module.exports;
}

async function main() {
  const plans = load('apps/web/src/lib/plans.ts');
  assert.equal(plans.isEntitled({ plan: 'none' }), false);
  assert.equal(plans.isEntitled({ plan: 'starter', subscription_status: 'cancelled' }), false);
  assert.equal(plans.isEntitled({ plan: 'starter', trial_ends_at: '2000-01-01' }), false);
  assert.equal(plans.isEntitled({ plan: 'starter', trial_ends_at: '2099-01-01' }), true);
  assert.equal(plans.isEntitled({ plan: 'pro', subscription_status: 'active' }), true);
  assert.equal(plans.isEntitled({ plan: 'none', is_admin: true }), true);
  assert.deepEqual(plans.PLAN_LIST.map(p => p.priceUsd), [49, 99]);

  const army = load('apps/web/src/lib/army.ts', { './templates': { getTemplate: id => ({ id, name: id }) } });
  assert.equal(army.rosterTemplateIds().length, 13);
  assert.equal(army.totalAgentCount(), 13);
  assert.ok(plans.PLANS.starter.agentQuota >= army.rosterTemplateIds().length);
  for (const role of ['head-agent', 'research-agent', 'lead-agent', 'competitor-agent', 'community-agent']) assert.ok(army.rosterTemplateIds().includes(role));

  const cadence = load('apps/web/src/lib/cadence.ts');
  assert.equal(cadence.morningDue(null, 'Asia/Kolkata', '08:00', new Date('2026-09-06T02:29:00Z')), false);
  assert.equal(cadence.morningDue(null, 'Asia/Kolkata', '08:00', new Date('2026-09-06T02:30:00Z')), true);
  assert.equal(cadence.morningDue('2026-09-06T02:31:00Z', 'Asia/Kolkata', '08:00', new Date('2026-09-06T04:30:00Z')), false);
  assert.equal(cadence.morningDue('2026-09-05T02:31:00Z', 'Asia/Kolkata', '08:00', new Date('2026-09-06T06:30:00Z')), true);

  const mention = load('apps/web/src/lib/mention.ts', {
    './supabase/admin': {}, './army': { displayName: (_id, name) => name }, './templates': { getTemplate: () => null },
  });
  const agents = [{ id: '1', name: 'Sam', template_id: 'research-agent' }, { id: '2', name: 'Samantha', template_id: 'lead-agent' }];
  assert.equal(mention.findMention('@Samantha find leads', agents).agent.id, '2');
  assert.equal(mention.findMention('@Sammy find leads', agents), null);
  assert.equal(mention.findMention('@Sam find leads', agents).instruction, 'find leads');

  const db = { from: () => ({ insert: async () => ({ error: { code: '42P01' } }) }) };
  const room = load('apps/web/src/lib/room.ts', {
    './supabase/admin': {}, './army': army, './templates': { getTemplate: () => null }, './mention': mention,
  });
  await assert.rejects(room.postFromFounder(db, 'owner', 'Find leads', []), /could not be saved/);
  await assert.rejects(room.postFromAgent(db, 'owner', { id: '1', template_id: 'lead-agent' }, 'Report'), /could not be saved/);
  console.log('PASS: entitlement, $49/$99 pricing, all 13 launch roles, India morning scheduling, mention matching, and persistence failures.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
