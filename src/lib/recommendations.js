/**
 * Preference-based suggestions, never a face or hair analysis.
 * All inputs describe what the user tells us; no image pixels are read here.
 */
export const DEFAULT_PREFERENCES = Object.freeze({
  presentation: 'feminine',
  texture: 'straight',
  density: 'medium',
  currentLength: 'medium',
  desiredLength: 'medium',
  maintenance: 'medium',
  goal: 'soften',
});

export const STYLES = [
  {
    id: 'curtain-layers',
    name: '帘式刘海层次剪',
    englishName: 'Curtain Layers',
    tagline: '用轻盈层次，留住长度',
    description: '中分或偏分的帘式刘海，衔接脸周的柔和层次。适合希望保留中长发、又想改变轮廓的人。',
    presentation: 'feminine',
    lengths: ['medium', 'long'],
    textures: ['straight', 'wavy'],
    maintenance: 'medium',
    goals: ['soften', 'fresh'],
    densities: ['medium', 'thick'],
    salonNotes: ['刘海从颧骨附近向两侧延伸，先保留长度再逐步调整。', '脸周做连接层次，后区保留饱满的底线。', '请根据真实发际线、旋和自然分缝确认刘海起点。'],
    cautions: ['刘海通常需要吹出方向，睡醒后可能要重新整理。', '细软或稀薄发避免把顶部和发尾打薄过度。'],
    demoKey: 'curtain-layers',
  },
  {
    id: 'airy-bob',
    name: '轻盈空气波波头',
    englishName: 'Airy Bob',
    tagline: '清爽轮廓，一点自然蓬松',
    description: '下颌到颈部之间的波波头，以轻微内扣和克制的层次带来柔和体积。具体落点需要由理发师现场确认。',
    presentation: 'feminine',
    lengths: ['short', 'medium'],
    textures: ['straight', 'wavy'],
    maintenance: 'medium',
    goals: ['soften', 'volume', 'fresh'],
    densities: ['fine', 'medium'],
    salonNotes: ['先讨论下颌到颈部的长度落点，保留足够重量。', '用少量内部层次减轻厚重感，不做大面积打薄。', '现场示范用吹风机整理发根和发尾。'],
    cautions: ['短发的形状变化较快，可能需要更频繁修剪。', '颈部发流和自然卷会影响发尾方向。'],
    demoKey: 'airy-bob',
  },
  {
    id: 'soft-waves',
    name: '柔和中长卷',
    englishName: 'Soft Waves',
    tagline: '松弛弧度，温柔而有动感',
    description: '保留中长发的重量，以宽松波纹和少量脸周层次增加动感。卷度取决于自然纹理或后续造型。',
    presentation: 'feminine',
    lengths: ['medium', 'long'],
    textures: ['wavy', 'curly'],
    maintenance: 'medium',
    goals: ['soften', 'volume'],
    densities: ['medium', 'thick'],
    salonNotes: ['保留中长发底线，让层次顺着自然纹理连接。', '先沟通想要的大弧度，避免只用“卷一点”描述。', '直发可先用临时造型体验，再讨论是否烫发。'],
    cautions: ['示意卷度无法仅靠剪发获得。', '烫发前需由理发师评估发质和既往漂染情况。'],
    demoKey: 'soft-waves',
  },
  {
    id: 'clean-lob',
    name: '自然锁骨直剪',
    englishName: 'Clean Lob',
    tagline: '利落底线，日常容易整理',
    description: '长度靠近锁骨，以完整底线和少量层次保留发量感。偏重自然垂落，适合减少每天的造型步骤。',
    presentation: 'feminine',
    lengths: ['medium'],
    textures: ['straight', 'wavy'],
    maintenance: 'low',
    goals: ['fresh'],
    densities: ['fine', 'medium', 'thick'],
    salonNotes: ['以锁骨附近为长度参考，预留自然干发后的回缩量。', '保留完整底线，先不增加明显的短层次。', '确认肩部是否会把发尾顶翘，再微调落点。'],
    cautions: ['碰到肩膀的发尾可能自然外翘。', '自然卷较明显时，成品会比直发参考更蓬松。'],
    demoKey: null,
  },
  {
    id: 'long-blunt',
    name: '自然长发齐剪',
    englishName: 'Long Blunt Cut',
    tagline: '保留重量，把日常交给自然',
    description: '保留长发，修整发尾并减少不必要的层次。适合重视可扎起、自然垂落和简单日常维护的人。',
    presentation: 'feminine',
    lengths: ['long'],
    textures: ['straight', 'wavy', 'curly'],
    maintenance: 'low',
    goals: ['fresh'],
    densities: ['fine', 'medium', 'thick'],
    salonNotes: ['说明希望保留的实际长度，先确认最多可以剪掉多少。', '清理分叉并保留底线，避免把细软发尾削薄。', '自然卷按干发回缩量决定最终长度。'],
    cautions: ['低打理指造型步骤较少，长发仍需要洗护和吹干时间。', '较厚重的长发可能让发根更贴头皮。'],
    demoKey: null,
  },
  {
    id: 'soft-pixie',
    name: '柔和精灵短发',
    englishName: 'Soft Pixie',
    tagline: '轻巧短发，露出清晰轮廓',
    description: '耳周和后颈收短，顶部保留少量可拨动的长度。每天造型可以简单，但需要定期维护剪裁。',
    presentation: 'feminine',
    lengths: ['short'],
    textures: ['straight', 'wavy', 'curly'],
    maintenance: 'low',
    goals: ['fresh', 'volume'],
    densities: ['fine', 'medium'],
    salonNotes: ['顶部保留可调整分缝和方向的长度。', '先讨论耳朵和后颈的露出程度。', '沿自然发流剪裁，并确认家中最简单的整理方式。'],
    cautions: ['每日造型可以很少，但需要定期修剪保持轮廓。', '发旋、发际线和自然卷会明显影响短发效果。'],
    demoKey: null,
  },
  {
    id: 'textured-crop',
    name: '自然纹理短碎',
    englishName: 'Textured Crop',
    tagline: '干净两侧，顶部保留纹理',
    description: '顶部留出少量自然纹理，额前可轻轻向前放，两侧渐短。适合希望日常步骤较少的短发选择。',
    presentation: 'masculine',
    lengths: ['short'],
    textures: ['straight', 'wavy', 'curly'],
    maintenance: 'low',
    goals: ['fresh', 'volume'],
    densities: ['medium', 'thick'],
    salonNotes: ['顶部保留可抓出纹理的长度，两侧按自然头形过渡。', '先确认额前要露出多少，再定刘海长度。', '细软发保留重量，避免过度打薄。'],
    cautions: ['短发仍需定期修剪两侧。', '硬直发剪得过短时可能自然竖起。'],
    demoKey: 'crop',
  },
  {
    id: 'side-part',
    name: '自然侧分',
    englishName: 'Natural Side Part',
    tagline: '顺着发流，留一点从容',
    description: '顶部保留能向侧边梳理的长度，两侧整洁过渡。适合喜欢清晰分缝、愿意简单吹整的人。',
    presentation: 'masculine',
    lengths: ['short', 'medium'],
    textures: ['straight', 'wavy'],
    maintenance: 'medium',
    goals: ['soften', 'fresh'],
    densities: ['fine', 'medium', 'thick'],
    salonNotes: ['顺自然分缝确定方向，不强行改变发旋。', '顶部保留足以侧梳的长度，两侧柔和连接。', '请理发师演示吹整和少量造型品的用法。'],
    cautions: ['保持分缝和顶部方向通常需要吹整。', '明显自然卷的成品会更有纹理。'],
    demoKey: 'side-part',
  },
  {
    id: 'textured-quiff',
    name: '蓬松前翘短发',
    englishName: 'Textured Quiff',
    tagline: '让顶部成为视觉重点',
    description: '额前和顶部保留高度，两侧收整，用吹风和造型品支撑向上、向后的纹理。适合愿意每天造型的人。',
    presentation: 'masculine',
    lengths: ['short', 'medium'],
    textures: ['straight', 'wavy'],
    maintenance: 'high',
    goals: ['volume', 'fresh'],
    densities: ['medium', 'thick'],
    salonNotes: ['额前保留足够长度，顶部与两侧连贯过渡。', '按实际发量决定高度，避免只照参考图追求体积。', '现场练习吹高发根和少量定型。'],
    cautions: ['需要较多日常吹整和定型。', '细软或稀薄发可能难以保持示意高度。'],
    demoKey: 'textured-quiff',
  },
  {
    id: 'buzz-cut',
    name: '均匀寸头',
    englishName: 'Buzz Cut',
    tagline: '极简长度，清爽直接',
    description: '整体剪至较短的均匀长度，减少日常造型步骤。头形、发际线和头皮会更明显。',
    presentation: 'masculine',
    lengths: ['short'],
    textures: ['straight', 'wavy', 'curly'],
    maintenance: 'low',
    goals: ['fresh'],
    densities: ['fine', 'medium', 'thick'],
    salonNotes: ['第一次可先用较长卡尺，确认效果后再逐步缩短。', '先讨论鬓角和后颈线条，再决定边缘是否渐变。', '请理发师结合发旋和头皮状态确认长度。'],
    cautions: ['短长度会更明显地露出头形、发际线和头皮。', '维持很短的轮廓仍需频繁修剪。'],
    demoKey: null,
  },
  {
    id: 'crew-cut',
    name: '经典平衡短发',
    englishName: 'Crew Cut',
    tagline: '顶部留一点，日常更轻松',
    description: '顶部略长于两侧，以简洁比例保留自然质感。适合想剪短，又希望顶部仍有少量变化的人。',
    presentation: 'masculine',
    lengths: ['short'],
    textures: ['straight', 'wavy', 'curly'],
    maintenance: 'low',
    goals: ['fresh', 'volume'],
    densities: ['fine', 'medium', 'thick'],
    salonNotes: ['顶部比两侧略长，按发旋调整过渡。', '先保留顶部重量，再决定需要多少纹理。', '确认是否希望不用造型品也能自然放下。'],
    cautions: ['硬直发和发旋可能让局部竖起。', '需要定期修剪才能维持两侧比例。'],
    demoKey: null,
  },
  {
    id: 'medium-flow',
    name: '自然中长流向',
    englishName: 'Medium Flow',
    tagline: '保留长度，让纹理自然展开',
    description: '耳周到颈部保留长度，层次顺着分缝和自然纹理连接。适合愿意经历留长阶段、喜欢柔和轮廓的人。',
    presentation: 'masculine',
    lengths: ['medium', 'long'],
    textures: ['straight', 'wavy', 'curly'],
    maintenance: 'medium',
    goals: ['soften'],
    densities: ['medium', 'thick'],
    salonNotes: ['保留耳周与后颈长度，让顶部层次自然连接。', '根据自然分缝和卷度决定层次位置。', '说明日常是否会扎起，并保留相应长度。'],
    cautions: ['由短发留长时会经过较难整理的过渡阶段。', '厚发可能需要适量减重，细软发应避免过多层次。'],
    demoKey: null,
  },
];

