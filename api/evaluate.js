/*
 * NOTE: The API key never reaches the browser. The client posts only { text };
 * the question schema is built here so a deployed instance cannot be used as
 * an open proxy to arbitrary models.
 */

export const EMOTIONS = {
  neutral: 'Flat, matter-of-fact, or purely informational. No emotional charge.',
  happy: 'Pleased, warm, amused, affectionate, or relieved.',
  sad: 'Hurt, disappointed, lonely, or let down.',
  angry: 'Irritated, offended, accusatory, or hostile.',
  surprised: 'Caught off guard by something unexpected, good or bad.',
  fear: 'Anxious, threatened, dreading what comes next.',
  disgust: 'Repulsed, grossed out, or morally revolted.',
  contempt: 'Looked down on, mocked, dismissed as beneath respect.',
};

export const INTENSITY_LEVELS = [
  'Barely registers. The reader would not react.',
  'A slight flicker of the feeling.',
  'Clearly felt, but easy to shake off.',
  'Strongly felt. It would stay with the reader.',
  'Overwhelming. It would dominate how the reader feels.',
];

/*
 * Jev is reachable two ways and the request bodies are identical, so the only
 * difference is the URL, the model id, and which key is present.
 */
function provider() {
  if (process.env.TYPESAFE_API_KEY) {
    return {
      url: 'https://api.typesafe.ai/v1/systemone',
      key: process.env.TYPESAFE_API_KEY,
      model: process.env.TYPESAFE_MODEL ?? 'jev-latest',
    };
  }
  if (process.env.AI_GATEWAY_API_KEY) {
    return {
      url: 'https://ai-gateway.vercel.sh/typesafe/v1/systemone',
      key: process.env.AI_GATEWAY_API_KEY,
      model: 'typesafe-ai/jev',
    };
  }
  throw new Error('set TYPESAFE_API_KEY or AI_GATEWAY_API_KEY in .env');
}

export async function evaluateText(text) {
  const { url, key, model } = provider();

  const started = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      state: {
        draftMessage: text,
        context: 'A private one-to-one chat between two friends.',
      },
      questions: {
        emotion: {
          type: 'choice',
          instructions:
            'The person receiving this message reads it exactly as written. Which single emotion would they feel most strongly?',
          criteria: EMOTIONS,
        },
        intensity: {
          type: 'score',
          instructions:
            'How strongly would the recipient feel that emotion?',
          criteria: INTENSITY_LEVELS,
        },
      },
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    // TypeSafe returns { message, error_type }; the gateway nests it under error.
    const detail = body?.error?.message ?? body?.message ?? JSON.stringify(body);
    throw new Error(`${res.status}: ${detail}`);
  }

  return { ...body, latencyMs: Date.now() - started };
}

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  const { text } = await request.json();
  if (typeof text !== 'string' || text.trim() === '') {
    return Response.json({ error: 'text is required' }, { status: 400 });
  }

  try {
    return Response.json(await evaluateText(text.slice(0, 2000)));
  } catch (error) {
    return Response.json({ error: String(error.message) }, { status: 502 });
  }
}
