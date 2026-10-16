import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const skill = read('../skills/pod-operations/SKILL.md');

test('pod-operations: connect = the identity sign-in (one sign-in, every scope), never a browser, coded failures have a next step', () => {
  assert.match(skill, /`identity_login_start`/);
  assert.match(skill, /one sign-in/i);
  assert.match(skill, /never opens a browser/i);
  assert.match(skill, /`cli-login-lost`/);
  assert.match(skill, /`not-configured`/);
});

test('no plugin text (outside the vendored Oracle skill) sends the user to aistudio authenticate or orchestratorTokenUrl', () => {
  const own = fs.readdirSync(new URL('../skills/', import.meta.url)).filter((d) => d !== 'aistudio');
  assert.ok(own.length >= 15, 'own skills not found');
  const files = [read('../instructions.md'), ...own.map((d) => read(`../skills/${d}/SKILL.md`))];
  for (const t of files) assert.doesNotMatch(t, /aistudio authenticate|orchestratorTokenUrl/);
});