const LENGTHS = ['short', 'medium', 'long'];
const MAINTENANCE = ['low', 'medium', 'high'];
const LENGTH_LABELS = { short: '短发', medium: '中发', long: '长发' };
const GOAL_LABELS = { soften: '柔和轮廓', volume: '增加蓬松感', fresh: '清爽换新' };
const TEXTURE_LABELS = { straight: '直发', wavy: '微卷发', curly: '自然卷' };
const ALLOWED = {
  presentation: ['feminine', 'masculine', 'any'],
  texture: ['straight', 'wavy', 'curly'],
  density: ['fine', 'medium', 'thick'],
  currentLength: LENGTHS,
  desiredLength: LENGTHS,
  maintenance: MAINTENANCE,
  goal: ['soften', 'volume', 'fresh'],
};

function normalizePreferences(preferences) {
  const input = preferences && typeof preferences === 'object' ? preferences : {};
  return Object.fromEntries(Object.entries(DEFAULT_PREFERENCES).map(([key, fallback]) => [
    key,
    ALLOWED[key].includes(input[key]) ? input[key] : fallback,
  ]));
}

function closestLength(style, desiredLength) {
  const desiredIndex = LENGTHS.indexOf(desiredLength);
  return [...style.lengths].sort((a, b) => (
    Math.abs(LENGTHS.indexOf(a) - desiredIndex) - Math.abs(LENGTHS.indexOf(b) - desiredIndex)
  ))[0];
}

