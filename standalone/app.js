/* VISUAL REPRESENTATION LAB — dependency-free MVP v0.2 */
(() => {
  "use strict";

  const STORAGE_KEY = "vrl-v02-projects";
  const MODULE_KEY = "vrl-v02-custom-modules";
  const AI_SETTINGS_KEY = "vrl-v02-ai-routing";
  const appEl = document.getElementById("app");
  const toastEl = document.getElementById("toast");

  const uid = (prefix = "id") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const pathGet = (object, path) => path.split(".").reduce((value, part) => value?.[part], object);
  const pathSet = (object, path, value) => { const parts = path.split("."); const final = parts.pop(); const target = parts.reduce((item, part) => item[part], object); target[final] = value; };
  const attr = (value, mode = "controlled", source = "system", strength = 60) => ({ value, enabled: true, mode, source, strength });
  const modeLabel = (mode) => mode === "locked" ? "잠금" : mode === "controlled" ? "제어" : "자유";
  const intensity = (n) => n <= 20 ? "subtle" : n <= 40 ? "light" : n <= 60 ? "clear" : n <= 80 ? "strong" : "dominant";
  const now = () => new Date().toISOString();
  function toast(message) { toastEl.textContent = message; toastEl.classList.add("show"); clearTimeout(toast._timer); toast._timer = setTimeout(() => toastEl.classList.remove("show"), 2200); }
  const KO_UI = {
    "Selection mask editor": "선택 마스크 편집기", "BRUSH": "브러시", "ERASER": "지우개", "CLEAR": "지우기", "MASK VISIBLE": "마스크 표시", "MASK HIDDEN": "마스크 숨김", "＋ NEW REGION": "＋ 새 영역", "UPDATE REGION MASK": "영역 마스크 업데이트", "CREATE REGION": "영역 만들기", "Regions": "편집 영역", "Active region": "활성 영역", "Region operation": "영역 작업", "Operation": "작업", "Instruction": "지시문", "Material": "재료", "Color": "색상", "Form": "형태", "Texture": "텍스처", "Region reference image": "영역 레퍼런스 이미지", "Preservation": "보존 설정", "Local compiler": "지역 컴파일러", "GENERATE REGION EDIT": "영역 편집 생성", "One Factor At A Time": "단일 변수 실험", "Variable": "변수", "Values": "값", "RUN OFAT SERIES": "단일 변수 실험 실행", "Coordinated divergence": "조율된 대안 변화", "Number of alternatives": "대안 개수", "Variation scope": "변화 범위", "GENERATE ALTERNATIVES": "대안 생성", "Image provider": "이미지 제공자", "ACTIVE PROVIDER": "활성 제공자", "MODE": "모드", "GENERATE SNAPSHOT": "스냅샷 생성", "Deterministic compiler": "결정론적 컴파일러", "Module port contract": "모듈 입출력 계약", "Debug node / state": "디버그 노드 / 상태", "DELETE": "삭제", "APPLY": "적용", "ADVANCED": "고급 설정", "EVALUATION": "평가", "LOAD": "불러오기", "CLEAR SELECTION": "선택 해제", "State difference": "상태 차이", "Compiler section difference": "컴파일러 섹션 차이", "Generation / experiment results": "생성 / 실험 결과", "UNCHANGED": "변경 없음", "IDENTICAL PROMPT": "동일한 프롬프트", "ONE FACTOR": "단일 변수", "BASELINE": "기준 상태", "targetFollowed": "목표 속성 반영", "preserved": "기타 속성 보존", "controllability": "전반적 제어성"
  };
  const FAILURE_KO = { "Variable definition failure": "변수 정의 실패", "Reference analysis failure": "레퍼런스 분석 실패", "Representation merge failure": "표현 병합 실패", "Prompt compiler failure": "프롬프트 컴파일러 실패", "Generator unpredictability": "생성기 예측 불가능성", "Preservation failure": "보존 실패", "Unknown": "알 수 없음", "Failure cause…": "실패 원인…" };
  function applyKoreanUi(root) {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll("h3,label,summary,b,button,.eyebrow,.diff-item,.badge").forEach((element) => {
      if (element.tagName === "BUTTON" && element.childElementCount) return;
      const text = element.textContent.trim(); if (KO_UI[text]) element.textContent = KO_UI[text]; else if (/^\d+ CHANGES$/.test(text)) element.textContent = text.replace("CHANGES", "개 변경");
    });
    root.querySelectorAll("select[data-failure-id] option").forEach((option) => { if (FAILURE_KO[option.textContent]) option.label = FAILURE_KO[option.textContent]; });
  }

  const NODE_DEFS = {
    imageInput: { label: "이미지 입력", category: "Input", inputs: [], outputs: ["소스 이미지"] },
    referenceInput: { label: "레퍼런스 입력", category: "Input", inputs: [], outputs: ["레퍼런스 이미지"] },
    representation: { label: "표현 상태", category: "Representation", inputs: ["의도", "속성"], outputs: ["표현 상태"] },
    referenceAnalyzer: { label: "레퍼런스 분석", category: "Representation", inputs: ["레퍼런스 이미지"], outputs: ["전이 가능 속성"] },
    attributeSelector: { label: "속성 선택", category: "Representation", inputs: ["분석된 속성"], outputs: ["선택된 속성"] },
    camera: { label: "카메라", category: "Control", inputs: ["기본 상태"], outputs: ["카메라 상태"] },
    lighting: { label: "조명", category: "Control", inputs: ["기본 상태"], outputs: ["조명 상태"] },
    material: { label: "재료", category: "Control", inputs: ["기본 상태"], outputs: ["재료 상태"] },
    atmosphere: { label: "분위기", category: "Control", inputs: ["기본 상태"], outputs: ["분위기 상태"] },
    altBuilder: { label: "대안 구성", category: "Control", inputs: ["기본 상태"], outputs: ["대안 상태"] },
    regionMask: { label: "영역 마스크", category: "Local Edit", inputs: ["소스 이미지"], outputs: ["선택 영역"] },
    regionEdit: { label: "영역 편집", category: "Local Edit", inputs: ["소스 이미지", "기본 상태", "선택 영역"], outputs: ["편집 지시"] },
    ofat: { label: "단일 변수 실험", category: "Experiment", inputs: ["기본 상태"], outputs: ["변형 상태"] },
    compare: { label: "비교", category: "Experiment", inputs: ["생성 결과"], outputs: ["비교 세트"] },
    evaluation: { label: "평가", category: "Experiment", inputs: ["결과"], outputs: ["평가 점수"] },
    compiler: { label: "프롬프트 컴파일러", category: "Output", inputs: ["표현 상태"], outputs: ["생성 지시"] },
    generator: { label: "이미지 생성", category: "Output", inputs: ["생성 지시"], outputs: ["생성 이미지"] },
  };

  const CATEGORY_KO = { Input: "입력", Representation: "표현", Control: "제어", "Local Edit": "지역 편집", Experiment: "실험", Output: "출력", Explore: "탐색", Edit: "편집", Study: "연구" };

  const NODE_LIBRARY = {
    Input: ["imageInput", "referenceInput"],
    Representation: ["representation", "referenceAnalyzer", "attributeSelector"],
    Control: ["camera", "lighting", "material", "atmosphere"],
    "Local Edit": ["regionMask", "regionEdit"],
    Experiment: ["ofat", "compare", "evaluation"],
    Output: ["compiler", "generator"],
  };

  if (globalThis.VRL_GRAPH) {
    Object.entries(globalThis.VRL_GRAPH.REGISTRY).forEach(([type, definition]) => {
      NODE_DEFS[type] ||= {
        label: definition.label,
        category: definition.category,
        inputs: definition.inputs.map((item) => item.label),
        outputs: definition.outputs.map((item) => item.label),
      };
    });
    NODE_LIBRARY.INPUT = ["number", "text", "boolean", "enum", "image", "reference", "list"];
    NODE_LIBRARY.REPRESENTATION = ["camera", "lighting", "material", "representation"];
    NODE_LIBRARY.LOGIC = ["switch", "merge", "override", "iterate", "lock", "styleMix"];
    NODE_LIBRARY.OUTPUT = ["compile", "generate", "compare"];
  }

  const CAMERA_PRESETS = {
    "Interior 24 Wide": { focalLengthMm: 24, sensor: "Full Frame", cameraHeightMm: 1500, pitchDeg: 0, perspectiveCorrection: true },
    "Interior 35 Natural": { focalLengthMm: 35, sensor: "Full Frame", cameraHeightMm: 1500, pitchDeg: 0, perspectiveCorrection: true },
    "Editorial 50": { focalLengthMm: 50, sensor: "Full Frame", cameraHeightMm: 1450, pitchDeg: 0, perspectiveCorrection: true },
    "Compressed 85": { focalLengthMm: 85, sensor: "Full Frame", cameraHeightMm: 1500, pitchDeg: 0, perspectiveCorrection: false },
  };
  const LIGHTING_PRESETS = {
    "Warm Dining 3000K": { colorTemperatureK: 3000, exposureEV: 0.2, softness: 70, contrast: 45, ambientLevel: 35, artificialLevel: 65, direction: "Mixed" },
    "Neutral Daylight": { colorTemperatureK: 5000, exposureEV: 0, softness: 65, contrast: 40, ambientLevel: 80, artificialLevel: 20, direction: "Side" },
    "Overcast Soft": { colorTemperatureK: 5500, exposureEV: 0.1, softness: 90, contrast: 25, ambientLevel: 90, artificialLevel: 10, direction: "Front" },
    "Night Restaurant": { colorTemperatureK: 2700, exposureEV: -0.4, softness: 55, contrast: 70, ambientLevel: 10, artificialLevel: 90, direction: "Mixed" },
  };

  const REFERENCE_PRESETS = {
    "Bare Paper Ink Line": { medium: ["black ink", 90], palette: ["monochrome", 100], detailDensity: ["very low", 80], texture: ["bare paper", 75], atmosphere: ["minimal", 55] },
    "Warm Nordic Interior": { palette: ["warm neutral", 75], lightingCharacter: ["soft warm daylight", 80], material: ["pale oak and lime plaster", 75], atmosphere: ["quiet domestic", 65] },
    "Night Restaurant": { palette: ["amber and deep brown", 80], lightingCharacter: ["low warm pools of light", 90], material: ["dark timber and brushed metal", 70], atmosphere: ["intimate", 80] },
    "Concrete Gallery": { palette: ["cool neutral", 70], lightingCharacter: ["diffuse overhead daylight", 75], material: ["exposed concrete", 90], atmosphere: ["minimal institutional", 65] },
  };

  const REPRESENTATION_PRESETS = [
    { id: "photoreal_actual", name: "Photoreal Actual", nameKo: "실사 사진", description: "현실적인 재료와 조명 반응을 지닌 실제 인테리어·건축 사진 표현", compilerDirectives: ["Photoreal actual interior or architectural photography.", "Real-world material behavior.", "Natural spatial depth.", "Believable surface response.", "Physically plausible lighting and shadow relationships.", "Realistic architectural photography character.", "Preserve realistic scale and spatial proportion."], materialHints: ["natural material imperfections", "realistic reflections", "believable roughness", "non-uniform surface behavior"], exclusions: ["overly glossy CGI surfaces", "artificial rendering artifacts", "diagrammatic abstraction", "cartoon-like simplification", "excessive synthetic perfection"] },
    { id: "archviz_render", name: "Archviz Render", nameKo: "아키비즈 렌더", description: "제어된 사실성과 정제된 프레젠테이션을 갖춘 건축 시각화", compilerDirectives: ["High-quality architectural visualization render.", "Refined archviz presentation.", "Controlled realism.", "Clean surface definition.", "Carefully balanced reflections.", "Crisp architectural edge clarity.", "Professionally composed interior visualization."], materialHints: ["refined material response", "clean texture mapping", "controlled reflections", "polished but believable surfaces"], exclusions: ["documentary photography imperfections", "rough conceptual sketch language", "low-detail massing abstraction"] },
    { id: "sketchup_like", name: "SketchUp-like", nameKo: "스케치업 스타일", description: "형상과 공간 판독성을 강조한 간결한 개념 건축 표현", compilerDirectives: ["SketchUp-like conceptual architectural representation.", "Simple planar surfaces.", "Clear geometric edges.", "Simplified materials.", "Strong spatial legibility.", "Lightweight architectural visualization.", "Reduced photographic complexity."], materialHints: ["flat or lightly textured materials", "simplified shading", "clean surfaces"], exclusions: ["highly photoreal rendering", "cinematic atmosphere", "complex natural imperfections", "excessive material richness"] },
    { id: "massing_white_model", name: "Massing / White Model", nameKo: "매싱 / 화이트 모델", description: "비례·볼륨·주요 형상에 집중한 건축 매싱 표현", compilerDirectives: ["Architectural massing study.", "Abstract white model representation.", "Focus on primary volume and proportion.", "Strong geometric readability.", "Minimal surface detail.", "Reduced material differentiation.", "Diagrammatic spatial clarity."], materialHints: ["matte white model material", "neutral gray shadow behavior", "paper model or foam model character"], exclusions: ["decorative detail", "realistic furniture styling", "rich textures", "visual clutter", "strong atmospheric storytelling"] },
  ];
  const DESIGN_STYLE_PRESETS = [
    { id: "none", name: "None", nameKo: "선택 안 함", description: "명시적인 디자인 사조를 추가하지 않습니다.", compilerDirectives: [], materialHints: [], formHints: [], exclusions: [] },
    { id: "modernism", name: "Modernism", nameKo: "모더니즘", description: "기능적이고 합리적이며 절제된 모더니즘 공간 언어", compilerDirectives: ["Modernist architectural language.", "Functional clarity.", "Rational composition.", "Clean orthogonal geometry.", "Minimal ornamentation.", "Calm spatial order.", "Strong relationship between function and form.", "Visual restraint."], materialHints: ["exposed concrete", "painted plaster", "steel", "glass", "restrained timber accents"], formHints: ["orthogonal geometry", "clean planar composition", "horizontal and vertical order"], exclusions: ["ornamental excess", "playful historical quotation", "decorative complexity", "unnecessary sculptural gestures"] },
    { id: "postmodernism", name: "Postmodernism", nameKo: "포스트모더니즘", description: "유희적이고 상징적이며 역사적 참조를 지닌 건축 표현", compilerDirectives: ["Postmodern architectural language.", "Playful formal composition.", "Historical quotation.", "Graphic geometry.", "Expressive forms.", "Layered symbolism.", "Decorative emphasis.", "Intentional visual contrast and irony."], materialHints: ["colored laminate", "painted stucco", "patterned surfaces", "decorative stone", "expressive metal details"], formHints: ["exaggerated geometry", "symbolic shapes", "contrasting formal elements"], exclusions: ["strict functionalist austerity", "total minimalism", "purely neutral expression"] },
    { id: "art_deco", name: "Art Deco", nameKo: "아르데코", description: "우아하고 기하학적이며 고급스러운 장식 건축 언어", compilerDirectives: ["Art Deco architectural expression.", "Strong symmetry.", "Vertical emphasis.", "Stepped geometry.", "Refined ornamental rhythm.", "Luxurious but controlled detailing.", "Rich material contrast.", "Elegant geometric decoration."], materialHints: ["brass", "dark timber", "marble", "polished stone", "lacquer", "patterned metal"], formHints: ["stepped forms", "symmetry", "geometric ornament", "vertical rhythm"], exclusions: ["rustic informality", "raw brutal materiality", "soft amorphous organic expression"] },
    { id: "art_nouveau", name: "Art Nouveau", nameKo: "아르누보", description: "유동적이고 식물적이며 수공예적인 건축 언어", compilerDirectives: ["Art Nouveau design language.", "Flowing organic curves.", "Botanical ornamental logic.", "Graceful line movement.", "Integrated decorative structure.", "Handcrafted detailing.", "Sensuous fluid spatial character."], materialHints: ["curved wood", "decorative glass", "patterned ironwork", "ceramic ornament", "natural motifs"], formHints: ["flowing curves", "asymmetrical organic line work", "botanical geometry"], exclusions: ["rigid orthogonal austerity", "heavy industrial bluntness", "total geometric reduction"] },
    { id: "brutalism", name: "Brutalism", nameKo: "브루탈리즘", description: "모놀리식하고 거칠며 구조적으로 직접적인 건축 표현", compilerDirectives: ["Brutalist architectural expression.", "Powerful mass.", "Direct structural presence.", "Exposed concrete.", "Raw material honesty.", "Monolithic geometry.", "Strong shadow definition.", "Minimal decorative treatment.", "Weighty spatial character."], materialHints: ["board-formed concrete", "raw plaster", "dark steel", "rough stone", "heavy timber"], formHints: ["massive geometry", "structural repetition", "deep openings", "heavy planar expression"], exclusions: ["decorative softness", "polished luxury styling", "playful postmodern color logic", "excessive ornament"] },
    { id: "organic", name: "Organic", nameKo: "오가닉", description: "유동적이고 자연 친화적이며 촉각적인 공간 언어", compilerDirectives: ["Organic architectural language.", "Soft flowing geometry.", "Natural spatial continuity.", "Curvilinear transitions.", "Non-rigid form.", "Tactile material presence.", "Nature-associated expression.", "Spatial rhythm inspired by biological growth, erosion or natural formation."], materialHints: ["timber", "natural stone", "clay-like finishes", "tactile plaster", "textured organic surfaces"], formHints: ["curved transitions", "irregular geometry", "softened corners", "flowing spatial sequence"], exclusions: ["strict orthogonal repetition", "overly mechanical expression", "rigid diagrammatic symmetry"] },
  ];
  const representationPresetById = Object.fromEntries(REPRESENTATION_PRESETS.map((preset) => [preset.id, preset]));
  const designStylePresetById = Object.fromEntries(DESIGN_STYLE_PRESETS.map((preset) => [preset.id, preset]));

  function defaultRepresentation() {
    return {
      global: {
        content: {
          subject: attr("Refined contemporary dining interior", "controlled", "user", 100),
          geometry: attr("existing room geometry", "locked", "system", 100),
          majorLayout: attr("existing major layout", "locked", "system", 100),
          composition: attr("balanced interior composition", "locked", "system", 80),
          furniture: attr("coordinated dining furniture", "controlled", "system", 60),
        },
        appearance: {
          medium: attr("architectural visualization", "controlled", "system", 70),
          palette: attr("warm neutral", "controlled", "system", 65),
          detailDensity: attr("medium", "controlled", "system", 60),
          texture: attr("natural material texture", "controlled", "system", 60),
          lightingCharacter: attr("soft warm interior illumination", "controlled", "system", 65),
          atmosphere: attr("quiet and refined", "controlled", "system", 60),
          surfaceCharacter: attr("restrained matte surfaces", "controlled", "system", 65),
        },
        camera: {
          sensor: attr("Full Frame", "controlled", "system"),
          focalLengthMm: attr(35, "controlled", "system"),
          cameraHeightMm: attr(1500, "controlled", "system"),
          pitchDeg: attr(0, "controlled", "system"),
          yawDeg: attr(0, "controlled", "system"),
          rollDeg: attr(0, "controlled", "system"),
          verticalShift: attr(0, "controlled", "system"),
          aperture: attr(8, "free", "system"),
          focusDistanceM: attr(5, "free", "system"),
          aspectRatio: attr("4:3", "controlled", "system"),
          perspectiveCorrection: attr(true, "controlled", "system"),
        },
        lighting: {
          colorTemperatureK: attr(3000, "controlled", "system"),
          exposureEV: attr(0.2, "controlled", "system"),
          softness: attr(70, "controlled", "system"),
          contrast: attr(45, "controlled", "system"),
          ambientLevel: attr(35, "controlled", "system"),
          artificialLevel: attr(65, "controlled", "system"),
          direction: attr("Mixed", "controlled", "system"),
        },
        material: {
          primary: attr("pale oak", "controlled", "system", 70),
          secondary: attr("lime plaster", "controlled", "system", 60),
          finish: attr("matte", "controlled", "system", 70),
        },
        output: {
          representationPreset: attr("photoreal_actual", "controlled", "preset", 80),
          designStylePreset: attr("none", "controlled", "preset", 70),
          userExclusions: attr("", "controlled", "user", 100),
        },
      },
      regions: [],
    };
  }

  function ensureOutputState(representation) {
    if (!representation.global.output) representation.global.output = clone(defaultRepresentation().global.output);
    return representation;
  }

  const templateConfigs = [
    {
      id: "interior-refine", title: "인테리어 리파인", purpose: "기존 인테리어 방향을 보존하며 재료·조명·분위기를 정교화합니다.",
      nodes: ["imageInput", "representation", "camera", "lighting", "material", "generator", "compare"],
      recommended: ["35mm · Full Frame · 높이 1500mm", "Pitch 0° · Perspective correction ON", "3000K · Exposure +0.2 · Softness 70"],
      locked: ["geometry", "major layout", "camera position", "composition"], editable: ["materials", "lighting", "atmosphere", "furniture", "surface character"],
    },
    {
      id: "alt-exploration", title: "대안 탐색", purpose: "형상과 카메라는 보존하고 여러 표현 변수를 함께 바꾼 대안을 만듭니다.",
      nodes: ["imageInput", "representation", "altBuilder", "generator", "compare"],
      recommended: ["Alternatives 4", "Targets: material, palette, lighting, atmosphere", "Variation scope: coordinated"],
      locked: ["geometry", "camera", "major layout"], editable: ["materials", "palette", "lighting", "atmosphere", "furniture expression", "visual density"],
    },
    {
      id: "furniture-swap", title: "가구 교체", purpose: "선택한 가구만 지역 마스크 안에서 교체하거나 재료·색·형태를 수정합니다.",
      nodes: ["imageInput", "regionMask", "regionEdit", "generator", "compare"],
      recommended: ["Operation: Replace", "Region position/scale/orientation locked", "Outside mask unchanged"],
      locked: ["global camera", "global geometry", "global lighting", "composition"], editable: ["region material", "region color", "region form"],
    },
    {
      id: "camera-study", title: "카메라 연구", purpose: "카메라 초점거리만 OFAT 방식으로 비교합니다.",
      nodes: ["imageInput", "camera", "ofat", "generator", "compare"],
      recommended: ["Focal length: 24 / 35 / 50 / 85mm", "Full Frame sensor", "Unrelated state unchanged"],
      locked: ["lighting", "materials", "geometry", "atmosphere"], editable: ["focal length"],
    },
    {
      id: "lighting-study", title: "조명 연구", purpose: "색온도 또는 부드러움을 하나씩 변화시켜 조명 반응을 비교합니다.",
      nodes: ["imageInput", "lighting", "ofat", "generator", "compare"],
      recommended: ["CCT: 2700 / 3000 / 4000 / 5500K", "or Softness: 20 / 45 / 70 / 95", "Unrelated state unchanged"],
      locked: ["camera", "materials", "geometry", "composition"], editable: ["color temperature", "softness"],
    },
    {
      id: "reference-mix", title: "레퍼런스 믹스", purpose: "각 레퍼런스에서 선택한 속성만 하나의 표현 상태로 병합합니다.",
      nodes: ["referenceInput", "referenceAnalyzer", "attributeSelector", "representation", "generator", "compare"],
      recommended: ["Reference A → lighting", "Reference B → material", "Reference C → palette", "Reference D → atmosphere"],
      locked: ["target content", "room geometry"], editable: ["transfer selections", "attribute strengths"],
    },
  ];

  const moduleConfigs = {
    "alt-exploration": { title: "대안 탐색", category: "Explore", nodes: ["representation", "altBuilder", "generator", "compare"], inputs: ["기본 이미지", "기본 표현 상태"], outputs: ["대안 결과", "비교 세트"] },
    "reference-mix": { title: "레퍼런스 믹스", category: "Explore", nodes: ["referenceInput", "referenceAnalyzer", "attributeSelector", "representation"], inputs: ["레퍼런스 이미지", "대상 상태"], outputs: ["병합된 표현 상태"] },
    "furniture-swap": { title: "가구 교체", category: "Edit", nodes: ["regionMask", "regionEdit", "generator", "compare"], inputs: ["소스 이미지", "기본 상태", "선택 영역"], outputs: ["편집 이미지", "새 실험 스냅샷"] },
    "region-edit": { title: "영역 편집", category: "Edit", nodes: ["regionMask", "regionEdit", "generator"], inputs: ["소스 이미지", "선택 영역"], outputs: ["편집 이미지"] },
    "camera-study": { title: "카메라 연구", category: "Study", nodes: ["camera", "ofat", "generator", "compare"], inputs: ["기본 이미지", "기본 표현 상태"], outputs: ["생성 결과", "비교 세트"] },
    "lighting-study": { title: "조명 연구", category: "Study", nodes: ["lighting", "ofat", "generator", "compare"], inputs: ["기본 이미지", "기본 표현 상태"], outputs: ["생성 결과", "비교 세트"] },
  };

  function makeGraph(nodeTypes, moduleId = null, origin = { x: 120, y: 150 }) {
    const nodes = nodeTypes.map((type, index) => ({ id: uid("node"), type, label: NODE_DEFS[type].label, x: origin.x + index * 224, y: origin.y + (index % 2) * 32, moduleId, settings: defaultNodeSettings(type) }));
    const edges = nodes.slice(0, -1).map((node, index) => ({ id: uid("edge"), from: node.id, to: nodes[index + 1].id, moduleId }));
    return { nodes, edges };
  }

  function defaultNodeSettings(type) {
    if (type === "ofat") return { variable: "global.camera.focalLengthMm", values: "24, 35, 50, 85" };
    if (type === "altBuilder") return { alternatives: 4, scope: "materials, palette, lighting, atmosphere" };
    if (type === "referenceAnalyzer") return { preset: "Warm Nordic Interior", analyzed: [] };
    if (type === "attributeSelector") return { selected: [] };
    return {};
  }

  function applyTemplateState(state, templateId) {
    const g = state.global;
    const lock = (attribute) => { attribute.mode = "locked"; attribute.source = "template"; };
    if (["interior-refine", "alt-exploration", "furniture-swap", "camera-study", "lighting-study"].includes(templateId)) { lock(g.content.geometry); lock(g.content.majorLayout); lock(g.content.composition); }
    if (["interior-refine", "alt-exploration", "furniture-swap", "lighting-study"].includes(templateId)) Object.values(g.camera).forEach(lock);
    if (["furniture-swap", "camera-study"].includes(templateId)) Object.values(g.lighting).forEach(lock);
    if (templateId === "camera-study") { g.camera.focalLengthMm.mode = "controlled"; g.camera.focalLengthMm.source = "template"; }
    if (templateId === "lighting-study") { g.lighting.colorTemperatureK.mode = "controlled"; g.lighting.colorTemperatureK.source = "template"; }
    g.output.representationPreset.value = "photoreal_actual";
    g.output.representationPreset.source = "preset";
    g.output.designStylePreset.value = "none";
    g.output.designStylePreset.source = "preset";
    return state;
  }

  function createProject(templateId = null, name = null) {
    const template = templateConfigs.find((item) => item.id === templateId);
    const initialRepresentation = applyTemplateState(defaultRepresentation(), templateId);
    const graph = globalThis.VRL_GRAPH
      ? globalThis.VRL_GRAPH.createTemplateGraph(templateId || "interior-refine", initialRepresentation)
      : makeGraph(template ? template.nodes : ["imageInput", "representation", "compiler", "generator", "compare"]);
    const preferredNode = graph.nodes.find((node) => node.type === "camera")
      || graph.nodes.find((node) => node.type === "lighting")
      || graph.nodes.find((node) => node.type === "regionMask")
      || graph.nodes.find((node) => node.type === "representation")
      || graph.nodes[0];
    const project = {
      id: uid("project"), name: name || (template ? `${template.title} 프로젝트` : "빈 프로젝트"), templateId,
      createdAt: now(), updatedAt: now(), sourceImage: null, referenceImages: [],
      representation: initialRepresentation, graph,
      experiments: [], selectedExperimentIds: [], selectedNodeId: preferredNode?.id || null,
      selectedNodeIds: [], activeRegionId: null, workspaceMode: globalThis.VRL_GRAPH ? "system" : "image", debug: false,
      execution: globalThis.VRL_AI?.defaultProjectExecution?.() || { useGlobalDefaults: true, generationModel: null, editModel: null, referenceModel: null, generatorOverrides: {}, aspectRatio: "4:3", quality: "high", count: 1 },
      engineSetupDismissed: false,
    };
    if (globalThis.VRL_GRAPH) syncGraphState(project);
    return project;
  }

  let store = { projects: [], activeProjectId: null };
  let customModules = [];
  let aiSettings = globalThis.VRL_AI?.defaultSettings?.() || { generationModel: null, editModel: null, referenceModel: null, mockExplicit: false };
  let providerStatuses = { openai: "not_connected", google: "not_connected", mock: "connected" };
  const modelRouter = globalThis.VRL_AI ? new globalThis.VRL_AI.ModelRouter() : null;
  let generationRuntime = { stage: null, error: null };
  let route = "landing";
  let selectedTemplateId = templateConfigs[0].id;
  let landingDetailOpen = false;
  let maskRuntime = { tool: "brush", size: 28, opacity: 0.55, visible: true, drawing: false, canvas: null, ctx: null };

  function activeProject() { return store.projects.find((project) => project.id === store.activeProjectId) || null; }
  function ensureExecutionState(project) {
    if (!project.execution) project.execution = globalThis.VRL_AI?.defaultProjectExecution?.() || { useGlobalDefaults: true, generationModel: null, editModel: null, referenceModel: null, generatorOverrides: {}, aspectRatio: "4:3", quality: "high", count: 1 };
    project.execution.generatorOverrides ||= {};
    project.execution.aspectRatio ||= "4:3";
    project.execution.quality ||= "high";
    project.execution.count ||= 1;
    return project.execution;
  }
  function selectedGenerator(project) { return project.graph.nodes.find((node) => node.id === project.selectedNodeId && ["generator", "generate"].includes(node.type)) || project.graph.nodes.find((node) => ["generator", "generate"].includes(node.type)) || null; }
  function providerName(id) { return globalThis.VRL_AI?.providers?.find((provider) => provider.id === id)?.name || String(id || "—").toUpperCase(); }
  function modelName(id) { return globalThis.VRL_AI?.modelById?.[id]?.name || id || "모델 미선택"; }
  function effectiveSelection(project, capability = "generation", nodeId = null) { return globalThis.VRL_AI?.selectionFor?.(capability, aiSettings, ensureExecutionState(project), nodeId) || null; }
  async function refreshProviderStatuses(rerender = false) {
    if (typeof location === "undefined" || !/^https?:$/.test(location.protocol)) return providerStatuses;
    try { const response = await fetch("/api/ai/status", { cache: "no-store" }); const payload = await response.json(); if (response.ok) providerStatuses = { ...providerStatuses, ...payload.providers }; }
    catch { providerStatuses = { ...providerStatuses, openai: "unavailable", google: "unavailable" }; }
    if (rerender && route === "workspace") renderWorkspace();
    return providerStatuses;
  }
  function load() {
    try { store = JSON.parse(localStorage.getItem(STORAGE_KEY)) || store; } catch { store = { projects: [], activeProjectId: null }; }
    try { customModules = JSON.parse(localStorage.getItem(MODULE_KEY)) || []; } catch { customModules = []; }
    try { aiSettings = { ...(globalThis.VRL_AI?.defaultSettings?.() || aiSettings), ...(JSON.parse(localStorage.getItem(AI_SETTINGS_KEY)) || {}) }; } catch { aiSettings = globalThis.VRL_AI?.defaultSettings?.() || aiSettings; }
    const oldModuleTitles = { "Alt Exploration": "대안 탐색", "Reference Mix": "레퍼런스 믹스", "Furniture Swap": "가구 교체", "Region Edit": "영역 편집", "Camera Study": "카메라 연구", "Lighting Study": "조명 연구" };
    store.projects.forEach((project) => {
      if (project.name === "Blank Project") project.name = "빈 프로젝트";
      ensureOutputState(project.representation);
      ensureExecutionState(project);
      if (globalThis.VRL_GRAPH) {
        globalThis.VRL_GRAPH.migrateGraphV1(project);
        syncGraphState(project);
      }
      if (project.workspaceMode === "graph") project.workspaceMode = "system";
      if (!["image", "system", "compare", "region", "design", "models"].includes(project.workspaceMode)) project.workspaceMode = globalThis.VRL_GRAPH ? "system" : "image";
      project.graph?.nodes?.forEach((node) => { if (NODE_DEFS[node.type]) node.label = NODE_DEFS[node.type].label; if (oldModuleTitles[node.moduleTitle]) node.moduleTitle = oldModuleTitles[node.moduleTitle]; });
    });
    customModules.forEach((module) => { if (oldModuleTitles[module.title]) module.title = oldModuleTitles[module.title]; module.nodes?.forEach((node) => { if (NODE_DEFS[node.type]) node.label = NODE_DEFS[node.type].label; }); });
    if (store.activeProjectId && activeProject()) route = "workspace";
  }
  function save(message = null) {
    const project = activeProject(); if (project) project.updatedAt = now();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); localStorage.setItem(MODULE_KEY, JSON.stringify(customModules)); localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(aiSettings)); if (message) toast(message); }
    catch (error) { toast("저장 공간이 부족합니다. 큰 이미지를 제거하세요."); console.error(error); }
  }

  function sensorWidth(sensor) { return ({ "Full Frame": 36, "APS-C": 23.6, "Micro Four Thirds": 17.3 })[sensor] || 36; }
  function horizontalFovDeg(camera) {
    const width = sensorWidth(camera.sensor.value);
    return +(2 * Math.atan(width / (2 * camera.focalLengthMm.value)) * 180 / Math.PI).toFixed(1);
  }
  function focalFromFov(sensor, fov) { return +(sensorWidth(sensor) / (2 * Math.tan(fov * Math.PI / 360))).toFixed(1); }

  function translateCamera(camera) {
    const focal = camera.focalLengthMm.value;
    const view = focal <= 24 ? "strongly wide interior architectural view" : focal <= 35 ? "natural moderately wide interior architectural view" : focal <= 55 ? "natural interior perspective" : "compressed interior perspective with narrow field of view";
    const height = camera.cameraHeightMm.value < 1200 ? "low camera height" : camera.cameraHeightMm.value > 1750 ? "elevated camera height" : "eye-level camera";
    const pitch = Math.abs(camera.pitchDeg.value) <= 2 ? "camera kept level" : camera.pitchDeg.value > 0 ? "camera pitched upward" : "camera pitched downward";
    const perspective = camera.perspectiveCorrection.value ? "controlled two-point perspective; vertical lines preserved" : "natural perspective convergence allowed";
    return `${view}; ${height}; ${pitch}; ${perspective}; yaw ${camera.yawDeg.value} degrees; roll ${camera.rollDeg.value} degrees; aspect ratio ${camera.aspectRatio.value}.`;
  }

  function translateLighting(lighting) {
    const k = lighting.colorTemperatureK.value;
    const temperature = k < 3200 ? "warm interior illumination" : k < 4200 ? "warm-neutral interior illumination" : k < 5600 ? "neutral daylight-balanced illumination" : "cool daylight illumination";
    const balance = lighting.artificialLevel.value > lighting.ambientLevel.value + 15 ? "artificial lighting is dominant" : lighting.ambientLevel.value > lighting.artificialLevel.value + 15 ? "ambient daylight is dominant" : "ambient and artificial light are balanced";
    const soft = lighting.softness.value > 75 ? "very soft diffused shadows" : lighting.softness.value > 45 ? "moderately soft shadows" : "defined hard-edged shadows";
    return `${temperature}; ${balance}; ${soft}; ${lighting.direction.value.toLowerCase()} light direction; exposure ${lighting.exposureEV.value >= 0 ? "+" : ""}${lighting.exposureEV.value} EV; contrast ${lighting.contrast.value}/100.`;
  }

  function presetInfluence(strength) { return `${intensity(strength)} influence`; }
  function applyOutputPreset(representation, kind, presetId, strength = null) {
    ensureOutputState(representation);
    const key = kind === "representation" ? "representationPreset" : "designStylePreset";
    const selection = representation.global.output[key];
    selection.value = presetId; selection.source = "preset"; selection.mode = "controlled"; selection.enabled = true;
    if (strength !== null) selection.strength = clamp(Number(strength), 0, 100);
    return representation;
  }
  function hasUserControlledMaterial(globalState) { return Object.values(globalState.material).some((a) => a.enabled && a.mode === "controlled" && a.source === "user"); }
  function resolvePresetDirectives(preset, globalState) {
    if (!hasUserControlledMaterial(globalState)) return preset.compilerDirectives;
    const materialTerms = ["concrete", "plaster", "steel", "stone", "timber", "brass", "marble", "wood", "glass", "laminate", "stucco", "lacquer", "ironwork", "ceramic", "clay"];
    return preset.compilerDirectives.filter((directive) => !materialTerms.some((term) => directive.toLowerCase().includes(term)));
  }
  function compilePresetBlock(preset, selection, globalState, includeFormHints = false) {
    if (!preset || preset.id === "none" || !selection.enabled) return "";
    const directives = resolvePresetDirectives(preset, globalState);
    const materialHints = hasUserControlledMaterial(globalState) ? [] : (preset.materialHints || []);
    const formHints = includeFormHints ? (preset.formHints || []) : [];
    return [`Influence: ${presetInfluence(selection.strength)}.`, ...directives, ...(materialHints.length ? [`Recommended material behavior: ${materialHints.join(", ")}.`] : []), ...(formHints.length ? [`Form language: ${formHints.join(", ")}.`] : [])].join(" ");
  }
  function mergeExclusions(...groups) {
    const seen = new Set(), merged = [];
    groups.flat().filter(Boolean).forEach((item) => { const normalized = item.trim().toLowerCase().replace(/[.]+$/, ""); if (!seen.has(normalized)) { seen.add(normalized); merged.push(item.trim().replace(/[.]+$/, "")); } });
    return merged;
  }
  function compileOutput(representation, selectedRegion = null) {
    ensureOutputState(representation);
    const g = representation.global, output = g.output;
    const representationPreset = representationPresetById[output.representationPreset.value] || REPRESENTATION_PRESETS[0];
    const designValue = output.designStylePreset.value;
    const mixedStyles = designValue?.kind === "style-mix" ? designValue.styles.map((id, index) => ({ preset: designStylePresetById[id], weight: designValue.weights?.[index] ?? 0.5 })).filter((item) => item.preset) : [];
    const designPreset = typeof designValue === "string" ? (designStylePresetById[designValue] || DESIGN_STYLE_PRESETS[0]) : DESIGN_STYLE_PRESETS[0];
    const sections = [];
    const enabledText = (record) => Object.entries(record).filter(([, a]) => a.enabled).map(([key, a]) => `${key}: ${a.value} (${intensity(a.strength)} emphasis; source ${a.source})`).join("; ");
    if (g.content.subject.enabled) sections.push({ id: "subject", label: "SUBJECT / CONTENT", text: `${g.content.subject.value}.` });
    sections.push({ id: "spatial-preservation", label: "SPATIAL PRESERVATION", text: enabledText({ geometry: g.content.geometry, majorLayout: g.content.majorLayout, composition: g.content.composition, furniture: g.content.furniture }) + "." });
    sections.push({ id: "representation-preset", label: "REPRESENTATION PRESET", text: compilePresetBlock(representationPreset, output.representationPreset, g) });
    if (mixedStyles.length) sections.push({ id: "design-style-mix", label: "DESIGN STYLE MIX", text: `Explicit Style Mix. ${mixedStyles.map(({ preset, weight }) => `${preset.name}: ${Math.round(weight * 100)}%. ${compilePresetBlock(preset, { ...output.designStylePreset, value: preset.id, strength: Math.round(weight * 100) }, g, true)}`).join(" ")}` });
    else if (designPreset.id !== "none") sections.push({ id: "design-style-preset", label: "DESIGN STYLE PRESET", text: compilePresetBlock(designPreset, output.designStylePreset, g, true) });
    sections.push({ id: "camera", label: "CAMERA", text: translateCamera(g.camera) });
    sections.push({ id: "lighting", label: "LIGHTING", text: translateLighting(g.lighting) });
    sections.push({ id: "materials", label: "MATERIALS", text: enabledText(g.material) + ". Explicit controlled user materials override all preset material hints." });
    sections.push({ id: "atmosphere", label: "ATMOSPHERE / APPEARANCE", text: enabledText(g.appearance) + "." });
    const regions = selectedRegion ? [selectedRegion] : representation.regions;
    regions.forEach((region) => {
      const attrs = Object.entries(region.attributes).filter(([, a]) => a?.enabled).map(([key, a]) => `${key}: ${a.value} (source ${a.source})`).join("; ");
      const preserved = Object.entries(region.preserve).filter(([, value]) => value).map(([key]) => key).join(", ");
      sections.push({ id: `region-${region.id}-target`, label: "REGION TARGET", text: `${region.name} inside the selected mask.` });
      sections.push({ id: `region-${region.id}-change`, label: "REGION CHANGE", text: `${region.operation.toUpperCase()}: ${region.instruction || attrs || "apply the explicitly controlled regional attributes"}. Inherit the global ${representationPreset.name} representation and ${mixedStyles.length ? mixedStyles.map((item) => item.preset.name).join(" + ") : designPreset.name} design language.` });
      sections.push({ id: `region-${region.id}-preserve`, label: "REGION PRESERVE", text: `Preserve exact ${preserved || "surrounding context"}; preserve global output presets, camera and room perspective.` });
      sections.push({ id: `region-${region.id}-outside`, label: "OUTSIDE MASK", text: "Keep all unselected pixels and scene elements visually unchanged." });
    });
    const locked = [];
    walkAttributes(representation.global, (path, a) => { if (a.enabled && a.mode === "locked") locked.push(`${path} (${a.value})`); });
    if (locked.length) sections.push({ id: "preservation-constraints", label: "PRESERVATION CONSTRAINTS", text: `Preserve exactly: ${locked.join(", ")}.` });
    const userExclusions = output.userExclusions.value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
    const exclusions = mergeExclusions(representationPreset.exclusions || [], mixedStyles.length ? mixedStyles.flatMap((item) => item.preset.exclusions || []) : (designPreset.exclusions || []), userExclusions, ["unrepresented objects or styles", "generic aesthetic enhancement terms"]);
    sections.push({ id: "exclusions", label: "EXCLUSIONS", text: `Avoid: ${exclusions.join("; ")}.` });
    return { sections: sections.filter((section) => section.text), prompt: sections.filter((section) => section.text).map((section) => `${section.label}:\n${section.text}`).join("\n\n") };
  }
  function compileGlobal(representation) { return compileOutput(representation); }
  function compileRegionEdit(representation, region) { return region ? compileOutput(representation, region) : null; }

  function evaluateProjectGraph(project, options = {}) {
    if (!globalThis.VRL_GRAPH || project.graph?.version !== 2) return null;
    project.graph.settings ||= {};
    project.graph.settings.baseRepresentation = clone(project.representation);
    const imageNode = project.graph.nodes.find((node) => node.type === "image");
    if (imageNode) imageNode.settings.value = project.sourceImage;
    return globalThis.VRL_GRAPH.evaluateProjectGraph(project, { compile: compileGlobal, ...options });
  }

  function syncGraphState(project, options = {}) {
    const evaluation = evaluateProjectGraph(project, options);
    if (evaluation?.representationState) project.representation = ensureOutputState(clone(evaluation.representationState));
    project.graphEvaluation = evaluation ? {
      graphVersion: evaluation.graphVersion,
      generatorNodeId: evaluation.generatorNodeId,
      diagnostics: clone(evaluation.diagnostics),
      provenance: clone(evaluation.provenance),
      compiledInstruction: clone(evaluation.compiledInstruction),
      variantCount: evaluation.variants.length,
    } : null;
    return evaluation;
  }

  function walkAttributes(object, callback, prefix = "") {
    Object.entries(object).forEach(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === "object" && "value" in value && "mode" in value) callback(path, value);
      else if (value && typeof value === "object" && !Array.isArray(value)) walkAttributes(value, callback, path);
    });
  }

  function flattenState(representation) {
    const flat = {};
    walkAttributes(representation.global, (path, value) => { flat[`global.${path}`] = clone(value); });
    representation.regions.forEach((region) => {
      Object.entries(region).forEach(([key, value]) => {
        if (key === "maskDataUrl" || key === "referenceImages") return;
        if (key === "attributes") Object.entries(value).forEach(([attrKey, attrValue]) => { flat[`regions.${region.id}.attributes.${attrKey}`] = clone(attrValue); });
        else if (key === "preserve") Object.entries(value).forEach(([preserveKey, preserveValue]) => { flat[`regions.${region.id}.preserve.${preserveKey}`] = preserveValue; });
        else if (typeof value !== "object") flat[`regions.${region.id}.${key}`] = value;
      });
    });
    return flat;
  }

  function diffRepresentations(before, after) {
    const a = flattenState(before), b = flattenState(after), keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].filter((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key])).map((key) => ({ path: key, before: a[key], after: b[key] }));
  }

  function diffPrompts(before, after) {
    const ids = new Set([...before.sections.map((s) => s.id), ...after.sections.map((s) => s.id)]);
    return [...ids].map((id) => ({ id, before: before.sections.find((s) => s.id === id)?.text || "", after: after.sections.find((s) => s.id === id)?.text || "" })).filter((item) => item.before !== item.after);
  }

  function hash(text) { let value = 0; for (let i = 0; i < text.length; i++) value = ((value << 5) - value + text.charCodeAt(i)) | 0; return Math.abs(value); }
  function mockInteriorImage(representation, prompt, region = null) {
    const h = hash(prompt + "vrl-v02-fixed-seed");
    const g = representation.global, focal = g.camera.focalLengthMm.value, detail = g.appearance.detailDensity.strength;
    const wall = g.appearance.palette.value.includes("warm") ? "#d8cdbd" : g.appearance.palette.value.includes("cool") ? "#c7d0d0" : "#d6d5cf";
    const wood = region?.attributes?.material?.value?.includes("metal") ? "#aeb3b4" : g.material.primary.value.includes("dark") ? "#503c2e" : "#a47c50";
    const perspective = clamp((85 - focal) / 80, .1, .8);
    const lines = Array.from({ length: Math.max(3, Math.round(detail / 12)) }, (_, i) => `<line x1="${80 + i * 45}" y1="310" x2="${120 + i * 36}" y2="180" stroke="#564d42" opacity=".18"/>`).join("");
    const regionMark = region ? `<rect x="202" y="235" width="145" height="16" rx="2" fill="${wood}" stroke="#333"/><text x="205" y="226" font-family="monospace" font-size="9" fill="#8a2b22">REGION EDIT · ${esc(region.name)}</text>` : `<rect x="202" y="235" width="145" height="16" rx="2" fill="${wood}"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="400"><rect width="560" height="400" fill="#eeeae1"/><path d="M50 55 L${270 - perspective * 70} 105 L510 55 V335 H50Z" fill="${wall}" stroke="#5c5b56"/><path d="M50 335 L${270 - perspective * 70} 285 L510 335 L560 400 H0Z" fill="#b9afa1"/>${lines}<rect x="105" y="115" width="115" height="150" fill="#b8ccce" stroke="#59676a"/><line x1="162" y1="115" x2="162" y2="265" stroke="#59676a"/>${regionMark}<path d="M220 251v72m110-72v72m-85-72v72m60-72v72" stroke="#473c33" stroke-width="4"/><circle cx="225" cy="270" r="18" fill="#64584f"/><circle cx="330" cy="270" r="18" fill="#64584f"/><text x="18" y="26" font-family="monospace" font-size="11" fill="#424741">MOCK INTERIOR · ${focal}MM · ${g.lighting.colorTemperatureK.value}K</text><text x="18" y="382" font-family="monospace" font-size="9" fill="#696d67">deterministic state visualization · ${h.toString(16).slice(0, 6)}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  class MockImageProvider {
    constructor() { this.name = "mock"; }
    async generate({ representation, instruction }) { return [{ id: uid("image"), url: mockInteriorImage(representation, instruction.prompt), alt: "Deterministic mock interior result" }]; }
  }
  class MockImageEditProvider {
    constructor() { this.name = "mock-edit"; }
    async edit({ representation, region, instruction }) { return [{ id: uid("image"), url: mockInteriorImage(representation, instruction.prompt, region), alt: "Deterministic mock region edit result" }]; }
  }

  function imageAsset(value, name = "image") {
    if (!value) return null;
    const mimeType = String(value).match(/^data:([^;,]+)/)?.[1] || "image/png";
    return String(value).startsWith("data:") ? { dataUrl: value, mimeType, name } : { url: value, mimeType, name };
  }
  function routingCapability(project, region = null) {
    if (region?.maskDataUrl) return "maskEditing";
    if (region) return "editing";
    if (project.referenceImages.length) return "imageInput";
    return "generation";
  }
  function resolveExecution(project, region = null, developmentFallback = false) {
    const capability = routingCapability(project, region), generator = selectedGenerator(project);
    const settings = developmentFallback && !effectiveSelection(project, capability, generator?.id)
      ? { ...aiSettings, generationModel: { providerId: "mock", modelId: "mock-image-v1" }, editModel: { providerId: "mock", modelId: "mock-image-v1" }, referenceModel: { providerId: "mock", modelId: "mock-image-v1" }, mockExplicit: true }
      : aiSettings;
    if (!modelRouter) return { provider: { id: "mock", name: "MOCK" }, model: { id: "mock-image-v1", name: "Mock Image v1" }, selection: { providerId: "mock", modelId: "mock-image-v1" }, settings, capability };
    return { ...modelRouter.resolve({ capability, globalSettings: settings, projectExecution: ensureExecutionState(project), nodeId: generator?.id, statuses: providerStatuses }), settings, capability };
  }
  function updateGenerationStage(stage, detail = "") {
    generationRuntime.stage = stage; generationRuntime.error = null;
    const element = appEl.querySelector?.("#generationStage");
    if (element) element.innerHTML = `<b>${esc(stage)}</b><span>${esc(detail)}</span><i></i>`;
  }

  async function createExperiment(project, representation, name, parentExperimentId = null, region = null, strictRouting = false, graphEvaluation = null) {
    const canonicalRepresentation = graphEvaluation?.representationState || representation;
    const instruction = region ? compileRegionEdit(canonicalRepresentation, region) : (graphEvaluation?.compiledInstruction || compileGlobal(canonicalRepresentation));
    const routed = resolveExecution(project, region, !strictRouting), operation = region ? "edit" : "generation";
    updateGenerationStage("ROUTING MODEL", `${providerName(routed.provider.id)} / ${routed.model.name}`);
    let images;
    if (routed.provider.id === "mock") {
      const provider = region ? new MockImageEditProvider() : new MockImageProvider();
      images = region ? await provider.edit({ sourceImage: project.sourceImage, mask: region.maskDataUrl, representation: canonicalRepresentation, region, instruction, references: region.referenceImages }) : await provider.generate({ representation: canonicalRepresentation, instruction });
      images = images.map((image) => ({ ...image, mimeType: "image/svg+xml", providerId: "mock", modelId: "mock-image-v1", createdAt: now() }));
    } else {
      updateGenerationStage("GENERATING", `${providerName(routed.provider.id)} / ${routed.model.name}`);
      const request = {
        representationState: canonicalRepresentation, compiledInstruction: instruction.prompt,
        sourceImage: imageAsset(project.sourceImage, "source"), mask: imageAsset(region?.maskDataUrl, "mask"),
        references: (region?.referenceImages || project.referenceImages).map((value, index) => imageAsset(value, `reference-${index + 1}`)).filter(Boolean),
        aspectRatio: ensureExecutionState(project).aspectRatio, quality: ensureExecutionState(project).quality, count: ensureExecutionState(project).count,
        regionState: region || undefined, metadata: { projectId: project.id, nodeId: selectedGenerator(project)?.id },
      };
      const result = await modelRouter.execute({ capability: routed.capability, operation, globalSettings: routed.settings, projectExecution: ensureExecutionState(project), nodeId: selectedGenerator(project)?.id, statuses: providerStatuses, request });
      images = (result.images || []).map((image) => ({ ...image, url: image.dataUrl || image.url, alt: `${providerName(image.providerId)} ${modelName(image.modelId)} result` }));
      if (!images.length) throw new globalThis.VRL_AI.RouterError("UNKNOWN", "Provider returned no image output.");
    }
    const previous = parentExperimentId ? project.experiments.find((item) => item.id === parentExperimentId) : project.experiments[0];
    const delta = previous ? diffRepresentations(previous.representationState, canonicalRepresentation) : [];
    const changed = delta.map((item) => item.path);
    return {
      id: uid("experiment"), name, timestamp: now(), parentExperimentId: previous?.id || null,
      sourceImages: { base: project.sourceImage, references: clone(project.referenceImages), mask: region?.maskDataUrl || null },
      representationState: clone(canonicalRepresentation), regionStates: clone(canonicalRepresentation.regions), graphSnapshot: clone(project.graph),
      graphProvenance: clone(graphEvaluation?.provenance || {}), generatorNodeId: graphEvaluation?.generatorNodeId || selectedGenerator(project)?.id || null,
      changedVariables: changed, changedValues: delta.map((item) => ({ ...item, source: clone(graphEvaluation?.provenance?.[item.path] || null) })),
      compiledInstruction: instruction, executionState: clone(ensureExecutionState(project)), provider: routed.provider.id, providerId: routed.provider.id, modelId: routed.model.id,
      providerModelVersion: routed.model.id === "gpt-image-2" ? "gpt-image-2" : null,
      generationSettings: { operation, capability: routed.capability, aspectRatio: ensureExecutionState(project).aspectRatio, quality: ensureExecutionState(project).quality, count: ensureExecutionState(project).count },
      generatedImages: images,
      evaluation: { targetFollowed: 3, preserved: 3, controllability: 3, notes: "", failureCause: "" },
    };
  }

  function render() {
    if (route === "landing") renderLanding(); else renderWorkspace();
  }

  function templateRail(templateId) {
    const rails = {
      "interior-refine": ["IMAGE", "CAMERA", "LIGHT", "REP", "GENERATE", "COMPARE"],
      "alt-exploration": ["BASE", "ALT", "GENERATE", "COMPARE"],
      "furniture-swap": ["IMAGE", "MASK", "REGION", "GENERATE", "COMPARE"],
      "camera-study": ["LIST", "ITERATE", "CAMERA", "GENERATE", "COMPARE"],
      "lighting-study": ["LIST", "ITERATE", "LIGHT", "GENERATE", "COMPARE"],
      "reference-mix": ["REF", "ANALYZE", "SELECT", "MERGE"],
    };
    return rails[templateId] || ["STATE A", "STATE B"];
  }
  function templatePreviewImage(templateId) {
    const representation = applyTemplateState(defaultRepresentation(), templateId);
    if (templateId === "camera-study") representation.global.camera.focalLengthMm.value = 50;
    if (templateId === "lighting-study") representation.global.lighting.colorTemperatureK.value = 4000;
    return mockInteriorImage(representation, compileGlobal(representation).prompt);
  }
  function railMarkup(values, label = "VARIABLE") {
    return `<div class="key-rail" aria-label="${esc(label)}"><div class="key-rail-line">${values.map((value, index) => `<span class="${index === 1 ? "active" : ""}"><i></i>${esc(value)}</span>`).join("")}</div></div>`;
  }

  function renderLanding() {
    const selected = templateConfigs.find((item) => item.id === selectedTemplateId) || templateConfigs[0];
    if (landingDetailOpen) {
      const index = templateConfigs.findIndex((item) => item.id === selected.id);
      appEl.innerHTML = `<main class="template-page"><header class="template-page-head"><button class="text-action" data-action="close-template">← 워크플로</button><span class="sequence">${String(index + 1).padStart(2, "0")} / ${String(templateConfigs.length).padStart(2, "0")}</span></header><section class="template-hero"><div class="template-hero-copy"><div class="eyebrow">WORKFLOW MODULE</div><h1>${esc(selected.title)}</h1><p>${esc(selected.purpose)}</p>${railMarkup(templateRail(selected.id), selected.title)}</div><figure class="template-hero-visual"><img src="${templatePreviewImage(selected.id)}" alt="${esc(selected.title)} 워크플로 미리보기"><figcaption>REPRESENTATION STATE PREVIEW · MOCK / OFFLINE</figcaption></figure></section><section class="template-spec"><div><div class="eyebrow">CONTROL</div>${selected.editable.map((item) => `<p><span class="state-symbol controlled">●</span>${esc(item)}</p>`).join("")}</div><div><div class="eyebrow">PRESERVE</div>${selected.locked.map((item) => `<p><span class="state-symbol locked">■</span>${esc(item)}</p>`).join("")}</div><div><div class="eyebrow">DEFAULT</div>${selected.recommended.map((item) => `<p>${esc(item)}</p>`).join("")}</div></section><footer class="template-start"><button class="btn secondary" data-action="blank-project">빈 프로젝트</button><button class="btn accent large" data-action="use-template" data-template="${selected.id}">시작 →</button></footer></main>`;
      appEl.querySelector('[data-action="close-template"]')?.addEventListener("click", () => { landingDetailOpen = false; renderLanding(); });
    } else {
      appEl.innerHTML = `<main class="landing"><header class="landing-masthead"><div class="brand-lockup"><span>VRL</span><span>VISUAL<br>REPRESENTATION<br>LAB</span></div><div class="landing-statement"><h1>Build images<br>as systems.</h1><p>이미지를 변수·상태·관계로 설계하고, 무엇이 바뀌었는지 명확히 비교합니다.</p></div><div class="landing-actions">${store.projects.length ? `<button class="text-action" data-action="resume-project">최근 프로젝트 열기 · ${store.projects.length}</button>` : ""}<button class="text-action" data-action="blank-project">＋ 빈 프로젝트</button></div></header><section class="workflow-index"><div class="workflow-index-head"><span class="eyebrow">WORKFLOW INDEX</span><span class="mono">하나의 목적 · 하나의 시작 상태</span></div>${templateConfigs.map((template, index) => `<button class="workflow-index-item" data-template="${template.id}"><span class="workflow-number">${String(index + 1).padStart(2, "0")}</span><div class="workflow-copy"><h2>${esc(template.title)}</h2><p>${esc(template.purpose)}</p>${railMarkup(templateRail(template.id), template.title)}</div><figure><img src="${templatePreviewImage(template.id)}" alt="${esc(template.title)} 미리보기"><figcaption>${esc(template.editable[0])} · ${esc(template.locked[0])}</figcaption></figure><span class="workflow-arrow">→</span></button>`).join("")}</section></main>`;
    }
    applyKoreanUi(appEl);
    appEl.querySelectorAll("[data-template]").forEach((el) => el.addEventListener("click", (event) => { if (event.currentTarget.dataset.action === "use-template") return; selectedTemplateId = event.currentTarget.dataset.template; landingDetailOpen = true; renderLanding(); }));
    appEl.querySelector('[data-action="blank-project"]')?.addEventListener("click", () => startProject(null));
    appEl.querySelector('[data-action="resume-project"]')?.addEventListener("click", () => { store.activeProjectId = store.projects[0]?.id; route = "workspace"; save(); render(); });
    appEl.querySelector('[data-action="use-template"]')?.addEventListener("click", (event) => startProject(event.currentTarget.dataset.template));
  }

  function startProject(templateId) {
    const project = createProject(templateId);
    landingDetailOpen = false; store.projects.unshift(project); store.activeProjectId = project.id; route = "workspace"; save("프로젝트를 생성했습니다."); render();
  }

  function projectStateCounts(project) {
    const counts = { locked: 0, controlled: 0, free: 0 };
    Object.values(project.representation.global).forEach((group) => Object.values(group).forEach((attribute) => { if (attribute?.mode && counts[attribute.mode] !== undefined) counts[attribute.mode] += 1; }));
    return counts;
  }
  function renderProjectSummary(project) {
    ensureOutputState(project.representation); const g = project.representation.global, counts = projectStateCounts(project);
    return `<div class="project-state-summary"><div><b>${g.camera.focalLengthMm.value}<small> mm</small></b><span>${g.lighting.colorTemperatureK.value} K</span></div><div><span>${esc(representationPresetById[g.output.representationPreset.value]?.nameKo || "표현")}</span><span>${esc(designStylePresetById[g.output.designStylePreset.value]?.nameKo || "스타일 없음")}</span></div><div class="state-counts"><span>■ ${counts.locked} 잠금</span><span>● ${counts.controlled} 제어</span><span>○ ${counts.free} 자유</span></div></div>`;
  }
  function modelOptions(capability, selection) {
    return (globalThis.VRL_AI?.compatibleModels?.(capability) || []).map((model) => `<option value="${model.providerId}/${model.id}" ${selection?.modelId === model.id ? "selected" : ""}>${providerName(model.providerId)} / ${esc(model.name)}${model.providerId !== "mock" && providerStatuses[model.providerId] !== "connected" ? " · 연결 필요" : ""}</option>`).join("");
  }
  function renderGenerationRuntime() {
    if (generationRuntime.stage) return `<div class="generation-state" id="generationStage"><b>${esc(generationRuntime.stage)}</b><span>표현 상태와 실행 모델을 보존합니다.</span><i></i></div>`;
    if (generationRuntime.error) {
      const recommendations = generationRuntime.error.details?.recommendations || generationRuntime.error.details?.compatibleModels || [];
      return `<div class="generation-error"><div class="eyebrow">GENERATION FAILED · ${esc(generationRuntime.error.code)}</div><h3>${esc(generationRuntime.error.message)}</h3><p>Representation State와 실험 설정은 보존되었습니다.</p>${recommendations.length ? `<p class="mono">호환 모델: ${recommendations.map((item) => esc(item.name || item)).join(" · ")}</p>` : ""}<div class="row"><button class="btn secondary small" data-action="manage-models">연결 관리</button><button class="btn small" data-action="dismiss-error">닫기</button></div></div>`;
    }
    return "";
  }

  function renderWorkspace() {
    const project = activeProject();
    if (!project) { route = "landing"; render(); return; }
    if (project.graph?.version === 2) syncGraphState(project);
    ensureExecutionState(project); const mode = project.workspaceMode || "image"; const selection = effectiveSelection(project, "generation", selectedGenerator(project)?.id);
    const inspector = mode === "compare" ? renderDeltaInspector(project) : mode === "models" ? renderProjectRoutingInspector(project) : mode === "design" ? renderDesignSystemInspector(project) : renderInspector(project);
    const topbar = mode === "region" ? `<header class="topbar region-topbar"><button class="text-action" data-view-mode="image">← 이미지</button><div><span class="eyebrow">REGION EDIT</span><b>${esc(project.representation.regions.find((region) => region.id === project.activeRegionId)?.name || "새 영역")}</b></div><button class="btn accent small" data-action="image-done">완료</button></header>` : `<header class="topbar"><div class="topbar-left"><button class="vrl-mark" data-action="home">VRL</button><input class="project-name" id="projectName" value="${esc(project.name)}" aria-label="프로젝트 이름"><span class="project-context">${project.templateId ? esc(templateConfigs.find((t) => t.id === project.templateId)?.title || "워크플로") : "자유 구성"}</span></div><nav class="mode-nav" aria-label="작업 공간 모드">${[["image","IMAGE"],["system","SYSTEM"],["compare","COMPARE"]].map(([id,label]) => `<button data-view-mode="${id}" class="${mode === id ? "active" : ""}">${label}</button>`).join("")}</nav><div class="topbar-right"><button class="model-status ${selection?.providerId === "mock" ? "offline" : ""}" data-action="manage-models"><span>${selection ? providerName(selection.providerId) : "AI MODELS"}</span><b>${selection ? modelName(selection.modelId) : "연결 필요"}</b></button><button class="btn accent generate-button" data-action="generate">생성 →</button></div></header>`;
    const showResults = ["image", "system"].includes(mode);
    appEl.innerHTML = `<div class="workspace mode-${mode} ${showResults ? "has-history" : ""}">${topbar}<div class="workspace-main"><aside class="library">${renderLibrary(project)}</aside>${renderCenterWorkspace(project)}<aside class="inspector" id="inspector">${inspector}</aside></div>${showResults ? `<section class="results-drawer">${renderResults(project)}</section>` : ""}${renderGenerationRuntime()}</div>`;
    applyKoreanUi(appEl);
    bindWorkspace(project);
  }

  function renderCenterWorkspace(project) {
    if (project.workspaceMode === "image") return renderImageWorkspace(project);
    if (project.workspaceMode === "compare") return renderCompareWorkspace(project);
    if (project.workspaceMode === "region") return renderRegionWorkspace(project);
    if (project.workspaceMode === "models") return renderAIModels(project);
    if (project.workspaceMode === "design") return renderDesignSystemPage();
    return `<section class="graph-shell"><div class="graph-canvas" id="graphCanvas"><div class="graph-toolbar">${project.graphStack?.length ? `<button class="text-action" data-action="close-cluster">← 상위 그래프</button>` : ""}<button class="btn secondary small" data-action="add-default-node">＋ 노드</button><button class="btn secondary small" data-action="add-camera-module">＋ 카메라 연구</button><button class="text-action" data-view-mode="design">DESIGN SYSTEM</button><span class="mono">GRAPH v${project.graph.version || 1} · ${project.graph.nodes.length} nodes · ${project.graph.edges.length} wires</span></div>${renderGraph(project)}</div></section>`;
  }

  function renderImageWorkspace(project) {
    const active = project.representation.regions.find((region) => region.id === project.activeRegionId) || null;
    const fallback = mockInteriorImage(project.representation, compileGlobal(project.representation).prompt);
    const image = project.experiments[0]?.generatedImages[0]?.url || project.sourceImage || fallback, camera = project.representation.global.camera.focalLengthMm;
    return `<section class="image-workspace"><div class="image-context"><span class="eyebrow">CURRENT IMAGE</span><span>${project.experiments[0] ? esc(project.experiments[0].name) : project.sourceImage ? "SOURCE" : "REPRESENTATION PREVIEW"}</span></div><figure class="image-stage"><img src="${image}" alt="현재 인테리어 작업 이미지"><button class="object-hotspot" data-action="enter-region" title="테이블 영역 편집"><i></i><span>테이블 선택</span></button></figure><div class="image-variable">${renderVariableRail(14, 135, camera.value, "mm", "FOCAL LENGTH")}</div><div class="image-actions"><button class="text-action" data-focus-type="imageInput">이미지 입력</button><button class="text-action" data-focus-type="camera">카메라</button><button class="text-action" data-focus-type="lighting">조명</button><button class="text-action" data-action="enter-region">영역 편집</button></div>${!project.engineSetupDismissed && !aiSettings.generationModel ? renderEngineSetup() : ""}${active ? `<div class="active-region-note"><span class="state-symbol controlled">●</span>${esc(active.name)} · ${esc(active.operation)}</div>` : ""}</section>`;
  }

  function renderVariableRail(min, max, value, unit, label) {
    const position = clamp(((Number(value) - min) / (max - min)) * 100, 0, 100);
    return `<div class="variable-rail" style="--rail-position:${position}%"><div class="spread"><span class="eyebrow">${esc(label)}</span><b>${esc(value)} <small>${esc(unit)}</small></b></div><div class="variable-track"><span>${min}</span><i><em></em></i><span>${max}</span></div></div>`;
  }
  function renderEngineSetup() {
    return `<div class="engine-setup"><div class="eyebrow">IMAGE ENGINE · FIRST RUN</div><h3>이미지를 어떻게 생성할까요?</h3><div class="engine-options"><button data-use-engine="openai"><b>OPENAI</b><span>GPT Image 2 · 연결 설정</span></button><button data-use-engine="google"><b>GOOGLE</b><span>Gemini Image · 연결 설정</span></button><button data-use-engine="mock"><b>MOCK</b><span>오프라인 테스트로 사용</span></button></div><button class="text-action" data-action="dismiss-engine">나중에 설정</button></div>`;
  }
  function renderRegionWorkspace(project) {
    const fallback = mockInteriorImage(project.representation, compileGlobal(project.representation).prompt);
    return `<section class="region-workspace"><figure class="region-stage"><img src="${project.sourceImage || fallback}" alt="영역 마스크 대상 이미지"><canvas id="imageModeMaskCanvas" width="1200" height="800" style="opacity:${maskRuntime.opacity}"></canvas></figure><div class="mask-toolbar"><button class="tool-button ${maskRuntime.tool === "brush" ? "active" : ""}" data-image-tool="brush">브러시</button><button class="tool-button ${maskRuntime.tool === "eraser" ? "active" : ""}" data-image-tool="eraser">지우개</button><label><span>BRUSH</span><input id="imageBrushSize" type="range" min="5" max="120" value="${maskRuntime.size}"><b>${maskRuntime.size} px</b></label><button class="tool-button" data-action="image-clear">지우기</button></div><p class="region-hint">변경할 대상만 칠하세요. 카메라·조명·주변 환경은 잠금 상태로 유지됩니다.</p></section>`;
  }

  function activeStudy(project) {
    const node = selectedNode(project), lighting = node?.type === "lighting" || node?.settings?.variable?.includes("colorTemperature") || project.templateId === "lighting-study";
    return lighting ? { title: "조명 연구", label: "COLOR TEMPERATURE", path: "global.lighting.colorTemperatureK", values: [2700, 3000, 4000, 5500], unit: "K", preserved: ["카메라", "재료", "형상", "구도"] } : { title: "카메라 연구", label: "FOCAL LENGTH", path: "global.camera.focalLengthMm", values: [24, 35, 50, 85], unit: "MM", preserved: ["카메라 위치", "조명", "재료", "구도"] };
  }
  function compareItems(project, study) {
    const actual = project.experiments.filter((item) => item.generatedImages?.length).slice(0, 4);
    if (actual.length >= 2) return actual.reverse().map((item) => ({ id: item.id, name: item.name, value: pathGet(item.representationState, study.path)?.value ?? "—", image: item.generatedImages[0].url, providerId: item.providerId || item.provider, modelId: item.modelId || "mock-image-v1", actual: true }));
    return study.values.map((value, index) => { const representation = clone(project.representation); pathGet(representation, study.path).value = value; return { id: `preview-${index}`, name: `${study.label} ${value}`, value, image: mockInteriorImage(representation, compileGlobal(representation).prompt), providerId: "mock", modelId: "mock-image-v1", actual: false }; });
  }
  function renderCompareWorkspace(project) {
    const study = activeStudy(project), items = compareItems(project, study);
    return `<section class="compare-workspace"><header class="compare-head"><div><span class="eyebrow">${esc(study.label)}</span><h1>${esc(study.title)}</h1></div><div class="compare-sequence">${study.values.join(" / ")} <small>${study.unit}</small></div></header><div class="contact-sheet">${items.map((item, index) => `<article class="comparison-item ${project.selectedExperimentIds.includes(item.id) ? "selected" : ""}"><button ${item.actual ? `data-select-experiment="${item.id}"` : ""}><span class="sequence">${String(index + 1).padStart(2, "0")}</span><img src="${item.image}" alt="${esc(item.name)}"><div><b>${esc(item.value)} <small>${study.unit}</small></b><span>${providerName(item.providerId)} · ${esc(modelName(item.modelId))}</span></div></button></article>`).join("")}</div><footer class="compare-footer"><b>Δ ${esc(study.label)} ONLY</b><span>${study.preserved.map((item) => `${esc(item)} ■ 잠금`).join(" · ")}</span>${items.some((item) => !item.actual) ? `<button class="btn accent small" data-action="run-study">4개 상태 생성 →</button>` : ""}</footer></section>`;
  }

  function renderAIModels(project) {
    const generation = aiSettings.generationModel, edit = aiSettings.editModel;
    return `<section class="models-page"><header><span class="eyebrow">EXECUTION STATE</span><h1>AI MODELS</h1><p>표현 상태와 분리된 생성·편집 실행 경로를 설정합니다. API 키는 서버의 <code>.env.local</code>에서만 읽습니다.</p></header><section class="provider-list"><div class="section-label"><span>CONNECTED SERVICES</span><span>STATUS / CAPABILITY</span></div>${globalThis.VRL_AI.providers.map((provider, index) => { const status = providerStatuses[provider.id] || "not_connected"; const providerModels = globalThis.VRL_AI.models.filter((model) => model.providerId === provider.id); return `<article class="provider-row"><span class="sequence">${String(index + 1).padStart(2, "0")}</span><div><h2>${esc(provider.name)}</h2><p>${provider.mode === "offline" ? "Development / Offline / Deterministic" : providerModels.map((model) => model.name).join(" · ")}</p></div><div class="connection-status ${status}"><i></i><b>${esc(status.replaceAll("_", " ").toUpperCase())}</b><span>${providerModels.flatMap((model) => Object.entries(model.capabilities).filter(([, enabled]) => enabled).map(([key]) => key)).filter((value, i, all) => all.indexOf(value) === i).join(" · ")}</span></div><button class="text-action" data-test-provider="${provider.id}">${provider.id === "mock" ? "확인" : "연결 테스트"}</button></article>`; }).join("")}</section><section class="routing-settings"><div><span class="eyebrow">DEFAULT ROUTING</span><h2>기본 실행 모델</h2></div><label><span>GENERATE</span><select class="field" id="globalGenerationModel"><option value="">선택하지 않음</option>${modelOptions("generation", generation)}</select></label><label><span>REGION EDIT</span><select class="field" id="globalEditModel"><option value="">선택하지 않음</option>${modelOptions("maskEditing", edit)}</select></label><button class="btn accent" data-action="save-ai-routing">저장</button></section><aside class="credential-note"><b>SERVER-SIDE CREDENTIALS</b><p><code>.env.example</code>을 <code>.env.local</code>로 복사한 뒤 <code>OPENAI_API_KEY</code> 또는 <code>GEMINI_API_KEY</code>를 입력하세요. 키는 프로젝트·브라우저 저장소·실험 스냅샷에 포함되지 않습니다.</p></aside></section>`;
  }
  function renderDesignSystemPage() {
    return `<section class="design-system-page"><header><span class="eyebrow">INTERNAL REFERENCE</span><h1>VRL SYSTEM GRAMMAR</h1><p>VARIABLE · STATE · DELTA · RELATION · MODULE</p></header><section><div class="eyebrow">TYPOGRAPHY</div><div class="type-spec"><span>Display 64</span><h2>Image as system.</h2><span>Project 26</span><h3>Interior Study 01</h3><span>Numeric 48</span><b>35 <small>mm</small></b></div></section><section><div class="eyebrow">STATE</div><div class="state-spec"><span>■ LOCKED</span><span>● CONTROLLED</span><span>○ FREE</span></div></section><section><div class="eyebrow">VARIABLE RAIL</div>${renderVariableRail(24, 85, 35, "mm", "FOCAL LENGTH")}</section><section><div class="eyebrow">MODULE / NODE</div><div class="system-samples"><div class="module-sample"><b>CAMERA STUDY</b>${railMarkup(["24", "35", "50", "85"])}</div><div class="node-sample"><span>CAMERA · 01</span><b>35 mm</b><small>1500 mm / 0°</small></div></div></section></section>`;
  }

  function renderDeltaInspector(project) {
    const study = activeStudy(project), compared = project.selectedExperimentIds.map((id) => project.experiments.find((item) => item.id === id)).filter(Boolean).sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
    let before = study.values[0], after = study.values[1], representationChanges = [];
    if (compared.length === 2) { before = pathGet(compared[0].representationState, study.path)?.value ?? before; after = pathGet(compared[1].representationState, study.path)?.value ?? after; representationChanges = diffRepresentations(compared[0].representationState, compared[1].representationState); }
    const source = compared[1]?.graphProvenance?.[study.path], sourceNode = source ? compared[1]?.graphSnapshot?.nodes?.find((node) => node.id === source.sourceNodeId) : null;
    return `<div class="panel-head"><span class="eyebrow">STATE DELTA</span><h2 class="inspector-title">${esc(study.title)}</h2></div><div class="delta-inspector"><div class="eyebrow">CHANGED</div><div class="delta-value" data-delta-path="${esc(study.path)}"><span>${esc(before)} <small>${study.unit}</small></span><i>→</i><b>${esc(after)} <small>${study.unit}</small></b></div><p>Δ ${esc(study.label)} ONLY</p>${source ? `<div class="execution-row"><span>SOURCE</span><b>${esc(sourceNode?.label || source.sourceNodeId || "graph")}</b></div>` : ""}<div class="eyebrow">PRESERVED</div>${study.preserved.map((item) => `<div class="delta-row"><span>${esc(item)}</span><b>■ 잠금</b></div>`).join("")}<details><summary>전체 상태 보기</summary><pre class="json">${esc(JSON.stringify(representationChanges, null, 2))}</pre></details></div>`;
  }
  function renderProjectRoutingInspector(project) {
    const execution = ensureExecutionState(project), generation = effectiveSelection(project, "generation"), edit = effectiveSelection(project, "maskEditing");
    return `<div class="panel-head"><span class="eyebrow">PROJECT ROUTING</span><h2 class="inspector-title">${esc(project.name)}</h2></div><div class="panel-section"><h3>상속 방식</h3><label class="checkline"><input type="checkbox" id="useGlobalRouting" ${execution.useGlobalDefaults ? "checked" : ""}>전역 기본값 사용</label></div><div class="panel-section"><h3>실행 상태</h3><div class="execution-row"><span>생성</span><b>${generation ? `${providerName(generation.providerId)} / ${modelName(generation.modelId)}` : "미설정"}</b></div><div class="execution-row"><span>영역 편집</span><b>${edit ? `${providerName(edit.providerId)} / ${modelName(edit.modelId)}` : "미설정"}</b></div><p class="mono">Representation State에는 이 정보가 포함되지 않습니다.</p></div>${renderProjectSummary(project)}`;
  }
  function renderDesignSystemInspector(project) { return `<div class="panel-head"><span class="eyebrow">DESIGN TOKENS</span><h2 class="inspector-title">Quiet interface.<br>Expressive state.</h2></div><div class="panel-section">${renderProjectSummary(project)}</div><div class="panel-section"><button class="btn secondary" data-view-mode="system">← 시스템으로 돌아가기</button></div>`; }

  function renderLibrary(project) {
    const modulesByCategory = Object.entries(moduleConfigs).reduce((groups, [id, module]) => { (groups[module.category] ||= []).push({ id, ...module }); return groups; }, {});
    const projectNav = `<div class="panel-head"><span class="eyebrow">PROJECT</span><h2>${esc(project.name)}</h2></div><div class="panel-section project-navigation"><button class="project-nav-item active"><span>00</span><b>BASE STATE</b></button>${project.experiments.slice(0, 4).map((item, index) => `<button class="project-nav-item" data-load-experiment="${item.id}"><span>${String(index + 1).padStart(2, "0")}</span><b>${esc(item.name)}</b></button>`).join("")}</div><div class="panel-section"><h3>CONTEXT</h3>${[["camera","카메라"],["lighting","조명"],["representation","출력"],["generator","생성기"]].filter(([type]) => project.graph.nodes.some((node) => node.type === type)).map(([type,label]) => `<button class="library-item" data-focus-type="${type}"><span>${label}</span><span>→</span></button>`).join("")}</div>`;
    const moduleNav = `<div class="panel-section"><h3>MODULES</h3>${Object.entries(modulesByCategory).map(([category, modules]) => `<div class="library-group"><h4>${esc(CATEGORY_KO[category] || category)}</h4>${modules.map((module) => `<button class="module-summary" data-add-module="${module.id}"><span>${esc(module.title)}</span><b>＋</b><i>${module.id === "camera-study" ? "24 — 35 — 50 — 85" : module.id === "lighting-study" ? "2700 — 3000 — 4000 — 5500" : module.nodes.map((type) => NODE_DEFS[type].label).join(" → ")}</i></button>`).join("")}</div>`).join("")}</div>`;
    if (project.workspaceMode !== "system") return projectNav + moduleNav;
    return `<div class="panel-head"><div class="eyebrow">SYSTEM LIBRARY</div><div class="mono">NODE · RELATION · MODULE</div></div><div class="panel-section"><h3>노드</h3>${Object.entries(NODE_LIBRARY).map(([category, types]) => `<div class="library-group"><h4>${esc(CATEGORY_KO[category] || category)}</h4>${types.map((type) => `<button class="library-item" data-add-node="${type}"><span>${esc(NODE_DEFS[type].label)}</span><span class="plus">＋</span></button>`).join("")}</div>`).join("")}</div>${moduleNav}<div class="panel-section"><h3>사용자 모듈</h3><button class="btn secondary" style="width:100%" data-action="save-module" ${project.selectedNodeIds.length ? "" : "disabled"}>선택 노드를 모듈로 저장</button><div style="margin-top:8px">${customModules.length ? customModules.map((module) => `<button class="module-summary" data-add-custom="${module.id}"><span>${esc(module.title)}</span><b>＋</b><i>노드 ${module.nodes.length}개</i></button>`).join("") : `<div class="mono">연결된 노드를 선택하면 동일한 문법의 사용자 모듈로 저장됩니다.</div>`}</div></div>`;
  }

  function moduleBounds(project, moduleId) {
    const nodes = project.graph.nodes.filter((node) => node.moduleId === moduleId);
    if (!nodes.length) return null;
    const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
    return { x: Math.min(...xs) - 22, y: Math.min(...ys) - 30, width: Math.max(...xs) - Math.min(...xs) + 228, height: Math.max(...ys) - Math.min(...ys) + 148 };
  }

  function graphPortY(node, direction, portId) {
    if (node.kind === "cluster") return node.y + 76;
    const ports = globalThis.VRL_GRAPH.getPorts(node, direction);
    const index = Math.max(0, ports.findIndex((item) => item.id === portId));
    return node.y + 78 + index * 25;
  }

  function graphPortX(node, direction) { return node.x + (direction === "outputs" ? 224 : 0); }

  function renderTypedPorts(node, direction) {
    if (node.kind === "cluster") return "";
    return globalThis.VRL_GRAPH.getPorts(node, direction).map((port) => `<button class="typed-port ${direction === "inputs" ? "input" : "output"}" data-port-node-id="${node.id}" data-port-id="${port.id}" data-port-direction="${direction === "inputs" ? "input" : "output"}" data-value-type="${port.type}" title="${esc(port.type)}${port.domain ? ` · ${esc(port.domain)}` : ""}"><i>${globalThis.VRL_GRAPH.PORT_SYMBOLS[port.type] || "○"}</i><span>${esc(port.label)}</span>${port.required ? `<b>REQ</b>` : ""}</button>`).join("");
  }

  function enumOptionLabel(node, value) {
    if (node.settings.domain === "RepresentationMode") return representationPresetById[value]?.nameKo || value;
    if (node.settings.domain === "DesignStyle") return designStylePresetById[value]?.nameKo || value;
    return value;
  }

  function renderParameterNode(node) {
    const value = node.settings.value, unit = node.settings.unit || "";
    if (node.type === "number") return `<div class="parameter-editor" data-parameter-node="${node.id}"><div class="parameter-value"><input data-parameter-editor="${node.id}" type="number" min="${node.settings.min ?? ""}" max="${node.settings.max ?? ""}" step="${node.settings.step ?? 1}" value="${esc(value)}"><span>${esc(unit)}</span></div><div class="parameter-rail"><span>${node.settings.min ?? ""}</span><input data-parameter-editor="${node.id}" type="range" min="${node.settings.min ?? 0}" max="${node.settings.max ?? 100}" step="${node.settings.step ?? 1}" value="${esc(value)}"><span>${node.settings.max ?? ""}</span></div></div>`;
    if (node.type === "enum") return `<select class="parameter-select" data-parameter-editor="${node.id}">${(node.settings.options || []).map((option) => `<option value="${esc(option)}" ${option === value ? "selected" : ""}>${esc(enumOptionLabel(node, option))}</option>`).join("")}</select>`;
    if (node.type === "list") return `<label class="list-editor"><span>∷ ${Array.isArray(value) ? value.length : 0} ITEMS</span><input data-parameter-editor="${node.id}" value="${esc((value || []).join(", "))}"><b>[${esc((value || []).join(", "))}] ${esc(unit)}</b></label>`;
    if (node.type === "boolean") return `<label class="boolean-editor"><input data-parameter-editor="${node.id}" type="checkbox" ${value ? "checked" : ""}><span>${value ? "TRUE" : "FALSE"}</span></label>`;
    if (node.type === "image") return `<div class="asset-node-state"><b>${value ? "IMAGE ATTACHED" : "IMAGE SOURCE"}</b><span>${value ? "graph asset" : "mock-ready · add in inspector"}</span></div>`;
    return `<input class="parameter-select" data-parameter-editor="${node.id}" value="${esc(value || "")}">`;
  }

  function renderGraphV2(project) {
    const edges = `<svg class="edge-layer typed-edges" viewBox="0 0 1800 1150" preserveAspectRatio="none">${project.graph.edges.map((candidate) => { const edge = globalThis.VRL_GRAPH.normalizedEdge(candidate), a = project.graph.nodes.find((node) => node.id === edge.source.nodeId), b = project.graph.nodes.find((node) => node.id === edge.target.nodeId); if (!a || !b) return ""; const x1 = graphPortX(a, "outputs"), y1 = graphPortY(a, "outputs", edge.source.portId), x2 = graphPortX(b, "inputs"), y2 = graphPortY(b, "inputs", edge.target.portId), bend = Math.max(42, Math.abs(x2 - x1) * .42); return `<path class="edge typed" data-from-node="${a.id}" data-from-port="${edge.source.portId}" data-to-node="${b.id}" data-to-port="${edge.target.portId}" d="M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}"/>`; }).join("")}</svg>`;
    const nodes = project.graph.nodes.map((node) => {
      if (node.kind === "cluster") return `<article class="node typed-node cluster-node ${node.id === project.selectedNodeId ? "active" : ""}" data-node-id="${node.id}" data-node-kind="cluster" data-cluster-type="${esc(node.settings.clusterType)}" style="left:${node.x}px;top:${node.y}px"><div class="node-head"><span class="node-kind">CLUSTER</span><span class="node-title">${esc(node.label)}</span></div><div class="cluster-grammar">LIST → ITERATE → ${node.settings.clusterType === "camera-study" ? "CAMERA OVERRIDE" : "LIGHTING OVERRIDE"} → GENERATE → COMPARE</div><div class="cluster-values">${esc(node.settings.subgraph?.nodes.find((item) => item.type === "list")?.settings.value?.join(" / ") || "")}</div><button class="text-action" data-action="open-cluster" data-cluster-id="${node.id}">내부 그래프 열기 →</button></article>`;
      const inputs = globalThis.VRL_GRAPH.getPorts(node, "inputs"), outputs = globalThis.VRL_GRAPH.getPorts(node, "outputs");
      return `<article class="node typed-node ${node.kind === "parameter" ? "parameter-node" : "component-node"} ${node.id === project.selectedNodeId ? "active" : ""} ${project.selectedNodeIds.includes(node.id) ? "selected" : ""}" data-node-id="${node.id}" data-node-kind="${node.kind}" data-node-type="${node.type}" data-semantic-key="${esc(node.settings.semanticPath || "")}" style="left:${node.x}px;top:${node.y}px"><div class="node-head"><input class="node-check" type="checkbox" ${project.selectedNodeIds.includes(node.id) ? "checked" : ""}><span class="node-kind">${esc(node.kind === "parameter" ? (node.settings.valueType || node.type).toUpperCase() : (NODE_DEFS[node.type]?.category || "COMPONENT").toUpperCase())}</span><span class="node-title">${esc(node.label)}</span></div><div class="typed-node-grid"><div class="typed-port-list inputs">${renderTypedPorts(node, "inputs")}</div><div class="node-body">${node.kind === "parameter" ? renderParameterNode(node) : nodeSummary(project, node)}</div><div class="typed-port-list outputs">${renderTypedPorts(node, "outputs")}</div></div><div class="node-contract">${inputs.length} IN · ${outputs.length} OUT</div></article>`;
    }).join("");
    return `<div class="graph-v2-label"><b>REPRESENTATION DATAFLOW</b><span>CONNECTED INPUT &gt; COMPONENT DEFAULT</span></div>${edges}${nodes}`;
  }

  function renderGraph(project) {
    if (project.graph?.version === 2 && globalThis.VRL_GRAPH) return renderGraphV2(project);
    const modules = [...new Set(project.graph.nodes.map((node) => node.moduleId).filter(Boolean))];
    const groups = modules.map((moduleId) => { const bounds = moduleBounds(project, moduleId); const title = project.graph.nodes.find((n) => n.moduleId === moduleId)?.moduleTitle || "MODULE"; return `<div class="module-group" style="left:${bounds.x}px;top:${bounds.y}px;width:${bounds.width}px;height:${bounds.height}px"><span class="module-label">${esc(title)}</span></div>`; }).join("");
    const edges = `<svg class="edge-layer" viewBox="0 0 1800 1100" preserveAspectRatio="none">${project.graph.edges.map((edge) => { const a = project.graph.nodes.find((n) => n.id === edge.from), b = project.graph.nodes.find((n) => n.id === edge.to); if (!a || !b) return ""; const x1 = a.x + 184, y1 = a.y + 39, x2 = b.x, y2 = b.y + 39, bend = Math.max(40, Math.abs(x2 - x1) * .45); return `<path class="edge ${edge.moduleId ? "module" : ""}" d="M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}"/>`; }).join("")}</svg>`;
    const nodes = project.graph.nodes.map((node) => { const def = NODE_DEFS[node.type] || { category: "Custom", inputs: [], outputs: [] }; const active = node.id === project.selectedNodeId, selected = project.selectedNodeIds.includes(node.id); return `<article class="node ${active ? "active" : ""} ${selected ? "selected" : ""}" data-node-id="${node.id}" data-category="${esc(def.category)}" style="left:${node.x}px;top:${node.y}px"><span class="node-port in" title="${esc(def.inputs.join(", "))}"></span><div class="node-head"><input class="node-check" type="checkbox" ${selected ? "checked" : ""} title="Select for custom module"><span class="node-kind"></span><span class="node-title">${esc(node.label)}</span></div><div class="node-body">${nodeSummary(project, node)}</div><span class="node-port out" title="${esc(def.outputs.join(", "))}"></span></article>`; }).join("");
    return groups + edges + nodes;
  }

  function nodeSummary(project, node) {
    const g = project.representation.global;
    if (node.type === "camera") return `<div class="node-metric"><span>Focal Length</span><strong>${g.camera.focalLengthMm.value} mm</strong></div><div class="node-metric"><span>Height</span><strong>${g.camera.cameraHeightMm.value} mm</strong></div><div class="node-metric"><span>Pitch</span><strong>${g.camera.pitchDeg.value}°</strong></div>`;
    if (node.type === "lighting") return `<div class="node-metric"><span>Temperature</span><strong>${g.lighting.colorTemperatureK.value} K</strong></div><div class="node-metric"><span>Exposure</span><strong>${g.lighting.exposureEV.value >= 0 ? "+" : ""}${g.lighting.exposureEV.value} EV</strong></div><div class="node-metric"><span>Softness</span><strong>${g.lighting.softness.value}</strong></div>`;
    if (node.type === "regionMask") return `${project.representation.regions.length} region(s)<br>independent mask`;
    if (node.type === "regionEdit") return project.activeRegionId ? `active: ${esc(project.representation.regions.find((r) => r.id === project.activeRegionId)?.name || "region")}` : "select or create region";
    if (node.type === "ofat") return `${esc(node.settings.variable?.split(".").pop() || "variable")}<br>${esc(node.settings.values || "")}`;
    if (["generator", "generate"].includes(node.type)) { const selection = effectiveSelection(project, "generation", node.id); return `<div class="node-metric"><span>실행 제공자</span><strong>${providerName(selection?.providerId)}</strong></div><div class="node-metric"><span>모델</span><strong>${esc(modelName(selection?.modelId))}</strong></div><div class="node-flow-line"><i></i></div>`; }
    if (["representation", "compiler", "compile"].includes(node.type)) { ensureOutputState(project.representation); const output = project.representation.global.output; const rep = representationPresetById[output.representationPreset.value]; const styleValue = output.designStylePreset.value; const style = typeof styleValue === "string" ? designStylePresetById[styleValue] : null; return `<div class="node-metric"><span>표현</span><strong>${esc(rep?.nameKo || rep?.name || "—")}</strong></div><div class="node-metric"><span>스타일</span><strong>${esc(style?.nameKo || style?.name || (styleValue?.kind === "style-mix" ? "명시적 스타일 믹스" : "—"))}</strong></div><div class="node-metric"><span>결과</span><strong>${project.experiments.length}</strong></div>`; }
    if (["imageInput", "image"].includes(node.type)) return project.sourceImage ? "source attached" : "no image · mock ready";
    if (node.type === "iterate") return `<div class="node-metric"><span>SERIES</span><strong>${project.graphEvaluation?.variantCount || 0} variants</strong></div><div class="node-flow-line"><i></i></div>`;
    return `${NODE_DEFS[node.type]?.inputs.length || 0} in · ${NODE_DEFS[node.type]?.outputs.length || 0} out`;
  }

  function selectedNode(project) { return project.graph.nodes.find((node) => node.id === project.selectedNodeId) || null; }

  function renderGraphInspector(project, node) {
    const definition = globalThis.VRL_GRAPH.getNodeDef(node.type);
    if (node.kind === "parameter") {
      const semanticPath = node.settings.semanticPath || "일반 그래프 값";
      const displayValue = Array.isArray(node.settings.value) ? `[${node.settings.value.join(", ")}]` : node.settings.value;
      return `<div class="panel-section graph-inspector"><h3>그래프 소스</h3><div class="provenance-value"><b>${esc(displayValue)}</b><span>${esc(node.settings.unit || "")}</span></div><div class="execution-row"><span>의미 경로</span><b>${esc(semanticPath)}</b></div><div class="execution-row"><span>출처</span><b>${esc(node.settings.sourceType || "user")}</b></div><p class="mono">일반 편집은 그래프 노드에서 직접 수행합니다.</p></div>`;
    }
    const incoming = project.graph.edges.map(globalThis.VRL_GRAPH.normalizedEdge);
    const rows = globalThis.VRL_GRAPH.getPorts(node, "inputs").map((input) => {
      const edge = incoming.find((candidate) => candidate.target.nodeId === node.id && candidate.target.portId === input.id);
      const source = edge ? project.graph.nodes.find((candidate) => candidate.id === edge.source.nodeId) : null;
      const provenancePath = Object.entries(project.graphEvaluation?.provenance || {}).find(([, value]) => value.sourceNodeId === source?.id)?.[0];
      return `<div class="graph-input-row" data-source-node-id="${source?.id || ""}"><div><span>${esc(input.label)}</span><small>${esc(input.type)}</small></div><b>${source ? `← ${esc(source.label)}` : `DEFAULT ${esc(input.default ?? "—")}`}</b>${provenancePath ? `<small>${esc(provenancePath)}</small>` : ""}</div>`;
    }).join("");
    const compiled = node.type === "compile" ? `<details><summary>컴파일 지시 보기</summary><pre class="json">${esc(project.graphEvaluation?.compiledInstruction?.prompt || compileGlobal(project.representation).prompt)}</pre></details>` : "";
    const execution = node.type === "generate" ? renderGeneratorInspector(project, node) : "";
    return `<div class="panel-section graph-inspector"><h3>CURRENT INPUT</h3>${rows || `<div class="empty">입력 포트 없음</div>`}<p class="mono">연결된 input이 component default보다 우선합니다. 의미 값은 이 Inspector에서 복제 편집하지 않습니다.</p>${compiled}</div>${execution}`;
  }

  function renderInspector(project) {
    const node = selectedNode(project);
    if (!node) return `<div class="panel-head"><div class="eyebrow">CONTEXT INSPECTOR</div><h2 class="inspector-title">현재 작업을 선택하세요.</h2></div><div class="panel-section">${renderProjectSummary(project)}</div>`;
    const def = NODE_DEFS[node.type] || { category: "Custom", inputs: [], outputs: [] };
    if (project.graph?.version === 2 && globalThis.VRL_GRAPH && node.kind !== "cluster") {
      const graphBody = renderGraphInspector(project, node);
      const graphDef = globalThis.VRL_GRAPH.getNodeDef(node.type);
      return `<div class="panel-head"><div class="spread"><div><div class="eyebrow">GRAPH PROVENANCE</div><h2 class="inspector-title">${esc(node.label)}</h2><div class="inspector-type">${esc(graphDef.category)} · ${node.id.slice(-6)}</div></div><button class="text-action danger-text" data-delete-node="${node.id}">삭제</button></div></div>${graphBody}<div class="panel-section"><h3>PORT CONTRACT</h3><div class="port-contract"><b>입력</b><span>${graphDef.inputs.length ? graphDef.inputs.map((port) => `${esc(port.label)} · ${port.type}`).join("<br>") : "없음"}</span><hr class="divider"><b>출력</b><span>${graphDef.outputs.map((port) => `${esc(port.label)} · ${port.type}`).join("<br>")}</span></div></div>${project.debug ? `<div class="panel-section"><h3>평가 디버그</h3><pre class="json">${esc(JSON.stringify({ node, evaluation: project.graphEvaluation }, null, 2))}</pre></div>` : ""}`;
    }
    if (node.kind === "cluster") return `<div class="panel-head"><div class="eyebrow">CLUSTER / SUBGRAPH</div><h2 class="inspector-title">${esc(node.label)}</h2></div><div class="panel-section"><p>LIST → ITERATE → CAMERA OVERRIDE → GENERATE → COMPARE</p><button class="btn secondary" data-action="open-cluster" data-cluster-id="${node.id}">내부 그래프 열기</button></div>`;
    let body = "";
    if (node.type === "camera") body = renderCameraInspector(project, node);
    else if (node.type === "lighting") body = renderLightingInspector(project, node);
    else if (["representation", "material", "atmosphere"].includes(node.type)) body = renderRepresentationInspector(project, node);
    else if (node.type === "imageInput") body = renderImageInputInspector(project, node);
    else if (["referenceInput", "referenceAnalyzer", "attributeSelector"].includes(node.type)) body = renderReferenceInspector(project, node);
    else if (node.type === "regionMask") body = renderMaskInspector(project, node);
    else if (node.type === "regionEdit") body = renderRegionEditInspector(project, node);
    else if (node.type === "ofat") body = renderOfatInspector(project, node);
    else if (node.type === "altBuilder") body = renderAltInspector(project, node);
    else if (node.type === "compiler") body = renderCompilerInspector(project, node);
    else if (node.type === "generator") body = renderGeneratorInspector(project, node);
    else body = `<div class="panel-section"><div class="empty">이 노드는 현재 그래프 흐름과 메타데이터를 제공합니다.</div></div>`;
    const outputPresets = ["representation", "compiler"].includes(node.type) ? renderOutputPresetInspector(project) : "";
    const systemMeta = project.workspaceMode === "system" ? `<div class="panel-section"><h3>입출력 관계</h3><div class="port-contract"><b>입력</b><span>${def.inputs.length ? def.inputs.map(esc).join(" · ") : "없음"}</span><hr class="divider"><b>출력</b><span>${def.outputs.length ? def.outputs.map(esc).join(" · ") : "없음"}</span></div>${node.moduleId ? `<p class="mono">모듈: ${esc(node.moduleTitle)} · ${node.moduleId.slice(-6)}</p>` : ""}</div>` : "";
    return `<div class="panel-head"><div class="spread"><div><div class="eyebrow">CONTEXT INSPECTOR</div><h2 class="inspector-title">${esc(node.label)}</h2><div class="inspector-type">${esc(CATEGORY_KO[def.category] || def.category)} · ${node.id.slice(-6)}</div></div>${project.workspaceMode === "system" ? `<button class="text-action danger-text" data-delete-node="${node.id}">삭제</button>` : ""}</div></div>${body}${outputPresets}${systemMeta}${project.debug ? `<div class="panel-section"><h3>디버그 상태</h3><pre class="json">${esc(JSON.stringify({ node, execution: project.execution, representation: project.representation }, null, 2))}</pre></div>` : ""}`;
  }

  function modeSwitch(path, attribute) {
    return `<div class="mode-switch">${["locked", "controlled", "free"].map((mode) => `<button class="${attribute.mode === mode ? `active ${mode}` : ""}" data-mode-path="${path}" data-mode="${mode}">${mode === "locked" ? "■ 잠금" : mode === "controlled" ? "● 제어" : "○ 자유"}</button>`).join("")}</div>`;
  }

  function attributeControl(project, path, label, config = {}) {
    const attribute = pathGet(project.representation, path);
    if (!attribute) return "";
    const disabled = attribute.mode === "locked" ? "disabled" : "";
    let input;
    if (config.type === "select") input = `<select class="field" data-attr-path="${path}" ${disabled}>${config.options.map((option) => `<option value="${esc(option)}" ${String(attribute.value) === String(option) ? "selected" : ""}>${esc(option)}</option>`).join("")}</select>`;
    else if (config.type === "boolean") input = `<button class="btn secondary small" data-boolean-path="${path}">${attribute.value ? "켜짐" : "꺼짐"}</button>`;
    else if (config.type === "range") input = `<div class="numeric-control"><div class="unit-value"><input type="number" data-attr-path="${path}" min="${config.min}" max="${config.max}" step="${config.step ?? 1}" value="${attribute.value}" ${disabled}><span>${esc(config.unit || "")}</span></div><div class="numeric-rail"><span>${config.min}</span><input type="range" data-attr-path="${path}" min="${config.min}" max="${config.max}" step="${config.step ?? 1}" value="${attribute.value}" ${disabled}><span>${config.max}</span></div></div>`;
    else input = `<input class="field" data-attr-path="${path}" value="${esc(attribute.value)}">`;
    return `<div class="attribute"><div class="attribute-top"><div><div class="attribute-name">${esc(label)}</div><div class="mono">${esc(attribute.source)} · ${modeLabel(attribute.mode)}</div></div>${modeSwitch(path, attribute)}</div>${input}${config.strength === false ? "" : `<div class="range-line" style="margin-top:6px"><input type="range" data-strength-path="${path}" min="0" max="100" value="${attribute.strength}" ${disabled}><output>strength ${attribute.strength}</output></div>`}</div>`;
  }

  function renderCameraInspector(project) {
    const c = project.representation.global.camera;
    return `<div class="inspector-hero"><span class="eyebrow">CAMERA</span><div class="hero-value"><b>${c.focalLengthMm.value}</b><span>mm</span></div><p>${c.cameraHeightMm.value} mm · ${c.perspectiveCorrection.value ? "Perspective Corrected" : "Natural Convergence"}</p><div class="hero-state"><span class="state-symbol ${c.focalLengthMm.mode}">${c.focalLengthMm.mode === "locked" ? "■" : c.focalLengthMm.mode === "controlled" ? "●" : "○"}</span>${modeLabel(c.focalLengthMm.mode)}</div></div><div class="panel-section"><h3>프리셋</h3><div class="preset-row"><select class="field" id="cameraPreset">${Object.keys(CAMERA_PRESETS).map((name) => `<option>${esc(name)}</option>`).join("")}</select><button class="btn secondary small" data-action="apply-camera-preset">적용</button></div></div><div class="panel-section"><h3>PRIMARY</h3>
      ${attributeControl(project, "global.camera.sensor", "센서", { type: "select", options: ["Full Frame", "APS-C", "Micro Four Thirds"], strength: false })}
      ${attributeControl(project, "global.camera.focalLengthMm", "초점거리", { type: "range", min: 14, max: 135, step: 1, unit: "mm", strength: false })}
      ${attributeControl(project, "global.camera.cameraHeightMm", "카메라 높이", { type: "range", min: 900, max: 2000, step: 10, unit: "mm", strength: false })}
      ${attributeControl(project, "global.camera.pitchDeg", "피치", { type: "range", min: -20, max: 20, step: 1, unit: "°", strength: false })}
      ${attributeControl(project, "global.camera.perspectiveCorrection", "원근 보정", { type: "boolean", strength: false })}
      <details class="advanced-section"><summary>ADVANCED +</summary>${attributeControl(project, "global.camera.yawDeg", "요", { type: "range", min: -90, max: 90, step: 1, unit: "°", strength: false })}${attributeControl(project, "global.camera.rollDeg", "롤", { type: "range", min: -10, max: 10, step: 1, unit: "°", strength: false })}${attributeControl(project, "global.camera.verticalShift", "수직 시프트", { type: "range", min: -100, max: 100, step: 1, strength: false })}${attributeControl(project, "global.camera.aperture", "조리개", { type: "range", min: 1.4, max: 16, step: 0.1, unit: "f/", strength: false })}${attributeControl(project, "global.camera.focusDistanceM", "초점 거리", { type: "range", min: 0.5, max: 30, step: 0.5, unit: "m", strength: false })}${attributeControl(project, "global.camera.aspectRatio", "화면 비율", { type: "select", options: ["4:3", "3:2", "16:9", "1:1"], strength: false })}<div class="attribute"><div class="attribute-name">파생 수평 화각</div><div class="unit-value compact"><b>${horizontalFovDeg(c)}</b><span>°</span></div></div></details></div>`;
  }

  function renderLightingInspector(project) {
    const l = project.representation.global.lighting;
    return `<div class="inspector-hero"><span class="eyebrow">LIGHT</span><div class="hero-value"><b>${l.colorTemperatureK.value}</b><span>K</span></div><p>${l.exposureEV.value >= 0 ? "+" : ""}${l.exposureEV.value} EV · Softness ${l.softness.value}</p><div class="hero-state"><span class="state-symbol ${l.colorTemperatureK.mode}">●</span>${modeLabel(l.colorTemperatureK.mode)}</div></div><div class="panel-section"><h3>프리셋</h3><div class="preset-row"><select class="field" id="lightingPreset">${Object.keys(LIGHTING_PRESETS).map((name) => `<option>${esc(name)}</option>`).join("")}</select><button class="btn secondary small" data-action="apply-lighting-preset">적용</button></div></div><div class="panel-section"><h3>PRIMARY</h3>
      ${attributeControl(project, "global.lighting.colorTemperatureK", "색온도", { type: "range", min: 2700, max: 6500, step: 100, unit: "K", strength: false })}
      ${attributeControl(project, "global.lighting.exposureEV", "노출", { type: "range", min: -3, max: 3, step: 0.1, unit: " EV", strength: false })}
      ${attributeControl(project, "global.lighting.softness", "부드러움", { type: "range", min: 0, max: 100, strength: false })}
      <details class="advanced-section"><summary>ADVANCED +</summary>${attributeControl(project, "global.lighting.contrast", "대비", { type: "range", min: 0, max: 100, strength: false })}${attributeControl(project, "global.lighting.ambientLevel", "주변광", { type: "range", min: 0, max: 100, strength: false })}${attributeControl(project, "global.lighting.artificialLevel", "인공광", { type: "range", min: 0, max: 100, strength: false })}${attributeControl(project, "global.lighting.direction", "방향", { type: "select", options: ["Front", "Side", "Back", "Top", "Mixed"], strength: false })}</details></div>`;
  }

  function renderRepresentationInspector(project, node) {
    const showMaterial = node.type === "material", showAtmosphere = node.type === "atmosphere";
    if (showMaterial) return `<div class="panel-section"><h3>재료 상태</h3>${attributeControl(project, "global.material.primary", "주요 재료")}${attributeControl(project, "global.material.secondary", "보조 재료")}${attributeControl(project, "global.material.finish", "마감")}${attributeControl(project, "global.appearance.surfaceCharacter", "표면 특성")}</div>`;
    if (showAtmosphere) return `<div class="panel-section"><h3>분위기 상태</h3>${attributeControl(project, "global.appearance.atmosphere", "분위기")}${attributeControl(project, "global.appearance.palette", "팔레트")}${attributeControl(project, "global.appearance.detailDensity", "시각 밀도")}</div>`;
    return `<div class="panel-section"><h3>전역 콘텐츠 / 보존</h3>${attributeControl(project, "global.content.subject", "인테리어 주제")}${attributeControl(project, "global.content.geometry", "공간 형상")}${attributeControl(project, "global.content.majorLayout", "주요 배치")}${attributeControl(project, "global.content.composition", "구도")}${attributeControl(project, "global.content.furniture", "가구")}</div><div class="panel-section"><h3>표현 외관</h3>${attributeControl(project, "global.appearance.medium", "매체")}${attributeControl(project, "global.appearance.palette", "팔레트")}${attributeControl(project, "global.appearance.detailDensity", "디테일 밀도")}${attributeControl(project, "global.appearance.texture", "텍스처")}${attributeControl(project, "global.appearance.lightingCharacter", "조명 특성")}${attributeControl(project, "global.appearance.atmosphere", "분위기")}${attributeControl(project, "global.appearance.surfaceCharacter", "표면 특성")}</div>`;
  }

  function renderImageInputInspector(project) {
    return `<div class="panel-section"><h3>소스 이미지</h3><input class="field" type="file" accept="image/*" id="sourceImageInput">${project.sourceImage ? `<img src="${project.sourceImage}" alt="소스 인테리어" style="width:100%;max-height:220px;object-fit:contain;margin-top:8px;border:1px solid var(--line)"><button class="btn danger small" data-action="clear-source" style="margin-top:7px">이미지 제거</button>` : `<div class="empty" style="margin-top:8px">이미지가 없어도 모의 모드는 작동합니다.</div>`}<p class="mono">소스 이미지는 표현 상태와 별도로 저장됩니다.</p></div>`;
  }

  function renderReferenceInspector(project, node) {
    const analyzerNode = node.type === "referenceAnalyzer" ? node : project.graph.nodes.find((item) => item.type === "referenceAnalyzer");
    const preset = analyzerNode?.settings.preset || "Warm Nordic Interior";
    const analyzed = analyzerNode?.settings.analyzed || [];
    return `<div class="panel-section"><h3>레퍼런스 입력</h3><input class="field" type="file" accept="image/*" multiple id="referenceImageInput"><div class="row wrap" style="margin-top:8px">${project.referenceImages.map((image, index) => `<img src="${image}" alt="레퍼런스 ${index + 1}" style="width:64px;height:64px;object-fit:cover;border:1px solid var(--line)">`).join("") || `<span class="mono">이미지 없이 프리셋 분석기를 사용할 수 있습니다.</span>`}</div></div><div class="panel-section"><h3>모의 레퍼런스 분석</h3><select class="field" id="referencePreset">${Object.keys(REFERENCE_PRESETS).map((name) => `<option ${name === preset ? "selected" : ""}>${esc(name)}</option>`).join("")}</select><button class="btn secondary" data-action="analyze-reference" style="width:100%;margin-top:7px">분석 / 속성 분해</button><p class="mono">콘텐츠와 전이 가능 속성을 분리합니다.</p></div><div class="panel-section"><h3>전이 가능 속성</h3>${analyzed.length ? analyzed.map((item) => `<div class="transfer-row"><div><b>${esc(item.key)}</b><br><span>${esc(item.value)} · ${item.strength}</span></div><button class="btn secondary small" data-transfer-key="${item.key}">전이</button></div>`).join("") : `<div class="empty">분석을 실행하세요.</div>`}</div>`;
  }

  function renderMaskInspector(project) {
    const regions = project.representation.regions;
    const active = project.activeRegionId ? regions.find((region) => region.id === project.activeRegionId) || null : null;
    return `<div class="panel-section"><h3>Selection mask editor</h3><div class="mask-stage" id="maskStage">${project.sourceImage ? `<img src="${project.sourceImage}" alt="Mask source">` : `<div class="empty" style="position:absolute;inset:20%;padding:15px">소스 이미지 없음<br>빈 캔버스에 마스크를 그릴 수 있습니다.</div>`}<canvas id="maskCanvas" width="640" height="480" style="opacity:${maskRuntime.opacity};${maskRuntime.visible ? "" : "display:none"}"></canvas></div><div class="mask-tools"><button class="btn secondary small ${maskRuntime.tool === "brush" ? "active" : ""}" data-mask-tool="brush">BRUSH</button><button class="btn secondary small ${maskRuntime.tool === "eraser" ? "active" : ""}" data-mask-tool="eraser">ERASER</button><button class="btn secondary small" data-action="clear-mask">CLEAR</button><button class="btn secondary small" data-action="toggle-mask">MASK ${maskRuntime.visible ? "VISIBLE" : "HIDDEN"}</button><button class="btn secondary small" data-action="new-region">＋ NEW REGION</button></div><label class="label">Brush size · ${maskRuntime.size}px</label><input type="range" id="brushSize" min="5" max="100" value="${maskRuntime.size}" style="width:100%"><label class="label">Mask opacity · ${Math.round(maskRuntime.opacity * 100)}%</label><input type="range" id="maskOpacity" min="10" max="100" value="${maskRuntime.opacity * 100}" style="width:100%"><label class="label">Region name</label><input class="field" id="newRegionName" value="${active ? esc(active.name) : "Dining Table"}"><button class="btn accent" data-action="create-region" style="width:100%;margin-top:8px">${active ? "UPDATE REGION MASK" : "CREATE REGION"}</button><p class="mono">마스크는 원본 이미지와 독립적인 PNG 데이터입니다.</p></div><div class="panel-section"><h3>Regions</h3>${regions.length ? regions.map((region) => `<button class="module-item" data-region-id="${region.id}" style="${region.id === project.activeRegionId ? "border-color:var(--accent)" : ""}"><b>${esc(region.name)}</b><span>${esc(region.operation)} · mask ${region.maskDataUrl ? "ready" : "empty"}</span></button>`).join("") : `<div class="empty">생성된 Region이 없습니다.</div>`}</div>`;
  }

  function renderRegionEditInspector(project) {
    const regions = project.representation.regions;
    const region = regions.find((item) => item.id === project.activeRegionId) || regions[0] || null;
    if (!region) return `<div class="panel-section"><div class="empty">Region Mask 노드에서 마스크를 그리고 Region을 먼저 생성하세요.</div></div>`;
    project.activeRegionId = region.id;
    const preserveKeys = ["position", "scale", "orientation", "geometry", "lighting", "surroundings"];
    const before = project.representation.global.material.primary.value, after = region.attributes.material.value;
    return `<div class="inspector-hero region-hero"><span class="eyebrow">REGION</span><h2>${esc(region.name)}</h2><div class="material-delta"><span>${esc(before)}</span><i>→</i><b>${esc(after)}</b></div><div class="hero-state"><span class="state-symbol controlled">●</span>제어</div></div><div class="panel-section"><h3>CHANGE</h3><select class="field" id="activeRegionSelect">${regions.map((item) => `<option value="${item.id}" ${item.id === region.id ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select><label class="label">작업</label><select class="field" id="regionOperation">${["replace", "material", "color", "shape", "add", "remove", "custom"].map((op) => `<option ${region.operation === op ? "selected" : ""}>${op}</option>`).join("")}</select><label class="label">재료</label><input class="field" data-region-attribute="material" value="${esc(region.attributes.material.value)}"><label class="label">색상</label><input class="field" data-region-attribute="color" value="${esc(region.attributes.color.value)}"><details class="advanced-section"><summary>ADVANCED +</summary><label class="label">지시문</label><textarea class="field" id="regionInstruction">${esc(region.instruction)}</textarea><label class="label">형태</label><input class="field" data-region-attribute="form" value="${esc(region.attributes.form.value)}"><label class="label">텍스처</label><input class="field" data-region-attribute="texture" value="${esc(region.attributes.texture.value)}"><label class="label">영역 레퍼런스</label><input class="field" id="regionReferenceInput" type="file" accept="image/*">${region.referenceImages.map((image) => `<img src="${image}" alt="Region reference" class="reference-thumb">`).join("")}</details></div><div class="panel-section"><h3>PRESERVE</h3><div class="preserve-grid">${preserveKeys.map((key) => `<label class="checkline"><input type="checkbox" data-preserve="${key}" ${region.preserve[key] ? "checked" : ""}><span>■ ${esc(key)}</span></label>`).join("")}</div></div><div class="panel-section"><details class="advanced-section"><summary>VIEW COMPILED INSTRUCTION</summary><div class="prompt-preview">${compileRegionEdit(project.representation, region).sections.map((section) => `<div class="attribute"><b class="mono">${section.label}</b><div class="instruction-text">${esc(section.text)}</div></div>`).join("")}</div></details><button class="btn accent full" data-action="generate-region">영역 편집 생성 →</button></div>`;
  }

  function renderOfatInspector(project, node) {
    const paths = { "Camera · Focal Length": "global.camera.focalLengthMm", "Lighting · Color Temperature": "global.lighting.colorTemperatureK", "Lighting · Softness": "global.lighting.softness", "Lighting · Exposure": "global.lighting.exposureEV" };
    return `<div class="panel-section"><h3>One Factor At A Time</h3><label class="label">Variable</label><select class="field" id="ofatVariable">${Object.entries(paths).map(([label, path]) => `<option value="${path}" ${node.settings.variable === path ? "selected" : ""}>${esc(label)}</option>`).join("")}</select><label class="label">Values</label><input class="field" id="ofatValues" value="${esc(node.settings.values)}"><p class="mono">선택한 Attribute.value만 변경합니다. mode, source와 모든 다른 상태는 동일하게 유지됩니다.</p><button class="btn accent" data-action="run-ofat" style="width:100%">RUN OFAT SERIES</button></div>`;
  }

  function renderAltInspector(project, node) {
    return `<div class="panel-section"><h3>Coordinated divergence</h3><label class="label">Number of alternatives</label><input class="field" id="altCount" type="number" min="2" max="8" value="${node.settings.alternatives || 4}"><label class="label">Variation scope</label><textarea class="field" id="altScope">${esc(node.settings.scope || "materials, palette, lighting, atmosphere")}</textarea><p class="mono">ALT EXPLORATION은 여러 변수의 의도적 동시 변경을 허용하는 유일한 기본 모듈입니다.</p><button class="btn accent" data-action="run-alt" style="width:100%">GENERATE ALTERNATIVES</button></div>`;
  }

  function renderCompilerInspector(project) {
    const compiled = compileGlobal(project.representation);
    return `<div class="panel-section"><h3>DETERMINISTIC COMPILER</h3><p class="mono">${compiled.sections.length}개 의미 블록 · 같은 상태는 같은 지시를 생성합니다.</p><details class="advanced-section"><summary>VIEW COMPILED INSTRUCTION</summary>${compiled.sections.map((section) => `<div class="attribute"><b class="mono">${section.label}</b><div class="instruction-text">${esc(section.text)}</div></div>`).join("")}</details></div>`;
  }

  function renderGeneratorInspector(project, node) {
    const execution = ensureExecutionState(project), override = execution.generatorOverrides[node.id] || null;
    const selection = effectiveSelection(project, "generation", node.id), model = globalThis.VRL_AI?.modelById?.[selection?.modelId] || null;
    const capabilities = model ? Object.entries(model.capabilities).filter(([, enabled]) => enabled).map(([key]) => key) : [];
    return `<div class="inspector-hero generator-hero"><span class="eyebrow">GENERATOR</span><h2>${selection ? providerName(selection.providerId) : "MODEL REQUIRED"}</h2><p>${esc(model?.name || "AI Models에서 실행 모델을 선택하세요.")}</p><div class="hero-state"><span class="state-symbol ${selection?.providerId === "mock" ? "free" : "controlled"}">${selection?.providerId === "mock" ? "○" : "●"}</span>${selection?.providerId === "mock" ? "OFFLINE / MOCK" : selection ? "REAL GENERATION" : "NOT CONNECTED"}</div></div><div class="panel-section"><h3>MODEL</h3><label class="label">라우팅</label><select class="field" id="generatorRoutingMode"><option value="project" ${!override ? "selected" : ""}>프로젝트 기본값</option><option value="override" ${override ? "selected" : ""}>이 Generator에서 재정의</option></select>${override ? `<label class="label">Provider / Model</label><select class="field" id="generatorModelSelect">${modelOptions("generation", selection)}</select>` : `<div class="execution-summary"><span>${selection ? providerName(selection.providerId) : "—"}</span><b>${esc(model?.name || "모델 미선택")}</b></div>`}<div class="capability-line">${capabilities.map((capability) => `<span>${esc(capability)}</span>`).join("") || `<span>capability unavailable</span>`}</div></div><div class="panel-section"><h3>OUTPUT</h3><label class="label">화면 비율</label><select class="field" id="generationAspect">${(model?.aspectRatios || ["4:3", "3:2", "16:9", "1:1"]).map((ratio) => `<option ${execution.aspectRatio === ratio ? "selected" : ""}>${ratio}</option>`).join("")}</select>${model?.qualities?.length ? `<label class="label">품질</label><select class="field" id="generationQuality">${model.qualities.map((quality) => `<option ${execution.quality === quality ? "selected" : ""}>${quality}</option>`).join("")}</select>` : ""}<label class="label">이미지 수</label><input class="field" type="number" id="generationCount" min="1" max="4" value="${execution.count}"></div><div class="panel-section"><details class="advanced-section"><summary>ADVANCED +</summary><div class="execution-row"><span>Compiled Instruction</span><b>${compileGlobal(project.representation).sections.length} blocks</b></div><div class="execution-row"><span>Reference Input</span><b>${model?.capabilities.imageInput ? "지원" : "미지원"}</b></div><div class="execution-row"><span>Mask Editing</span><b>${model?.capabilities.maskEditing ? "지원" : "미지원"}</b></div></details><button class="btn accent full" data-action="generate">생성 →</button></div>`;
  }

  function presetPreview(preset, selection, kind) {
    const traits = preset.compilerDirectives.slice(0, 4).map((text) => text.replace(/[.]+$/, ""));
    return `<div class="preset-preview"><div class="spread"><div><div class="eyebrow">${kind}</div><h4>${esc(preset.nameKo || preset.name)}</h4></div><span class="badge controlled">${presetInfluence(selection.strength)}</span></div><p>${esc(preset.description)}</p><div class="preset-traits">${traits.map((trait) => `<span>${esc(trait)}</span>`).join("") || `<span>명시적 스타일 지시 없음</span>`}</div><div class="preset-avoid"><b>제외</b>${(preset.exclusions || []).slice(0, 3).map((item) => `<span>${esc(item)}</span>`).join("") || `<span>추가 제외 없음</span>`}</div><details><summary class="mono">고급 · 컴파일 지시 전체</summary><div class="mono" style="margin-top:8px">${preset.compilerDirectives.map((item) => `• ${esc(item)}`).join("<br>")}<br>${(preset.exclusions || []).map((item) => `− ${esc(item)}`).join("<br>")}</div></details></div>`;
  }
  function renderOutputPresetInspector(project) {
    ensureOutputState(project.representation);
    const output = project.representation.global.output;
    const representationPreset = representationPresetById[output.representationPreset.value] || REPRESENTATION_PRESETS[0];
    const designPreset = designStylePresetById[output.designStylePreset.value] || DESIGN_STYLE_PRESETS[0];
    return `<div class="panel-section output-preset-section"><h3>출력 프리셋</h3><p class="mono">표현 방식과 디자인 언어는 서로 독립적이며 모든 세부 값은 계속 편집할 수 있습니다.</p><label class="label">표현 방식</label><select class="field" id="representationPreset">${REPRESENTATION_PRESETS.map((preset) => `<option value="${preset.id}" ${preset.id === representationPreset.id ? "selected" : ""}>${esc(preset.nameKo)} · ${esc(preset.name)}</option>`).join("")}</select><div class="range-line" style="margin-top:8px"><input id="representationPresetStrength" type="range" min="0" max="100" value="${output.representationPreset.strength}"><output>강도 ${output.representationPreset.strength}</output></div>${presetPreview(representationPreset, output.representationPreset, "표현 프리셋")}
      <label class="label">디자인 스타일</label><select class="field" id="designStylePreset">${DESIGN_STYLE_PRESETS.map((preset) => `<option value="${preset.id}" ${preset.id === designPreset.id ? "selected" : ""}>${esc(preset.nameKo)}${preset.id === "none" ? "" : ` · ${esc(preset.name)}`}</option>`).join("")}</select><div class="range-line" style="margin-top:8px"><input id="designStylePresetStrength" type="range" min="0" max="100" value="${output.designStylePreset.strength}" ${designPreset.id === "none" ? "disabled" : ""}><output>강도 ${output.designStylePreset.strength}</output></div>${presetPreview(designPreset, output.designStylePreset, "디자인 스타일 프리셋")}
      <label class="label">사용자 제외 항목</label><textarea class="field" id="userExclusions" placeholder="쉼표 또는 줄바꿈으로 구분">${esc(output.userExclusions.value)}</textarea><p class="mono">우선순위: 사용자 제어값 &gt; 영역 제어값 &gt; 프리셋 &gt; 템플릿 &gt; 시스템 기본값</p></div>`;
  }

  function displayDiffValue(value) {
    if (value === undefined) return "∅";
    if (value && typeof value === "object" && "value" in value) return `${value.value} [${value.mode}]`;
    return typeof value === "object" ? JSON.stringify(value) : String(value);
  }

  function renderResults(project) {
    return `<div class="results-head"><div><span class="eyebrow">VARIANT HISTORY</span><span>${project.experiments.length} STATES</span></div><div class="row"><span class="mono">결과 두 개 선택 → Compare</span>${project.selectedExperimentIds.length ? `<button class="text-action" data-view-mode="compare">비교 열기</button><button class="text-action" data-action="clear-results-selection">선택 해제</button>` : ""}</div></div><div class="results-grid">${project.experiments.length ? project.experiments.map((item, index) => { const changedPath = item.changedVariables[0]; const current = changedPath ? pathGet(item.representationState, changedPath)?.value : null; const parent = item.parentExperimentId ? project.experiments.find((candidate) => candidate.id === item.parentExperimentId) : null; const previous = changedPath && parent ? pathGet(parent.representationState, changedPath)?.value : null; return `<article class="result-card ${project.selectedExperimentIds.includes(item.id) ? "selected" : ""}" data-experiment-id="${item.id}"><button class="result-image" data-select-experiment="${item.id}"><span class="sequence">${String(project.experiments.length - index).padStart(2, "0")}</span><img src="${item.generatedImages[0]?.url}" alt="${esc(item.generatedImages[0]?.alt || "Generated result")}"></button><div class="result-body"><div><span class="eyebrow">${item.providerId === "mock" || item.provider === "mock" ? "OFFLINE" : "REAL GENERATION"}</span><div class="result-name">${esc(item.name)}</div></div><div class="result-provider"><b>${providerName(item.providerId || item.provider)}</b><span>${esc(modelName(item.modelId || "mock-image-v1"))}</span></div><div class="result-delta">${changedPath ? `<span>Δ ${esc(changedPath.split(".").pop())}</span><b>${previous !== null ? `${esc(previous)} → ` : ""}${esc(current)}</b>` : `<span>BASE STATE</span><b>NO DELTA</b>`}</div><details><summary>VIEW STATE</summary><div class="result-actions"><button class="text-action" data-load-experiment="${item.id}">상태 불러오기</button><button class="text-action danger-text" data-delete-experiment="${item.id}">삭제</button></div><div class="evaluation">${["targetFollowed", "preserved", "controllability"].map((key) => `<label>${key}<select class="field" data-eval-id="${item.id}" data-eval-key="${key}">${[1,2,3,4,5].map((n) => `<option ${item.evaluation[key] === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>`).join("")}</div>${project.debug ? `<pre class="json">${esc(JSON.stringify(item, null, 2))}</pre>` : ""}</details></div></article>`; }).join("") : `<div class="history-empty"><span>NO GENERATED STATE</span><p>현재 Representation State는 준비되었습니다.</p><button class="text-action" data-action="generate">첫 상태 생성 →</button></div>`}</div>`;
  }

  function addNode(project, type, position = null) {
    if (project.graph?.version === 2 && globalThis.VRL_GRAPH) {
      const parameterDefaults = {
        number: { valueType: "Number", value: 0, min: 0, max: 100, step: 1, label: "숫자" },
        text: { valueType: "String", value: "", label: "텍스트" },
        boolean: { valueType: "Boolean", value: true, label: "불리언" },
        enum: { valueType: "Enum", value: "none", options: ["none"], label: "열거값" },
        image: { valueType: "Image", value: project.sourceImage, label: "이미지 소스" },
        reference: { valueType: "Reference", value: project.referenceImages, label: "레퍼런스" },
        list: { valueType: "List", itemType: "Number", value: [24, 35, 50, 85], label: "리스트" },
      };
      const settings = parameterDefaults[type] || { label: globalThis.VRL_GRAPH.getNodeDef(type).label };
      const node = parameterDefaults[type]
        ? globalThis.VRL_GRAPH.addParameterNode(project.graph, settings, position || { x: 160 + (project.graph.nodes.length % 5) * 228, y: 180 + Math.floor(project.graph.nodes.length / 5) * 170 })
        : globalThis.VRL_GRAPH.addNode(project.graph, type, settings, position || { x: 160 + (project.graph.nodes.length % 5) * 228, y: 180 + Math.floor(project.graph.nodes.length / 5) * 170 });
      project.selectedNodeId = node.id; syncGraphState(project); save("typed node를 추가했습니다."); renderWorkspace(); return;
    }
    const count = project.graph.nodes.length;
    const node = { id: uid("node"), type, label: NODE_DEFS[type].label, x: position?.x ?? 160 + (count % 5) * 218, y: position?.y ?? 160 + Math.floor(count / 5) * 140, moduleId: null, settings: defaultNodeSettings(type) };
    project.graph.nodes.push(node); project.selectedNodeId = node.id; save("노드를 추가했습니다."); renderWorkspace();
  }

  function addModule(project, moduleId, custom = null) {
    const definition = custom || moduleConfigs[moduleId]; if (!definition) return;
    if (project.graph?.version === 2 && !custom && ["camera-study", "lighting-study"].includes(moduleId)) {
      const cluster = globalThis.VRL_GRAPH.createClusterInstance(moduleId, project.representation, { x: 180 + (project.graph.nodes.length % 4) * 240, y: 520 });
      cluster.order = project.graph.nodes.length; project.graph.nodes.push(cluster); project.selectedNodeId = cluster.id;
      save(`${definition.title} 클러스터를 기존 그래프에 삽입했습니다.`); renderWorkspace(); return;
    }
    const instanceId = uid("module");
    if (custom) {
      const idMap = {};
      const minX = Math.min(...definition.nodes.map((n) => n.x)), minY = Math.min(...definition.nodes.map((n) => n.y));
      const baseX = 160 + (project.graph.nodes.length % 3) * 140, baseY = 440 + (project.graph.nodes.length % 4) * 80;
      const nodes = definition.nodes.map((source) => { const id = uid("node"); idMap[source.id] = id; return { ...clone(source), id, x: baseX + source.x - minX, y: baseY + source.y - minY, moduleId: instanceId, moduleTitle: definition.title }; });
      const edges = definition.edges.map((source) => ({ ...clone(source), id: uid("edge"), from: idMap[source.from], to: idMap[source.to], moduleId: instanceId }));
      project.graph.nodes.push(...nodes); project.graph.edges.push(...edges); project.selectedNodeId = nodes[0]?.id;
    } else {
      const origin = { x: 140 + (project.graph.nodes.length % 3) * 80, y: 420 + (project.graph.nodes.length % 4) * 110 };
      const graph = makeGraph(definition.nodes, instanceId, origin);
      graph.nodes.forEach((node) => { node.moduleTitle = definition.title; if (node.type === "ofat") { if (moduleId === "lighting-study") { node.settings.variable = "global.lighting.colorTemperatureK"; node.settings.values = "2700, 3000, 4000, 5500"; } } });
      project.graph.nodes.push(...graph.nodes); project.graph.edges.push(...graph.edges); project.selectedNodeId = graph.nodes[0]?.id;
    }
    if (["camera-study", "lighting-study"].includes(moduleId)) project.workspaceMode = "compare";
    if (["furniture-swap", "region-edit"].includes(moduleId)) { project.workspaceMode = "region"; const maskNode = [...project.graph.nodes].reverse().find((node) => node.type === "regionMask"); if (maskNode) project.selectedNodeId = maskNode.id; }
    save(`${definition.title} 모듈을 기존 그래프에 삽입했습니다.`); renderWorkspace();
  }

  function selectionConnected(project, selectedIds) {
    if (selectedIds.length < 2) return selectedIds.length === 1;
    const adjacency = Object.fromEntries(selectedIds.map((id) => [id, []]));
    project.graph.edges.filter((edge) => selectedIds.includes(edge.from) && selectedIds.includes(edge.to)).forEach((edge) => { adjacency[edge.from].push(edge.to); adjacency[edge.to].push(edge.from); });
    const seen = new Set([selectedIds[0]]), queue = [selectedIds[0]];
    while (queue.length) adjacency[queue.shift()].forEach((id) => { if (!seen.has(id)) { seen.add(id); queue.push(id); } });
    return seen.size === selectedIds.length;
  }

  function saveSelectionAsModule(project) {
    const ids = project.selectedNodeIds;
    if (!ids.length) return;
    if (!selectionConnected(project, ids)) { alert("연결된 노드만 Custom Workflow Module로 저장할 수 있습니다."); return; }
    const title = prompt("Custom Workflow Module 이름", "My Workflow Module"); if (!title) return;
    const nodes = clone(project.graph.nodes.filter((node) => ids.includes(node.id)));
    const edges = clone(project.graph.edges.filter((edge) => ids.includes(edge.from) && ids.includes(edge.to)));
    customModules.unshift({ id: uid("custom-module"), title, nodes, edges, createdAt: now(), inputs: ["base Representation State"], outputs: ["module result"] });
    save("Custom Module을 로컬에 저장했습니다."); renderWorkspace();
  }

  function bindWorkspace(project) {
    appEl.querySelector('[data-action="home"]')?.addEventListener("click", () => { route = "landing"; save(); render(); });
    appEl.querySelector("#projectName")?.addEventListener("change", (event) => { project.name = event.target.value.trim() || project.name; save("프로젝트 이름을 저장했습니다."); });
    appEl.querySelector("#projectSelect")?.addEventListener("change", (event) => { store.activeProjectId = event.target.value; save(); renderWorkspace(); });
    appEl.querySelector('[data-action="debug"]')?.addEventListener("click", () => { project.debug = !project.debug; save(); renderWorkspace(); });
    appEl.querySelectorAll("[data-view-mode]").forEach((button) => button.addEventListener("click", () => { const previous = project.workspaceMode; project.workspaceMode = button.dataset.viewMode; if (project.workspaceMode === "image" && previous === "region") { const editNode = project.graph.nodes.find((item) => item.type === "regionEdit"); if (editNode && project.activeRegionId) project.selectedNodeId = editNode.id; } save(); renderWorkspace(); }));
    appEl.querySelectorAll('[data-action="manage-models"]').forEach((button) => button.addEventListener("click", () => { project.workspaceMode = "models"; generationRuntime.error = null; refreshProviderStatuses(false).finally(() => { save(); renderWorkspace(); }); }));
    appEl.querySelector('[data-action="dismiss-error"]')?.addEventListener("click", () => { generationRuntime.error = null; renderWorkspace(); });
    appEl.querySelectorAll('[data-action="enter-region"]').forEach((button) => button.addEventListener("click", () => { const maskNode = project.graph.nodes.find((item) => item.type === "regionMask"); if (!maskNode) return addModule(project, "region-edit"); project.selectedNodeId = maskNode.id; project.workspaceMode = "region"; save(); renderWorkspace(); }));
    appEl.querySelectorAll("[data-focus-type]").forEach((button) => button.addEventListener("click", () => { const node = project.graph.nodes.find((item) => item.type === button.dataset.focusType); if (!node) return; project.selectedNodeId = node.id; if (button.dataset.focusType === "regionMask") project.workspaceMode = "region"; save(); renderWorkspace(); }));
    appEl.querySelector('[data-action="dismiss-engine"]')?.addEventListener("click", () => { project.engineSetupDismissed = true; save(); renderWorkspace(); });
    appEl.querySelectorAll("[data-use-engine]").forEach((button) => button.addEventListener("click", () => { const providerId = button.dataset.useEngine; if (providerId === "mock") { const selection = { providerId: "mock", modelId: "mock-image-v1" }; aiSettings = { ...aiSettings, generationModel: selection, editModel: selection, referenceModel: selection, mockExplicit: true }; project.engineSetupDismissed = true; save("Mock 오프라인 모드를 명시적으로 선택했습니다."); renderWorkspace(); } else { project.workspaceMode = "models"; project.engineSetupDismissed = true; save(); renderWorkspace(); } }));
    appEl.querySelectorAll("[data-test-provider]").forEach((button) => button.addEventListener("click", async () => { button.disabled = true; button.textContent = "확인 중…"; try { const response = await fetch("/api/ai/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ providerId: button.dataset.testProvider }) }); const payload = await response.json(); providerStatuses[button.dataset.testProvider] = payload.status || (response.ok ? "connected" : "unavailable"); toast(payload.message || "연결 상태를 확인했습니다."); } catch { providerStatuses[button.dataset.testProvider] = "unavailable"; toast("로컬 AI 서버에 연결할 수 없습니다."); } renderWorkspace(); }));
    appEl.querySelector('[data-action="save-ai-routing"]')?.addEventListener("click", () => { const parse = (value) => { if (!value) return null; const [providerId, ...rest] = value.split("/"); return { providerId, modelId: rest.join("/") }; }; aiSettings.generationModel = parse(appEl.querySelector("#globalGenerationModel")?.value); aiSettings.editModel = parse(appEl.querySelector("#globalEditModel")?.value); aiSettings.referenceModel = aiSettings.generationModel; aiSettings.mockExplicit = [aiSettings.generationModel, aiSettings.editModel].some((selection) => selection?.providerId === "mock"); project.engineSetupDismissed = true; save("기본 AI 라우팅을 저장했습니다."); renderWorkspace(); });
    appEl.querySelector("#useGlobalRouting")?.addEventListener("change", (event) => { ensureExecutionState(project).useGlobalDefaults = event.target.checked; save(); renderWorkspace(); });
    appEl.querySelector('[data-action="run-study"]')?.addEventListener("click", () => { if (project.graph?.version === 2) return generateNormal(project); const study = activeStudy(project); const node = [...project.graph.nodes].reverse().find((item) => item.type === "ofat" && (study.path.includes("lighting") ? item.settings.variable.includes("lighting") : item.settings.variable.includes("camera"))) || project.graph.nodes.find((item) => item.type === "ofat"); if (node) { node.settings.variable = study.path; node.settings.values = study.values.join(", "); runOfat(project, node); } });
    appEl.querySelectorAll('[data-action="generate"]').forEach((button) => button.addEventListener("click", () => generateNormal(project)));
    appEl.querySelector('[data-action="clear-results-selection"]')?.addEventListener("click", () => { project.selectedExperimentIds = []; save(); renderWorkspace(); });
    appEl.querySelector('[data-action="add-default-node"]')?.addEventListener("click", () => addNode(project, "representation"));
    appEl.querySelector('[data-action="add-camera-module"]')?.addEventListener("click", () => addModule(project, "camera-study"));
    appEl.querySelectorAll('[data-action="open-cluster"]').forEach((button) => button.addEventListener("click", (event) => { event.stopPropagation(); const cluster = project.graph.nodes.find((node) => node.id === button.dataset.clusterId); if (!cluster?.settings?.subgraph) return; project.graphStack ||= []; project.graphStack.push({ graph: project.graph, selectedNodeId: project.selectedNodeId }); project.graph = cluster.settings.subgraph; project.selectedNodeId = project.graph.nodes[0]?.id || null; renderWorkspace(); }));
    appEl.querySelector('[data-action="close-cluster"]')?.addEventListener("click", () => { const parent = project.graphStack?.pop(); if (!parent) return; project.graph = parent.graph; project.selectedNodeId = parent.selectedNodeId; save("상위 그래프로 돌아왔습니다."); renderWorkspace(); });
    appEl.querySelectorAll("[data-add-node]").forEach((button) => button.addEventListener("click", () => addNode(project, button.dataset.addNode)));
    appEl.querySelectorAll("[data-add-module]").forEach((button) => button.addEventListener("click", () => addModule(project, button.dataset.addModule)));
    appEl.querySelectorAll("[data-add-custom]").forEach((button) => button.addEventListener("click", () => addModule(project, null, customModules.find((module) => module.id === button.dataset.addCustom))));
    appEl.querySelector('[data-action="save-module"]')?.addEventListener("click", () => saveSelectionAsModule(project));
    bindGraph(project);
    if (["image", "region"].includes(project.workspaceMode)) bindImageWorkspace(project);
    bindInspector(project);
    bindResults(project);
  }

  function bindImageWorkspace(project) {
    const canvas = appEl.querySelector("#imageModeMaskCanvas"), ctx = canvas?.getContext("2d"); if (!canvas || !ctx) return;
    const active = project.representation.regions.find((region) => region.id === project.activeRegionId);
    if (active?.maskDataUrl) { const image = new Image(); image.onload = () => ctx.drawImage(image, 0, 0, canvas.width, canvas.height); image.src = active.maskDataUrl; }
    const point = (event) => { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height }; };
    const draw = (event) => { if (!maskRuntime.drawing) return; const p = point(event); ctx.globalCompositeOperation = maskRuntime.tool === "eraser" ? "destination-out" : "source-over"; ctx.fillStyle = "rgba(37,89,77,1)"; ctx.beginPath(); ctx.arc(p.x, p.y, maskRuntime.size / 2, 0, Math.PI * 2); ctx.fill(); };
    canvas.addEventListener("pointerdown", (event) => { maskRuntime.drawing = true; canvas.setPointerCapture(event.pointerId); draw(event); }); canvas.addEventListener("pointermove", draw); canvas.addEventListener("pointerup", () => maskRuntime.drawing = false);
    appEl.querySelectorAll("[data-image-tool]").forEach((button) => button.addEventListener("click", () => { maskRuntime.tool = button.dataset.imageTool; appEl.querySelectorAll("[data-image-tool]").forEach((item) => item.classList.toggle("accent", item === button)); }));
    appEl.querySelector("#imageBrushSize")?.addEventListener("input", (event) => maskRuntime.size = Number(event.target.value));
    appEl.querySelector('[data-action="image-clear"]')?.addEventListener("click", () => ctx.clearRect(0, 0, canvas.width, canvas.height));
    appEl.querySelector('[data-action="image-done"]')?.addEventListener("click", () => {
      const current = project.representation.regions.find((region) => region.id === project.activeRegionId); const data = canvas.toDataURL("image/png");
      if (current) current.maskDataUrl = data; else { const name = prompt("Region name", `Region ${String(project.representation.regions.length + 1).padStart(2, "0")}`) || "Region"; const region = blankRegion(name, data); project.representation.regions.push(region); project.activeRegionId = region.id; }
      const editNode = project.graph.nodes.find((item) => item.type === "regionEdit"); if (editNode) project.selectedNodeId = editNode.id;
      project.workspaceMode = "image"; save("Region mask를 확정했습니다."); renderWorkspace();
    });
    appEl.querySelectorAll("[data-image-region]").forEach((button) => button.addEventListener("click", () => { project.activeRegionId = button.dataset.imageRegion; save(); renderWorkspace(); }));
  }

  function bindGraph(project) {
    appEl.querySelectorAll(".node").forEach((element) => {
      const node = project.graph.nodes.find((item) => item.id === element.dataset.nodeId);
      const head = element.querySelector(".node-head"), checkbox = element.querySelector(".node-check");
      checkbox?.addEventListener("click", (event) => { event.stopPropagation(); const id = node.id; project.selectedNodeIds = checkbox.checked ? [...new Set([...project.selectedNodeIds, id])] : project.selectedNodeIds.filter((item) => item !== id); save(); renderWorkspace(); });
      element.addEventListener("click", (event) => { if (event.target.closest("input,select,button")) return; project.selectedNodeId = node.id; save(); renderWorkspace(); });
      head.addEventListener("pointerdown", (event) => {
        if (event.target.closest("input")) return;
        event.preventDefault(); event.stopPropagation();
        project.selectedNodeId = node.id;
        const start = { x: event.clientX, y: event.clientY, nodeX: node.x, nodeY: node.y };
        head.setPointerCapture(event.pointerId);
        const move = (moveEvent) => { node.x = clamp(start.nodeX + moveEvent.clientX - start.x, 20, 1620); node.y = clamp(start.nodeY + moveEvent.clientY - start.y, 50, 1000); element.style.left = `${node.x}px`; element.style.top = `${node.y}px`; };
        const up = () => { head.removeEventListener("pointermove", move); head.removeEventListener("pointerup", up); save(); renderWorkspace(); };
        head.addEventListener("pointermove", move); head.addEventListener("pointerup", up);
      });
    });
    if (project.graph?.version !== 2 || !globalThis.VRL_GRAPH) return;
    appEl.querySelectorAll("[data-parameter-editor]").forEach((input) => {
      ["pointerdown", "click"].forEach((eventName) => input.addEventListener(eventName, (event) => event.stopPropagation()));
      const update = () => {
        const nodeId = input.dataset.parameterEditor;
        const value = input.type === "checkbox" ? input.checked : input.value;
        try { globalThis.VRL_GRAPH.setParameterValue(project.graph, nodeId, value); syncGraphState(project); save(); }
        catch (error) { toast(error.message); }
      };
      const liveInput = ["range", "number", "text"].includes(input.type) && input.tagName !== "SELECT";
      input.addEventListener(liveInput ? "input" : "change", () => { update(); if (liveInput) { if (["range", "number"].includes(input.type)) { const peerType = input.type === "range" ? "number" : "range"; const peer = appEl.querySelector(`input[type="${peerType}"][data-parameter-editor="${input.dataset.parameterEditor}"]`); if (peer) peer.value = input.value; } const editedNode = project.graph.nodes.find((candidate) => candidate.id === input.dataset.parameterEditor); if (editedNode?.type === "list") { const editor = input.closest(".list-editor"); const values = editedNode.settings.value || []; const count = editor?.querySelector("span"); const summary = editor?.querySelector("b"); if (count) count.textContent = `∷ ${values.length} ITEMS`; if (summary) summary.textContent = `[${values.join(", ")}] ${editedNode.settings.unit || ""}`; } refreshGraphSummaries(project); } else renderWorkspace(); });
    });
    appEl.querySelectorAll('[data-port-direction="output"]').forEach((port) => {
      const begin = (event) => { event.preventDefault(); event.stopPropagation(); project.pendingGraphConnection = { fromNodeId: port.dataset.portNodeId, fromPortId: port.dataset.portId }; port.classList.add("pending"); };
      port.addEventListener("pointerdown", begin); port.addEventListener("click", begin);
    });
    appEl.querySelectorAll('[data-port-direction="input"]').forEach((port) => {
      const complete = (event) => {
        event.preventDefault(); event.stopPropagation(); const pending = project.pendingGraphConnection; if (!pending) return;
        const draft = { ...pending, toNodeId: port.dataset.portNodeId, toPortId: port.dataset.portId };
        try { globalThis.VRL_GRAPH.connect(project.graph, draft); syncGraphState(project); toast("연결했습니다."); }
        catch (error) {
          if (error.code === "INPUT_OCCUPIED" && confirm(`${error.message}\n\n기존 연결을 교체할까요?\n혼합이 필요하면 취소 후 STYLE MIX를 삽입하세요.`)) {
            globalThis.VRL_GRAPH.connect(project.graph, draft, { mode: "replace" }); syncGraphState(project); toast("기존 연결을 교체했습니다.");
          } else toast(error.message);
        }
        project.pendingGraphConnection = null; save(); renderWorkspace();
      };
      port.addEventListener("pointerup", complete); port.addEventListener("click", complete);
    });
  }

  function bindInspector(project) {
    const node = selectedNode(project); if (!node) return;
    appEl.querySelector("[data-delete-node]")?.addEventListener("click", () => {
      const id = node.id; if (project.graph?.version === 2) globalThis.VRL_GRAPH.removeNode(project.graph, id); else { project.graph.nodes = project.graph.nodes.filter((item) => item.id !== id); project.graph.edges = project.graph.edges.filter((edge) => edge.from !== id && edge.to !== id); } project.selectedNodeIds = project.selectedNodeIds.filter((item) => item !== id); project.selectedNodeId = project.graph.nodes[0]?.id || null; if (project.graph?.version === 2) syncGraphState(project); save("노드를 삭제했습니다."); renderWorkspace();
    });
    appEl.querySelectorAll("[data-mode-path]").forEach((button) => button.addEventListener("click", () => { const attribute = pathGet(project.representation, button.dataset.modePath); attribute.mode = button.dataset.mode; attribute.source = "user"; save(); renderWorkspace(); }));
    appEl.querySelectorAll("[data-attr-path]").forEach((input) => input.addEventListener(input.type === "range" ? "input" : "change", () => {
      const attribute = pathGet(project.representation, input.dataset.attrPath); const old = attribute.value;
      attribute.value = typeof old === "number" ? Number(input.value) : input.value; attribute.source = "user"; if (attribute.mode === "free") attribute.mode = "controlled";
      appEl.querySelectorAll("[data-attr-path]").forEach((peer) => { if (peer !== input && peer.dataset.attrPath === input.dataset.attrPath) peer.value = input.value; });
      save(); if (input.type !== "range") renderWorkspace(); else refreshGraphSummaries(project);
    }));
    appEl.querySelectorAll("[data-strength-path]").forEach((input) => input.addEventListener("input", () => { const attribute = pathGet(project.representation, input.dataset.strengthPath); attribute.strength = Number(input.value); attribute.source = "user"; input.nextElementSibling.textContent = `strength ${input.value}`; save(); }));
    appEl.querySelectorAll("[data-boolean-path]").forEach((button) => button.addEventListener("click", () => { const attribute = pathGet(project.representation, button.dataset.booleanPath); attribute.value = !attribute.value; attribute.source = "user"; save(); renderWorkspace(); }));
    bindNodeSpecificInspector(project, node);
  }

  function refreshGraphSummaries(project) {
    appEl.querySelectorAll(".node").forEach((element) => { const node = project.graph.nodes.find((item) => item.id === element.dataset.nodeId); const body = element.querySelector(".node-body"); if (node && body && !(project.graph?.version === 2 && node.kind === "parameter")) body.innerHTML = nodeSummary(project, node); });
  }

  function bindNodeSpecificInspector(project, node) {
    appEl.querySelector('[data-action="apply-camera-preset"]')?.addEventListener("click", () => { const preset = CAMERA_PRESETS[appEl.querySelector("#cameraPreset").value]; Object.entries(preset).forEach(([key, value]) => { Object.assign(project.representation.global.camera[key], { value, source: "preset", mode: "controlled" }); }); save("Camera preset을 적용했습니다."); renderWorkspace(); });
    appEl.querySelector('[data-action="apply-lighting-preset"]')?.addEventListener("click", () => { const preset = LIGHTING_PRESETS[appEl.querySelector("#lightingPreset").value]; Object.entries(preset).forEach(([key, value]) => { Object.assign(project.representation.global.lighting[key], { value, source: "preset", mode: "controlled" }); }); save("Lighting preset을 적용했습니다."); renderWorkspace(); });
    appEl.querySelector("#fovInput")?.addEventListener("input", (event) => { const camera = project.representation.global.camera; camera.focalLengthMm.value = focalFromFov(camera.sensor.value, Number(event.target.value)); camera.focalLengthMm.source = "user"; event.target.nextElementSibling.textContent = `${event.target.value}°`; save(); refreshGraphSummaries(project); });
    appEl.querySelector("#sourceImageInput")?.addEventListener("change", (event) => readFiles(event.target.files, (images) => { project.sourceImage = images[0] || null; save("소스 이미지를 저장했습니다."); renderWorkspace(); }));
    appEl.querySelector('[data-action="clear-source"]')?.addEventListener("click", () => { project.sourceImage = null; save(); renderWorkspace(); });
    appEl.querySelector("#referenceImageInput")?.addEventListener("change", (event) => readFiles(event.target.files, (images) => { project.referenceImages.push(...images); save("레퍼런스를 저장했습니다."); renderWorkspace(); }));
    appEl.querySelector('[data-action="analyze-reference"]')?.addEventListener("click", () => analyzeReference(project, node));
    appEl.querySelectorAll("[data-transfer-key]").forEach((button) => button.addEventListener("click", () => transferReferenceAttribute(project, node, button.dataset.transferKey)));
    if (node.type === "regionMask") bindMaskEditor(project);
    if (node.type === "regionEdit") bindRegionEdit(project);
    if (node.type === "ofat") bindOfat(project, node);
    if (node.type === "altBuilder") bindAlt(project, node);
    if (project.graph?.version !== 2 && ["representation", "compiler"].includes(node.type)) bindOutputPresets(project);
    if (["generator", "generate"].includes(node.type)) bindGeneratorInspector(project, node);
    appEl.querySelector('[data-action="generate-region"]')?.addEventListener("click", () => generateRegion(project));
  }

  function bindGeneratorInspector(project, node) {
    const execution = ensureExecutionState(project);
    appEl.querySelector("#generatorRoutingMode")?.addEventListener("change", (event) => { if (event.target.value === "project") delete execution.generatorOverrides[node.id]; else { const base = effectiveSelection(project, "generation") || { providerId: "mock", modelId: "mock-image-v1" }; execution.generatorOverrides[node.id] = clone(base); if (base.providerId === "mock") aiSettings.mockExplicit = true; } save(); renderWorkspace(); });
    appEl.querySelector("#generatorModelSelect")?.addEventListener("change", (event) => { const [providerId, ...rest] = event.target.value.split("/"); execution.generatorOverrides[node.id] = { providerId, modelId: rest.join("/") }; if (providerId === "mock") aiSettings.mockExplicit = true; save(); renderWorkspace(); });
    appEl.querySelector("#generationAspect")?.addEventListener("change", (event) => { execution.aspectRatio = event.target.value; save(); renderWorkspace(); });
    appEl.querySelector("#generationQuality")?.addEventListener("change", (event) => { execution.quality = event.target.value; save(); });
    appEl.querySelector("#generationCount")?.addEventListener("change", (event) => { execution.count = clamp(Number(event.target.value), 1, 4); save(); renderWorkspace(); });
  }

  function bindOutputPresets(project) {
    appEl.querySelector("#representationPreset")?.addEventListener("change", (event) => { applyOutputPreset(project.representation, "representation", event.target.value); save("표현 프리셋을 적용했습니다."); renderWorkspace(); });
    appEl.querySelector("#designStylePreset")?.addEventListener("change", (event) => { applyOutputPreset(project.representation, "design", event.target.value); save("디자인 스타일 프리셋을 적용했습니다."); renderWorkspace(); });
    appEl.querySelector("#representationPresetStrength")?.addEventListener("input", (event) => { const selection = project.representation.global.output.representationPreset; selection.strength = Number(event.target.value); selection.source = "preset"; event.target.nextElementSibling.textContent = `강도 ${event.target.value}`; save(); });
    appEl.querySelector("#designStylePresetStrength")?.addEventListener("input", (event) => { const selection = project.representation.global.output.designStylePreset; selection.strength = Number(event.target.value); selection.source = "preset"; event.target.nextElementSibling.textContent = `강도 ${event.target.value}`; save(); });
    appEl.querySelector("#userExclusions")?.addEventListener("change", (event) => { const exclusions = project.representation.global.output.userExclusions; exclusions.value = event.target.value; exclusions.source = "user"; exclusions.mode = "controlled"; save(); renderWorkspace(); });
  }

  function readFiles(fileList, callback) {
    const files = [...(fileList || [])]; if (!files.length) return;
    Promise.all(files.map((file) => new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsDataURL(file); }))).then(callback);
  }

  function findAnalyzerNode(project, selected) {
    return selected.type === "referenceAnalyzer" ? selected : project.graph.nodes.find((item) => item.type === "referenceAnalyzer") || selected;
  }
  function analyzeReference(project, selected) {
    const analyzer = findAnalyzerNode(project, selected), name = appEl.querySelector("#referencePreset").value;
    analyzer.settings.preset = name;
    analyzer.settings.analyzed = Object.entries(REFERENCE_PRESETS[name]).map(([key, [value, strength]]) => ({ key, value, strength, source: "reference" }));
    save("레퍼런스를 불투명한 style이 아닌 속성으로 분해했습니다."); renderWorkspace();
  }
  function transferReferenceAttribute(project, selected, key) {
    const analyzer = findAnalyzerNode(project, selected), item = analyzer.settings.analyzed.find((candidate) => candidate.key === key); if (!item) return;
    const targetPaths = { medium: "global.appearance.medium", palette: "global.appearance.palette", detailDensity: "global.appearance.detailDensity", texture: "global.appearance.texture", atmosphere: "global.appearance.atmosphere", lightingCharacter: "global.appearance.lightingCharacter", material: "global.material.primary" };
    const attribute = pathGet(project.representation, targetPaths[key]);
    if (!attribute) return;
    if (attribute.mode === "locked") { alert(`${key} 속성이 LOCKED 상태입니다.`); return; }
    Object.assign(attribute, { value: item.value, strength: item.strength, source: "reference", mode: "controlled", enabled: true });
    save(`${key}만 Representation State에 전이했습니다.`); renderWorkspace();
  }

  function blankRegion(name, maskDataUrl) {
    return { id: uid("region"), name, maskDataUrl, operation: "replace", instruction: "Replace only the selected object", referenceImages: [], attributes: { material: attr("brushed stainless steel", "controlled", "user", 80), color: attr("natural metal", "controlled", "user", 70), form: attr("preserve current proportions", "controlled", "system", 90), texture: attr("fine brushed texture", "controlled", "user", 65), detail: attr("medium", "controlled", "system", 60) }, preserve: { position: true, scale: true, orientation: true, geometry: true, lighting: true, surroundings: true } };
  }

  function bindMaskEditor(project) {
    const canvas = appEl.querySelector("#maskCanvas"), ctx = canvas?.getContext("2d"); if (!canvas || !ctx) return;
    maskRuntime.canvas = canvas; maskRuntime.ctx = ctx;
    const active = project.activeRegionId ? project.representation.regions.find((region) => region.id === project.activeRegionId) : null;
    if (active?.maskDataUrl) { const image = new Image(); image.onload = () => ctx.drawImage(image, 0, 0, canvas.width, canvas.height); image.src = active.maskDataUrl; }
    const point = (event) => { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height }; };
    const draw = (event) => { if (!maskRuntime.drawing) return; const p = point(event); ctx.globalCompositeOperation = maskRuntime.tool === "eraser" ? "destination-out" : "source-over"; ctx.fillStyle = "rgba(214,91,61,1)"; ctx.beginPath(); ctx.arc(p.x, p.y, maskRuntime.size / 2, 0, Math.PI * 2); ctx.fill(); };
    canvas.addEventListener("pointerdown", (event) => { maskRuntime.drawing = true; canvas.setPointerCapture(event.pointerId); draw(event); });
    canvas.addEventListener("pointermove", draw); canvas.addEventListener("pointerup", () => { maskRuntime.drawing = false; });
    appEl.querySelectorAll("[data-mask-tool]").forEach((button) => button.addEventListener("click", () => { maskRuntime.tool = button.dataset.maskTool; appEl.querySelectorAll("[data-mask-tool]").forEach((item) => item.classList.toggle("active", item === button)); }));
    appEl.querySelector('[data-action="clear-mask"]')?.addEventListener("click", () => ctx.clearRect(0, 0, canvas.width, canvas.height));
    appEl.querySelector('[data-action="new-region"]')?.addEventListener("click", () => { project.activeRegionId = null; save(); renderWorkspace(); });
    appEl.querySelector('[data-action="toggle-mask"]')?.addEventListener("click", (event) => { maskRuntime.visible = !maskRuntime.visible; canvas.style.display = maskRuntime.visible ? "block" : "none"; event.currentTarget.textContent = maskRuntime.visible ? "마스크 표시" : "마스크 숨김"; });
    appEl.querySelector("#brushSize")?.addEventListener("input", (event) => { maskRuntime.size = Number(event.target.value); });
    appEl.querySelector("#maskOpacity")?.addEventListener("input", (event) => { maskRuntime.opacity = Number(event.target.value) / 100; canvas.style.opacity = maskRuntime.opacity; });
    appEl.querySelector('[data-action="create-region"]')?.addEventListener("click", () => {
      const name = appEl.querySelector("#newRegionName").value.trim() || "Region"; const data = canvas.toDataURL("image/png");
      const current = project.representation.regions.find((region) => region.id === project.activeRegionId);
      if (current) { current.name = name; current.maskDataUrl = data; } else { const region = blankRegion(name, data); project.representation.regions.push(region); project.activeRegionId = region.id; }
      Object.values(project.representation.global.camera).forEach((attribute) => attribute.mode = "locked");
      [project.representation.global.content.geometry, project.representation.global.content.composition].forEach((attribute) => attribute.mode = "locked");
      Object.values(project.representation.global.lighting).forEach((attribute) => attribute.mode = "locked");
      save("독립 마스크 Region을 저장했습니다."); renderWorkspace();
    });
    appEl.querySelectorAll("[data-region-id]").forEach((button) => button.addEventListener("click", () => { project.activeRegionId = button.dataset.regionId; save(); renderWorkspace(); }));
  }

  function bindRegionEdit(project) {
    const region = project.representation.regions.find((item) => item.id === project.activeRegionId) || project.representation.regions[0]; if (!region) return;
    appEl.querySelector("#activeRegionSelect")?.addEventListener("change", (event) => { project.activeRegionId = event.target.value; save(); renderWorkspace(); });
    appEl.querySelector("#regionOperation")?.addEventListener("change", (event) => { region.operation = event.target.value; save(); renderWorkspace(); });
    appEl.querySelector("#regionInstruction")?.addEventListener("change", (event) => { region.instruction = event.target.value; save(); renderWorkspace(); });
    appEl.querySelectorAll("[data-region-attribute]").forEach((input) => input.addEventListener("change", () => { const attribute = region.attributes[input.dataset.regionAttribute]; attribute.value = input.value; attribute.source = "user"; attribute.mode = "controlled"; save(); renderWorkspace(); }));
    appEl.querySelectorAll("[data-preserve]").forEach((input) => input.addEventListener("change", () => { region.preserve[input.dataset.preserve] = input.checked; save(); }));
    appEl.querySelector("#regionReferenceInput")?.addEventListener("change", (event) => readFiles(event.target.files, (images) => { region.referenceImages.push(...images); save("Region 전용 레퍼런스를 저장했습니다."); renderWorkspace(); }));
  }

  function bindOfat(project, node) {
    appEl.querySelector("#ofatVariable")?.addEventListener("change", (event) => { node.settings.variable = event.target.value; if (event.target.value.includes("colorTemperature")) node.settings.values = "2700, 3000, 4000, 5500"; else if (event.target.value.includes("softness")) node.settings.values = "20, 45, 70, 95"; else if (event.target.value.includes("focalLength")) node.settings.values = "24, 35, 50, 85"; save(); renderWorkspace(); });
    appEl.querySelector("#ofatValues")?.addEventListener("change", (event) => { node.settings.values = event.target.value; save(); });
    appEl.querySelector('[data-action="run-ofat"]')?.addEventListener("click", () => runOfat(project, node));
  }

  function bindAlt(project, node) {
    appEl.querySelector("#altCount")?.addEventListener("change", (event) => { node.settings.alternatives = clamp(Number(event.target.value), 2, 8); save(); });
    appEl.querySelector("#altScope")?.addEventListener("change", (event) => { node.settings.scope = event.target.value; save(); });
    appEl.querySelector('[data-action="run-alt"]')?.addEventListener("click", () => runAlternatives(project, node));
  }

  async function generateNormal(project) {
    try {
      resolveExecution(project, null, false); updateGenerationStage("COMPILING REPRESENTATION", "표현 상태를 모델 지시로 변환 중");
      const parent = project.experiments[0]?.id || null;
      if (project.graph?.version === 2) {
        const evaluation = evaluateProjectGraph(project);
        if (!evaluation?.variants.length) throw new globalThis.VRL_GRAPH.GraphError("MISSING_GENERATION_PLAN", "GENERATE에 필요한 그래프 입력을 연결하세요.", { diagnostics: evaluation?.diagnostics || [] });
        const created = [];
        for (let index = 0; index < evaluation.variants.length; index += 1) {
          const variant = evaluation.variants[index];
          const variantEvaluation = { representationState: variant.representationState, compiledInstruction: variant.compiledInstruction, provenance: variant.provenance, generatorNodeId: evaluation.generatorNodeId };
          const changed = parent ? diffRepresentations(project.experiments[0].representationState, variant.representationState) : [];
          const suffix = changed[0] ? `${changed[0].path.split(".").pop()} ${changed[0].after?.value}` : `${index + 1}`;
          created.push(await createExperiment(project, variant.representationState, evaluation.variants.length > 1 ? `ITERATE · ${suffix}` : project.experiments.length ? `Iteration ${project.experiments.length}` : "Baseline", parent, null, true, variantEvaluation));
        }
        project.experiments.unshift(...created.reverse()); project.selectedExperimentIds = evaluation.variants.length > 1 ? created.slice(0, 2).map((item) => item.id) : [created[0].id, ...project.selectedExperimentIds].slice(0, 2); generationRuntime.stage = null; save(evaluation.variants.length > 1 ? `ITERATE ${evaluation.variants.length}개 snapshot을 저장했습니다.` : "Graph snapshot을 저장했습니다."); renderWorkspace(); return;
      }
      const experiment = await createExperiment(project, project.representation, project.experiments.length ? `Iteration ${project.experiments.length}` : "Baseline", parent, null, true);
      project.experiments.unshift(experiment); project.selectedExperimentIds = [experiment.id, ...project.selectedExperimentIds].slice(0, 2); generationRuntime.stage = null; save("Generation snapshot을 저장했습니다."); renderWorkspace();
    } catch (error) { generationRuntime.stage = null; generationRuntime.error = { code: error.code || "UNKNOWN", message: error.message, details: error.details || null }; renderWorkspace(); }
  }
  async function generateRegion(project) {
    const region = project.representation.regions.find((item) => item.id === project.activeRegionId); if (!region) return;
    try {
      resolveExecution(project, region, false); updateGenerationStage("COMPILING REGION", `${region.name} 로컬 상태`);
      const experiment = await createExperiment(project, project.representation, `Region Edit · ${region.name}`, project.experiments[0]?.id || null, region, true);
      project.experiments.unshift(experiment); project.selectedExperimentIds = [experiment.id, ...project.selectedExperimentIds].slice(0, 2); generationRuntime.stage = null; save("Region edit snapshot을 저장했습니다."); renderWorkspace();
    } catch (error) { generationRuntime.stage = null; generationRuntime.error = { code: error.code || "UNKNOWN", message: error.message, details: error.details || null }; renderWorkspace(); }
  }
  async function runOfat(project, node) {
    if (project.graph?.version === 2) return generateNormal(project);
    const path = node.settings.variable, rawValues = node.settings.values.split(",").map((value) => value.trim()).filter(Boolean), base = clone(project.representation), baseAttr = pathGet(base, path);
    const values = rawValues.map((value) => typeof baseAttr.value === "number" ? Number(value) : value).filter((value) => typeof value !== "number" || Number.isFinite(value)); if (!values.length) return;
    const created = [];
    try { resolveExecution(project, null, false); } catch (error) { generationRuntime.error = { code: error.code || "UNKNOWN", message: error.message, details: error.details || null }; renderWorkspace(); return; }
    for (const value of values) { const variant = clone(base), attribute = pathGet(variant, path); attribute.value = value; const experiment = await createExperiment(project, variant, `OFAT · ${path.split(".").pop()} ${value}`, project.experiments[0]?.id || null, null, true); experiment.changedVariables = [path]; created.push(experiment); }
    project.experiments.unshift(...created.reverse()); project.selectedExperimentIds = created.slice(0, 2).map((item) => item.id); save(`OFAT ${values.length}개 snapshot을 생성했습니다.`); renderWorkspace();
  }
  async function runAlternatives(project, node) {
    const count = clamp(node.settings.alternatives || 4, 2, 8), variants = [
      { palette: "warm terracotta neutral", primary: "walnut", temperature: 3000, atmosphere: "intimate dining" },
      { palette: "cool mineral neutral", primary: "brushed stainless steel", temperature: 5000, atmosphere: "precise gallery-like" },
      { palette: "muted natural green", primary: "pale oak", temperature: 4000, atmosphere: "calm biophilic" },
      { palette: "high contrast monochrome", primary: "blackened timber", temperature: 3500, atmosphere: "graphic editorial" },
    ];
    const created = [];
    try { resolveExecution(project, null, false); } catch (error) { generationRuntime.error = { code: error.code || "UNKNOWN", message: error.message, details: error.details || null }; renderWorkspace(); return; }
    for (let i = 0; i < count; i++) { const variant = clone(project.representation), spec = variants[i % variants.length]; Object.assign(variant.global.appearance.palette, { value: spec.palette, source: "system", mode: "controlled" }); Object.assign(variant.global.material.primary, { value: spec.primary, source: "system", mode: "controlled" }); Object.assign(variant.global.lighting.colorTemperatureK, { value: spec.temperature, source: "system", mode: "controlled" }); Object.assign(variant.global.appearance.atmosphere, { value: spec.atmosphere, source: "system", mode: "controlled" }); created.push(await createExperiment(project, variant, `Alternative ${i + 1}`, project.experiments[0]?.id || null, null, true)); }
    project.experiments.unshift(...created.reverse()); project.selectedExperimentIds = created.slice(0, 2).map((item) => item.id); save("의도적 multi-variable alternatives를 생성했습니다."); renderWorkspace();
  }

  function bindResults(project) {
    appEl.querySelectorAll("[data-select-experiment]").forEach((image) => image.addEventListener("click", () => {
      const id = image.dataset.selectExperiment;
      project.selectedExperimentIds = project.selectedExperimentIds.includes(id) ? project.selectedExperimentIds.filter((item) => item !== id) : [...project.selectedExperimentIds.slice(-1), id];
      save(); renderWorkspace();
    }));
    appEl.querySelectorAll("[data-load-experiment]").forEach((button) => button.addEventListener("click", () => { const experiment = project.experiments.find((item) => item.id === button.dataset.loadExperiment); if (!experiment) return; if (experiment.graphSnapshot?.version === 2) { project.graph = clone(experiment.graphSnapshot); project.graphStack = []; project.representation = ensureOutputState(clone(experiment.representationState)); syncGraphState(project); project.workspaceMode = "system"; } else project.representation = ensureOutputState(clone(experiment.representationState)); save("그래프 스냅샷을 작업 상태로 불러왔습니다."); renderWorkspace(); }));
    appEl.querySelectorAll("[data-delete-experiment]").forEach((button) => button.addEventListener("click", () => { const id = button.dataset.deleteExperiment; project.experiments = project.experiments.filter((item) => item.id !== id); project.selectedExperimentIds = project.selectedExperimentIds.filter((item) => item !== id); save("Snapshot을 삭제했습니다."); renderWorkspace(); }));
    appEl.querySelectorAll("[data-eval-id]").forEach((select) => select.addEventListener("change", () => { const experiment = project.experiments.find((item) => item.id === select.dataset.evalId); experiment.evaluation[select.dataset.evalKey] = Number(select.value); save(); }));
    appEl.querySelectorAll("[data-failure-id]").forEach((select) => select.addEventListener("change", () => { const experiment = project.experiments.find((item) => item.id === select.dataset.failureId); experiment.evaluation.failureCause = select.value === "Failure cause…" ? "" : select.value; save(); }));
    appEl.querySelectorAll("[data-notes-id]").forEach((textarea) => textarea.addEventListener("change", () => { const experiment = project.experiments.find((item) => item.id === textarea.dataset.notesId); experiment.evaluation.notes = textarea.value; save(); }));
  }

  globalThis.__VRL_TEST__ = {
    templateConfigs, moduleConfigs, createProject, compileGlobal, compileRegionEdit,
    diffRepresentations, diffPrompts, horizontalFovDeg, focalFromFov,
    blankRegion, createExperiment, clone, ensureOutputState, applyOutputPreset,
    compileOutput, mergeExclusions, REPRESENTATION_PRESETS, DESIGN_STYLE_PRESETS,
    ensureExecutionState, routingCapability, resolveExecution,
    evaluateProjectGraph, syncGraphState,
    evaluateGraph: (graph) => globalThis.VRL_GRAPH.evaluateGraph(graph, { compile: compileGlobal }),
    connectGraph: (graph, draft, options) => globalThis.VRL_GRAPH.connect(graph, draft, options),
    disconnectGraph: (graph, criteria) => globalThis.VRL_GRAPH.disconnect(graph, criteria),
    setParameterValue: (graph, nodeId, value) => globalThis.VRL_GRAPH.setParameterValue(graph, nodeId, value),
    addParameterNode: (graph, settings, position) => globalThis.VRL_GRAPH.addParameterNode(graph, settings, position),
    addGraphNode: (graph, type, settings, position) => globalThis.VRL_GRAPH.addNode(graph, type, settings, position),
    removeGraphNode: (graph, nodeId) => globalThis.VRL_GRAPH.removeNode(graph, nodeId),
    runIterate: (project, iterateNodeId) => globalThis.VRL_GRAPH.runIterate(project, iterateNodeId, { compile: compileGlobal }),
    createClusterInstance: globalThis.VRL_GRAPH.createClusterInstance,
    validateGraph: globalThis.VRL_GRAPH.validateGraph,
    COMPONENT_DEFAULTS: globalThis.VRL_GRAPH.COMPONENT_DEFAULTS,
  };
  load();
  render();
  refreshProviderStatuses(true);
})();
