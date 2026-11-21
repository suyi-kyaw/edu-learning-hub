const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Focused starter curriculum: HSK 2 only (all 5 exercise types included)
const lessons = [
  {
    id: "hsk2-01",
    course: "HSK 2",
    category: "HSK 2",
    categoryKey: "hsk2",
    categoryNum: "Course 1",
    title: "Ordering Food, Transit & Everyday Plans",
    chineseTitle: "餐厅点餐与日常出行交流",
    pinyin: "Cāntīng diǎncài yǔ rìcháng chūxíng jiāoliú",
    meaning: "Ordering meals, taking city transport, and coordinating daily plans",
    level: "HSK 2",
    description: "Build HSK 2 fluency across restaurants, taxis and subways, workplace scheduling, and everyday dialogues.",
    videoUrl: "assets/video/lesson-02.mp4",
    posterUrl: "assets/images/story-02.jpg",
    fullAudio: "assets/audio/lesson-02-full.mp3",
    keywords: "HSK 2, Dining, Transit, Schedule, Conversation",
    accessType: "paid",
    price: 9
  }
];

const rawExercises = [
  // =========================================================================
  // hsk2-01 (HSK 2) — Covers all 5 exercise types
  // =========================================================================
  {
    lessonId: "hsk2-01",
    order: 1,
    type: "multiple-choice",
    question: "When ordering food in a restaurant, how do you say 'Waiter, bring the menu please'?",
    optionA: "服务员，请给我菜单！",
    optionB: "服务员，买单！",
    optionC: "请问洗手间在哪儿？",
    optionD: "我要一杯冰茶。",
    answer: "服务员，请给我菜单！",
    explanation: "菜单 (càidān) means 'menu'; 请给我菜单 politely asks to see the menu."
  },
  {
    lessonId: "hsk2-01",
    order: 2,
    type: "multiple-choice",
    question: "What does '坐地铁去公司很快' (Zuò dìtiě qù gōngsī hěn kuài) mean?",
    optionA: "Taking the subway to the company is very fast",
    optionB: "Walking to the airport takes too long",
    optionC: "The bus stop is behind the restaurant",
    optionD: "Wait at the taxi stand outside",
    answer: "Taking the subway to the company is very fast",
    explanation: "地铁 (dìtiě) = subway, 公司 (gōngsī) = company/office, 很快 = very fast."
  },
  {
    lessonId: "hsk2-01",
    order: 3,
    type: "image-choice",
    audioUrl: "assets/audio/tian-haochi.mp3",
    question: "我想点一碗热腾腾的牛肉面。(I'd like to order a bowl of beef noodles.) Choose the matching picture.",
    optionA: "牛肉面 (Beef noodles)",
    optionB: "冰茶 (Iced tea)",
    optionC: "菜单 (Menu)",
    optionAImage: "assets/images/exercises/noodles-bowl.svg",
    optionBImage: "assets/images/exercises/iced-tea-cup.svg",
    optionCImage: "assets/images/exercises/menu-book.svg",
    answer: "A",
    explanation: "面 (miàn / noodles) matches the steaming bowl of noodles in picture A."
  },
  {
    lessonId: "hsk2-01",
    order: 4,
    type: "shared-image-match",
    groupId: "hsk2-transit-pic",
    groupTitle: "Part II: Match Picture A, B, C, or D to each HSK 2 travel dialogue.",
    pinyin: "Wǒ měitiān zǎoshang zuò dìtiě qù shàngbān.",
    question: "我每天早上坐地铁去上班，只要二十分钟。",
    optionA: "坐地铁 (Subway)",
    optionB: "出租车 (Taxi)",
    optionC: "坐飞机 (Airplane)",
    optionD: "菜单 (Menu)",
    optionAImage: "assets/images/exercises/subway-train.svg",
    optionBImage: "assets/images/exercises/taxi-cab.svg",
    optionCImage: "assets/images/exercises/airplane.svg",
    optionDImage: "assets/images/exercises/menu-book.svg",
    answer: "A",
    explanation: "地铁 (dìtiě) means subway/metro train (A)."
  },
  {
    lessonId: "hsk2-01",
    order: 5,
    type: "shared-image-match",
    groupId: "hsk2-transit-pic",
    groupTitle: "Part II: Match Picture A, B, C, or D to each HSK 2 travel dialogue.",
    pinyin: "Xiàyǔ le, wǒmen dǎ chūzūchē qù jīchǎng ba.",
    question: "外面下雨了，我们打出租车去火车站吧。",
    optionA: "坐地铁 (Subway)",
    optionB: "出租车 (Taxi)",
    optionC: "坐飞机 (Airplane)",
    optionD: "菜单 (Menu)",
    optionAImage: "assets/images/exercises/subway-train.svg",
    optionBImage: "assets/images/exercises/taxi-cab.svg",
    optionCImage: "assets/images/exercises/airplane.svg",
    optionDImage: "assets/images/exercises/menu-book.svg",
    answer: "B",
    explanation: "出租车 (chūzūchē) means taxi cab (B)."
  },
  {
    lessonId: "hsk2-01",
    order: 6,
    type: "shared-text-match",
    groupId: "hsk2-wordbank",
    groupTitle: "Sentence & Word Bank: Pick the best choice (A–E) for each HSK 2 sentence.",
    pinyin: "Zhè dào cài tài là le, wǒ bù xǐhuan (   ).",
    question: "这道菜太辣了，我不太喜欢 (   ) 辣的食物。",
    optionA: "吃 (chī)",
    optionB: "喝 (hē)",
    optionC: "买单 (mǎidān)",
    optionD: "左 (zuǒ)",
    optionE: "右 (yòu)",
    answer: "A",
    explanation: "吃 (chī) means 'to eat'."
  },
  {
    lessonId: "hsk2-01",
    order: 7,
    type: "shared-text-match",
    groupId: "hsk2-wordbank",
    groupTitle: "Sentence & Word Bank: Pick the best choice (A–E) for each HSK 2 sentence.",
    pinyin: "Chī bǎo le, fúwùyuán qǐng (   )!",
    question: "我们吃饱了，服务员，请 (   )！",
    optionA: "吃 (chī)",
    optionB: "喝 (hē)",
    optionC: "买单 (mǎidān)",
    optionD: "左 (zuǒ)",
    optionE: "右 (yòu)",
    answer: "C",
    explanation: "买单 (mǎidān) means 'to pay the bill / check please' (C)."
  },
  {
    lessonId: "hsk2-01",
    order: 8,
    type: "fill-blank",
    pinyin: "chá",
    question: "吃饭的时候我想喝一杯冰绿 (   )。",
    answer: "茶",
    explanation: "绿茶 (lǜchá) means 'green tea'."
  },
  {
    lessonId: "hsk2-01",
    order: 9,
    type: "fill-blank",
    pinyin: "zuǒ",
    question: "前面的路口往 (   ) 拐就是地铁站。",
    answer: "左",
    explanation: "往左拐 (wǎng zuǒ guǎi) means 'turn left'."
  }
];