function scoreStyle(style, preferences, index) {
  const distance = Math.abs(LENGTHS.indexOf(closestLength(style, preferences.desiredLength)) - LENGTHS.indexOf(preferences.desiredLength));
  let score = distance === 0 ? 35 : -12 * distance;
  const effort = MAINTENANCE.indexOf(style.maintenance) - MAINTENANCE.indexOf(preferences.maintenance);
  score += effort > 0 ? -44 * effort : effort === 0 ? 28 : 14;
  score += style.textures.includes(preferences.texture) ? 16 : -8;
  score += style.goals.includes(preferences.goal) ? 18 : 0;
  score += style.densities.includes(preferences.density) ? 8 : -6;
  // A stable catalogue order resolves ties; there is no random ranking or confidence score.
  return { style, score, index };
}

function explain(style, preferences) {
  const targetLength = closestLength(style, preferences.desiredLength);
  const currentIndex = LENGTHS.indexOf(preferences.currentLength);
  const targetIndex = LENGTHS.indexOf(targetLength);
  const reasons = [];
  const requirements = [];

  if (style.lengths.includes(preferences.desiredLength)) {
    reasons.push(`符合你希望的${LENGTH_LABELS[preferences.desiredLength]}长度范围。`);
  } else {
    reasons.push(`作为替代方向：这款更接近${LENGTH_LABELS[targetLength]}，与你想要的${LENGTH_LABELS[preferences.desiredLength]}有差异。`);
  }

  if (style.goals.includes(preferences.goal)) {
    reasons.push(`剪裁方向贴近你选择的“${GOAL_LABELS[preferences.goal]}”。`);
  }

  if (style.textures.includes(preferences.texture)) {
    reasons.push(`可以结合你填写的${TEXTURE_LABELS[preferences.texture]}纹理调整，具体形状需现场确认。`);
  } else if (preferences.texture === 'straight') {
    requirements.push('你填写的是直发；示意卷度需要卷发棒、吹整或烫发，单靠剪发无法获得。');
  } else {
    requirements.push(`你填写的是${TEXTURE_LABELS[preferences.texture]}；若追求较顺直的轮廓，可能需要额外吹整，建议先保留自然纹理。`);
  }

  if (MAINTENANCE.indexOf(style.maintenance) <= MAINTENANCE.indexOf(preferences.maintenance)) {
    reasons.push(style.maintenance === 'low'
      ? '日常造型步骤较少，符合你的打理时间偏好；仍需正常洗护和定期修剪。'
      : '打理需求在你选择的时间投入范围内。');
  } else {
    requirements.push('这款需要的日常造型比你选择的打理投入更多，建议先请理发师演示再决定。');
  }

  if (targetIndex > currentIndex) {
    requirements.push(`你目前填写的是${LENGTH_LABELS[preferences.currentLength]}，需要先留长到${LENGTH_LABELS[targetLength]}范围；实际等待时间取决于现有长度和生长速度。`);
  } else if (targetIndex < currentIndex) {
    requirements.push(`从你目前的${LENGTH_LABELS[preferences.currentLength]}改为${LENGTH_LABELS[targetLength]}需要剪短，剪之前请确认可接受的长度。`);
  } else {
    requirements.push('当前长度类别大致合适，是否足够完成刘海或层次，仍需理发师检查实际长度。');
  }

  if (preferences.density === 'fine') {
    requirements.push(style.densities.includes('fine')
      ? '你填写的是细软／偏少发量，建议保留底线和重量，避免过度打薄；剪裁不能增加真实发量。'
      : '你填写的是细软／偏少发量，这款的饱满度可能受限；建议减少层次、保留重量，并与理发师确认。');
  } else if (preferences.density === 'thick') {
    requirements.push(style.densities.includes('thick')
      ? '你填写的是偏厚发量，可由理发师适量减重，并保留轮廓所需的支撑。'
      : '你填写的是偏厚发量，这款可能更容易膨胀，需要调整内部重量和层次。');
  }

  return {
    ...style,
    careLabel: { low: '轻松日常', medium: '简单吹整', high: '每日造型' }[style.maintenance],
    lengthLabel: style.lengths.map((length) => LENGTH_LABELS[length]).join(' / '),
    textureLabel: style.textures.map((texture) => TEXTURE_LABELS[texture]).join(' / '),
    reasons,
    requirements,
  };
}

/** Explains any selected catalogue style using the current preferences, including saved styles. */
export function explainStyle(style, preferences = DEFAULT_PREFERENCES) {
  return explain(style, normalizePreferences(preferences));
}

/** Returns three explainable catalogue suggestions based only on entered preferences. */
export function recommendStyles(preferences = DEFAULT_PREFERENCES) {
  const normalized = normalizePreferences(preferences);
  return STYLES
    .filter((style) => normalized.presentation === 'any' || style.presentation === normalized.presentation || style.presentation === 'any')
    .map((style, index) => scoreStyle(style, normalized, index))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3)
    .map(({ style }) => explain(style, normalized));
}
