/**
 * Looks shown on the homepage wall: real hairstyle photos hotlinked from
 * Unsplash (Unsplash License, credited to each photographer) plus the
 * project's own AI-generated sample models, which are always labelled as AI.
 * Nothing here is downloaded into the project; Unsplash serves the images.
 */
import { STYLES } from './recommendations.js';

const UNSPLASH = 'https://unsplash.com';
const REFERRAL = 'utm_source=hairroom&utm_medium=referral';

// [Unsplash photo id, CDN image id, photographer, username, gender,
//  中文名, English name, 一句话说明, matching studio style id or null]
const PHOTOS = [
  ['-LCwTy91CWI', '1608877607386-8698047d65a9', 'Dev Asangbam', 'devasangbam', 'f', '齐刘海黑波波', 'Glossy Blunt Bob', '齐下巴的光泽短发，刘海修饰额头', 'airy-bob'],
  ['XZvyT2u04i8', '1586266195531-76cfa365cb43', 'engin akyurt', 'enginakyurt', 'f', '红色齐刘海短发', 'Red Bob with Bangs', '鲜明发色配利落短发', null],
  ['nIp8LJKxntA', '1674867688577-0ba3be4b7773', 'MohammadReza BaBaei', 'mohammadrezababaei', 'f', '银灰精灵短发', 'Silver Pixie', '顶部蓬松，两侧服帖', 'soft-pixie'],
  ['2I-fXHM7OCQ', '1598771326492-f523d7bd3e89', 'Alistair Cowin', 'alistaircowin', 'f', '法式短发', 'French Crop', '短而柔软，露出五官', 'soft-pixie'],
  ['xUY5bVTQ5bs', '1576023614239-dd207a58658f', 'Lera Kogan', 'newyork_creator', 'f', '侧分精灵短发', 'Side-swept Pixie', '侧分刘海，清爽有型', 'soft-pixie'],
  ['uELbJdwULP4', '1565906353471-db6555b67554', 'Amin RK', 'amiwnrk', 'f', '刘海丸子头', 'Top Knot with Bangs', '高丸子头配齐刘海', null],
  ['TupudXrjKPc', '1628292180187-3bac5c5b3cb6', 'siamak poorjam', 'siamakpoorjam', 'f', '挑染齐刘海长发', 'Highlights & Bangs', '挑染出层次，刘海修饰脸型', null],
  ['7jq7AVxFzUc', '1626951239416-c3f0639dec35', 'Ahmad Ebadi', 'ebadi__ahmad', 'f', '八字刘海中长发', 'Curtain Bangs', '刘海向两侧散开，柔和脸部线条', 'curtain-layers'],
  ['0gJaYZigbZo', '1737064709497-078a80ded76b', 'Maria Kovalets', 'marylooo', 'f', '蓬松层次短发', 'Shaggy Layers', '碎发层次，自然蓬松', null],
  ['jXf8tIX0N44', '1772758058699-5b3f1abc384d', 'Nicolas Ladino Silva', 'nicolasladinosilva', 'f', '浓密齐刘海波波', 'Blunt Fringe Bob', '厚刘海配短发，复古利落', 'airy-bob'],
  ['Xbr_bQmf0nA', '1763560276646-8315f3fe55f7', 'Luigi Ritchie', 'luigir', 'f', '空气刘海长直发', 'Wispy Bangs', '轻薄刘海，长直柔顺', null],
  ['p5AxtVTJ4yk', '1654157984511-750e0a3fe51c', 'zana pq', 'zanapq', 'f', '撞色刘海波波', 'Two-tone Bob', '发色拼接，个性鲜明', null],
  ['CGKYNN3uuVo', '1614204424926-196a80bf0be8', 'Filipp Romanovski', 'filipp_roman_photography', 'f', '短卷发', 'Short Curls', '自然卷度，俏皮蓬松', null],
  ['a7itXABwl8U', '1595218841793-d38b949402d2', 'omid armin', 'itsomidarmin', 'f', '蓬松小卷', 'Bouncy Curls', '细密卷度，充满活力', null],
  ['qXzOsNZP7mA', '1569430548104-6ca1cda3ec41', 'Jude Infantini', 'judowoodo_', 'f', '长卷发', 'Long Curls', '长发大卷，自然垂坠', 'soft-waves'],
  ['RtVGS4vGkgM', '1599842057874-37393e9342df', 'Patrik Velich', 'patrikvelich', 'f', '中分长直发', 'Long & Straight', '中分长直，简单耐看', 'long-blunt'],
  ['tZx2TIOBQnQ', '1613099084406-4b9140fc780a', 'Gama. Films', 'gamafilms1703', 'f', '长辫编发', 'Long Braids', '细长编发，造型感强', null],
  ['dyW-gQ6GcIY', '1590954658566-7dcff7dfd75c', 'Johannes Krupinski', 'hanneskrupinski', 'f', '慵懒丸子头', 'Messy Bun', '随手一挽，松弛自在', null],
  ['DAaTr1dP1UM', '1760552069871-a7c3c99a2aae', 'amin naderloei', 'aminnaderloei', 'f', '高马尾', 'High Ponytail', '干净利落，露出脸部线条', null],
  ['_cvwXhGqG-o', '1519699047748-de8e457a634e', 'Jessica Felicio', 'jekafe', 'f', '蓬松爆炸头', 'Afro', '圆润饱满的自然卷', null],
  ['BOW0zIGpUGI', '1679466061812-211a6b737175', 'Gus Tu Njana', 'njanatugus', 'f', '光洁低盘发', 'Sleek Bun', '发丝服帖，干净优雅', null],
  ['JCLH7JXSeZs', '1657830582172-b1eb2880f497', 'Condor Wei', 'cwcanchn', 'f', '空气刘海黑长直', 'Long with Light Bangs', '轻盈刘海配黑长直', null],
  ['Xee9ayS4DQo', '1593350109594-e3babafe49e8', 'zhenzhong liu', 'lzzbest', 'f', '日系短波波', 'Short Bob', '齐下巴短发，清爽减龄', 'airy-bob'],
  ['hbQ5fHbpbXw', '1575818267535-ed0d5640edfe', 'Oleg Ivanov', 'olegivanovpht', 'f', '锁骨发', 'Lob', '发尾落在锁骨，日常好打理', 'clean-lob'],
  ['i5R8hbZFDdc', '1589525231707-f2de2428f59c', 'Thanh Duc PHAN', 'stiffduc', 'f', '黑长直', 'Sleek Long Hair', '顺直黑发，自然光泽', 'long-blunt'],
  ['OuxJHYeUYpk', '1600481176431-47ad2ab2745d', 'panitan punpuang', 'panitan', 'f', '自然中长发', 'Natural Mid-length', '不刻意造型的自然长度', null],
  ['xmSWVeGEnJw', '1632765854612-9b02b6ec2b15', 'Good Faces', 'goodfacesagency', 'f', '短卷爆炸头', 'Short Afro', '卷度紧密，轮廓圆润', null],
  ['5st86wYikQQ', '1618049049816-43a00d5b0c3d', 'Damian Barczak', 'barczakshoots', 'm', '渐变纹理飞机头', 'Textured Quiff Fade', '两侧渐变，顶部蓬松上翘', 'textured-quiff'],
  ['5EIW3DDX6dw', '1456327102063-fb5054efe647', 'Nathan Fertig', 'nathanfertig', 'm', '侧背渐变', 'Side-swept Fade', '发顶侧背，两侧干净', null],
  ['YZwS7pVARZU', '1673118306698-ffda943ec1b9', 'Thomas Marquize', 'tomarquize', 'm', '锅盖刘海', 'Crop Fringe', '厚重刘海，短而有型', 'textured-crop'],
  ['gD74r4_YXE8', '1616701878886-b6273a98d897', 'Jakob Rosen', 'jakobnoahrosen', 'm', '凌乱碎发', 'Messy Fringe', '随意碎发，少年感', null],
  ['JPM-7Ujv3zs', '1544964555-39d69aaccffe', 'Ramsheed k', 'ram11w', 'm', '长刘海侧分', 'Long Side Fringe', '刘海遮眉，偏分有层次', null],
  ['Ski5jkhduAY', '1645857195444-2064b4ecabf3', 'Lizzy Jenkins', 'lizzybug', 'm', '寸头', 'Buzz Cut', '极短均匀，清爽直接', 'buzz-cut'],
  ['L3s5QySz5UM', '1599834562135-b6fc90e642ca', 'Stephan Louis', 'stephanlouis', 'm', '侧分飞机头', 'Side-part Pompadour', '顶部蓬起，侧分利落', null],
  ['dqecEkA69WY', '1621095346111-a25f48b39b66', 'SAJAD FI', 'sajadfi', 'm', '复古背头', 'Slick Back', '向后梳理，成熟稳重', null],
  ['aoPiT3iUrpc', '1635567818469-e28cdf45c1f5', 'Gahara Putra', 'garpputra', 'm', '及肩卷发', 'Shoulder-length Waves', '及肩自然卷，松弛感', 'medium-flow'],
  ['CB9gWZPpoNU', '1698163224176-dea3b7739cf4', 'Alex Sheldon', 'slavewire', 'm', '金色长卷发', 'Long Blond Waves', '长发蓬松大卷', null],
  ['KyOASVcJL1I', '1783008242123-16134ba9c807', 'Anastasia Pivnenko', '_kano_', 'm', '男士长直发', 'Long & Straight', '长直发，个性鲜明', null],
  ['iQ7bPP7sl3k', '1676025911719-32ff252572e9', 'Yashar Molaee', 'yasharmag', 'm', '蓬松卷发', 'Curly Top', '卷发蓬松，自带体积', null],
  ['ntLkvt6OZvQ', '1681097561932-36d0df02b379', 'Anky Lau', 'anky', 'm', '清爽短发', 'Clean Short Cut', '短而整齐，干净利落', 'crew-cut'],
  ['gDoNB_BCkdE', '1509112552557-8eb3dab85cfc', 'Royal Anwar', 'royalanwar', 'm', '商务侧分', 'Classic Side Part', '侧分服帖，适合正式场合', 'side-part'],
  ['CO4tbl4qp7c', '1686543972602-da0c7ea61ce2', 'Bùi Hoàng Long', 'dxaxoxfz', 'm', '纹理刘海', 'Textured Crop', '短刘海配纹理感', 'textured-crop'],
  ['Z9LaTWt2Xac', '1655495684052-e310039397fc', 'nguyen quan', 'quan12355', 'm', '两块式短发', 'Two-block Cut', '两侧推短，顶部保留长度', null],
  ['JnlilXTcFXE', '1559100293-a2470e7301e0', 'Prakash Thapa', 'dad2love', 'm', '中长碎发', 'Shaggy Mid-length', '层次碎发，略带蓬松', null],
  ['TBUA5KHJn6k', '1518725522904-4b3939358342', 'Arjunsyah', 'arjunsyah_', 'm', '自然侧分', 'Natural Side Part', '顺着发流，自然不刻意', 'side-part'],
  ['emp0IDD7NOU', '1659857934338-cdd2eb5ccce6', 'Aejaz Memon', 'aejazmemon', 'm', '男士丸子头', 'Man Bun', '长发束起，干净有型', null],
  ['YMQBvzzmPi8', '1774544006012-e0efd92add27', 'Laszlo Barta', 'slie_design', 'm', '复古油头', 'Retro Slick', '油亮背梳，复古味道', null],
  ['Qmk2ZdUvh9w', '1783379793595-e2790e191285', 'Ben Iwara', '1hundredimages', 'm', '高顶卷发', 'High-top Curls', '顶部卷发堆叠，两侧短', null],
  ['Rtq9qhM3LOk', '1584029307290-2acd5258bde4', 'Thibault Debaene', 'iamthibault', 'm', '铜色纹理飞机头', 'Copper Textured Quiff', '暖调发色，顶部纹理', 'textured-quiff'],
  ['3a51XbqfJwE', '1762914395007-03ca29612b9f', 'abolfazl babaei', 'aban_pics', 'm', '背头侧分', 'Side Slick', '油头向后，线条分明', null],
  ['Zk8jloGF3fQ', '1705247815016-fb23ebf07a44', 'Hongwei FAN', 'yokonoito0512', 'm', '韩系染发', 'Bleached K-style', '浅色发色配蓬松刘海', null],
  ['2xRcVIO5wKI', '1705247372524-74c821873b6c', 'Hongwei FAN', 'yokonoito0512', 'm', '漂白短发', 'Platinum Crop', '浅白发色，短发清爽', null],
];

