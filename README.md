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
cp .env.example .env     # AI_GATEWAY_API_KEY 채우기
pnpm dev                 # http://localhost:5180
pnpm test                # 포즈가 참조하는 블렌드셰이프 이름 검사
```

키는 Vercel 대시보드 → AI Gateway → API Keys에서 발급합니다. 브라우저로는 내려가지 않습니다. 클라이언트는 `{ text }`만 보내고 질문 스키마는 [api/evaluate.js](./api/evaluate.js)에서 만듭니다.

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

원본은 한 문장 안에서 뜻이 뒤집히면서 표정이 따라 돌아갑니다. 영어판도 같은 구조가 필요합니다.

- `I need to tell you something. You are the best thing that ever happened to me. Or you were, before I read your texts. Anyway I haven't showered since Tuesday.`
- `Good news, you got the promotion. Kidding. They gave it to Mark. He also took your desk. And your chair. He's sitting in it right now.`

neutral에서 시작해 surprised와 happy를 찍고 sad나 angry로 떨어졌다가 disgust로 끝나면 영상에서 변화가 가장 잘 보입니다.
