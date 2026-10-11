/*
 * Types a sentence one word at a time through the running dev server and
 * reports where the emotion actually flips. Guessing where a sentence turns
 * is unreliable; this measures it.
 *
 *   pnpm dev                       # in another shell
 *   node scripts/trace.js "Love you. As a friend."
 */

const ENDPOINT = 'http://localhost:5180/api/evaluate';

const sentence = process.argv.slice(2).join(' ').trim();
if (!sentence) {
  console.error('usage: node scripts/trace.js "<sentence>"');
  process.exit(1);
}

const words = sentence.split(/\s+/);
const rows = [];
let previous = null;
let lastFlipAt = 0;
const gaps = [];

for (let i = 0; i < words.length; i++) {
  const prefix = words.slice(0, i + 1).join(' ');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: prefix }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? res.statusText);

  const { choice } = body.answers.emotion;
  const { score } = body.answers.intensity;
  const flipped = previous !== null && choice !== previous;

  if (flipped) {
    gaps.push(i + 1 - lastFlipAt);
    lastFlipAt = i + 1;
  }
  previous = choice;

  rows.push({
    '#': i + 1,
    word: words[i],
    emotion: choice,
    score: score.toFixed(2),
    flip: flipped ? '◀ FLIP' : '',
  });
}

console.table(rows);

const average = gaps.length ? (gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1) : '-';
console.log(
  `\n${words.length} words · ${gaps.length} flips · one flip every ${average} words` +
    `\ngaps: ${gaps.join(', ') || 'none'}`,
);