const styleById = (id) => (id ? STYLES.find((s) => s.id === id) ?? null : null);

export const PHOTO_LOOKS = PHOTOS.map(
  ([id, image, photographer, username, gender, name, englishName, tagline, styleId]) => ({
    id: `unsplash-${id}`,
    gender,
    image: `photo-${image}`,
    name,
    englishName,
    tagline,
    style: styleById(styleId),
    credit: {
      photographer,
      photographerUrl: `${UNSPLASH}/@${username}?${REFERRAL}`,
      photoUrl: `${UNSPLASH}/photos/${id}?${REFERRAL}`,
      unsplashUrl: `${UNSPLASH}/?${REFERRAL}`,
    },
  }),
);

// The project's own AI contact sheets: one fictional model per sheet, 2×2
// hairstyles each. See public/images/ASSETS.md.
const PANEL_POSITIONS = ['0% 0%', '100% 0%', '0% 100%', '100% 100%'];
const AI_SHEETS = [
  {
    gender: 'f',
    sheet: '/images/hairstyle-demo.png',
    original: { name: '自然长直发', tagline: '中长直发，自然分线' },
    keys: ['curtain-layers', 'airy-bob', 'soft-waves'],
  },
  {
    gender: 'm',
    sheet: '/images/hairstyle-demo-men.png',
    original: { name: '自然刘海短发', tagline: '没有刻意打理的自然碎发' },
    keys: ['crop', 'side-part', 'textured-quiff'],
  },
];

