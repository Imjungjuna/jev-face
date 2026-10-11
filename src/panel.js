import { EMOTION_ORDER, EMOTION_COLORS, INTENSITY_LABELS } from './emotions.js';

const $ = (id) => document.getElementById(id);

function buildRows(host, items) {
  return items.map(({ label, color }) => {
    const row = document.createElement('div');
    row.className = 'row prob-row';
    row.innerHTML =
      `<span class="label">${color ? `<i class="dot" style="background:${color}"></i>` : ''}${label}</span>` +
      `<span class="bar"><i></i></span>` +
      `<span class="num">—</span>`;
    host.appendChild(row);
    return { row, fill: row.querySelector('.bar > i'), num: row.querySelector('.num') };
  });
}

const emotionRows = buildRows(
  $('emotion-rows'),
  EMOTION_ORDER.map((name) => ({ label: name, color: EMOTION_COLORS[name] })),
);

const intensityRows = buildRows(
  $('intensity-rows'),
  INTENSITY_LABELS.map((label, i) => ({ label: `${i} · ${label}` })),
);

const counters = { requests: 0, failures: 0 };

function paint(rows, probabilities, leadIndex, color) {
  rows.forEach((r, i) => {
    const p = probabilities?.[i] ?? null;
    r.fill.style.width = `${(p ?? 0) * 100}%`;
    r.fill.style.background = i === leadIndex ? color : '#5a6068';
    r.num.textContent = p == null ? '—' : p.toFixed(3);
    r.row.classList.toggle('lead', i === leadIndex);
  });
}

export function countRequest() {
  $('m-req').textContent = ++counters.requests;
}

export function countFailure(message) {
  $('m-fail').textContent = ++counters.failures;
  $('raw-json').textContent = message;
}

/*
 * The gateway response envelope is not pinned down in the docs, so answers are
 * located defensively and the raw body is always shown in the panel.
 */
export function render(body) {
  const answers = body.answers ?? body;
  const emotion = answers.emotion ?? {};
  const intensity = answers.intensity ?? {};

  const choice = emotion.choice ?? 'neutral';
  const color = EMOTION_COLORS[choice] ?? '#9aa3ad';
  const score = typeof intensity.score === 'number' ? intensity.score : 0;
  const level = Math.round(score);

  document.documentElement.style.setProperty('--accent', color);

  $('em-dot').style.background = color;
  $('em-name').textContent = `"${choice}"`;
  $('em-int').textContent = (score / 4).toFixed(3);
  $('em-int-bar').style.width = `${(score / 4) * 100}%`;
  $('em-score').textContent = `${score.toFixed(3)} → "${INTENSITY_LABELS[level] ?? '—'}"`;

  paint(
    emotionRows,
    EMOTION_ORDER.map((k) => emotion.probabilities?.[k] ?? 0),
    EMOTION_ORDER.indexOf(choice),
    color,
  );
  paint(
    intensityRows,
    INTENSITY_LABELS.map((_, i) => intensity.probabilities?.[String(i)] ?? 0),
    level,
    color,
  );

  /* TypeSafe answers carry their own confidence; the gateway's evaluate route
   * groups them under providerMetadata instead. */
  const confidence =
    body.providerMetadata?.typesafe?.confidence ??
    Object.fromEntries(
      Object.entries(answers)
        .filter(([, a]) => typeof a?.confidence === 'number')
        .map(([k, a]) => [k, a.confidence]),
    );
  $('m-conf').textContent =
    Object.entries(confidence)
      .map(([k, v]) => `${k}=${Number(v).toFixed(3)}`)
      .join('\n') || '—';
  $('m-lat').textContent = `${body.latencyMs ?? '—'} ms`;
  $('m-tok').textContent =
    body.usage?.input_tokens ?? body.usage?.inputTokens ?? body.usage?.promptTokens ?? '—';
  $('raw-json').textContent = JSON.stringify(body, null, 1);

  return { emotion, intensity, score };
}

export function setStatus(state, text) {
  $('status').className = state;
  $('status-text').textContent = text;
}

$('settings-toggle').addEventListener('click', () => {
  $('panel').classList.toggle('hidden');
});
