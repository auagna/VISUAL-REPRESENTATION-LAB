# Visual Representation Lab — v0.3

VRL은 인테리어 이미지를 `VARIABLE · STATE · DELTA · RELATION · MODULE`로 설계하는 로컬 시각화 작업 공간입니다. 이미지가 중심이 되며, Representation State(무엇을 표현할지)와 Execution State(어떤 모델로 실행할지)는 분리됩니다.

## 의존성 설치 없는 실행

Node.js 18 이상만 필요합니다. 패키지 설치는 필요하지 않습니다.

```powershell
cd "C:\Users\yujin\Documents\VISUAL REPRESENTATION LAB"
node server\server.mjs
```

브라우저에서 `http://127.0.0.1:3000`을 엽니다.

`python -m http.server`도 Mock UI만 확인할 때는 사용할 수 있지만, AI Provider API는 Node 서버에서만 동작합니다. `standalone/index.html`을 직접 열면 Mock UI는 표시되지만 서버 연결 상태 확인과 실제 생성은 사용할 수 없습니다.

## AI Provider 설정

1. `.env.example`을 `.env.local`로 복사합니다.
2. 사용할 Provider 키만 입력합니다.

```dotenv
OPENAI_API_KEY=
GEMINI_API_KEY=
PORT=3000
```

3. 서버를 다시 시작합니다.
4. 상단 `AI MODELS`에서 `연결 테스트`를 실행하고 생성·영역 편집 기본 모델을 저장합니다.

`.env.local`은 Git에서 제외됩니다. API 키는 클라이언트 JavaScript, `localStorage`, 프로젝트 JSON, 실험 스냅샷에 저장되지 않습니다.

지원 모델 레지스트리:

- Mock / `mock-image-v1`: 오프라인·테스트·결정론적 결과
- OpenAI / `gpt-image-2`: 생성, 이미지 입력, 편집, 마스크 편집
- Google / `gemini-3.1-flash-lite-image`: 빠른 생성·이미지 입력
- Google / `gemini-3.1-flash-image`: 생성·편집·다중 레퍼런스
- Google / `gemini-3-pro-image`: 정밀 생성·편집·다중 레퍼런스

모델 ID와 기능 지원 여부는 레지스트리에 모여 있으며 UI 컴포넌트에 흩어져 있지 않습니다. OpenAI 구현은 공식 [GPT Image 2 모델 문서](https://developers.openai.com/api/docs/models/gpt-image-2)와 [Image generation 가이드](https://developers.openai.com/api/docs/guides/image-generation), Gemini 구현은 Google의 [Gemini image generation 가이드](https://ai.google.dev/gemini-api/docs/image-generation)를 기준으로 합니다.

## 작업 공간

- `IMAGE`: 큰 이미지, 프로젝트/모듈 탐색, Context Inspector, Variant History
- `SYSTEM`: Node/Module Library, 저소음 그래프, 선택 노드 Inspector
- `COMPARE`: Camera/Lighting Study용 에디토리얼 Contact Sheet와 Delta Inspector
- `REGION`: 이미지 중심 Mask Toolbar와 Furniture/Material 변경 흐름
- `AI MODELS`: 연결 상태, 기능 레지스트리, 전역·프로젝트·Generator 실행 라우팅
- `DESIGN SYSTEM`: Typography, State Marker, Variable Rail, Module/Node 문법 내부 참고 화면

## 주요 기능

- 여섯 개 Workflow Template과 전용 Template Detail
- LOCKED / CONTROLLED / FREE 상태 언어와 Variable Rail
- 독립적인 Representation Preset 4종 + Design Style 6종
- 사용자 상태 우선 충돌 해결과 결정론적 컴파일러
- Camera/Lighting OFAT, Alt Exploration, Region Mask/Edit, Delta Compare
- Provider-independent ModelRouter와 기능 기반 호환성 검사
- 전역 기본값, 프로젝트 기본값, Generator 노드 재정의 우선순위
- Mock, OpenAI, Gemini 결과의 공통 Snapshot 메타데이터
- 연결 필요·미지원 기능·인증·Rate Limit 오류의 명시적 처리

## 검증

```powershell
node --check standalone\provider-runtime.js
node --check standalone\app.js
node --check server\server.mjs
node standalone\smoke-test.js
```

Smoke test는 기존 상태·컴파일러·Output Preset 회귀 테스트와 다음 Provider Router 조건 12개를 검사합니다.

- Mock 유지
- 연결 필요 상태
- 프로젝트 기본 모델
- Generator 재정의
- Provider 변경 시 Representation 불변
- 모델 기능 레지스트리
- Region Edit의 편집 기능 요청
- 미지원 기능 오류
- 직렬화 데이터의 API 키 부재
- Snapshot의 Provider/Model 기록
- OpenAI → Gemini 실행 상태 변경
- 같은 Representation의 결정론적 컴파일

## 소스 구조

- `standalone/` — 의존성 없는 실제 UI와 client ModelRouter
- `server/server.mjs` — 정적 파일 및 서버 전용 OpenAI/Gemini API 라우트
- `src/ai/` — TypeScript Provider/Model/Capability 계약과 ModelRouter
- `src/providers/` — Mock/OpenAI/Gemini Provider 구현
- `src/compilers/` — Provider별 Image Compiler 계층
- `src/presets/` — Output Preset 타입과 레지스트리
- `.env.example` — 안전한 서버 환경 변수 예시
