const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '../..');
const frontendRequire = createRequire(path.join(root, 'db-world-frontend/package.json'));
const yaml = frontendRequire('js-yaml');
const workflow = yaml.load(fs.readFileSync(path.join(root, '.github/workflows/deploy.yml'), 'utf8'));
const jobs = workflow.jobs;

function dependencies(job) {
  return Array.isArray(job.needs) ? job.needs : job.needs ? [job.needs] : [];
}

function allowed(name, inputs, states, cancelled = false) {
  let expression = jobs[name].if.trim().slice(3, -2).trim()
    .replaceAll('always()', 'true').replaceAll('cancelled()', JSON.stringify(cancelled));
  expression = expression.replace(/github\.event\.inputs\.([a-z_]+)/g,
    (_match, key) => JSON.stringify(inputs[key]));
  expression = expression.replace(/needs\.([a-z-]+)\.result/g,
    (_match, key) => JSON.stringify(states[key]));
  return Function(`return (${expression})`)();
}

function visit(name, ancestors = new Set()) {
  assert.ok(jobs[name], `Unknown job dependency: ${name}`);
  assert.ok(!ancestors.has(name), `Cyclic job dependency: ${name}`);
  const next = new Set([...ancestors, name]);
  for (const dependency of dependencies(jobs[name])) visit(dependency, next);
}

for (const name of Object.keys(jobs)) visit(name);
assert.ok(jobs['resolve-source'].steps[0].with.ref.includes('github.sha'));
for (const name of ['backend-build', 'frontend-build', 'android-build']) {
  assert.ok(jobs[name].steps[0].with.ref.includes('needs.resolve-source.outputs.revision'), `${name} must use the pinned commit`);
  assert.ok(dependencies(jobs[name]).includes('resolve-source'));
}
assert.ok(jobs['backend-image'].with.ref.includes('needs.resolve-source.outputs.revision'));
assert.ok(dependencies(jobs['android-build']).includes('frontend-build'));
for (const name of ['android-build', 'backend-deploy', 'backend-deploy-docker', 'frontend-deploy', 'resolve-source']) {
  assert.ok(dependencies(jobs['android-release']).includes(name), `Release must wait for ${name}`);
}
for (const name of ['frontend-build', 'backend-deploy', 'backend-deploy-docker']) {
  assert.ok(dependencies(jobs['frontend-deploy']).includes(name));
}

let cases = 0;
for (const backend of ['true', 'false']) {
  for (const frontend of ['true', 'false']) {
    for (const android of ['true', 'false']) {
      for (const runtime of ['docker', 'war']) {
        const inputs = { backend, frontend, android, backend_runtime: runtime };
        const backendJob = runtime === 'docker' ? 'backend-deploy-docker' : 'backend-deploy';
        const states = {
          'frontend-build': frontend === 'true' || android === 'true' ? 'success' : 'skipped',
          'android-build': android === 'true' ? 'success' : 'skipped',
          'backend-deploy': backend === 'true' && runtime === 'war' ? 'success' : 'skipped',
          'backend-deploy-docker': backend === 'true' && runtime === 'docker' ? 'success' : 'skipped',
          'frontend-deploy': frontend === 'true' ? 'success' : 'skipped',
        };
        assert.equal(allowed('frontend-build', inputs, states), frontend === 'true' || android === 'true');
        assert.equal(allowed('android-release', inputs, states), android === 'true');
        assert.equal(allowed('frontend-deploy', inputs, states), frontend === 'true');
        assert.equal(allowed('android-release', inputs, states, true), false);
        assert.equal(allowed('frontend-deploy', inputs, states, true), false);
        cases += 5;
        for (const status of ['failure', 'cancelled', 'skipped']) {
          assert.equal(allowed('android-release', inputs, { ...states, 'android-build': status }), false);
          assert.equal(allowed('frontend-deploy', inputs, { ...states, 'frontend-build': status }), false);
          cases += 2;
          if (backend === 'true') {
            assert.equal(allowed('android-release', inputs, { ...states, [backendJob]: status }), false);
            assert.equal(allowed('frontend-deploy', inputs, { ...states, [backendJob]: status }), false);
            cases += 2;
          }
          if (frontend === 'true') {
            assert.equal(allowed('android-release', inputs, { ...states, 'frontend-deploy': status }), false);
            cases++;
          }
        }
      }
    }
  }
}

const steps = Object.values(jobs).flatMap(job => job.steps || []);
assert.equal(steps.filter(step => step.run?.includes('npm run build:production')).length, 1, 'Build the production web bundle exactly once');
assert.ok(jobs['android-build'].steps.some(step => step.uses?.startsWith('actions/download-artifact@') && step.with.name === 'frontend-dist'));
assert.equal(jobs['android-build'].permissions?.contents === 'write', false);
assert.equal(jobs['android-release'].permissions.contents, 'write');
assert.equal(jobs['android-release'].environment, 'production');
const publish = jobs['android-release'].steps.find(step => step.name === 'Publish GitHub Release');
assert.ok(publish.with.target_commitish.includes('needs.resolve-source.outputs.revision'));
assert.ok(publish.with.files.includes('release/version.json'));
console.log(`Release workflow checks passed: ${cases} gate cases, acyclic dependencies, pinned source, shared bundle and publish permissions.`);