const exercises = rawExercises.map((ex) => ({
  lessonId: ex.lessonId || "",
  order: ex.order || 1,
  type: ex.type || "multiple-choice",
  groupId: ex.groupId || "",
  groupTitle: ex.groupTitle || "",
  pinyin: ex.pinyin || "",
  question: ex.question || "",
  audioUrl: ex.audioUrl || "",
  optionA: ex.optionA || "",
  optionB: ex.optionB || "",
  optionC: ex.optionC || "",
  optionD: ex.optionD || "",
  optionE: ex.optionE || "",
  optionAImage: ex.optionAImage || "",
  optionBImage: ex.optionBImage || "",
  optionCImage: ex.optionCImage || "",
  optionDImage: ex.optionDImage || "",
  optionEImage: ex.optionEImage || "",
  answer: ex.answer || "",
  explanation: ex.explanation || ""
}));

const writing = [
  {
    lessonId: "hsk2-01",
    order: 1,
    character: "吃",
    pinyin: "chī",
    meaning: "to eat",
    strokeCount: 6,
    radical: "口 (Mouth)",
    strokeAnimationUrl: "",
    svgPath: "",
    strokeOrderSteps: "1. Vertical (丨), 2. Horizontal-turn (𠃍), 3. Horizontal (一), 4. Top slant (丿), 5. Horizontal (一), 6. Curved hook (乙)"
  },
  {
    lessonId: "hsk2-01",
    order: 2,
    character: "茶",
    pinyin: "chá",
    meaning: "tea",
    strokeCount: 9,
    radical: "艹 (Grass)",
    strokeAnimationUrl: "",
    svgPath: "",
    strokeOrderSteps: "1. Horizontal (一), 2. Left vertical (丨), 3. Right vertical (丨), 4. Slant (丿), 5. Right press (乀), 6. Horizontal (一), 7. Vertical hook (亅), 8. Left slant (丿), 9. Right dot (丶)"
  },
  {
    lessonId: "hsk2-01",
    order: 3,
    character: "左",
    pinyin: "zuǒ",
    meaning: "left",
    strokeCount: 5,
    radical: "工 (Work)",
    strokeOrderSteps: "1. Horizontal (一), 2. Left slant (丿), 3. Horizontal (一), 4. Vertical (丨), 5. Horizontal (一)"
  }
];

