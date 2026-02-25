import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const USERSCRIPT_PATH = new URL('../src/ac-revisit.user.js', import.meta.url);

function parseMetadataLines(source) {
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('// @'));
}

function valuesForKey(lines, key) {
  const marker = new RegExp(`^// @${key}\\s+`);
  return lines
    .filter((line) => marker.test(line))
    .map((line) => line.replace(marker, '').trim())
    .filter(Boolean);
}

test('userscript metadata は AtCoder ドメインにのみ match する', () => {
  const source = readFileSync(USERSCRIPT_PATH, 'utf8');
  const metadata = parseMetadataLines(source);
  const matches = valuesForKey(metadata, 'match');

  assert.deepEqual(matches, ['https://atcoder.jp/*', 'https://*.atcoder.jp/*']);
});

test('userscript metadata は最小 grant のみを宣言する', () => {
  const source = readFileSync(USERSCRIPT_PATH, 'utf8');
  const metadata = parseMetadataLines(source);

  const grants = valuesForKey(metadata, 'grant');
  assert.deepEqual(grants, ['GM_getValue', 'GM_setValue', 'GM_deleteValue']);

  const connect = valuesForKey(metadata, 'connect');
  assert.deepEqual(connect, ['none']);
});

test('userscript metadata は Greasy Fork 配布前提の基本項目を持つ', () => {
  const source = readFileSync(USERSCRIPT_PATH, 'utf8');
  const metadata = parseMetadataLines(source);

  const requiredSingletonKeys = ['name', 'namespace', 'version', 'description', 'author', 'license'];
  for (const key of requiredSingletonKeys) {
    const values = valuesForKey(metadata, key);
    assert.equal(values.length, 1, `${key} should exist exactly once`);
    assert.notEqual(values[0], '', `${key} should not be empty`);
  }
});
