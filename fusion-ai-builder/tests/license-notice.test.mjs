// The plugin bundle is the plugin dir (PLUGIN_BUNDLE tar / dev mount). The vendored Oracle skill must
// carry Oracle's UPL notice inside it (equality with the repo LICENSES copy is asserted by mcp/test/license-notices.test.mjs,
// since the plugin tests run with only the plugin dir mounted).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');

test('skills/aistudio ships the UPL notice (inside the plugin dir, so inside the bundle)', () => {
  const notice = read('../skills/aistudio/LICENSE.txt');
  assert.match(notice, /Copyright \(c\) 2022 Oracle/);
  assert.match(notice, /Universal Permissive License \(UPL\), Version 1\.0/);
});

test('the vendored Oracle SKILL.md is still present next to the notice', () => {
  assert.ok(fs.existsSync(new URL('../skills/aistudio/SKILL.md', import.meta.url)));
});