export const AI_LOOKS = AI_SHEETS.flatMap(({ gender, sheet, original, keys }) => [
  { key: 'original', name: original.name, englishName: 'Original', tagline: original.tagline, style: null },
  ...keys.map((key) => {
    const style = STYLES.find((s) => s.demoKey === key);
    return { key, name: style.name, englishName: style.englishName, tagline: style.tagline, style };
  }),
].map((look, i) => ({
  ...look,
  id: `ai-${gender}-${look.key}`,
  gender,
  ai: true,
  sheet,
  position: PANEL_POSITIONS[i],
})));

export const LOOKS = [...PHOTO_LOOKS, ...AI_LOOKS];

/** Square, face-centred crop served by Unsplash's image CDN. */
export function lookImageUrl(look, size) {
  return `https://images.unsplash.com/${look.image}?w=${size}&h=${size}&fit=crop&crop=faces&q=70&auto=format`;
}

/**
 * Choose the next look for a tile: never the one it shows now, and not one
 * shown on another tile while any other look is free.
 */
export function pickNext(pool, taken, current, random = Math.random) {
  const free = pool.filter((look) => look.id !== current && !taken.has(look.id));
  const options = free.length ? free : pool.filter((look) => look.id !== current);
  if (!options.length) return current;
  return options[Math.floor(random() * options.length)].id;
}
