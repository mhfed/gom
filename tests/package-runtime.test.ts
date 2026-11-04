import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readdir } from 'node:fs/promises';
const require = createRequire(import.meta.url);

test('packaged runtime includes every bundled provider logo', async () => {
  const forge = require('../forge.config.cjs');
  const assets = await readdir(new URL('../src/renderer/logos/', import.meta.url));
  for (const asset of assets.filter(name => /\.(svg|png)$/.test(name))) {
    assert.equal(forge.packagerConfig.ignore('/dist/logos/' + asset), false, asset);
  }
});
