#!/usr/bin/env node
/*
 * Rebuild the Snapshot grammar search index from REAL, already-installed
 * model answers. No generated or hand-written example sentences.
 *
 * Run after changing data/themes/*.json or data/theme_catalog.json:
 *   node scripts/generate-snapshot-grammar-index.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = path => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
const catalog = readJson('data/theme_catalog.json');

const MATCHERS = {
  progressive: g => /現在進行形|is\s*~?ing/i.test(g),
  participle: g => /(現在分詞[^/]*?(修飾|形容詞)|(修飾|形容詞)[^/]*?現在分詞)/.test(g),
  gerund: g => /動名詞/.test(g) && !/動名詞列挙|while\s*[＋+]\s*動名詞/.test(g),
  preposition: g => /前置詞/.test(g),
  relative: g => /関係代名詞/.test(g),
  infinitive: g => /to\s*不定詞|不定詞の|to不定詞|不定詞（|不定詞\(/.test(g),
  passive: g => /受動態/.test(g),
  pastparticiple: g => /(過去分詞[^/]*?(修飾|形容詞)|(修飾|形容詞)[^/]*?過去分詞)/.test(g),
  comparison: g => /比較級|最上級|比較表現/.test(g),
  conjunction: g => /接続詞|becauseを用いた|whileを用いた|while\s*[＋+]/.test(g),
  modal: g => /助動詞|(^|[\s/＋+])(?:may|might|must|could|should)(?:\s|$|[＋+])/i.test(g),
  there: g => /There\s+(?:is|are)/i.test(g),
  perfect: g => /現在完了/.test(g)
};
const LEVELS = ['elementary', 'junior_high', 'high_school'];
let answerCount = 0;

const items = catalog.map(item => {
  if (!item || !item.id) throw new Error('Invalid theme catalog item');
  const src = readJson('data/themes/' + item.id + '.json');
  const data = Array.isArray(src) ? src[0] : src;
  if (!data?.scoringData) throw new Error('Missing scoringData for theme ' + item.id);
  const sentenceRows = [];
  for (const level of LEVELS) {
    for (const sentence of data.scoringData[level]?.sentences || []) {
      if (typeof sentence.text !== 'string' || !sentence.text.trim()) continue;
      sentenceRows.push({
        level,
        text: sentence.text.trim(),
        grammar: String(sentence.grammar || '').trim(),
        ja: String(sentence.ja || '').trim()
      });
      answerCount++;
    }
  }

  const examples = {};
  for (const [grammarId, test] of Object.entries(MATCHERS)) {
    const byLevel = {};
    for (const level of LEVELS) {
      const matches = sentenceRows.filter(s => s.level === level && test(s.grammar));
      if (matches.length) {
        matches.sort((a, b) => a.text.length - b.text.length);
        const chosen = matches[0];
        byLevel[level] = {
          text: chosen.text,
          grammar: chosen.grammar,
          ja: chosen.ja
        };
      }
    }
    if (Object.keys(byLevel).length) examples[grammarId] = byLevel;
  }
  return { id: String(item.id), examples };
});

const index = {
  schemaVersion: 1,
  source: 'data/themes/{id}.json:scoringData.{level}.sentences',
  count: items.length,
  items
};
writeFileSync(join(ROOT, 'data/snapshot_grammar_index.json'), JSON.stringify(index) + '\n', 'utf8');
const grammarCounts = Object.fromEntries(Object.keys(MATCHERS).map(type => [
  type, items.filter(item => Boolean(item.examples[type])).length
]));
console.log('Indexed ' + items.length + ' photos from ' + answerCount + ' original model-answer sentences.');
console.log('Grammar counts:', grammarCounts);