const vocabulary = [
  { lessonId: "hsk2-01", order: 1, character: "点菜", pinyin: "diǎn cài", meaning: "order dishes", audio: "assets/audio/tian-haochi.mp3" },
  { lessonId: "hsk2-01", order: 2, character: "买单", pinyin: "mǎidān", meaning: "pay the bill", audio: "assets/audio/tian-haochi.mp3" },
  { lessonId: "hsk2-01", order: 3, character: "地铁", pinyin: "dìtiě", meaning: "subway / metro", audio: "assets/audio/shichang.mp3" },
  { lessonId: "hsk2-01", order: 4, character: "出租车", pinyin: "chūzūchē", meaning: "taxi cab", audio: "assets/audio/shichang.mp3" },
  { lessonId: "hsk2-01", order: 5, character: "往左拐", pinyin: "wǎng zuǒ guǎi", meaning: "turn left", audio: "assets/audio/dianyingyuan.mp3" }
];

const games = [
  {
    id: "game-01",
    order: 1,
    title: "Tone Hunter — Character & Tone Matcher",
    category: "Tone Recognition",
    badge: "Wordwall Challenge 1",
    description: "Match Mandarin characters to their correct tone mark and phonetic pitch. Practice tonal accuracy and ear training.",
    embed_code: '<iframe style="max-width:100%" src="https://wordwall.net/embed/9dfb097b6b4a405ca39a08514e805030?themeId=27&templateId=82&fontStackId=0" width="500" height="380" frameborder="0" allowfullscreen></iframe>',
    embed_url: "https://wordwall.net/embed/9dfb097b6b4a405ca39a08514e805030?themeId=27&templateId=82&fontStackId=0",
    width: 500,
    height: 380,
    active: "TRUE"
  },
  {
    id: "game-02",
    order: 2,
    title: "Word Speed Quiz — Vocabulary Match",
    category: "Rapid Recall",
    badge: "Wordwall Challenge 2",
    description: "Fast-paced Mandarin vocabulary identification. Test your speed recognition of characters, pinyin, and definitions.",
    embed_code: '<iframe style="max-width:100%" src="https://wordwall.net/embed/9dfb097b6b4a405ca39a08514e805030?themeId=23&templateId=49&fontStackId=0" width="500" height="380" frameborder="0" allowfullscreen></iframe>',
    embed_url: "https://wordwall.net/embed/9dfb097b6b4a405ca39a08514e805030?themeId=23&templateId=49&fontStackId=0",
    width: 500,
    height: 380,
    active: "TRUE"
  }
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lessons), "Lessons");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(exercises), "Exercises");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(writing), "Writing");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vocabulary), "Vocabulary");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(games), "Games");

const outExcel = path.join(__dirname, 'data', 'lessons.xlsx');
XLSX.writeFile(wb, outExcel);
console.log('Wrote data/lessons.xlsx successfully! (HSK 2 only: hsk2-01)');

const outJson = path.join(__dirname, 'data', 'lessons.json');
const jsonData = {
  sheetNames: ["Lessons", "Exercises", "Writing", "Vocabulary", "Games"],
  sheets: {
    Lessons: lessons,
    Exercises: exercises,
    Writing: writing,
    Vocabulary: vocabulary,
    Games: games
  }
};
fs.writeFileSync(outJson, JSON.stringify(jsonData, null, 2), 'utf8');
console.log('Wrote data/lessons.json successfully!');
