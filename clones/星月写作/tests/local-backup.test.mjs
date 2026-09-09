import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLocalBackup, restoreLocalEntries } from '../src/lib/local-backup.ts';

test('old exports remain importable while versioned backups include image history', () => {
  const local = { 'xingyue-books': '[]', 'xingyue-profile': JSON.stringify({ nickname: '作者', bio: '' }) };
  assert.deepEqual(parseLocalBackup(JSON.stringify(local)).local, local);
  const batch = { id: 'image-1', images: ['data:image/jpeg;base64,YQ=='], prompt: '封面', createdAt: '2026-09-08' };
  assert.deepEqual(parseLocalBackup(JSON.stringify({format:'xingyue-backup',version:1,local,images:[batch]})).images,[batch]);
});
test('malformed books and out-of-scope keys are rejected before restoring storage', () => {
  for (const value of [{ 'xingyue-books': '[{}]' }, { 'other-app': '[]' }, { 'xingyue-prompts': '42' }, { 'xingyue-context-combinations': '[{"id":"a","name":"b"}]' }]) assert.throws(() => parseLocalBackup(JSON.stringify(value)));
  assert.throws(() => parseLocalBackup(JSON.stringify({format:'xingyue-backup',version:3,local:{},images:[]})));
});
test('quota failure rolls back every touched key and preserves unrelated data', () => {
  const values = new Map([['xingyue-books','old books'],['other-app','preserve']]);
  let writes = 0;
  const storage = {getItem:key=>values.get(key)??null,removeItem:key=>values.delete(key),setItem:(key,value)=>{if(++writes===2) throw Error('QuotaExceeded');values.set(key,value);}};
  assert.throws(()=>restoreLocalEntries(storage,{'xingyue-books':'new books','xingyue-profile':'new profile'}),/已恢复/);
  assert.deepEqual([...values],[['other-app','preserve'],['xingyue-books','old books']]);
});
