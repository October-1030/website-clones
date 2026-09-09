import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkflowRoundPrompt } from '../src/lib/workflow-rounds.ts';
import { appendWorkflowChapters } from '../src/lib/workflow-save.ts';

test('single round remains unchanged and subsequent rounds carry their complete predecessor', () => {
  assert.equal(buildWorkflowRoundPrompt('要求','',1,1),'要求');
  const previous = 'The last star vanished.\n后续必须承接的秘密。';
  const prompt = buildWorkflowRoundPrompt('写下一章',previous,2,3);
  assert.ok(prompt.includes(previous)); assert.ok(prompt.includes('第2/3轮'));
  assert.throws(()=>buildWorkflowRoundPrompt('要求','x'.repeat(30000),2,3),/已停止/);
  assert.throws(()=>buildWorkflowRoundPrompt('要求','',1,11));
});
test('completed rounds become individual chapters without losing existing illustrations or prose', () => {
  const book = {id:'b',title:'测试',description:'',kind:'novel',status:'active',content:'原文',updatedAt:'old',chapters:[{id:'c',title:'第1章',content:'原文',summary:'概要',illustrations:['data:image/jpeg;base64,YQ=='],updatedAt:'old'}]};
  const saved = appendWorkflowChapters(book,['下一章','再下一章'],'now');
  assert.equal(saved.chapters.length,3); assert.deepEqual(saved.chapters[0],book.chapters[0]);
  assert.equal(saved.content,'原文\n\n下一章\n\n再下一章'); assert.notEqual(saved.chapters[1].id,saved.chapters[2].id);
  assert.throws(()=>appendWorkflowChapters(book,['有效','']));
});
