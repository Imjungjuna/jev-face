# jev-face

타이핑하는 동안 받는 사람이 느낄 감정을 Jev가 판단해 3D 얼굴 표정에 바로 적용합니다.

[@doodlefingers의 릴스](https://www.instagram.com/p/Dds_Noqz0DY/)를 영어판으로 다시 만들었습니다. 원작자가 소스를 공개하지 않아 영상 프레임을 보고 UI를 복원했습니다.

## 구성

| 조각 | 출처 |
| --- | --- |
| 결정 모델 | TypeSafe AI `typesafe-ai/jev` (Vercel AI Gateway) |
| 얼굴 모델 | [Face Cap](https://www.bannaflak.com/face-cap) by Bannaflak (`facecap.glb`, ARKit 블렌드셰이프 52개) |
| 렌더링 | three.js `webgl_morphtargets_face` 예제의 씬 설정 |

## 실행

```bash
pnpm install
cp .env.example .env     # 키 한 줄 채우기
pnpm dev                 # http://localhost:5180
pnpm test                # 포즈가 참조하는 블렌드셰이프 이름 검사
```

Jev를 부르는 길이 둘입니다. 둘 다 요청 본문이 같아서 [api/evaluate.js](./api/evaluate.js)가 **어느 키가 있는지 보고 알아서 고릅니다.**

| 키 | 호출 주소 | 모델 id |
| --- | --- | --- |
| `TYPESAFE_API_KEY` | `api.typesafe.ai/v1/systemone` | `jev-latest` |
| `AI_GATEWAY_API_KEY` | `ai-gateway.vercel.sh/typesafe/v1/systemone` | `typesafe-ai/jev` |

`TYPESAFE_API_KEY`가 있으면 그쪽을 먼저 씁니다. TypeSafe 공홈에서 받은 키는 `apikey_`로, Vercel AI Gateway 키는 `vck_`로 시작합니다. Vercel 쪽은 Jev가 무료 티어 모델이 아니라서 크레딧을 충전해야 합니다.

키는 브라우저로 내려가지 않습니다. 클라이언트는 `{ text }`만 보내고 질문 스키마는 서버에서 만듭니다.

`pnpm dev`는 기동할 때 `.env`를 한 번만 읽습니다. 키를 바꾸면 서버를 다시 띄우세요.

## 동작

1. 입력이 멈추고 250ms 뒤 `/api/evaluate`로 현재 문장을 보냅니다.
2. Jev가 질문 두 개를 병렬로 평가합니다. `emotion`은 8종 중 하나를 고르는 choice, `intensity`는 0~4 단계 score입니다. 둘 다 확률 분포를 함께 돌려줍니다.
3. 확률 분포를 가중치로 써서 8개 표정 포즈를 섞습니다. 1등만 쓰면 글자를 칠 때마다 표정이 튑니다. 섞어야 흐릅니다.
4. intensity가 전체 세기를 조절하고, 매 프레임 지수 보간으로 따라갑니다.

요청이 진행 중일 때 들어온 입력은 버리지 않고 마지막 하나만 큐에 넣었다가 응답 직후 한 번 더 보냅니다.

## 손볼 만한 곳

- 표정 포즈 8종: [src/emotions.js](./src/emotions.js). 블렌드셰이프 이름과 0~1 가중치만 있는 평범한 객체입니다. `pnpm test`가 오타를 잡습니다.
- 반응 속도: [src/main.js](./src/main.js)의 `SMOOTHING`과 `DEBOUNCE_MS`.
- 카메라 거리와 화각: `src/main.js` 상단. 녹화 구도에 맞춰 조절하세요. 마우스로 돌려 본 뒤 그 값을 적어도 됩니다.
- 감정별 강조 색: `src/emotions.js`의 `EMOTION_COLORS`.

## 확인하지 않은 것

HTTP `/v1/evaluate` 응답 봉투의 정확한 모양입니다. 문서에 `answers`의 내용만 있고 바깥 껍데기는 나오지 않습니다. [src/panel.js](./src/panel.js)는 `body.answers ?? body`로 양쪽을 받고, 패널 맨 아래 `raw response JSON`에 원본을 그대로 보여 줍니다. 첫 요청을 보내고 그 칸을 펼쳐 보면 실제 모양이 바로 보입니다. 토큰 수와 confidence 자리가 `—`로 남으면 그 경로만 고치면 됩니다.

## 녹화용 문장

원본이 역동적인 이유는 단순합니다. **절이 하나 끝날 때마다 그때까지 쌓인 문장의 뜻이 뒤집힙니다.** "넌 참 좋은 친구가"까지는 칭찬이고, "별로 없지?"가 붙는 순간 모욕이 됩니다. 한국어는 동사와 부정이 문장 끝에 오니 이 반전이 저절로 따라옵니다.

영어는 동사가 앞에 와서 한 절 안에서는 못 뒤집습니다. 대신 **짧은 꼬리 문장**을 붙여 앞을 통째로 다시 칠합니다.

| 수법 | 예 |
| --- | --- |
| 철회 | `You got it. Kidding.` |
| 범위 좁히기 | `You're perfect. For someone else.` |
| 뒤에 붙이는 전치사구 | `I think about you every day. With regret.` |
| 꼬리를 또 뒤집기 | `As a friend. Of a friend.` |

비트를 3~5단어로 끊을수록 표정이 자주 바뀝니다. 아래 셋은 그렇게 짠 것이고, 감정은 **보내는 사람이 아니라 받는 사람** 기준입니다.

### A. 가장 역동적 (8비트, 123자)

```text
Hey. I love you. As a friend. Of a friend. Who told me to stop texting you. She's in your kitchen. She used your toothbrush.
```

| 여기까지 쳤을 때 | 받는 사람 감정 |
| --- | --- |
| `Hey.` | neutral |
| `I love you.` | happy |
| `As a friend.` | sad |
| `Of a friend.` | sad |
| `Who told me to stop texting you.` | angry |
| `She's in your kitchen.` | fear |
| `She used your toothbrush.` | disgust |

### B. 원본과 길이가 가장 비슷함 (6비트, 124자)

```text
Quick update. You got the promotion. Kidding. Mark did. He wants your desk by Friday. He's behind you. I drank from your mug.
```

neutral → happy → sad → angry → fear → disgust로 갑니다. 124자면 분당 240자로 쳐서 31초라 릴스 33초와 거의 같습니다.

### C. 원본과 말투가 가장 비슷함 (6비트, 155자)

```text
I have to tell you something. You're my favorite person. To lie to. Everyone knows. They're outside your door right now. I ate your lunch too. Off the floor.
```

`To lie to.`가 영어판의 "별로 없지?"입니다. 앞 문장을 칭찬에서 조롱으로 뒤집습니다.

### 직접 쓸 때

contempt는 받는 사람이 **보내는 사람을 깔봐야** 나옵니다. 받는 사람을 비웃는 문장은 contempt가 아니라 angry로 갑니다. fear는 "지금 네 뒤에 있다"처럼 **곧 닥칠 일**을 적으면 걸립니다. disgust는 몸으로 느끼는 역겨움이라야 확실합니다.
