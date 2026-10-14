/**
 * =========================================================
 * LINGUAPATH - LESSONS & CURRICULUM CONTROLLER (lessons.js)
 * 3-Category Dynamic Curriculum System & 3-Section Lesson Workspace
 * (Video Lesson, Practice Exercises, Writing & Stroke Order)
 * Driven by SheetJS (XLSX) parser reading data/lessons.xlsx
 * =========================================================
 */

(function () {
  'use strict';

  // --- Global State ---
  let lessonsWorkbook = null;
  let allLessons = [];
  let allExercises = [];
  let allWriting = [];
  let allVocabulary = [];

  let currentAudience = 'Adult'; // 'Adult' or 'Kids'
  let activeCategoryKey = 'basics'; // 'basics' or 'travel' or 'business' / 'pinyin' etc.
  let activeLesson = null;
  let activeWorkspaceTab = 'video'; // 'video', 'exercises', 'writing'
  let activeWritingCharIndex = 0;
  let exerciseAnswersState = {}; // { questionIndex: { selectedOption, isCorrect } }

  // Canvas drawing state
  let canvas = null;
  let ctx = null;
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let showGhostChar = true;

  // --- Embedded Offline Fallbacks ---
  const FALLBACK_LESSONS = [
    // ADULT
    {
      id: "adult-basics-01",
      audience: "Adult",
      category: "Beginner & Everyday Basics",
      categoryKey: "basics",
      categoryNum: "Category 1",
      title: "Morning Greetings & Politeness",
      chineseTitle: "早上好！日常礼貌问候",
      pinyin: "Zǎoshang hǎo! Rìcháng lǐmào wènhòu",
      meaning: "Good morning! Daily pleasantries and formal etiquette",
      level: "Beginner",
      description: "Master daily greetings, formal polite expressions (您好, 请问), and the essential third-tone sandhi rhythm of Chinese speech.",
      videoUrl: "assets/video/lesson-01.mp4",
      posterUrl: "assets/images/story-01.jpg",
      keywords: "Greetings, Hello, Morning, Politeness"
    },
    {
      id: "adult-basics-02",
      audience: "Adult",
      category: "Beginner & Everyday Basics",
      categoryKey: "basics",
      categoryNum: "Category 1",
      title: "Self-Introduction & Essential Numbers",
      chineseTitle: "自我介绍与基础数字应用",
      pinyin: "Zìwǒ jièshào yǔ jīchǔ shùzì yìngyòng",
      meaning: "Introducing yourself, nationalities, professions, and counting 1-100",
      level: "Beginner",
      description: "Learn to state your name, origin, job, exchange phone numbers, and master counting numbers 1-100 for everyday transactions.",
      videoUrl: "assets/video/lesson-02.mp4",
      posterUrl: "assets/images/story-02.jpg",
      keywords: "Introduction, Name, Numbers, Country"
    },
    {
      id: "adult-travel-01",
      audience: "Adult",
      category: "Travel & Daily Life",
      categoryKey: "travel",
      categoryNum: "Category 2",
      title: "Ordering Food & Dining Culture",
      chineseTitle: "餐厅点餐与地道饮食文化",
      pinyin: "Cāntīng diǎncài yǔ dìdào yǐnshí wénhuà",
      meaning: "Ordering meals, dietary preferences, and table etiquette",
      level: "Elementary",
      description: "Navigate authentic Chinese menus, specify spice levels (不吃辣, 微辣), request drinks, and settle bills with WeChat/Alipay.",
      videoUrl: "assets/video/lesson-01.mp4",
      posterUrl: "assets/images/story-03.jpg",
      keywords: "Restaurant, Menu, Spicy, Bill"
    },
    {
      id: "adult-travel-02",
      audience: "Adult",
      category: "Travel & Daily Life",
      categoryKey: "travel",
      categoryNum: "Category 2",
      title: "Asking Directions & Urban Transit",
      chineseTitle: "问路导航与城市公共交通",
      pinyin: "Wènlù dǎoháng yǔ chéngshì gōnggòng jiāotōng",
      meaning: "Asking for directions, taking high-speed trains, taxis, and metro",
      level: "Elementary",
      description: "Master metro transfer signs, taxi instructions (往右拐, 直走), asking 'Where is...', and landmark navigation in major Chinese cities.",
      videoUrl: "assets/video/lesson-02.mp4",
      posterUrl: "assets/images/story-04.jpg",
      keywords: "Directions, Metro, Taxi, Station"
    },
    {
      id: "adult-business-01",
      audience: "Adult",
      category: "Business & Workplace",
      categoryKey: "business",
      categoryNum: "Category 3",
      title: "Professional Etiquette & Introductions",
      chineseTitle: "商务职场礼仪与初次洽谈",
      pinyin: "Shāngwù zhíchǎng lǐyí yǔ chūcì qiàtán",
      meaning: "Business card etiquette, formal greetings, and company roles",
      level: "Intermediate",
      description: "Exchange business cards with both hands, introduce corporate ranks (总经理, 项目经理), and express enthusiasm for mutual collaboration.",
      videoUrl: "assets/video/lesson-01.mp4",
      posterUrl: "assets/images/story-05.jpg",
      keywords: "Business, Etiquette, Business Card, Cooperation"
    },
    {
      id: "adult-business-02",
      audience: "Adult",
      category: "Business & Workplace",
      categoryKey: "business",
      categoryNum: "Category 3",
      title: "Work Emails & Scheduling Meetings",
      chineseTitle: "职场商务邮件与会议安排",
      pinyin: "Zhíchǎng shāngwù yóujiàn yǔ huìyì ānpái",
      meaning: "Formal email correspondence and conference scheduling",
      level: "Intermediate",
      description: "Draft professional emails, propose meeting agendas, confirm schedules (确定时间), and follow up on business project deliverables.",
      videoUrl: "assets/video/lesson-02.mp4",
      posterUrl: "assets/images/story2-01.jpg",
      keywords: "Email, Meeting, Schedule, Confirm"
    },

    // KIDS
    {
      id: "kids-pinyin-01",
      audience: "Kids",
      category: "Fun with Pinyin & Tones",
      categoryKey: "pinyin",
      categoryNum: "Category 1",
      title: "Pinyin Melody & Four Tones Island",
      chineseTitle: "拼音小乐园与四声调大冒险",
      pinyin: "Pīnyīn xiǎo lèyuán yǔ sì shēngdiào dà màoxiǎn",
      meaning: "Singing vowel songs and mastering the four tones with animal sounds",
      level: "Kids Starter",
      description: "Ride the tone rollercoaster: Flat 1st tone (mā), Climbing 2nd tone (má), Bouncing 3rd tone (mǎ), and Falling 4th tone (mà)!",
      videoUrl: "assets/video/lesson-01.mp4",
      posterUrl: "assets/images/story-01.jpg",
      keywords: "Pinyin, Tones, Vowels, Music"
    },
    {
      id: "kids-pinyin-02",
      audience: "Kids",
      category: "Fun with Pinyin & Tones",
      categoryKey: "pinyin",
      categoryNum: "Category 1",
      title: "Consonant Safari: B, P, M, F Fun",
      chineseTitle: "声母探险队：波坡摸佛动物探秘",
      pinyin: "Shēngmǔ tànxiǎnduì: Bō Pō Mō Fó dòngwù tànmì",
      meaning: "Catching initial sound butterflies with joyful animal friends",
      level: "Kids Starter",
      description: "Discover initial consonant sounds with Daddy Panda (bàba), Little Kitten (māomāo), and playful frog jumps!",
      videoUrl: "assets/video/lesson-02.mp4",
      posterUrl: "assets/images/story-02.jpg",
      keywords: "Consonants, Animals, Panda, Sounds"
    },
    {
      id: "kids-colors-01",
      audience: "Kids",
      category: "Colors, Animals & Family",
      categoryKey: "colors",
      categoryNum: "Category 2",
      title: "Rainbow Colors & Animal Friends",
      chineseTitle: "七彩彩虹与动物乐园",
      pinyin: "Qīcǎi cǎihóng yǔ dòngwù lèyuán",
      meaning: "Vibrant rainbow colors and cute animal vocabulary",
      level: "Kids Elementary",
      description: "Learn red (红色), yellow (黄色), blue (蓝色), and green (绿色) while petting friendly puppies, kittens, and singing birds!",
      videoUrl: "assets/video/lesson-01.mp4",
      posterUrl: "assets/images/story-03.jpg",
      keywords: "Colors, Rainbow, Animals, Puppy"
    },
    {
      id: "kids-family-01",
      audience: "Kids",
      category: "Colors, Animals & Family",
      categoryKey: "colors",
      categoryNum: "Category 2",
      title: "My Loving Family Tree",
      chineseTitle: "我亲爱的温馨一家人",
      pinyin: "Wǒ qīn'ài de wēnxīn yìjiārén",
      meaning: "Meet grandpa, grandma, mom, dad, and siblings",
      level: "Kids Elementary",
      description: "Introduce your family with hugs and love: 爷爷 (Grandpa), 奶奶 (Grandma), 爸爸, 妈妈, 哥哥, and 妹妹!",
      videoUrl: "assets/video/lesson-02.mp4",
      posterUrl: "assets/images/story-04.jpg",
      keywords: "Family, Love, Grandpa, Grandma"
    },
    {
      id: "kids-rhymes-01",
      audience: "Kids",
      category: "Nursery Rhymes & Short Stories",
      categoryKey: "rhymes",
      categoryNum: "Category 3",
      title: "Two Tigers Rhyme & Sing-Along",
      chineseTitle: "两只老虎经典儿歌唱跳",
      pinyin: "Liǎng zhī lǎohǔ jīngdiǎn érgē chàngtiào",
      meaning: "The beloved Chinese nursery rhyme and animal movement game",
      level: "Kids Fun",
      description: "Sing and dance to '两只老虎，两只老虎，跑得快！' while learning body parts (ears, eyes, tail) and rhythmic beats.",
      videoUrl: "assets/video/lesson-01.mp4",
      posterUrl: "assets/images/story-05.jpg",
      keywords: "Nursery Rhyme, Song, Tiger, Fast"
    },
    {
      id: "kids-rhymes-02",
      audience: "Kids",
      category: "Nursery Rhymes & Short Stories",
      categoryKey: "rhymes",
      categoryNum: "Category 3",
      title: "Little White Rabbit & Big Radish",
      chineseTitle: "小白兔拔萝卜经典童话故事",
      pinyin: "Xiǎo bái tù bá luóbo jīngdiǎn tónghuà gùshì",
      meaning: "Teamwork fairytale: Pulling up the giant sweet radish",
      level: "Kids Fun",
      description: "Help Little White Rabbit and all forest friends work together to pull up the enormous sweet carrot!",
      videoUrl: "assets/video/lesson-02.mp4",
      posterUrl: "assets/images/story2-02.jpg",
      keywords: "Story, Rabbit, Teamwork, Radish"
    }
  ];

  const FALLBACK_EXERCISES = [
    {
      lessonId: "adult-basics-01",
      order: 1,
      type: "multiple-choice",
      question: "How do you politely greet a client, elder, or respected colleague in Chinese?",
      optionA: "你好 (Nǐ hǎo)",
      optionB: "您好 (Nín hǎo)",
      optionC: "早上 (Zǎoshang)",
      optionD: "再见 (Zàijiàn)",
      answer: "您好 (Nín hǎo)",
      explanation: "您 (nín) is the formal, polite second-person pronoun in Mandarin, ideal for business and elders."
    },
    {
      lessonId: "adult-basics-01",
      order: 2,
      type: "multiple-choice",
      question: "What is the standard response when someone says '谢谢' (Xièxie - Thank you)?",
      optionA: "不客气 (Bú kèqì)",
      optionB: "对不起 (Duìbuqǐ)",
      optionC: "早上好 (Zǎoshang hǎo)",
      optionD: "请问 (Qǐngwèn)",
      answer: "不客气 (Bú kèqì)",
      explanation: "不客气 (bú kèqì) translates directly to 'Don't be polite / You're welcome'."
    },
    {
      lessonId: "adult-basics-01",
      order: 3,
      type: "fill-blank",
      question: "Fill in the blank for 'Good morning': 早上___！(hǎo)",
      optionA: "好",
      optionB: "见",
      optionC: "吗",
      optionD: "呢",
      answer: "好",
      explanation: "早上好 (Zǎoshang hǎo) is the standard morning greeting in Chinese."
    }
  ];

  const FALLBACK_WRITING = [
    {
      lessonId: "adult-basics-01",
      order: 1,
      character: "早",
      pinyin: "zǎo",
      meaning: "morning / early",
      strokeCount: 6,
      radical: "日 (Sun)",
      strokeOrderSteps: "1. Vertical (丨), 2. Horizontal-turning (𠃍), 3. Horizontal (一), 4. Horizontal close (一), 5. Horizontal baseline (一), 6. Center vertical (丨)"
    },
    {
      lessonId: "adult-basics-01",
      order: 2,
      character: "好",
      pinyin: "hǎo",
      meaning: "good / fine / well",
      strokeCount: 6,
      radical: "女 (Woman)",
      strokeOrderSteps: "1. Turning stroke (ㄑ), 2. Slanted curve (ノ), 3. Horizontal crossing (一), 4. Horizontal hook (乛), 5. Vertical curve hook (亅), 6. Horizontal (一)"
    },
    {
      lessonId: "adult-basics-01",
      order: 3,
      character: "您",
      pinyin: "nín",
      meaning: "you (polite/respectful)",
      strokeCount: 11,
      radical: "心 (Heart)",
      strokeOrderSteps: "1. Slant (ノ), 2. Vertical (丨), 3. Slant (ノ), 4. Horizontal-hook (𠃍), 5. Vertical (丨), 6. Left dot (丶), 7. Right dot (丶), 8. Heart dot (丶), 9. Heart curve (㇃), 10. Inner dot (丶), 11. Outer dot (丶)"
    }
  ];

  // --- Category Definitions (Without 'all' filter option) ---
  const ADULT_CATEGORIES = [
    { key: "basics", name: "Beginner & Everyday Basics", icon: "⭐", num: "Category 1", desc: "Greetings, Self-Introduction, Numbers, Pinyin" },
    { key: "travel", name: "Travel & Daily Life", icon: "✈️", num: "Category 2", desc: "Dining, Directions, Shopping, HSK 1–2 Vocab" },
    { key: "business", name: "Business & Workplace", icon: "💼", num: "Category 3", desc: "Workplace Etiquette, Emails, Meetings, Networking" }
  ];

  const KIDS_CATEGORIES = [
    { key: "pinyin", name: "Fun with Pinyin & Tones", icon: "🎵", num: "Category 1", desc: "Pinyin Songs, Four Tones Audio Cards, Easy Sounds" },
    { key: "colors", name: "Colors, Animals & Family", icon: "🌈", num: "Category 2", desc: "Flashcards, Word Matching, Picture Vocab" },
    { key: "rhymes", name: "Nursery Rhymes & Short Stories", icon: "📖", num: "Category 3", desc: "Animated Songs, Simple Dialogues, Story Time" }
  ];

  // --- Utilities ---
  function escapeHTML(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Render Chinese text output inside an HTML block styled with 楷体
  function renderChineseKaitiBlock(text, extraClass = '', extraStyle = '') {
    if (!text) return '';
    return `<div class="chinese-kaiti-block chinese-kaiti ${extraClass}" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', 'KaiTi_GB2312', 'BiauKai', 'Ma Shan Zheng', 'Noto Serif SC', serif; ${extraStyle}">${escapeHTML(text)}</div>`;
  }

  function renderChineseKaitiInline(text, extraClass = '', extraStyle = '') {
    if (!text) return '';
    return `<span class="chinese-kaiti ${extraClass}" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', 'KaiTi_GB2312', 'BiauKai', 'Ma Shan Zheng', 'Noto Serif SC', serif; ${extraStyle}">${escapeHTML(text)}</span>`;
  }

  function wrapChineseInKaiti(str) {
    if (!str) return '';
    return String(str).replace(/([\u4e00-\u9fa5\u3400-\u4dbf\u2e80-\u2eff\u31c0-\u31ef\u3000-\u303f\uff01-\uff0f\uff1a-\uff20\uff3b-\uff40\uff5b-\uff65]+)/g, '<span class="chinese-kaiti" style="font-family: \'KaiTi\', \'STKaiti\', \'楷体\', \'Kaiti SC\', \'Ma Shan Zheng\', serif;">$1</span>');
  }

  function getCategoryKey(lesson) {
    if (lesson.categoryKey) return lesson.categoryKey;
    const cat = String(lesson.category || "").toLowerCase();
    if (cat.includes("basic") || cat.includes("beginner") || cat.includes("category 1")) return "basics";
    if (cat.includes("travel") || cat.includes("daily") || cat.includes("category 2")) return "travel";
    if (cat.includes("business") || cat.includes("work") || cat.includes("category 3")) return "business";
    if (cat.includes("pinyin") || cat.includes("tone")) return "pinyin";
    if (cat.includes("color") || cat.includes("animal") || cat.includes("family")) return "colors";
    if (cat.includes("rhyme") || cat.includes("song") || cat.includes("story")) return "rhymes";
    return currentAudience === 'Kids' ? 'pinyin' : 'basics';
  }

  // Speak Chinese speech synthesis
  function speakChinese(text) {
    if (!text || typeof window === 'undefined') return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn("TTS error:", e);
    }
  }

  // Sound Chimes using Web Audio API
  function playSound(type) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const actx = new AudioCtx();
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.connect(gain);
      gain.connect(actx.destination);

      if (type === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, actx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, actx.currentTime + 0.1); // E5
        osc.frequency.setValueAtTime(783.99, actx.currentTime + 0.2); // G5
        gain.gain.setValueAtTime(0.2, actx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.5);
        osc.start();
        osc.stop(actx.currentTime + 0.5);
      } else if (type === 'incorrect') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260, actx.currentTime);
        osc.frequency.setValueAtTime(200, actx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, actx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.4);
        osc.start();
        osc.stop(actx.currentTime + 0.4);
      }
    } catch (e) {
      // Ignore audio context errors if blocked
    }
  }

  // --- SheetJS Data Loader ---
  async function loadLessonsWorkbook() {
    let loaded = false;

    // Strategy 0: Check localStorage custom lessons saved from Excel upload
    try {
      const rawCustom = localStorage.getItem('linguapath_custom_lessons');
      if (rawCustom) {
        const parsed = JSON.parse(rawCustom);
        if (parsed.sheets && parsed.sheets.Lessons && parsed.sheets.Lessons.length) {
          allLessons = parsed.sheets.Lessons;
          if (parsed.sheets.Exercises) allExercises = parsed.sheets.Exercises;
          if (parsed.sheets.Writing) allWriting = parsed.sheets.Writing;
          if (parsed.sheets.Vocabulary) allVocabulary = parsed.sheets.Vocabulary;
          loaded = true;
        }
      }
    } catch (e) {
      console.warn("localStorage custom lessons load note:", e);
    }

    // Strategy 1: Fetch API /api/lessons-data
    if (!loaded) {
      try {
        const res = await fetch('/api/lessons-data?t=' + Date.now());
        if (res.ok) {
          const data = await res.json();
          if (data.sheets) {
            if (data.sheets.Lessons && data.sheets.Lessons.length) allLessons = data.sheets.Lessons;
            if (data.sheets.Exercises && data.sheets.Exercises.length) allExercises = data.sheets.Exercises;
            if (data.sheets.Writing && data.sheets.Writing.length) allWriting = data.sheets.Writing;
            if (data.sheets.Vocabulary && data.sheets.Vocabulary.length) allVocabulary = data.sheets.Vocabulary;
            if (allLessons.length) loaded = true;
          }
        }
      } catch (err) {
        console.warn("API /api/lessons-data load note:", err);
      }
    }

    // Strategy 2: Direct Binary Excel Parsing via SheetJS (XLSX)
    if (!loaded && typeof XLSX !== 'undefined') {
      try {
        const res = await fetch('data/lessons.xlsx?t=' + Date.now());
        if (res.ok) {
          const buf = await res.arrayBuffer();
          lessonsWorkbook = XLSX.read(buf, { type: 'array' });
          if (lessonsWorkbook.SheetNames.includes('Lessons')) {
            allLessons = XLSX.utils.sheet_to_json(lessonsWorkbook.Sheets['Lessons'], { defval: '' });
          }
          if (lessonsWorkbook.SheetNames.includes('Exercises')) {
            allExercises = XLSX.utils.sheet_to_json(lessonsWorkbook.Sheets['Exercises'], { defval: '' });
          }
          if (lessonsWorkbook.SheetNames.includes('Writing')) {
            allWriting = XLSX.utils.sheet_to_json(lessonsWorkbook.Sheets['Writing'], { defval: '' });
          }
          if (lessonsWorkbook.SheetNames.includes('Vocabulary')) {
            allVocabulary = XLSX.utils.sheet_to_json(lessonsWorkbook.Sheets['Vocabulary'], { defval: '' });
          }
          if (allLessons.length) loaded = true;
        }
      } catch (err) {
        console.warn("Direct XLSX load note:", err);
      }
    }

    // Strategy 3: Static lessons.json fallback
    if (!loaded) {
      try {
        const res = await fetch('data/lessons.json?t=' + Date.now());
        if (res.ok) {
          const data = await res.json();
          if (data.sheets) {
            if (data.sheets.Lessons && data.sheets.Lessons.length) allLessons = data.sheets.Lessons;
            if (data.sheets.Exercises && data.sheets.Exercises.length) allExercises = data.sheets.Exercises;
            if (data.sheets.Writing && data.sheets.Writing.length) allWriting = data.sheets.Writing;
            if (data.sheets.Vocabulary && data.sheets.Vocabulary.length) allVocabulary = data.sheets.Vocabulary;
            if (allLessons.length) loaded = true;
          }
        }
      } catch (err) {
        console.warn("Static lessons.json load note:", err);
      }
    }

    // Final Fallback: In-memory arrays
    if (!allLessons.length) {
      allLessons = FALLBACK_LESSONS;
      allExercises = FALLBACK_EXERCISES;
      allWriting = FALLBACK_WRITING;
    }
  }

  // --- Render Categories Navigation Bar ---
  function renderCategoryBar() {
    const container = document.getElementById('curriculumCategoryBar');
    if (!container) return;

    const categories = currentAudience === 'Kids' ? KIDS_CATEGORIES : ADULT_CATEGORIES;
    const audienceLessons = allLessons.filter(l => String(l.audience || 'Adult').toLowerCase() === currentAudience.toLowerCase());

    // Ensure activeCategoryKey is valid
    if (!categories.some(c => c.key === activeCategoryKey)) {
      activeCategoryKey = categories[0].key;
    }

    container.innerHTML = categories.map(cat => {
      const count = audienceLessons.filter(l => getCategoryKey(l) === cat.key).length;
      const isActive = activeCategoryKey === cat.key;
      return `
        <button type="button" class="cat-pill-btn ${isActive ? 'active' : ''}" data-category="${cat.key}">
          <span>${cat.icon}</span>
          <span>${escapeHTML(cat.name)}</span>
          <span class="cat-count-badge">${count}</span>
        </button>
      `;
    }).join('');

    // Attach click listeners to category pills
    container.querySelectorAll('.cat-pill-btn').forEach(btn => {
      btn.onclick = () => {
        const catKey = btn.dataset.category;
        switchCategory(catKey);
      };
    });
  }

  function switchCategory(catKey, updateUrl = true) {
    activeCategoryKey = catKey;
    renderCategoryBar();
    renderLessonGrid();

    // If a lesson workspace is open, close it to show the filtered grid
    closeLessonWorkspace();

    if (updateUrl) {
      const url = new URL(window.location);
      url.searchParams.set('category', catKey);
      url.searchParams.delete('lesson');
      window.history.pushState({}, '', url);
    }
  }

  // --- Render Lesson Cards Grid ---
  function renderLessonGrid() {
    const grid = document.getElementById('lessonsGrid');
    if (!grid) return;

    const audienceLessons = allLessons.filter(l => String(l.audience || 'Adult').toLowerCase() === currentAudience.toLowerCase());
    const filtered = audienceLessons.filter(l => {
      return getCategoryKey(l) === activeCategoryKey;
    });

    if (!filtered.length) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 50px 20px; background: #fff7ed; border: 1.5px dashed #fed7aa; border-radius: 20px;">
          <h3>No lessons found in this category</h3>
          <p>Please select another category above to view lessons.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map((lesson, idx) => {
      const lessonId = lesson.id || `lesson-${idx + 1}`;
      const title = lesson.title || `Lesson ${idx + 1}`;
      const cnTitle = lesson.chineseTitle || '';
      const pinyin = lesson.pinyin || '';
      const meaning = lesson.meaning || '';
      const desc = lesson.description || '';
      const level = lesson.level || 'Beginner';
      const poster = lesson.posterUrl || lesson.poster || `assets/images/story-0${(idx % 5) + 1}.jpg`;
      const categoryName = lesson.category || (currentAudience === 'Kids' ? 'Fun Adventure' : 'Everyday Basics');

      const isKids = currentAudience === 'Kids';

      return `
        <article class="lesson-card" id="card-${escapeHTML(lessonId)}">
          <div class="lesson-card-image">
            <img src="${escapeHTML(poster)}" alt="${escapeHTML(title)}" onerror="this.onerror=null; this.src='assets/images/story-poster.jpg';" loading="lazy">
          </div>
          <div class="lesson-card-content">
            <div class="lesson-category-tag">${escapeHTML(categoryName)}</div>
            <span class="lesson-level">⭐ ${escapeHTML(level)}</span>
            <h3>${escapeHTML(title)}</h3>
            ${cnTitle ? `<div class="lesson-chinese-title chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', 'Ma Shan Zheng', serif;">${escapeHTML(cnTitle)}</div>` : ''}
            ${pinyin ? `<div class="lesson-pinyin">${escapeHTML(pinyin)}</div>` : ''}
            ${meaning ? `<div class="lesson-meaning">${escapeHTML(meaning)}</div>` : ''}
            <p class="lesson-description">${escapeHTML(desc)}</p>

            <div class="lesson-features-badges">
              <span class="lesson-feature-pill">📺 Video</span>
              <span class="lesson-feature-pill">✏️ Exercises</span>
              <span class="lesson-feature-pill">🖌️ Stroke Writing</span>
            </div>

            <div class="lesson-card-actions" style="margin-top: auto;">
              <button type="button" class="btn ${isKids ? 'btn-kids-play' : 'btn-primary'} lesson-button" style="width: 100%; text-align: center;" data-lesson-id="${escapeHTML(lessonId)}">
                🚀 Start Lesson →
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Attach click listeners to "Start Lesson" buttons
    grid.querySelectorAll('.lesson-button').forEach(btn => {
      btn.onclick = () => {
        const lessonId = btn.dataset.lessonId;
        openLessonWorkspace(lessonId);
      };
    });
  }

  // --- Open Lesson Workspace (3 Core Sections) ---
  function openLessonWorkspace(lessonId, updateUrl = true) {
    const lesson = allLessons.find(l => String(l.id || '').trim().toLowerCase() === String(lessonId || '').trim().toLowerCase()) || allLessons[0];
    if (!lesson) return;

    activeLesson = lesson;
    activeWorkspaceTab = 'video';
    activeWritingCharIndex = 0;
    exerciseAnswersState = {};

    // Track active lesson in localStorage for "Continue Lesson" banner
    try {
      localStorage.setItem('linguapath_active_lesson', JSON.stringify({
        id: lesson.id,
        audience: lesson.audience || currentAudience,
        title: lesson.title,
        chineseTitle: lesson.chineseTitle || '',
        pinyin: lesson.pinyin || '',
        level: lesson.level || '',
        category: lesson.category || '',
        timestamp: Date.now()
      }));
    } catch (e) {}

    const workspace = document.getElementById('lessonWorkspace');
    const curriculumSection = document.getElementById('curriculumListSection');

    if (workspace) {
      if (curriculumSection) curriculumSection.style.display = 'none';
      const adultView = document.getElementById('adultView');
      if (adultView) adultView.style.display = 'none';
      const kidsView = document.getElementById('kidsView');
      if (kidsView) kidsView.style.display = 'none';

      workspace.classList.add('active');
      workspace.style.display = 'block';

      renderWorkspaceHeader(lesson);
      renderVideoSection(lesson);
      renderExercisesSection(lesson);
      renderWritingSection(lesson);
      renderPronunciationSection(lesson);
      switchWorkspaceTab('video');

      // Scroll to top of workspace smoothly
      workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // If workspace container is not on this page, redirect to the correct track page with query param
      const targetAudience = (lesson.audience || currentAudience).toLowerCase() === 'kids' ? 'Kids' : 'Adult';
      const targetPage = targetAudience === 'Kids' ? 'lessons-kids.html' : 'lessons-adult.html';
      window.location.href = `${targetPage}?lesson=${encodeURIComponent(lesson.id)}`;
      return;
    }

    if (updateUrl) {
      const url = new URL(window.location);
      url.searchParams.set('lesson', lesson.id);
      const catKey = getCategoryKey(lesson);
      if (catKey) url.searchParams.set('category', catKey);
      window.history.pushState({}, '', url);
    }
  }

  function closeLessonWorkspace(updateUrl = true) {
    const workspace = document.getElementById('lessonWorkspace');
    const curriculumSection = document.getElementById('curriculumListSection');

    // Stop active speech recognition recording if in progress
    stopPronunciationRecording();

    if (workspace) {
      workspace.classList.remove('active');
      workspace.style.display = 'none';
    }

    if (curriculumSection) curriculumSection.style.display = 'block';
    const adultView = document.getElementById('adultView');
    if (adultView) adultView.style.display = 'block';
    const kidsView = document.getElementById('kidsView');
    if (kidsView) kidsView.style.display = 'none';

    // Pause any playing video
    const video = document.getElementById('workspaceVideoPlayer');
    if (video) video.pause();

    activeLesson = null;

    if (updateUrl) {
      const url = new URL(window.location);
      url.searchParams.delete('lesson');
      window.history.pushState({}, '', url);
    }
  }

  // --- Render Workspace Header ---
  function renderWorkspaceHeader(lesson) {
    const hero = document.getElementById('workspaceHeroHeader');
    if (!hero) return;

    const catName = lesson.category || 'General Curriculum';
    const isKids = currentAudience === 'Kids';

    hero.innerHTML = `
      <div class="workspace-top-bar">
        <button type="button" class="btn-back-to-curriculum" id="btnBackToCurriculum">
          ← Back to Curriculum Lessons
        </button>
        <div class="workspace-breadcrumbs">
          <span>${isKids ? '🐼 Kids Track' : '💼 Adult Track'}</span>
          <span class="sep">›</span>
          <span>${escapeHTML(catName)}</span>
          <span class="sep">›</span>
          <span style="color: #ea580c;">${escapeHTML(lesson.title)}</span>
        </div>
      </div>

      <div class="workspace-hero-meta">
        <span class="workspace-category-badge">${escapeHTML(catName)}</span>
        <span class="workspace-level-badge">⭐ ${escapeHTML(lesson.level || 'Beginner')}</span>
      </div>

      <h1 class="workspace-lesson-title">${escapeHTML(lesson.title)}</h1>

      ${lesson.chineseTitle ? `
        <div class="workspace-chinese-block">
          <span class="workspace-chinese-text chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', 'Ma Shan Zheng', serif;">${escapeHTML(lesson.chineseTitle)}</span>
          ${lesson.pinyin ? `<span class="workspace-pinyin-text">${escapeHTML(lesson.pinyin)}</span>` : ''}
          ${lesson.meaning ? `<span class="workspace-meaning-text">• "${escapeHTML(lesson.meaning)}"</span>` : ''}
          <button type="button" class="btn-speak-line" title="Listen" id="btnSpeakLessonTitle" style="width: 32px; height: 32px; font-size: 0.9rem;">🔊</button>
        </div>
      ` : ''}

      <p class="workspace-description">${escapeHTML(lesson.description || '')}</p>
    `;

    document.getElementById('btnBackToCurriculum').onclick = () => closeLessonWorkspace();
    const speakBtn = document.getElementById('btnSpeakLessonTitle');
    if (speakBtn && lesson.chineseTitle) {
      speakBtn.onclick = () => speakChinese(lesson.chineseTitle);
    }
  }

  // --- Workspace Tab Switching ---
  function setupWorkspaceTabs() {
    const tabBtns = document.querySelectorAll('.workspace-tab-btn');
    tabBtns.forEach(btn => {
      btn.onclick = () => {
        const tab = btn.dataset.tab;
        switchWorkspaceTab(tab);
      };
    });
  }

  function switchWorkspaceTab(tabName) {
    activeWorkspaceTab = tabName;

    // Stop active speech recognition recording if user leaves pronunciation tab
    if (tabName !== 'pronunciation') {
      stopPronunciationRecording();
    }

    document.querySelectorAll('.workspace-tab-btn').forEach(b => {
      const isActive = b.dataset.tab === tabName;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (isActive) {
        try {
          b.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        } catch (_) {}
      }
    });

    document.querySelectorAll('.workspace-panel').forEach(p => {
      p.classList.toggle('active', p.id === `panel-${tabName}`);
    });

    // Smooth scroll to top of lesson workspace container with sticky offset so section is fully in view
    const workspaceEl = document.getElementById('lessonWorkspace');
    if (workspaceEl) {
      const rect = workspaceEl.getBoundingClientRect();
      const stickyOffset = window.innerWidth <= 768 ? 120 : 135;
      const targetScroll = window.pageYOffset + rect.top - stickyOffset;
      window.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
    }

    // If writing tab is opened, initialize canvas and writing section
    if (tabName === 'writing' && activeLesson) {
      setTimeout(() => renderWritingSection(activeLesson), 50);
    }

    // If pronunciation tab is opened, render and initialize pronunciation workspace
    if (tabName === 'pronunciation' && activeLesson) {
      setTimeout(() => renderPronunciationSection(activeLesson), 50);
    }
  }

  // --- SECTION 1: VIDEO LESSON ---
  function renderVideoSection(lesson) {
    const panel = document.getElementById('panel-video');
    if (!panel) return;

    const videoUrl = lesson.videoUrl || lesson.video || 'assets/video/lesson-01.mp4';
    const poster = lesson.posterUrl || lesson.poster || 'assets/images/story-poster.jpg';

    // Find vocabulary or story lines for this lesson
    const vocabItems = allVocabulary.filter(v => String(v.lessonId || '').trim().toLowerCase() === String(lesson.id || '').trim().toLowerCase());

    panel.innerHTML = `
      <div class="video-lesson-grid">
        <div class="video-player-card">
          <div class="video-frame-wrap">
            <video id="workspaceVideoPlayer" controls poster="${escapeHTML(poster)}" preload="metadata">
              <source src="${escapeHTML(videoUrl)}" type="video/mp4">
              Your browser does not support the video tag.
            </video>
          </div>
          <div class="video-controls-toolbar">
            <div class="video-quick-buttons">
              <button type="button" class="btn-video-control" id="btnReplayVideo">↺ Replay</button>
              <button type="button" class="btn-video-control" id="btnTogglePlaybackSpeed">⚡ Speed: 1.0x</button>
            </div>
            <div class="video-quick-buttons">
              <button type="button" class="btn-video-control" id="btnNextToQuiz">Continue to Practice Quiz ✏️ →</button>
            </div>
          </div>
        </div>

        <!-- Dialogue & Vocabulary Breakdown Card -->
        <div class="transcript-card">
          <div class="transcript-header">
            <h4>📖 Core Dialogue &amp; Key Vocabulary (${vocabItems.length || 'Featured'})</h4>
            <span style="font-size: 0.85rem; color: #64748b;">Click 🔊 to hear native pronunciation</span>
          </div>

          <div class="dialogue-lines-list">
            ${vocabItems.length ? vocabItems.map(item => `
              <div class="dialogue-line-item">
                <div class="dialogue-text-content">
                  <div class="dialogue-chinese">${escapeHTML(item.character)}</div>
                  <div class="dialogue-pinyin">${escapeHTML(item.pinyin)}</div>
                  <div class="dialogue-english">${escapeHTML(item.meaning)}</div>
                </div>
                <button type="button" class="btn-speak-line" onclick="window.LinguaLessons.speakChinese('${escapeHTML(item.character)}')">🔊</button>
              </div>
            `).join('') : `
              <div class="dialogue-line-item">
                <div class="dialogue-text-content">
                  <div class="dialogue-chinese">${escapeHTML(lesson.chineseTitle || lesson.title)}</div>
                  <div class="dialogue-pinyin">${escapeHTML(lesson.pinyin || '')}</div>
                  <div class="dialogue-english">${escapeHTML(lesson.meaning || lesson.description)}</div>
                </div>
                <button type="button" class="btn-speak-line" onclick="window.LinguaLessons.speakChinese('${escapeHTML(lesson.chineseTitle || lesson.title)}')">🔊</button>
              </div>
            `}
          </div>
        </div>

        <div class="video-bottom-nav-bar" style="display: flex; justify-content: flex-end; margin-top: 32px;">
          <button type="button" class="btn btn-primary btn-lg" id="btnBottomNextToExercises">
            Continue to Practice Exercises ✏️ →
          </button>
        </div>
      </div>
    `;

    // Attach video control listeners
    const video = document.getElementById('workspaceVideoPlayer');
    const replayBtn = document.getElementById('btnReplayVideo');
    if (replayBtn && video) {
      replayBtn.onclick = () => {
        video.currentTime = 0;
        video.play();
      };
    }

    const speedBtn = document.getElementById('btnTogglePlaybackSpeed');
    let speedIndex = 1;
    const speeds = [0.75, 1.0, 1.25];
    if (speedBtn && video) {
      speedBtn.onclick = () => {
        speedIndex = (speedIndex + 1) % speeds.length;
        const newSpeed = speeds[speedIndex];
        video.playbackRate = newSpeed;
        speedBtn.textContent = `⚡ Speed: ${newSpeed}x`;
      };
    }

    const nextQuizBtn = document.getElementById('btnNextToQuiz');
    if (nextQuizBtn) {
      nextQuizBtn.onclick = () => switchWorkspaceTab('exercises');
    }

    const bottomNextQuizBtn = document.getElementById('btnBottomNextToExercises');
    if (bottomNextQuizBtn) {
      bottomNextQuizBtn.onclick = () => switchWorkspaceTab('exercises');
    }
  }

  // --- SECTION 2: PRACTICE EXERCISES ---
  function renderExercisesSection(lesson) {
    const panel = document.getElementById('panel-exercises');
    if (!panel) return;

    let exercises = allExercises.filter(ex => String(ex.lessonId || '').trim().toLowerCase() === String(lesson.id || '').trim().toLowerCase());

    if (!exercises.length) {
      const lessonTitle = lesson.title || 'Mandarin Practice';
      const cnTitle = lesson.chineseTitle || '汉语练习';
      const pinyinStr = lesson.pinyin || 'Hànyǔ liànxí';

      exercises = [
        {
          lessonId: lesson.id,
          order: 1,
          type: "multiple-choice",
          question: `What is the correct Chinese expression for "${lessonTitle}"?`,
          optionA: `${cnTitle} (${pinyinStr})`,
          optionB: `你好 (Nǐ hǎo)`,
          optionC: `谢谢 (Xièxie)`,
          optionD: `再见 (Zàijiàn)`,
          answer: `${cnTitle} (${pinyinStr})`,
          explanation: `"${cnTitle}" is the authentic Chinese phrase for ${lessonTitle}.`
        },
        {
          lessonId: lesson.id,
          order: 2,
          type: "multiple-choice",
          question: `Which Pinyin pronunciation matches "${cnTitle}"?`,
          optionA: pinyinStr,
          optionB: "Zǎoshang hǎo",
          optionC: "Mǎi shuǐguǒ",
          optionD: "Wènlù dǎoháng",
          answer: pinyinStr,
          explanation: `The Pinyin for "${cnTitle}" is "${pinyinStr}".`
        },
        {
          lessonId: lesson.id,
          order: 3,
          type: "multiple-choice",
          question: `How do you express polite communication or greeting in this lesson topic?`,
          optionA: "非常感谢 (Fēicháng gǎnxiè - Thank you very much)",
          optionB: "不客气 (Bú kèqì - You're welcome)",
          optionC: "对不起 (Duìbuqǐ - Sorry)",
          optionD: "没关系 (Méi guānxi - No problem)",
          answer: "非常感谢 (Fēicháng gǎnxiè - Thank you very much)",
          explanation: "Polite expressions enrich natural Chinese conversations."
        }
      ];
    }

    panel.innerHTML = `
      <div class="exercises-workspace">
        <div class="quiz-header-bar">
          <div>
            <h3 style="margin: 0 0 4px; font-size: 1.3rem; font-weight: 800;">Interactive Practice Exercises</h3>
            <span class="quiz-progress-counter">${exercises.length} Questions to Test Your Mastery</span>
          </div>
          <div class="quiz-score-badge" id="quizScoreBadge">
            <span>⭐ Score: 0 / ${exercises.length}</span>
          </div>
        </div>

        <div class="quiz-questions-stack">
          ${exercises.map((ex, idx) => {
            const num = idx + 1;
            const qType = ex.type || 'multiple-choice';
            const options = [ex.optionA, ex.optionB, ex.optionC, ex.optionD].filter(Boolean);

            return `
              <div class="quiz-card-item" id="quizCard-${num}">
                <div class="quiz-question-number">Question ${num} • ${qType === 'fill-blank' ? 'Fill in the Blank' : 'Multiple Choice'}</div>
                <h4 class="quiz-question-text">${wrapChineseInKaiti(escapeHTML(ex.question))}</h4>

                <div class="quiz-options-grid">
                  ${options.map(opt => `
                    <button type="button" class="quiz-option-btn" data-question-index="${num}" data-option="${escapeHTML(opt)}" data-answer="${escapeHTML(ex.answer || '')}" data-explanation="${escapeHTML(ex.explanation || '')}">
                      <span>${wrapChineseInKaiti(escapeHTML(opt))}</span>
                      <span class="quiz-opt-icon"></span>
                    </button>
                  `).join('')}
                </div>

                <div class="quiz-feedback-box" id="quizFeedback-${num}">
                  <div class="quiz-feedback-status" id="feedbackStatus-${num}"></div>
                  <p class="quiz-explanation-text" id="feedbackText-${num}"></p>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="quiz-reset-bar">
          <button type="button" class="btn btn-secondary" id="btnResetQuiz" style="margin-right: 12px;">↺ Reset &amp; Retry Quiz</button>
          <button type="button" class="btn btn-primary" id="btnNextToWriting">Go to Writing &amp; Stroke Order 🖌️ →</button>
        </div>
      </div>
    `;

    // Attach quiz answer validation listeners
    panel.querySelectorAll('.quiz-option-btn').forEach(btn => {
      btn.onclick = () => {
        const qNum = btn.dataset.questionIndex;
        const selected = btn.dataset.option;
        const correct = btn.dataset.answer;
        const explanation = btn.dataset.explanation;

        handleQuizSelection(qNum, selected, correct, explanation, exercises.length);
      };
    });

    const resetBtn = document.getElementById('btnResetQuiz');
    if (resetBtn) {
      resetBtn.onclick = () => renderExercisesSection(lesson);
    }

    const nextWritingBtn = document.getElementById('btnNextToWriting');
    if (nextWritingBtn) {
      nextWritingBtn.onclick = () => switchWorkspaceTab('writing');
    }
  }

  function handleQuizSelection(qNum, selected, correct, explanation, totalQuestions) {
    const card = document.getElementById(`quizCard-${qNum}`);
    if (!card) return;

    // Normalize comparison strings
    const selNorm = String(selected).trim().toLowerCase();
    const corrNorm = String(correct).trim().toLowerCase();

    // Check match either exactly or contains
    const isCorrect = selNorm === corrNorm || selNorm.startsWith(corrNorm) || corrNorm.startsWith(selNorm);

    // Disable buttons on this question card
    card.querySelectorAll('.quiz-option-btn').forEach(btn => {
      btn.disabled = true;
      const opt = String(btn.dataset.option).trim().toLowerCase();
      if (opt === corrNorm || opt.startsWith(corrNorm) || corrNorm.startsWith(opt)) {
        btn.classList.add('correct');
        btn.querySelector('.quiz-opt-icon').textContent = '✓';
      } else if (btn.dataset.option === selected && !isCorrect) {
        btn.classList.add('incorrect');
        btn.querySelector('.quiz-opt-icon').textContent = '✗';
      }
    });

    // Update feedback box
    const feedbackBox = document.getElementById(`quizFeedback-${qNum}`);
    const statusEl = document.getElementById(`feedbackStatus-${qNum}`);
    const textEl = document.getElementById(`feedbackText-${qNum}`);

    if (feedbackBox) {
      feedbackBox.classList.add('active');
      if (isCorrect) {
        statusEl.className = 'quiz-feedback-status correct';
        statusEl.innerHTML = '<span>✅ Correct! Great job!</span>';
        playSound('correct');
      } else {
        statusEl.className = 'quiz-feedback-status incorrect';
        statusEl.innerHTML = `<span>❌ Incorrect. The correct answer is: <strong>${wrapChineseInKaiti(escapeHTML(correct))}</strong></span>`;
        playSound('incorrect');
      }
      textEl.innerHTML = wrapChineseInKaiti(escapeHTML(explanation || (isCorrect ? 'Well done!' : 'Keep practicing!')));
    }

    exerciseAnswersState[qNum] = isCorrect;

    // Update score badge
    const correctCount = Object.values(exerciseAnswersState).filter(Boolean).length;
    const scoreBadge = document.getElementById('quizScoreBadge');
    if (scoreBadge) {
      scoreBadge.innerHTML = `<span>⭐ Score: ${correctCount} / ${totalQuestions} (${Math.round((correctCount / totalQuestions) * 100)}%)</span>`;
    }
  }

  // --- SECTION 3: WRITING WITH STROKE ORDER ---
  let drawnStrokes = [];
  let strokeScores = [];
  let currentStrokePoints = [];
  let strokeOrderDemoTimer = null;
  let currentHanziWriter = null;
  let activeWritingChar = null;
  let activeWritingLesson = null;
  let activeWritingChars = [];

  // --- STROKE ORDER RULES ENGINE (HanziStroke Standard) ---
  function getCharacterStrokeRule(char) {
    const rules = {
      "水": {
        name: "Center Before Sides (先中间后两边)",
        explanation: "In vertically symmetrical characters like 水, write the central vertical hook (亅) first to establish character structure and balance, then draw the left side (㇇ノ), and finally the right side (㇏).",
        steps: "1. 亅 Center Vertical Hook  2. ㇇ Left Horizontal Slant  3. ノ Left Fall  4. ㇏ Right Fall"
      },
      "小": {
        name: "Center Before Sides (先中间后两边)",
        explanation: "Write the central vertical hook (亅) first, followed by the left dot (丶) and right dot (丶).",
        steps: "1. 亅 Center Vertical Hook  2. 丶 Left Dot  3. 丶 Right Dot"
      },
      "十": {
        name: "Horizontal Before Vertical (先横后竖)",
        explanation: "When horizontal and vertical strokes cross, draw horizontal strokes before vertical strokes.",
        steps: "1. 一 Main Horizontal  2. 丨 Center Vertical"
      },
      "人": {
        name: "Left-Falling Before Right-Falling (先撇后捺)",
        explanation: "When left-falling (撇) and right-falling (捺) strokes cross, write the left-falling stroke first.",
        steps: "1. ノ Left Falling  2. ㇏ Right Falling"
      },
      "大": {
        name: "Horizontal First & Left-Falling Before Right-Falling",
        explanation: "Write the top horizontal stroke (一) first, then the left-falling stroke (ノ), and finally the right-falling stroke (㇏).",
        steps: "1. 一 Main Horizontal  2. ノ Left Falling  3. ㇏ Right Falling"
      },
      "日": {
        name: "Inside Before Closing (先内后封口)",
        explanation: "Draw the outer frame top & left, fill the inside content, then seal the enclosure with the bottom horizontal stroke.",
        steps: "1. 丨 Left Vertical  2. 𠃍 Top-Right Corner  3. 一 Middle Bar  4. 一 Bottom Closing Bar"
      },
      "早": {
        name: "Top to Bottom (先上后下)",
        explanation: "Write the top component (日) first following inside-before-closing, then write the lower component (十).",
        steps: "1. 丨 Left Vertical  2. 𠃍 Top-Right Corner  3. 一 Middle Bar  4. 一 Bottom Bar  5. 一 Cross Bar  6. 丨 Central Vertical"
      },
      "好": {
        name: "Left to Right (先左后右)",
        explanation: "For side-by-side structures, write the left radical component (女) first, then write the right component (子).",
        steps: "1. ㄑ Slant Angle  2. ノ Left Falling  3. 一 Cross Bar  4. 乛 Top Hook  5. 亅 Vertical Hook  6. 一 Center Bar"
      },
      "三": {
        name: "Top to Bottom (先上后下)",
        explanation: "Write horizontal strokes sequentially from top to bottom.",
        steps: "1. 一 Top Bar  2. 一 Middle Bar  3. 一 Bottom Bar"
      },
      "我": {
        name: "Left to Right & Top to Bottom (先左后右，先上后下)",
        explanation: "Follow standard stroke order sequence: left top slant (丿), main horizontal (一), vertical hook (亅), lower rising stroke (提), slant hook (㇂), middle slant (撇), and top-right dot (点).",
        steps: "1. 丿 Top Left Fall  2. 一 Main Horizontal  3. 亅 Vertical Hook  4. 提 Lower Rising  5. ㇂ Slant Hook  6. 撇 Middle Left Fall  7. 丶 Top Right Dot"
      }
    };

    if (rules[char]) {
      return rules[char];
    }

    return {
      name: "Standard Stroke Rules (先上后下，先左后右)",
      explanation: "Follow standard Chinese stroke order guidelines: top to bottom, left to right, horizontal before vertical, and center before sides.",
      steps: `Follow standard stroke order for ${char}: top to bottom, left to right, outside to inside.`
    };
  }

  function openStrokeRulesModal() {
    const existing = document.getElementById("strokeRulesModal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "strokeRulesModal";
    modal.className = "practice-modal-backdrop";
    modal.innerHTML = `
      <div class="practice-modal-card" style="max-width: 680px; text-align: left;">
        <div class="practice-modal-header">
          <div class="practice-modal-title">
            <span>📜 7 Core Rules of Chinese Stroke Order (<span class="chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', 'Ma Shan Zheng', serif;">汉字笔顺规则</span>)</span>
          </div>
          <button type="button" class="practice-modal-close-btn" id="btnCloseRulesModal" aria-label="Close">✕</button>
        </div>

        <p style="font-size: 0.92rem; color: #64748b; margin-bottom: 12px; line-height: 1.5;">
          Mastering stroke order ensures correct character balance, aesthetics, and writing speed. Refer to these 7 fundamental rules from Hanzi stroke standards:
        </p>

        <div class="stroke-rules-grid">
          <div class="stroke-rule-card">
            <div class="stroke-rule-card-title">1. Top to Bottom (<span class="chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', serif;">先上后下</span>)</div>
            <div class="stroke-rule-card-desc">Upper components or strokes are written before lower ones.</div>
            <div class="stroke-rule-card-example">Examples: <strong class="chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', serif; font-size: 1.2rem; letter-spacing: 0.1em;">三, 言, 早</strong></div>
          </div>

          <div class="stroke-rule-card">
            <div class="stroke-rule-card-title">2. Left to Right (<span class="chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', serif;">先左后右</span>)</div>
            <div class="stroke-rule-card-desc">Left components are written before right components.</div>
            <div class="stroke-rule-card-example">Examples: <strong class="chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', serif; font-size: 1.2rem; letter-spacing: 0.1em;">好, 明, 做, 你</strong></div>
          </div>

          <div class="stroke-rule-card">
            <div class="stroke-rule-card-title">3. Horizontal Before Vertical (<span class="chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', serif;">先横后竖</span>)</div>
            <div class="stroke-rule-card-desc">When strokes cross, write horizontal strokes before vertical strokes.</div>
            <div class="stroke-rule-card-example">Examples: <strong class="chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', serif; font-size: 1.2rem; letter-spacing: 0.1em;">十, 干, 木</strong></div>
          </div>

          <div class="stroke-rule-card">
            <div class="stroke-rule-card-title">4. Left-Falling Before Right-Falling (<span class="chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', serif;">先撇后捺</span>)</div>
            <div class="stroke-rule-card-desc">Draw left-falling diagonal strokes (撇) before right-falling ones (捺).</div>
            <div class="stroke-rule-card-example">Examples: <strong class="chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', serif; font-size: 1.2rem; letter-spacing: 0.1em;">人, 八, 大</strong></div>
          </div>

          <div class="stroke-rule-card Highlight">
            <div class="stroke-rule-card-title">5. Center Before Sides (<span class="chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', serif;">先中间后两边</span>) ⭐</div>
            <div class="stroke-rule-card-desc">For symmetrical characters, write the central vertical spine first, then left and right sides.</div>
            <div class="stroke-rule-card-example">Examples: <strong class="chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', serif; font-size: 1.2rem; letter-spacing: 0.1em;">水, 小, 办</strong></div>
          </div>

          <div class="stroke-rule-card">
            <div class="stroke-rule-card-title">6. Outside Before Inside (<span class="chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', serif;">先外后内</span>)</div>
            <div class="stroke-rule-card-desc">Draw outer surrounding frame strokes before writing inside contents.</div>
            <div class="stroke-rule-card-example">Examples: <strong class="chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', serif; font-size: 1.2rem; letter-spacing: 0.1em;">月, 同, 风</strong></div>
          </div>

          <div class="stroke-rule-card">
            <div class="stroke-rule-card-title">7. Inside Before Closing (<span class="chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', serif;">先内后封口</span>)</div>
            <div class="stroke-rule-card-desc">For full enclosures, fill the inner contents before drawing the bottom closing stroke.</div>
            <div class="stroke-rule-card-example">Examples: <strong class="chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', serif; font-size: 1.2rem; letter-spacing: 0.1em;">国, 日, 回</strong></div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = document.getElementById("btnCloseRulesModal");
    if (closeBtn) closeBtn.onclick = () => modal.remove();
  }

  function renderWritingSection(lesson) {
    const panel = document.getElementById('panel-writing');
    if (!panel) return;

    drawnStrokes = [];
    strokeScores = [];
    currentStrokePoints = [];

    let chars = allWriting.filter(w => String(w.lessonId || '').trim().toLowerCase() === String(lesson.id || '').trim().toLowerCase());

    if (!chars.length) {
      if (lesson.chineseTitle) {
        const extracted = Array.from(lesson.chineseTitle).filter(c => /[\u4e00-\u9fa5]/.test(c));
        extracted.forEach((char, idx) => {
          chars.push({
            lessonId: lesson.id,
            order: idx + 1,
            character: char,
            pinyin: lesson.pinyin ? (lesson.pinyin.split(' ')[idx] || 'zǎo') : 'zǎo',
            meaning: `Character from ${lesson.title}`,
            strokeCount: 6,
            radical: "Key Radical",
            strokeOrderSteps: `Follow standard stroke order for character ${char}: top to bottom, left to right.`
          });
        });
      }
      if (!chars.length) {
        chars.push(
          { character: "早", pinyin: "zǎo", meaning: "morning", strokeCount: 6, radical: "日", strokeOrderSteps: "1.丨 2.𠃍 3.一 4.一 5.一 6.丨" },
          { character: "好", pinyin: "hǎo", meaning: "good", strokeCount: 6, radical: "女", strokeOrderSteps: "1.ㄑ 2.ノ 3.一 4.乛 5.亅 6.一" }
        );
      }
    }

    const currentChar = chars[activeWritingCharIndex] || chars[0];
    activeWritingChar = currentChar;
    activeWritingLesson = lesson;
    activeWritingChars = chars;

    const ruleInfo = getCharacterStrokeRule(currentChar.character);

    panel.innerHTML = `
      <div class="writing-workspace">
        <div class="writing-char-picker">
          <span class="writing-char-picker-label">Select Character to Practice:</span>
          ${chars.map((c, i) => `
            <button type="button" class="writing-char-chip chinese-kaiti ${i === activeWritingCharIndex ? 'active' : ''}" data-index="${i}" title="${escapeHTML(c.pinyin || '')}" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', 'Ma Shan Zheng', serif;">
              <span class="chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', 'Ma Shan Zheng', serif; font-size: 1.45rem;">${escapeHTML(c.character)}</span>
            </button>
          `).join('')}
        </div>

        <div class="writing-stage-grid">
          <!-- Left Column: Character Breakdown & Stroke Rules -->
          <div class="writing-info-col">
            <div class="writing-character-hero-card">
              <div class="char-giant-display chinese-kaiti" id="charBigDisplay" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', 'Ma Shan Zheng', serif;">${escapeHTML(currentChar.character)}</div>
              <div class="char-pinyin-badge" id="charPinyinDisplay">${escapeHTML(currentChar.pinyin || '')}</div>
              <div class="char-meaning-badge" id="charMeaningDisplay">"${escapeHTML(currentChar.meaning || '')}"</div>
              
              <div class="char-meta-row">
                <span class="char-stat-pill" id="charStrokeCountDisplay">✏️ ${currentChar.strokeCount || '?'} Strokes</span>
                ${currentChar.radical ? `<span class="char-stat-pill" id="charRadicalDisplay">Radical: <span class="chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', 'Ma Shan Zheng', serif; font-size: 1.15em; font-weight: bold; margin-left: 2px;">${escapeHTML(currentChar.radical)}</span></span>` : ''}
                <button type="button" class="btn-canvas-action" id="btnSpeakWritingChar">🔊 Pronounce</button>
              </div>
            </div>

            <div class="stroke-steps-card">
              <div class="stroke-rule-header-row">
                <span class="stroke-rule-badge-pill">📌 Rule: <span class="chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', serif;">${escapeHTML(ruleInfo.name)}</span></span>
                <button type="button" class="btn-stroke-rules-trigger" id="btnOpenStrokeRulesModal">
                  📜 All 7 Rules
                </button>
              </div>

              <div class="stroke-rule-explanation chinese-kaiti-block" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', 'Ma Shan Zheng', serif;">
                ${wrapChineseInKaiti(ruleInfo.explanation)}
              </div>

              <h4 style="margin-top: 10px; margin-bottom: 6px; font-size: 0.88rem; color: #1e293b;">
                🖌️ Stroke-by-Stroke Sequence
              </h4>
              <div class="stroke-steps-wrapper chinese-kaiti-block" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', 'Ma Shan Zheng', serif; background: #fff7ed; border: 1.5px solid #fed7aa; border-radius: 12px; padding: 12px 14px; margin-top: 6px;">
                <p class="stroke-steps-text chinese-kaiti" id="charStepsDisplay" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', 'Ma Shan Zheng', serif; margin: 0; color: #1e293b; font-size: 0.98rem; line-height: 1.75; font-weight: 600;">
                  ${wrapChineseInKaiti(currentChar.strokeOrderSteps || ruleInfo.steps)}
                </p>
              </div>
            </div>
          </div>

          <!-- Right Column: Interactive Mi-Zi-Ge (米字格) Canvas & Stroke Order Indicator -->
          <div class="writing-canvas-col">
            <div class="stroke-order-indicator-bar" id="strokeOrderStepBar">
              <span><span class="stroke-order-step-badge" id="strokeStepBadge">Stroke 1 / ${currentChar.strokeCount || 4}</span> Step 1: Draw 1st Stroke</span>
              <span id="strokeOrderHintText">Follow top-to-bottom order</span>
            </div>

            <div class="stroke-live-scores-row" id="strokeLiveScoresRow">
              <span style="font-size: 0.8rem; color: #a8a29e; font-style: italic;">Draw strokes on canvas to check accuracy</span>
            </div>

            <div class="canvas-mizige-box" id="canvasContainer">
              <div class="canvas-grid-lines"></div>
              <div id="hanziWriterTarget" class="${showGhostChar ? '' : 'hidden'}" style="position: absolute; inset: 0; z-index: 3; pointer-events: none;"></div>
              <canvas id="strokeDrawCanvas" width="320" height="320" style="z-index: 10; pointer-events: auto; touch-action: none; position: absolute; inset: 0; cursor: crosshair;"></canvas>
            </div>

            <div class="canvas-toolbar">
              <button type="button" class="btn-canvas-action" id="btnAnimateStroke" style="background: #0284c7; color: #ffffff; border-color: #0284c7;">
                ▶️ Stroke Animation
              </button>
              <button type="button" class="btn-canvas-action" id="btnGradeWriting">
                ✨ Grade Writing
              </button>
              <button type="button" class="btn-canvas-action" id="btnClearCanvas">
                🧹 Clear
              </button>
              <button type="button" class="btn-canvas-action" id="btnToggleGhostChar">
                ${showGhostChar ? '👁️ Hide Guide' : '👁️ Show Guide'}
              </button>
            </div>
          </div>
        </div>

        <div class="writing-bottom-nav-bar" style="display: flex; justify-content: flex-end; margin-top: 32px;">
          <button type="button" class="btn btn-primary btn-lg" id="btnBottomNextToPronunciation">
            Go to Pronunciation Check 🎤 →
          </button>
        </div>
      </div>
    `;

    // Character selector chips
    panel.querySelectorAll('.writing-char-chip').forEach(btn => {
      btn.onclick = () => {
        activeWritingCharIndex = parseInt(btn.dataset.index, 10) || 0;
        renderWritingSection(lesson);
      };
    });

    const openRulesBtn = document.getElementById('btnOpenStrokeRulesModal');
    if (openRulesBtn) {
      openRulesBtn.onclick = () => openStrokeRulesModal();
    }

    const speakCharBtn = document.getElementById('btnSpeakWritingChar');
    if (speakCharBtn) {
      speakCharBtn.onclick = () => {
        if (window.LinguaAudio) {
          window.LinguaAudio.speak(currentChar.character);
        } else {
          speakChinese(currentChar.character);
        }
      };
    }

    const clearBtn = document.getElementById('btnClearCanvas');
    if (clearBtn) {
      clearBtn.onclick = () => clearCanvas(currentChar);
    }

    const animateBtn = document.getElementById('btnAnimateStroke');
    if (animateBtn) {
      animateBtn.onclick = () => {
        playStrokeAnimation(currentChar);
      };
    }

    const toggleGhostBtn = document.getElementById('btnToggleGhostChar');
    if (toggleGhostBtn) {
      toggleGhostBtn.onclick = () => {
        showGhostChar = !showGhostChar;
        const hwTarget = document.getElementById('hanziWriterTarget');
        if (hwTarget) hwTarget.classList.toggle('hidden', !showGhostChar);
        if (currentHanziWriter && typeof currentHanziWriter.showOutline === 'function') {
          if (showGhostChar) {
            currentHanziWriter.showOutline();
          } else {
            currentHanziWriter.hideOutline();
          }
        }
        toggleGhostBtn.textContent = showGhostChar ? '👁️ Hide Guide' : '👁️ Show Guide';
      };
    }

    const gradeBtn = document.getElementById('btnGradeWriting');
    if (gradeBtn) {
      gradeBtn.onclick = () => openPracticeResultModal(currentChar, lesson, chars);
    }

    const bottomNextPronBtn = document.getElementById('btnBottomNextToPronunciation');
    if (bottomNextPronBtn) {
      bottomNextPronBtn.onclick = () => switchWorkspaceTab('pronunciation');
    }

    initWritingCanvas(currentChar, lesson, chars);
  }

  // --- STROKE ANIMATION CONTROLLER (Dual Engine: HanziWriter SVG + 2D Vector Canvas) ---
  let isStrokeAnimating = false;
  let strokeAnimToken = 0;

  function playStrokeAnimation(currentChar) {
    if (isStrokeAnimating) {
      stopStrokeAnimation();
      return;
    }

    isStrokeAnimating = true;
    const currentToken = ++strokeAnimToken;

    const animateBtn = document.getElementById('btnAnimateStroke');
    if (animateBtn) {
      animateBtn.textContent = '⏸ Pause';
      animateBtn.style.background = '#dc2626';
      animateBtn.style.borderColor = '#dc2626';
    }

    const stepBadge = document.getElementById('strokeStepBadge');
    const stepHint = document.getElementById('strokeOrderHintText');
    if (stepBadge) stepBadge.textContent = '▶ Animating...';

    // Clear canvas user strokes so animation is crystal clear
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    drawnStrokes = [];
    strokeScores = [];
    currentStrokePoints = [];

    // Ensure HanziWriter element is visible
    const hwTarget = document.getElementById('hanziWriterTarget');
    if (hwTarget) hwTarget.classList.remove('hidden');

    let hanziAnimationSuccess = false;

    if (currentHanziWriter && typeof currentHanziWriter.animateCharacter === 'function') {
      try {
        if (typeof currentHanziWriter.cancelQuiz === 'function') {
          try { currentHanziWriter.cancelQuiz(); } catch (e) {}
        }
        if (typeof currentHanziWriter.showOutline === 'function') {
          try { currentHanziWriter.showOutline(); } catch (e) {}
        }
        const animPromise = currentHanziWriter.animateCharacter({
          strokeAnimationSpeed: 1.1,
          delayBetweenStrokes: 280,
          onComplete: () => {
            if (currentToken !== strokeAnimToken) return;
            finishStrokeAnimation(stepBadge, stepHint, animateBtn);
          }
        });

        if (animPromise && typeof animPromise.catch === 'function') {
          animPromise.catch(err => {
            console.warn('HanziWriter animateCharacter promise rejected, using vector fallback:', err);
            runCanvasStrokeVectorAnimation(currentChar, currentToken, () => {
              if (currentToken !== strokeAnimToken) return;
              finishStrokeAnimation(stepBadge, stepHint, animateBtn);
            });
          });
        }
        hanziAnimationSuccess = true;

        // Sync live step badges during animation
        const vectors = getCharacterStrokeVectors(currentChar);
        const total = (currentChar && currentChar.strokeCount) || vectors.length || 4;
        let currentStrokeStep = 0;
        const stepInterval = setInterval(() => {
          if (currentToken !== strokeAnimToken || !isStrokeAnimating) {
            clearInterval(stepInterval);
            return;
          }
          currentStrokeStep++;
          if (currentStrokeStep <= total) {
            if (stepBadge) stepBadge.textContent = `Stroke ${currentStrokeStep} / ${total}`;
            const v = vectors[currentStrokeStep - 1];
            if (stepHint && v && v.label) {
              stepHint.innerHTML = `Drawing: <strong class="chinese-kaiti" style="font-family: 'KaiTi', '楷体', serif; color: #ea580c;">${escapeHTML(v.label)}</strong>`;
            }
            if (window.LinguaAudio) window.LinguaAudio.playTone(1, 0.1);
          } else {
            clearInterval(stepInterval);
          }
        }, 550);
      } catch (err) {
        console.warn('HanziWriter animation fallback triggered:', err);
        hanziAnimationSuccess = false;
      }
    }

    // Canvas Vector Fallback if HanziWriter is offline or pending
    if (!hanziAnimationSuccess) {
      runCanvasStrokeVectorAnimation(currentChar, currentToken, () => {
        if (currentToken !== strokeAnimToken) return;
        finishStrokeAnimation(stepBadge, stepHint, animateBtn);
      });
    }
  }

  function finishStrokeAnimation(stepBadge, stepHint, animateBtn) {
    isStrokeAnimating = false;
    if (animateBtn) {
      animateBtn.textContent = '▶️ Stroke Animation';
      animateBtn.style.background = '#0284c7';
      animateBtn.style.borderColor = '#0284c7';
    }
    if (activeWritingChar) {
      startStrokeWriting(activeWritingChar, activeWritingLesson, activeWritingChars);
    }
  }

  function stopStrokeAnimation() {
    isStrokeAnimating = false;
    strokeAnimToken++;
    if (currentHanziWriter && typeof currentHanziWriter.pauseAnimation === 'function') {
      try {
        currentHanziWriter.pauseAnimation();
      } catch (e) {}
    }
    const animateBtn = document.getElementById('btnAnimateStroke');
    if (animateBtn) {
      animateBtn.textContent = '▶️ Stroke Animation';
      animateBtn.style.background = '#0284c7';
      animateBtn.style.borderColor = '#0284c7';
    }
    const stepBadge = document.getElementById('strokeStepBadge');
    if (stepBadge) stepBadge.textContent = 'Animation Paused';
  }

  // Pure 2D HTML5 Canvas Vector Stroke Order Animator
  function runCanvasStrokeVectorAnimation(currentChar, token, onComplete) {
    if (!canvas || !ctx) {
      if (onComplete) onComplete();
      return;
    }

    const vectors = getCharacterStrokeVectors(currentChar);
    const total = vectors.length || 4;
    let strokeIdx = 0;

    function animateSingleVector() {
      if (token !== strokeAnimToken || !isStrokeAnimating) return;

      if (strokeIdx >= total) {
        if (onComplete) onComplete();
        return;
      }

      const vec = vectors[strokeIdx];
      const stepBadge = document.getElementById('strokeStepBadge');
      const stepHint = document.getElementById('strokeOrderHintText');
      if (stepBadge) stepBadge.textContent = `Stroke ${strokeIdx + 1} / ${total}`;
      if (stepHint && vec.label) {
        stepHint.innerHTML = `Drawing: <strong class="chinese-kaiti" style="font-family: 'KaiTi', '楷体', serif; color: #ea580c;">${escapeHTML(vec.label)}</strong>`;
      }

      if (window.LinguaAudio) window.LinguaAudio.playTone(1, 0.12);

      const p1 = { x: vec.x1, y: vec.y1 };
      const p2 = vec.x3 !== undefined ? { x: vec.x2, y: vec.y2 } : { x: vec.x2, y: vec.y2 };
      const p3 = vec.x3 !== undefined ? { x: vec.x3, y: vec.y3 } : null;

      let progress = 0;
      const startTime = performance.now();
      const duration = 400; // ms

      function step(now) {
        if (token !== strokeAnimToken || !isStrokeAnimating) return;

        progress = Math.min(1, (now - startTime) / duration);

        // Draw animated brush tip
        ctx.strokeStyle = '#ea580c';
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);

        if (!p3) {
          const curX = p1.x + (p2.x - p1.x) * progress;
          const curY = p1.y + (p2.y - p1.y) * progress;
          ctx.lineTo(curX, curY);
        } else {
          if (progress < 0.5) {
            const segP = progress * 2;
            const curX = p1.x + (p2.x - p1.x) * segP;
            const curY = p1.y + (p2.y - p1.y) * segP;
            ctx.lineTo(curX, curY);
          } else {
            ctx.lineTo(p2.x, p2.y);
            const segP = (progress - 0.5) * 2;
            const curX = p2.x + (p3.x - p2.x) * segP;
            const curY = p2.y + (p3.y - p2.y) * segP;
            ctx.lineTo(curX, curY);
          }
        }
        ctx.stroke();

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          strokeIdx++;
          setTimeout(animateSingleVector, 200);
        }
      }

      requestAnimationFrame(step);
    }

    animateSingleVector();
  }

  // --- Progress & Score Persistence Engine ---
  function saveLessonProgressRecord(lessonId, score, completed) {
    if (!lessonId) return;
    try {
      const cleanId = String(lessonId).trim();
      let allProgress = {};
      try {
        allProgress = JSON.parse(localStorage.getItem('linguapath_lesson_progress') || '{}');
      } catch (e) {}

      const prev = allProgress[cleanId] || {};
      const isDone = Boolean(completed || prev.completed);
      allProgress[cleanId] = {
        percent: isDone ? 100 : Math.max(prev.percent || 0, Math.min(100, score || 0)),
        completed: isDone,
        score: Math.max(prev.score || 0, score || 0),
        lastUpdated: Date.now()
      };
      localStorage.setItem('linguapath_lesson_progress', JSON.stringify(allProgress));
    } catch (e) {
      console.warn('Could not save lesson progress to localStorage:', e);
    }
  }
  window.saveLessonProgressRecord = saveLessonProgressRecord;

  function saveUserScore(points) {
    try {
      const currentScore = parseInt(localStorage.getItem('linguapath_user_score') || '0', 10) || 0;
      const addPoints = parseInt(points, 10) || 10;
      const newScore = currentScore + addPoints;
      localStorage.setItem('linguapath_user_score', String(newScore));

      const streakBadge = document.getElementById('dailyStreakCount');
      if (streakBadge && streakBadge.dataset.streak) {
        streakBadge.textContent = streakBadge.dataset.streak + ' 🔥';
      }
    } catch (e) {
      console.warn('Could not save user score:', e);
    }
  }
  window.saveUserScore = saveUserScore;

  // --- STRICT STROKE-ORDER WRITING ENGINE ---
  let userMistakesCount = 0;

  function startStrokeWriting(currentChar, lesson, chars) {
    if (isStrokeAnimating) {
      stopStrokeAnimation();
    }

    activeWritingChar = currentChar;
    activeWritingLesson = lesson;
    activeWritingChars = chars;

    const vectors = getCharacterStrokeVectors(currentChar);
    const total = (currentChar && currentChar.strokeCount) || vectors.length || 4;
    const stepBadge = document.getElementById('strokeStepBadge');
    const stepHint = document.getElementById('strokeOrderHintText');
    const liveScoresRow = document.getElementById('strokeLiveScoresRow');

    drawnStrokes = [];
    strokeScores = [];
    currentStrokePoints = [];
    userMistakesCount = 0;

    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    const firstVector = vectors[0] || { label: '1st Stroke', direction: 'Follow stroke order' };
    if (stepBadge) stepBadge.textContent = `Stroke 1 / ${total}`;
    if (stepHint) {
      stepHint.innerHTML = `👉 Draw <strong>Stroke 1</strong>: <span class="chinese-kaiti" style="color: #ea580c; font-weight: bold;">${escapeHTML(firstVector.label || '1st Stroke')}</span> (${escapeHTML(firstVector.direction || 'Follow stroke order')})`;
    }
    if (liveScoresRow) {
      liveScoresRow.innerHTML = '<span style="font-size: 0.8rem; color: #a8a29e; font-style: italic;">Write strokes step-by-step on the canvas in correct sequence</span>';
    }

    if (currentHanziWriter && typeof currentHanziWriter.cancelQuiz === 'function') {
      try { currentHanziWriter.cancelQuiz(); } catch (e) {}
    }
  }

  function redrawCanvasFromStrokes() {
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.lineWidth = brushSizes[currentBrushIndex] || 10;
    ctx.strokeStyle = currentColor || '#ea580c';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    drawnStrokes.forEach(strokePoints => {
      if (!strokePoints || strokePoints.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(strokePoints[0].x, strokePoints[0].y);
      for (let i = 1; i < strokePoints.length; i++) {
        ctx.lineTo(strokePoints[i].x, strokePoints[i].y);
      }
      ctx.stroke();
    });
  }

  // Exact Character Stroke Animation & Geometry Engine
  function getCharacterStrokeVectors(currentChar) {
    if (!currentChar) return [];
    let char = '';
    let count = 4;

    if (typeof currentChar === 'string') {
      char = currentChar.trim();
    } else if (typeof currentChar === 'object' && currentChar !== null) {
      char = (currentChar.character || currentChar.char || currentChar.word || currentChar.title || '').trim();
      count = parseInt(currentChar.strokeCount, 10) || 4;
    }

    const cleanChar = (String(char).match(/[\u4e00-\u9fa5]/) || ['早'])[0];

    const charMap = {
      "我": [
        { type: "left_fall", x1: 150, y1: 50, x2: 100, y2: 90, label: "1.ノ Top Left Fall", direction: "Top-right to bottom-left" },
        { type: "horizontal", x1: 70, y1: 110, x2: 240, y2: 110, label: "2.一 Main Horizontal", direction: "Left to right" },
        { type: "v_hook", x1: 120, y1: 90, x2: 120, y2: 260, x3: 95, y3: 240, label: "3.亅 Vertical Hook", direction: "Top to bottom" },
        { type: "rising", x1: 60, y1: 220, x2: 140, y2: 170, label: "4.提 Lower Rising Stroke", direction: "Lower-left to upper-right" },
        { type: "slant_hook", x1: 170, y1: 60, x2: 240, y2: 250, x3: 265, y3: 230, label: "5.㇂ Slant Hook", direction: "Top-left to bottom-right" },
        { type: "left_fall", x1: 210, y1: 140, x2: 160, y2: 210, label: "6.撇 Middle Left Fall", direction: "Top-right to bottom-left" },
        { type: "dot", x1: 220, y1: 70, x2: 250, y2: 100, label: "7.丶 Top Right Dot", direction: "Top to bottom-right" }
      ],
      "你": [
        { type: "left_fall", x1: 90, y1: 60, x2: 60, y2: 140, label: "1.ノ Person Slant", direction: "Top-right to bottom-left" },
        { type: "vertical", x1: 75, y1: 130, x2: 75, y2: 270, label: "2.丨 Person Vertical", direction: "Top to bottom" },
        { type: "left_fall", x1: 200, y1: 60, x2: 170, y2: 100, label: "3.ノ Top Slant", direction: "Top-right to bottom-left" },
        { type: "v_hook", x1: 150, y1: 100, x2: 250, y2: 100, x3: 230, y3: 140, label: "4.乛 Hook", direction: "Left to right, then down" },
        { type: "v_hook", x1: 195, y1: 110, x2: 195, y2: 260, x3: 170, y3: 240, label: "5.亅 Center Hook", direction: "Top to bottom" },
        { type: "dot", x1: 140, y1: 150, x2: 120, y2: 210, label: "6.丶 Left Dot", direction: "Top to bottom" },
        { type: "dot", x1: 230, y1: 150, x2: 260, y2: 210, label: "7.丶 Right Dot", direction: "Top to bottom-right" }
      ],
      "他": [
        { type: "left_fall", x1: 90, y1: 60, x2: 60, y2: 140, label: "1.ノ Person Slant", direction: "Top-right to bottom-left" },
        { type: "vertical", x1: 75, y1: 130, x2: 75, y2: 270, label: "2.丨 Person Vertical", direction: "Top to bottom" },
        { type: "horizontal", x1: 140, y1: 120, x2: 260, y2: 120, label: "3.乛 Top Horizontal Hook", direction: "Left to right" },
        { type: "vertical", x1: 170, y1: 80, x2: 170, y2: 240, label: "4.丨 Center Vertical", direction: "Top to bottom" },
        { type: "v_hook", x1: 220, y1: 80, x2: 220, y2: 260, x3: 250, y3: 220, label: "5.乚 Curved Hook", direction: "Top to bottom, curved right" }
      ],
      "早": [
        { type: "vertical", x1: 115, y1: 80, x2: 115, y2: 170, label: "1.丨 Left Vertical of 日", direction: "Top to bottom" },
        { type: "corner", x1: 115, y1: 80, x2: 205, y2: 80, x3: 205, y3: 170, label: "2.𠃍 Top-Right Corner of 日", direction: "Left to right, then down" },
        { type: "horizontal", x1: 115, y1: 125, x2: 205, y2: 125, label: "3.一 Middle Bar of 日", direction: "Left to right" },
        { type: "horizontal", x1: 115, y1: 170, x2: 205, y2: 170, label: "4.一 Bottom Bar of 日", direction: "Left to right" },
        { type: "horizontal", x1: 85, y1: 215, x2: 235, y2: 215, label: "5.一 Lower Cross Bar", direction: "Left to right" },
        { type: "vertical", x1: 160, y1: 125, x2: 160, y2: 275, label: "6.丨 Central Vertical Drop", direction: "Top to bottom" }
      ],
      "好": [
        { type: "slant_angle", x1: 100, y1: 70, x2: 70, y2: 140, x3: 130, y3: 180, label: "1.ㄑ Slant Angle", direction: "Top-right to bottom-left" },
        { type: "left_fall", x1: 130, y1: 90, x2: 60, y2: 250, label: "2.ノ Left Falling", direction: "Top-right to bottom-left" },
        { type: "horizontal", x1: 40, y1: 150, x2: 140, y2: 150, label: "3.一 Cross Bar", direction: "Left to right" },
        { type: "corner", x1: 180, y1: 80, x2: 250, y2: 80, x3: 220, y3: 120, label: "4.乛 Top Hook", direction: "Left to right, then hook down" },
        { type: "v_hook", x1: 215, y1: 120, x2: 215, y2: 260, x3: 190, y3: 240, label: "5.亅 Vertical Hook", direction: "Top to bottom" },
        { type: "horizontal", x1: 150, y1: 160, x2: 270, y2: 160, label: "6.一 Center Bar", direction: "Left to right" }
      ],
      "水": [
        { type: "v_hook", x1: 160, y1: 50, x2: 160, y2: 270, x3: 130, y3: 240, label: "1.亅 Center Hook", direction: "Top to bottom" },
        { type: "corner_slant", x1: 70, y1: 120, x2: 120, y2: 120, x3: 80, y3: 170, label: "2.㇇ Horizontal Slant", direction: "Left to right, then down-left" },
        { type: "left_fall", x1: 120, y1: 170, x2: 50, y2: 260, label: "3.ノ Left Fall", direction: "Top-right to bottom-left" },
        { type: "right_fall", x1: 180, y1: 130, x2: 270, y2: 260, label: "4.㇏ Right Fall", direction: "Top-left to bottom-right" }
      ],
      "大": [
        { type: "horizontal", x1: 60, y1: 120, x2: 260, y2: 120, label: "1.一 Main Horizontal", direction: "Left to right" },
        { type: "left_fall", x1: 160, y1: 70, x2: 60, y2: 270, label: "2.ノ Left Falling", direction: "Top-right to bottom-left" },
        { type: "right_fall", x1: 160, y1: 120, x2: 260, y2: 270, label: "3.㇏ Right Falling", direction: "Top-left to bottom-right" }
      ],
      "小": [
        { type: "v_hook", x1: 160, y1: 60, x2: 160, y2: 260, x3: 130, y3: 235, label: "1.亅 Center Hook", direction: "Top to bottom" },
        { type: "dot", x1: 90, y1: 120, x2: 60, y2: 180, label: "2.丶 Left Dot", direction: "Top to bottom-left" },
        { type: "dot", x1: 230, y1: 120, x2: 260, y2: 180, label: "3.丶 Right Dot", direction: "Top to bottom-right" }
      ],
      "人": [
        { type: "left_fall", x1: 160, y1: 60, x2: 60, y2: 270, label: "1.ノ Left Falling", direction: "Top-right to bottom-left" },
        { type: "right_fall", x1: 130, y1: 120, x2: 260, y2: 270, label: "2.㇏ Right Falling", direction: "Top-left to bottom-right" }
      ],
      "一": [
        { type: "horizontal", x1: 50, y1: 160, x2: 270, y2: 160, label: "1.一 Horizontal Bar", direction: "Left to right" }
      ],
      "二": [
        { type: "horizontal", x1: 80, y1: 110, x2: 240, y2: 110, label: "1.一 Top Bar", direction: "Left to right" },
        { type: "horizontal", x1: 50, y1: 210, x2: 270, y2: 210, label: "2.一 Bottom Bar", direction: "Left to right" }
      ],
      "三": [
        { type: "horizontal", x1: 80, y1: 90, x2: 240, y2: 90, label: "1.一 Top Bar", direction: "Left to right" },
        { type: "horizontal", x1: 100, y1: 160, x2: 220, y2: 160, label: "2.一 Middle Bar", direction: "Left to right" },
        { type: "horizontal", x1: 50, y1: 230, x2: 270, y2: 230, label: "3.一 Bottom Bar", direction: "Left to right" }
      ],
      "坐": [
        { type: "left_fall", x1: 100, y1: 60, x2: 70, y2: 120, label: "1.ノ Left Person", direction: "Top-right to bottom-left" },
        { type: "dot", x1: 110, y1: 85, x2: 130, y2: 120, label: "2.丶 Person Dot", direction: "Top to bottom-right" },
        { type: "left_fall", x1: 220, y1: 60, x2: 190, y2: 120, label: "3.ノ Right Person", direction: "Top-right to bottom-left" },
        { type: "dot", x1: 230, y1: 85, x2: 250, y2: 120, label: "4.丶 Person Dot", direction: "Top to bottom-right" },
        { type: "horizontal", x1: 80, y1: 150, x2: 240, y2: 150, label: "5.一 Middle Bar", direction: "Left to right" },
        { type: "vertical", x1: 160, y1: 40, x2: 160, y2: 270, label: "6.丨 Center Vertical", direction: "Top to bottom" },
        { type: "horizontal", x1: 40, y1: 270, x2: 280, y2: 270, label: "7.一 Ground Bar", direction: "Left to right" }
      ],
      "做": [
        { type: "left_fall", x1: 70, y1: 60, x2: 40, y2: 130, label: "1.ノ Person Slant", direction: "Top-right to bottom-left" },
        { type: "vertical", x1: 55, y1: 130, x2: 55, y2: 270, label: "2.丨 Person Drop", direction: "Top to bottom" },
        { type: "left_fall", x1: 130, y1: 60, x2: 100, y2: 100, label: "3.ノ Middle Slant", direction: "Top-right to bottom-left" },
        { type: "horizontal", x1: 90, y1: 100, x2: 160, y2: 100, label: "4.一 Top Bar", direction: "Left to right" },
        { type: "vertical", x1: 125, y1: 100, x2: 125, y2: 190, label: "5.丨 Center Bar", direction: "Top to bottom" },
        { type: "corner", x1: 95, y1: 140, x2: 155, y2: 140, x3: 155, y3: 190, label: "6.𠃍 Corner", direction: "Left to right, then down" },
        { type: "horizontal", x1: 95, y1: 190, x2: 155, y2: 190, label: "7.一 Box Bottom", direction: "Left to right" },
        { type: "left_fall", x1: 125, y1: 200, x2: 90, y2: 260, label: "8.ノ Lower Left", direction: "Top-right to bottom-left" },
        { type: "right_fall", x1: 125, y1: 210, x2: 165, y2: 260, label: "9.㇏ Lower Right", direction: "Top-left to bottom-right" },
        { type: "left_fall", x1: 220, y1: 60, x2: 190, y2: 130, label: "10.ノ Right Top Slant", direction: "Top-right to bottom-left" },
        { type: "right_fall", x1: 190, y1: 130, x2: 270, y2: 260, label: "11.㇏ Right Falling", direction: "Top-left to bottom-right" }
      ],
      "爱": [
        { type: "left_fall", x1: 160, y1: 40, x2: 120, y2: 80, label: "1.ノ Top Slant", direction: "Top-right to bottom-left" },
        { type: "dot", x1: 80, y1: 80, x2: 100, y2: 110, label: "2.丶 Left Dot", direction: "Top to bottom-right" },
        { type: "dot", x1: 140, y1: 80, x2: 160, y2: 110, label: "3.丶 Middle Dot", direction: "Top to bottom-right" },
        { type: "left_fall", x1: 220, y1: 80, x2: 190, y2: 110, label: "4.ノ Right Slant", direction: "Top-right to bottom-left" },
        { type: "corner", x1: 60, y1: 130, x2: 260, y2: 130, x3: 240, y3: 160, label: "5.冖 Crown", direction: "Left to right, then hook down" },
        { type: "left_fall", x1: 130, y1: 160, x2: 90, y2: 210, label: "6.ノ Heart Slant", direction: "Top-right to bottom-left" },
        { type: "corner", x1: 90, y1: 190, x2: 230, y2: 190, x3: 210, y3: 230, label: "7.乛 Heart Hook", direction: "Left to right, then hook" },
        { type: "left_fall", x1: 150, y1: 200, x2: 80, y2: 280, label: "8.ノ Lower Left", direction: "Top-right to bottom-left" },
        { type: "right_fall", x1: 150, y1: 210, x2: 270, y2: 280, label: "9.㇏ Lower Right", direction: "Top-left to bottom-right" }
      ]
    };

    // Extract authoritative strokes from embedded hanzi-data medians if available
    if (window.EMBEDDED_HANZI_DATA && window.EMBEDDED_HANZI_DATA[cleanChar]) {
      const charData = window.EMBEDDED_HANZI_DATA[cleanChar];
      if (charData && Array.isArray(charData.medians) && charData.medians.length > 0) {
        const padding = 20;
        const width = 320;
        const height = 320;
        const scale = (width - 2 * padding) / 1024;
        const xOffset = padding;
        const yOffset = 124 * scale + padding;

        const vectors = charData.medians.map((medianPts, idx) => {
          const pts = medianPts.map(pt => ({
            x: Math.round(pt[0] * scale + xOffset),
            y: Math.round(height - yOffset - pt[1] * scale)
          }));
          const pStart = pts[0];
          const pEnd = pts[pts.length - 1];
          const dx = pEnd.x - pStart.x;
          const dy = pEnd.y - pStart.y;
          const len = Math.round(Math.hypot(dx, dy));

          const pre = charMap[cleanChar] && charMap[cleanChar][idx];
          if (pre) {
            return {
              ...pre,
              x1: pStart.x,
              y1: pStart.y,
              x2: pEnd.x,
              y2: pEnd.y,
              pts,
              len
            };
          }

          let type = 'stroke';
          let label = `第${idx + 1}笔`;
          let direction = 'Follow stroke flow';

          if (len < 38) {
            type = 'dot';
            label = `第${idx + 1}笔 丶 点 (Diǎn, Dot)`;
            direction = 'Top to bottom-right';
          } else if (Math.abs(dx) > Math.abs(dy) * 1.4 && dx > 0) {
            type = 'horizontal';
            label = `第${idx + 1}笔 一 横 (Héng, Left to Right)`;
            direction = 'Left to right (从左到右)';
          } else if (Math.abs(dy) > Math.abs(dx) * 1.4 && dy > 0) {
            type = 'vertical';
            label = `第${idx + 1}笔 丨 竖 (Shù, Top to Bottom)`;
            direction = 'Top to bottom (从上到下)';
          } else if (dx < 0 && dy > 0) {
            type = 'left_fall';
            label = `第${idx + 1}笔 丿 撇 (Piě, Left Falling)`;
            direction = 'Top-right to bottom-left (从右上到左下)';
          } else if (dx > 0 && dy > 0) {
            type = 'right_fall';
            label = `第${idx + 1}笔 ㇏ 捺 (Nà, Right Falling)`;
            direction = 'Top-left to bottom-right (从左上到右下)';
          } else if (dx > 0 && dy < 0) {
            type = 'rising';
            label = `第${idx + 1}笔 提 (Tí, Rising)`;
            direction = 'Lower-left to upper-right (从左下到右上)';
          } else {
            type = 'corner';
            label = `第${idx + 1}笔 折/钩 (Zhé / Gōu)`;
            direction = 'Follow stroke trajectory';
          }

          return {
            type,
            x1: pStart.x,
            y1: pStart.y,
            x2: pEnd.x,
            y2: pEnd.y,
            pts,
            len,
            label,
            direction
          };
        });

        return vectors;
      }
    }

    if (charMap[cleanChar]) {
      return charMap[cleanChar];
    }

    const strokes = [];
    for (let i = 0; i < count; i++) {
      const t = i / Math.max(1, count - 1);
      const y = 65 + t * 170;
      if (i % 2 === 0) {
        strokes.push({
          type: "horizontal",
          x1: 60, y1: y, x2: 260, y2: y,
          label: `第${i + 1}笔 一 横 (Left to Right)`,
          direction: "Left to right (从左到右)"
        });
      } else {
        strokes.push({
          type: "vertical",
          x1: 60 + ((i * 45) % 180), y1: Math.max(40, y - 50),
          x2: 60 + ((i * 45) % 180), y2: Math.min(280, y + 60),
          label: `第${i + 1}笔 丨 竖 (Top to Bottom)`,
          direction: "Top to bottom (从上到下)"
        });
      }
    }
    return strokes;
  }

  // Multi-Factor Strict Stroke Step & Format Evaluator
  function evaluateSingleStroke(points, strokeIdx, currentChar) {
    if (!points || points.length < 2) {
      return {
        pass: false,
        score: 0,
        reason: 'too_short',
        hint: '⚠️ Stroke too short. Please draw the stroke on the canvas.',
        valueOf() { return 0; }
      };
    }

    const strokeVectors = getCharacterStrokeVectors(currentChar);
    const totalExpected = strokeVectors.length || 4;

    if (strokeIdx >= totalExpected) {
      return {
        pass: true,
        score: 75,
        reason: 'extra',
        hint: 'Character already complete.',
        valueOf() { return 75; }
      };
    }

    const expected = strokeVectors[strokeIdx] || { x1: 50, y1: 150, x2: 250, y2: 150, label: `Stroke ${strokeIdx + 1}` };
    const startP = points[0];
    const endP = points[points.length - 1];
    const dx = endP.x - startP.x;
    const dy = endP.y - startP.y;
    const len = Math.hypot(dx, dy);

    // Reject tiny taps under 10px unless expected is a dot
    if (len < 10 && expected.type !== 'dot') {
      return {
        pass: false,
        score: 0,
        reason: 'too_short',
        hint: '⚠️ Stroke is too short. Please draw the full stroke.',
        valueOf() { return 0; }
      };
    }

    const userAngle = Math.atan2(dy, dx);
    const expDx = (expected.x2 || 0) - (expected.x1 || 0);
    const expDy = (expected.y2 || 0) - (expected.y1 || 0);
    const expAngle = Math.atan2(expDy, expDx);

    let angleDiff = Math.abs(userAngle - expAngle);
    if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

    const startDist = Math.hypot(startP.x - expected.x1, startP.y - expected.y1);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });
    const drawnMidX = (minX + maxX) / 2;
    const drawnMidY = (minY + maxY) / 2;
    const expMidX = ((expected.x1 || 0) + (expected.x2 || 0)) / 2;
    const expMidY = ((expected.y1 || 0) + (expected.y2 || 0)) / 2;
    const midDist = Math.hypot(drawnMidX - expMidX, drawnMidY - expMidY);

    // 1. OUT OF ORDER CHECK: Did the user draw a subsequent stroke instead of current step?
    // Only check if current drawn stroke deviates from current expected stroke
    if (angleDiff > 0.65 || startDist > 65) {
      for (let k = strokeIdx + 1; k < strokeVectors.length; k++) {
        const other = strokeVectors[k];
        const oDx = other.x2 - other.x1;
        const oDy = other.y2 - other.y1;
        const oAngle = Math.atan2(oDy, oDx);
        let oAngleDiff = Math.abs(userAngle - oAngle);
        if (oAngleDiff > Math.PI) oAngleDiff = 2 * Math.PI - oAngleDiff;
        const oStartDist = Math.hypot(startP.x - other.x1, startP.y - other.y1);

        if (oAngleDiff < 0.48 && oStartDist < 48) {
          return {
            pass: false,
            score: 15,
            reason: 'out_of_order',
            hint: `⚠️ Out of order! That looks like Stroke ${k + 1}, but you must draw <strong>Stroke ${strokeIdx + 1}</strong> first.`,
            valueOf() { return 15; }
          };
        }
      }
    }

    // 2. DIRECTION CHECK: Must not be written backwards (tolerance max 72 degrees / 1.26 radians)
    if (angleDiff > 1.26) {
      let dirTip = expected.direction || 'Follow stroke direction';
      if (Math.abs(expDx) > Math.abs(expDy) * 1.3 && expDx > 0) {
        dirTip = 'Draw from left to right (从左到右)';
      } else if (Math.abs(expDy) > Math.abs(expDx) * 1.3 && expDy > 0) {
        dirTip = 'Draw from top to bottom (从上到下)';
      } else if (expDx < 0 && expDy > 0) {
        dirTip = 'Draw from top-right to bottom-left (从右上到左下)';
      } else if (expDx > 0 && expDy > 0) {
        dirTip = 'Draw from top-left to bottom-right (从左上到右下)';
      }

      return {
        pass: false,
        score: 20,
        reason: 'wrong_direction',
        hint: `⚠️ Wrong direction for ${escapeHTML(expected.label || `Stroke ${strokeIdx + 1}`)}! ${dirTip}.`,
        valueOf() { return 20; }
      };
    }

    // 3. START POSITION & LOCATION CHECK: Must start in reasonable neighborhood
    if (startDist > 115 || midDist > 125) {
      return {
        pass: false,
        score: 25,
        reason: 'wrong_position',
        hint: `⚠️ Wrong position! Draw <strong>${escapeHTML(expected.label || `Stroke ${strokeIdx + 1}`)}</strong> in the correct section.`,
        valueOf() { return 25; }
      };
    }

    // 4. SCORE CALCULATION
    const dirFactor = Math.max(0, 1 - angleDiff / (Math.PI / 2));
    const posFactor = Math.max(0, 1 - (startDist * 0.55 + midDist * 0.45) / 125);
    const expLen = Math.hypot(expDx, expDy);
    const lenRatio = Math.min(len, expLen) / Math.max(len, expLen, 1);
    const rawScore = Math.round((dirFactor * 0.45 + posFactor * 0.40 + lenRatio * 0.15) * 100);

    if (rawScore < 42) {
      return {
        pass: false,
        score: rawScore,
        reason: 'low_score',
        hint: `⚠️ Inaccurate stroke format. Follow the line of <strong>${escapeHTML(expected.label || `Stroke ${strokeIdx + 1}`)}</strong>.`,
        valueOf() { return rawScore; }
      };
    }

    return {
      pass: true,
      score: Math.min(99, Math.max(50, rawScore)),
      reason: 'ok',
      hint: `✅ Correct stroke!`,
      valueOf() { return this.score; }
    };
  }

  // --- HTML5 Canvas Writing & Pointer Events Engine ---
  let currentColor = '#ea580c';
  let brushSizes = [6, 10, 16];
  let currentBrushIndex = 1;

  function initWritingCanvas(currentChar, lesson, chars) {
    canvas = document.getElementById('strokeDrawCanvas');
    if (!canvas) return;

    activeWritingChar = currentChar;
    activeWritingLesson = lesson;
    activeWritingChars = chars;

    const rect = canvas.parentElement.getBoundingClientRect();
    const size = Math.min(rect.width || 320, 320);

    canvas.width = size * window.devicePixelRatio;
    canvas.height = size * window.devicePixelRatio;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSizes[currentBrushIndex];
    ctx.strokeStyle = currentColor;

    canvas.style.touchAction = 'none';
    canvas.style.pointerEvents = 'auto';
    canvas.style.zIndex = '10';
    canvas.style.cursor = 'crosshair';

    // Direct pointer event binding on the canvas for reliable stroke start & stop
    canvas.onpointerdown = handlePointerDown;
    canvas.onpointermove = handlePointerMove;
    canvas.onpointerup = handlePointerUp;
    canvas.onpointercancel = handlePointerCancel;
    canvas.onpointerleave = handlePointerCancel;

    // Helper to ensure container is mounted and visible with valid dimensions
    function waitForContainerMountedAndVisible(container, callback, maxFrames = 25) {
      if (!container) return;
      let frameCount = 0;
      function poll() {
        frameCount++;
        const isMounted = document.body.contains(container);
        const rect = container.getBoundingClientRect();
        const style = window.getComputedStyle(container);
        const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0;
        if (isMounted && isVisible) {
          callback();
        } else if (frameCount < maxFrames) {
          requestAnimationFrame(poll);
        } else {
          callback();
        }
      }
      requestAnimationFrame(poll);
    }

    // Initialize single, high-precision HanziWriter instance
    const targetElement = document.getElementById('hanziWriterTarget');
    if (targetElement) {
      targetElement.style.pointerEvents = 'none';
      targetElement.style.zIndex = '3';
      targetElement.innerHTML = '';
      const rawCharStr = (currentChar && (currentChar.character || currentChar.char || (typeof currentChar === 'string' ? currentChar : ''))) || '早';
      const validChar = (String(rawCharStr).match(/[\u4e00-\u9fa5]/) || ['早'])[0];

      if (window.HanziWriter && validChar) {
        waitForContainerMountedAndVisible(targetElement, () => {
          try {
            if (currentHanziWriter && typeof currentHanziWriter.cancelQuiz === 'function') {
              try { currentHanziWriter.cancelQuiz(); } catch (e) {}
            }
            const rect = targetElement.getBoundingClientRect();
            const computedW = Math.round(rect.width) > 40 ? Math.round(rect.width) : 290;
            const computedH = Math.round(rect.height) > 40 ? Math.round(rect.height) : 290;

            currentHanziWriter = HanziWriter.create(targetElement, validChar, {
              width: computedW,
              height: computedH,
              padding: 10,
              showOutline: showGhostChar,
              showCharacter: false,
              strokeColor: '#ea580c',
              outlineColor: 'rgba(234, 88, 12, 0.28)',
              drawingWidth: 16,
              strokeAnimationSpeed: 1.2,
              delayBetweenStrokes: 250,
              charDataLoader: function (charToLoad, onComplete, onError) {
                if (window.EMBEDDED_HANZI_DATA && window.EMBEDDED_HANZI_DATA[charToLoad]) {
                  onComplete(window.EMBEDDED_HANZI_DATA[charToLoad]);
                  return;
                }
                fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/${encodeURIComponent(charToLoad)}.json`)
                  .then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                  })
                  .then(data => onComplete(data))
                  .catch(err => {
                    if (typeof onError === 'function') onError(err);
                  });
              },
              onLoadCharDataError: function (err) {
                console.warn('HanziWriter data notice for ' + validChar, err);
              },
              onLoadCharDataSuccess: function () {
                if (drawnStrokes.length === 0) {
                  startStrokeWriting(currentChar, lesson, chars);
                }
              }
            });
            if (drawnStrokes.length === 0) {
              startStrokeWriting(currentChar, lesson, chars);
            }
          } catch (err) {
            console.warn('HanziWriter init error:', err);
            targetElement.innerHTML = `<div class="fallback-ghost-char chinese-kaiti ${showGhostChar ? '' : 'hidden'}" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', 'Ma Shan Zheng', serif;">${escapeHTML(validChar)}</div>`;
          }
        });
      } else {
        targetElement.innerHTML = `<div class="fallback-ghost-char chinese-kaiti ${showGhostChar ? '' : 'hidden'}" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', 'Ma Shan Zheng', serif;">${escapeHTML(validChar)}</div>`;
      }
    }
  }

  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function handlePointerDown(e) {
    e.preventDefault();
    isDrawing = true;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {}

    const { x, y } = getCanvasCoords(e);
    lastX = x;
    lastY = y;
    currentStrokePoints = [{ x, y }];

    ctx.beginPath();
    ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  }

  function handlePointerMove(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCanvasCoords(e);
    currentStrokePoints.push({ x, y });

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastX = x;
    lastY = y;
  }

  function handlePointerUp(e) {
    if (!isDrawing) return;
    isDrawing = false;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (err) {}

    if (currentStrokePoints && currentStrokePoints.length > 1) {
      const strokeVectors = getCharacterStrokeVectors(activeWritingChar);
      const totalExpected = (activeWritingChar && activeWritingChar.strokeCount) || strokeVectors.length || 4;
      const strokeIdx = drawnStrokes.length;

      if (strokeIdx < totalExpected) {
        const evalResult = evaluateSingleStroke(currentStrokePoints, strokeIdx, activeWritingChar);
        const expectedVector = strokeVectors[strokeIdx] || { label: `Stroke ${strokeIdx + 1}` };

        // Strictly block incorrect stroke, erase invalid drawing line, and show instructional correction
        if (!evalResult.pass) {
          userMistakesCount++;
          if (window.LinguaAudio) window.LinguaAudio.playChime(false);

          // Clear invalid stroke from canvas, leaving all previously drawn correct strokes intact
          redrawCanvasFromStrokes();

          const stepHint = document.getElementById('strokeOrderHintText');
          if (stepHint) {
            stepHint.innerHTML = `<span style="color: #dc2626; font-weight: 700;">${evalResult.hint || `⚠️ Incorrect stroke! Try drawing: ${escapeHTML(expectedVector.label || `Stroke ${strokeIdx + 1}`)}`}</span>`;
          }
          const stepBar = document.getElementById('strokeOrderStepBar');
          if (stepBar) {
            stepBar.classList.add('stroke-error-shake');
            setTimeout(() => stepBar.classList.remove('stroke-error-shake'), 450);
          }
          const container = document.getElementById('canvasContainer');
          if (container) {
            container.classList.add('stroke-error-shake');
            setTimeout(() => container.classList.remove('stroke-error-shake'), 450);
          }
        } else {
          // ACCEPT STROKE: Keep user's exact handwritten stroke on canvas & advance step
          if (window.LinguaAudio) window.LinguaAudio.playChime(true);
          drawnStrokes.push([...currentStrokePoints]);
          strokeScores.push(evalResult.score);

          redrawCanvasFromStrokes();
          updateStrokeBadgesUI(activeWritingChar);

          const nextIdx = drawnStrokes.length;
          const stepBadge = document.getElementById('strokeStepBadge');
          const stepHint = document.getElementById('strokeOrderHintText');

          if (nextIdx < totalExpected) {
            const nextVector = strokeVectors[nextIdx] || { label: `Stroke ${nextIdx + 1}` };
            if (stepBadge) stepBadge.textContent = `Stroke ${nextIdx + 1} / ${totalExpected}`;
            if (stepHint) {
              stepHint.innerHTML = `✅ Step ${strokeIdx + 1} Correct! Next: 👉 <strong class="chinese-kaiti" style="color: #ea580c;">${escapeHTML(nextVector.label || `Stroke ${nextIdx + 1}`)}</strong> (${escapeHTML(nextVector.direction || 'Follow stroke order')})`;
            }
          } else {
            if (stepBadge) stepBadge.textContent = `Completed (${totalExpected} / ${totalExpected})`;
            if (stepHint) stepHint.innerHTML = `🎉 <strong>Character Completed!</strong> Great handwriting!`;

            const accuracy = Math.max(50, Math.round(strokeScores.reduce((a, b) => a + b, 0) / totalExpected));
            if (activeWritingLesson && activeWritingLesson.id) {
              saveLessonProgressRecord(activeWritingLesson.id, accuracy, true);
            }
            saveUserScore(20);

            setTimeout(() => {
              openPracticeResultModal(activeWritingChar, activeWritingLesson, activeWritingChars, accuracy);
            }, 550);
          }
        }
      }
    }
    currentStrokePoints = [];
  }

  function handlePointerCancel(e) {
    if (!isDrawing) return;
    isDrawing = false;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (err) {}
    currentStrokePoints = [];
  }

  // Update stroke live scores row & step indicator
  function updateStrokeBadgesUI(currentChar) {
    const strokeVectors = getCharacterStrokeVectors(currentChar);
    const totalExpected = currentChar.strokeCount || strokeVectors.length || 4;
    const stepBadge = document.getElementById('strokeStepBadge');
    const stepHint = document.getElementById('strokeOrderHintText');
    const liveScoresRow = document.getElementById('strokeLiveScoresRow');

    const nextStrokeNum = Math.min(drawnStrokes.length + 1, totalExpected);

    if (stepBadge) {
      stepBadge.textContent = `Stroke ${nextStrokeNum} / ${totalExpected}`;
    }
    if (stepHint) {
      if (drawnStrokes.length >= totalExpected) {
        stepHint.innerHTML = 'All strokes drawn! Click Grade below.';
      } else {
        const nextVector = strokeVectors[nextStrokeNum - 1];
        if (nextVector && nextVector.label) {
          stepHint.innerHTML = `Draw stroke #${nextStrokeNum}: <span class="chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', 'Ma Shan Zheng', serif; font-weight: 700; color: #ea580c;">${escapeHTML(nextVector.label)}</span>`;
        } else {
          stepHint.textContent = `Draw stroke #${nextStrokeNum}`;
        }
      }
    }

    if (liveScoresRow) {
      liveScoresRow.innerHTML = strokeScores.map(score => `
        <span class="stroke-live-badge">${score}</span>
      `).join('');
    }
  }

  function clearCanvas(currentChar) {
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    drawnStrokes = [];
    strokeScores = [];
    currentStrokePoints = [];

    if (currentHanziWriter) {
      try {
        currentHanziWriter.cancelQuiz();
        currentHanziWriter.hideCharacter();
        if (showGhostChar) {
          currentHanziWriter.showOutline();
        } else {
          currentHanziWriter.hideOutline();
        }
      } catch (e) {}
    }

    if (currentChar) {
      startStrokeWriting(currentChar, activeWritingLesson, activeWritingChars);
    }
  }

  // =========================================================
  // --- SECTION 4: PRONUNCIATION CHECK (Web Speech API) ---
  // =========================================================

  const PRONUNCIATION_PRACTICE_BANK = {
    "adult-basics-01": [
      {
        chinese: "早上好！今天天气真好。",
        pinyin: "Zǎoshang hǎo! Jīntiān tiānqì zhēn hǎo.",
        meaning: "Good morning! The weather is really nice today.",
        focus: "Morning greetings & daily pleasantries"
      },
      {
        chinese: "您好，请问洗手间在哪里？",
        pinyin: "Nín hǎo, qǐngwèn xǐshǒujiān zài nǎlǐ?",
        meaning: "Hello, excuse me, where is the restroom?",
        focus: "Polite inquiries (您好 / 请问)"
      },
      {
        chinese: "非常感谢您的热心帮助。",
        pinyin: "Fēicháng gǎnxiè nín de rèxīn bāngzhù.",
        meaning: "Thank you very much for your kind help.",
        focus: "Gratitude & formal etiquette"
      },
      {
        chinese: "不客气，明天见！",
        pinyin: "Bú kèqi, míngtiān jiàn!",
        meaning: "You're welcome, see you tomorrow!",
        focus: "Closing pleasantries"
      }
    ],
    "adult-basics-02": [
      {
        chinese: "你好，我叫大卫，很高兴认识你。",
        pinyin: "Nǐ hǎo, wǒ jiào Dàwèi, hěn gāoxìng rènshí nǐ.",
        meaning: "Hello, my name is David, nice to meet you.",
        focus: "Self-introduction & greetings"
      },
      {
        chinese: "我是美国人，目前在北京工作。",
        pinyin: "Wǒ shì Měiguó rén, mùqián zài Běijīng gōngzuò.",
        meaning: "I am American, currently working in Beijing.",
        focus: "Nationality & location"
      },
      {
        chinese: "我的手机号码是一三八零零一二。",
        pinyin: "Wǒ de shǒujī hàomǎ shì yīsānbā línglíng yī'èr.",
        meaning: "My cell phone number is 138-0012.",
        focus: "Digits & phone number rhythm"
      },
      {
        chinese: "请问这个一件多少钱？",
        pinyin: "Qǐngwèn zhège yí jiàn duōshao qián?",
        meaning: "Excuse me, how much is this one piece?",
        focus: "Basic prices & measure words"
      }
    ],
    "adult-travel-01": [
      {
        chinese: "服务员，请给我们一份菜单。",
        pinyin: "Fúwùyuán, qǐng gěi wǒmen yí fèn càidān.",
        meaning: "Waiter, please bring us a menu.",
        focus: "Restaurant etiquette"
      },
      {
        chinese: "我们点一份宫保鸡丁和水饺。",
        pinyin: "Wǒmen diǎn yí fèn gōngbǎo jīdīng hé shuǐjiǎo.",
        meaning: "We'd like to order Kung Pao chicken and dumplings.",
        focus: "Ordering signature dishes"
      },
      {
        chinese: "请不要放辣椒，我们不吃辣。",
        pinyin: "Qǐng búyào fàng làjiāo, wǒmen bù chī là.",
        meaning: "Please don't put chili, we don't eat spicy.",
        focus: "Dietary preferences"
      },
      {
        chinese: "你好买单，可以用微信支付吗？",
        pinyin: "Nǐ hǎo mǎidān, kěyǐ yòng Wēixìn zhīfù ma?",
        meaning: "Hello, check please, can I pay using WeChat?",
        focus: "Digital payments & bill settlement"
      }
    ],
    "adult-travel-02": [
      {
        chinese: "请问去最近的地铁站怎么走？",
        pinyin: "Qǐngwèn qù zuìjìn de dìtiězhàn zěnme zǒu?",
        meaning: "Excuse me, how do I walk to the nearest subway station?",
        focus: "Asking directions"
      },
      {
        chinese: "向前一直走，在十字路口向右转。",
        pinyin: "Xiàng qián yìzhí zǒu, zài shízì lùkǒu xiàng yòu zhuǎn.",
        meaning: "Walk straight ahead, then turn right at the crossroads.",
        focus: "Navigation directions"
      },
      {
        chinese: "我要买一张去上海的高铁二等座。",
        pinyin: "Wǒ yào mǎi yì zhāng qù Shànghǎi de gāotiě èrděngzuò.",
        meaning: "I'd like to buy a second-class bullet train ticket to Shanghai.",
        focus: "High-speed rail booking"
      },
      {
        chinese: "请带我到这家酒店，谢谢师傅。",
        pinyin: "Qǐng dài wǒ dào zhè jiā jiǔdiàn, xièxie shīfu.",
        meaning: "Please take me to this hotel, thank you driver.",
        focus: "Taxi communication"
      }
    ],
    "adult-business-01": [
      {
        chinese: "王总您好，初次见面，请多关照。",
        pinyin: "Wáng zǒng nín hǎo, chūcì jiànmiàn, qǐng duō guānzhào.",
        meaning: "Hello Director Wang, nice to meet you for the first time.",
        focus: "Corporate introductions"
      },
      {
        chinese: "这是我们公司的最新项目企划方案。",
        pinyin: "Zhè shì wǒmen gōngsī de zuìxīn xiàngmù qǐhuà fāng'àn.",
        meaning: "This is our company's latest project proposal.",
        focus: "Presenting business materials"
      },
      {
        chinese: "期待我们双方未来有更深入的合作。",
        pinyin: "Qīdài wǒmen shuāngfāng wèilái yǒu gèng shēnrù de hézuò.",
        meaning: "Looking forward to deeper cooperation between our parties.",
        focus: "Partnership etiquette"
      }
    ],
    "adult-business-02": [
      {
        chinese: "关于这批产品的单价，我们还可以商量吗？",
        pinyin: "Guānyú zhè pī chǎnpǐn de dānjià, wǒmen hái kěyǐ shāngliang ma?",
        meaning: "Regarding the unit price of these products, can we negotiate further?",
        focus: "Price discussions"
      },
      {
        chinese: "如果订购数量翻倍，能否给予百分之五的折扣？",
        pinyin: "Rúguǒ dìnggòu shùliàng fānbèi, néngfǒu jǐyǔ bǎi fēn zhī wǔ de zhékòu?",
        meaning: "If order volume doubles, could you grant a 5% discount?",
        focus: "Bulk discount negotiation"
      },
      {
        chinese: "双方对本次采购合同条款都表示满意。",
        pinyin: "Shuāngfāng duì běncì cǎigòu hétong tiáokuǎn dōu biǎoshì mǎnyì.",
        meaning: "Both parties are satisfied with the terms of this procurement contract.",
        focus: "Contract finalization"
      }
    ],
    "kids-pinyin-01": [
      {
        chinese: "你好！小熊猫，你好吗？",
        pinyin: "Nǐ hǎo! Xiǎo xióngmāo, nǐ hǎo ma?",
        meaning: "Hello! Little panda, how are you?",
        focus: "Friendly greetings"
      },
      {
        chinese: "我很好，谢谢你，我的好朋友！",
        pinyin: "Wǒ hěn hǎo, xièxie nǐ, wǒ de hǎo péngyou!",
        meaning: "I am great, thank you, my good friend!",
        focus: "Happy response"
      },
      {
        chinese: "小白兔，蹦蹦跳跳真可爱。",
        pinyin: "Xiǎo bái tù, bèngbèng tiàotiào zhēn kě'ài.",
        meaning: "The little white rabbit hops around, so cute.",
        focus: "Animal rhyming fun"
      },
      {
        chinese: "再见，明天我们一起玩游戏！",
        pinyin: "Zàijiàn, míngtiān wǒmen yìqǐ wán yóuxì!",
        meaning: "Goodbye, tomorrow let's play games together!",
        focus: "Playful farewell"
      }
    ],
    "kids-pinyin-02": [
      {
        chinese: "小猫喵喵叫，小狗汪汪叫。",
        pinyin: "Xiǎo māo miāo miāo jiào, xiǎo gǒu wāng wāng jiào.",
        meaning: "Kittens say meow meow, puppies say woof woof.",
        focus: "Onomatopoeia & animal sounds"
      },
      {
        chinese: "大象鼻子长，长颈鹿个子高。",
        pinyin: "Dàxiàng bízi cháng, chángjǐnglù gèzi gāo.",
        meaning: "Elephants have long trunks, giraffes are tall.",
        focus: "Descriptive animal traits"
      },
      {
        chinese: "红红的苹果甜又香，真好吃！",
        pinyin: "Hónghóng de píngguǒ tián yòu xiāng, zhēn hǎochī!",
        meaning: "Red apples are sweet and fragrant, so tasty!",
        focus: "Colors and delicious foods"
      }
    ],
    "kids-animals-01": [
      {
        chinese: "动物园里有好多可爱的小动物。",
        pinyin: "Dòngwùyuán lǐ yǒu hǎoduō kě'ài de xiǎo dòngwù.",
        meaning: "There are so many cute animals in the zoo.",
        focus: "Zoo exploration"
      },
      {
        chinese: "看！熊猫正在开心地吃竹子。",
        pinyin: "Kàn! Xióngmāo zhèngzài kāixīn de chī zhúzi.",
        meaning: "Look! The panda is happily eating bamboo.",
        focus: "Panda habitat"
      },
      {
        chinese: "大老虎威风凛凛真帅气。",
        pinyin: "Dà lǎohǔ wēifēng lǐnlǐn zhēn shuàiqì.",
        meaning: "The big tiger looks mighty and handsome.",
        focus: "Wild animal adjectives"
      }
    ],
    "kids-animals-02": [
      {
        chinese: "海洋里有大鲸鱼和彩色的小热带鱼。",
        pinyin: "Hǎiyáng lǐ yǒu dà jīngyú hé cǎisè de xiǎo rèdàiyú.",
        meaning: "In the ocean there are big whales and colorful tropical fish.",
        focus: "Marine creatures"
      },
      {
        chinese: "海豚在浪花里跳跃翻滚，真聪明！",
        pinyin: "Hǎitún zài lànghuā lǐ tiàoyuè fāngǔn, zhēn cōngmíng!",
        meaning: "Dolphins leap and roll in the waves, so smart!",
        focus: "Dolphin intelligence"
      }
    ],
    "kids-culture-01": [
      {
        chinese: "新年快乐！恭喜发财，红包拿来！",
        pinyin: "Xīnnián kuàilè! Gōngxǐ fācái, hóngbāo nálái!",
        meaning: "Happy New Year! Wishing you prosperity, red envelopes please!",
        focus: "Spring Festival celebrations"
      },
      {
        chinese: "过年全家人一起吃饺子，贴春联。",
        pinyin: "Guònián quán jiā rén yìqǐ chī jiǎozi, tiē chūnlián.",
        meaning: "During New Year the whole family eats dumplings and puts up spring couplets.",
        focus: "Traditional holiday customs"
      }
    ],
    "kids-culture-02": [
      {
        chinese: "中秋节的月亮又大又圆，月饼真香！",
        pinyin: "Zhōngqiūjié de yuèliang yòu dà yòu yuán, yuèbǐng zhēn xiāng!",
        meaning: "The Mid-Autumn moon is big and round, mooncakes smell so good!",
        focus: "Moon Festival traditions"
      },
      {
        chinese: "嫦娥奔月的美丽传说流传千百年。",
        pinyin: "Cháng'é bēn yuè de měilì chuánshuō liúchuán qiānbǎi nián.",
        meaning: "The beautiful legend of Chang'e flying to the moon has been told for centuries.",
        focus: "Folklore storytelling"
      }
    ]
  };

  // State variables for Pronunciation Check
  let activePronunciationLesson = null;
  let activePronunciationSentences = [];
  let currentPronunciationIndex = 0;
  let activeSpeechRecognition = null;
  let isPronunciationRecording = false;
  let pronunciationSessionScores = {};

  // Standard character to Pinyin dictionary lookup
  const HANZI_PINYIN_MAP = {
    "早": "zǎo", "上": "shang", "好": "hǎo", "今": "jīn", "天": "tiān", "气": "qì", "真": "zhēn",
    "您": "nín", "请": "qǐng", "问": "wèn", "洗": "xǐ", "手": "shǒu", "间": "jiān", "在": "zài",
    "哪": "nǎ", "里": "lǐ", "非": "fēi", "常": "cháng", "感": "gǎn", "谢": "xiè", "的": "de",
    "热": "rè", "心": "xīn", "帮": "bāng", "助": "zhù", "不": "bù", "客": "kè", "明": "míng",
    "见": "jiàn", "我": "wǒ", "叫": "jiào", "大": "dà", "卫": "wèi", "很": "hěn", "高": "gāo",
    "兴": "xìng", "认": "rèn", "识": "shi", "你": "nǐ", "是": "shì", "美": "měi", "国": "guó",
    "人": "rén", "目": "mù", "前": "qián", "北": "běi", "京": "jīng", "工": "gōng", "作": "zuò",
    "机": "jī", "号": "hào", "码": "mǎ", "一": "yī", "三": "sān", "八": "bā", "零": "líng",
    "二": "èr", "这": "zhè", "个": "gè", "件": "jiàn", "多": "duō", "少": "shǎo", "钱": "qián",
    "服": "fú", "务": "wù", "员": "yuán", "给": "gěi", "们": "men", "份": "fèn", "菜": "cài",
    "单": "dān", "点": "diǎn", "宫": "gōng", "保": "bǎo", "鸡": "jī", "丁": "dīng", "和": "hé",
    "水": "shuǐ", "饺": "jiǎo", "要": "yào", "放": "fàng", "辣": "là", "椒": "jiāo", "吃": "chī",
    "买": "mǎi", "可": "kě", "以": "yǐ", "用": "yòng", "微": "wēi", "信": "xìn", "支": "zhī",
    "付": "fù", "吗": "ma", "最": "zuì", "近": "jìn", "地": "dì", "铁": "tiě", "站": "zhàn",
    "怎": "zěn", "么": "me", "走": "zǒu", "向": "xiàng", "直": "zhí", "十": "shí", "字": "zì",
    "路": "lù", "口": "kǒu", "右": "yòu", "转": "zhuǎn", "张": "zhāng", "去": "qù", "海": "hǎi",
    "等": "děng", "座": "zuò", "带": "dài", "到": "dào", "家": "jiā", "酒": "jiǔ", "店": "diàn",
    "师": "shī", "傅": "fu", "王": "wáng", "总": "zǒng", "初": "chū", "次": "cì", "面": "miàn",
    "关": "guān", "照": "zhào", "司": "sī", "新": "xīn", "项": "xiàng", "企": "qǐ", "划": "huà",
    "方": "fāng", "案": "àn", "期": "qī", "双": "shuāng", "未": "wèi", "来": "lái", "有": "yǒu",
    "更": "gèng", "深": "shēn", "入": "rù", "合": "hé", "产": "chǎn", "品": "pǐn", "批": "pī",
    "商": "shāng", "量": "liang", "如": "rú", "果": "guǒ", "订": "dìng", "购": "gòu", "数": "shù",
    "翻": "fān", "倍": "bèi", "能": "néng", "否": "fǒu", "予": "yǔ", "百": "bǎi", "分": "fēn",
    "之": "zhī", "五": "wǔ", "折": "zhé", "扣": "kòu", "对": "duì", "本": "běn", "采": "cǎi",
    "同": "tóng", "条": "tiáo", "款": "kuǎn", "都": "dōu", "表": "biǎo", "示": "shì", "满": "mǎn",
    "意": "yì", "熊": "xióng", "猫": "māo", "兔": "tù", "蹦": "bèng", "跳": "tiào", "爱": "ài",
    "玩": "wán", "游": "yóu", "戏": "xì", "狗": "gǒu", "汪": "wāng", "喵": "miāo", "象": "xiàng",
    "鼻": "bí", "子": "zi", "长": "cháng", "颈": "jǐng", "鹿": "lù", "红": "hóng", "苹": "píng",
    "甜": "tián", "香": "xiāng", "动": "dòng", "物": "wù", "园": "yuán", "翠": "cuì", "绿": "lǜ",
    "竹": "zhú", "老": "lǎo", "虎": "hǔ", "威": "wēi", "风": "fēng", "凛": "lǐn", "帅": "shuài",
    "鲸": "jīng", "鱼": "yú", "色": "sè", "豚": "tún", "浪": "làng", "花": "huā", "跃": "yuè",
    "滚": "gǔn", "聪": "cōng", "年": "nián", "快": "kuài", "乐": "lè", "恭": "gōng", "喜": "xǐ",
    "发": "fā", "财": "cái", "包": "bāo", "拿": "ná", "全": "quán", "贴": "tiē", "春": "chūn",
    "联": "lián", "中": "zhōng", "秋": "qiū", "节": "jié", "月": "yuè", "饼": "bǐng", "嫦": "cháng",
    "娥": "é", "奔": "bēn", "传": "chuán", "说": "shuō", "流": "liú", "千": "qiān"
  };

  function getCharacterPinyin(char, fallbackSentencePinyin, idx) {
    if (HANZI_PINYIN_MAP[char]) return HANZI_PINYIN_MAP[char];
    if (fallbackSentencePinyin) {
      const words = fallbackSentencePinyin.replace(/[!,?.;:'"—\-]/g, '').trim().split(/\s+/);
      if (words[idx]) return words[idx].toLowerCase();
    }
    return '';
  }

  function getLessonPronunciationSentences(lesson) {
    if (!lesson) return [];
    const lessonId = String(lesson.id || '').trim().toLowerCase();
    for (const [key, list] of Object.entries(PRONUNCIATION_PRACTICE_BANK)) {
      if (key.toLowerCase() === lessonId) return list;
    }
    // Check if vocabulary items exist for this lesson
    const vocab = allVocabulary.filter(v => String(v.lessonId || '').trim().toLowerCase() === lessonId);
    if (vocab.length > 0) {
      return vocab.slice(0, 5).map(v => ({
        chinese: v.character || lesson.chineseTitle || lesson.title,
        pinyin: v.pinyin || '',
        meaning: v.meaning || `Vocabulary phrase for ${lesson.title}`,
        focus: `Lesson Vocabulary`
      }));
    }
    // Fallback based on lesson Chinese title
    const fallbackList = [];
    if (lesson.chineseTitle) {
      fallbackList.push({
        chinese: lesson.chineseTitle,
        pinyin: lesson.pinyin || '',
        meaning: lesson.meaning || lesson.title,
        focus: "Lesson Core Phrase"
      });
    }
    fallbackList.push({
      chinese: "你好！很高兴学中文。",
      pinyin: "Nǐ hǎo! Hěn gāoxìng xué Zhōngwén.",
      meaning: "Hello! Very happy to learn Chinese.",
      focus: "General Greeting Practice"
    });
    return fallbackList;
  }

  function stopPronunciationRecording() {
    if (activeSpeechRecognition) {
      try {
        activeSpeechRecognition.onend = null;
        activeSpeechRecognition.onerror = null;
        activeSpeechRecognition.onresult = null;
        activeSpeechRecognition.stop();
      } catch (e) {}
      activeSpeechRecognition = null;
    }
    isPronunciationRecording = false;
    updatePronunciationMicUI(false);
  }

  function updatePronunciationMicUI(recording) {
    const consoleEl = document.getElementById('pronMicConsole');
    const statusText = document.getElementById('pronMicStatusText');
    const interimBox = document.getElementById('pronInterimBox');

    if (consoleEl) {
      consoleEl.classList.toggle('is-recording', recording);
    }
    if (statusText) {
      statusText.textContent = recording ? '🔴 Listening... Speak clearly in Mandarin!' : '🎙️ Click to Read Aloud';
    }
    if (interimBox && !recording) {
      interimBox.style.display = 'none';
    }
  }

  // Pure Client-side Speech Recognition with zh-CN
  function togglePronunciationRecording(currentSentence) {
    if (isPronunciationRecording) {
      stopPronunciationRecording();
      return;
    }

    const SpeechRecClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecClass) {
      const hint = document.getElementById('pronMicStatusText');
      if (hint) {
        hint.innerHTML = '⚠️ Web Speech API not supported in this browser. Please use Chrome, Edge, or Safari, or test with the input below.';
      }
      return;
    }

    try {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      const rec = new SpeechRecClass();
      rec.lang = 'zh-CN';
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 3;

      let finalTranscript = '';
      activeSpeechRecognition = rec;
      isPronunciationRecording = true;
      updatePronunciationMicUI(true);

      const interimBox = document.getElementById('pronInterimBox');
      const interimText = document.getElementById('pronInterimText');
      if (interimBox) interimBox.style.display = 'inline-block';
      if (interimText) interimText.textContent = 'Listening... Speak in Mandarin now';

      rec.onresult = (evt) => {
        let interim = '';
        for (let i = evt.resultIndex; i < evt.results.length; ++i) {
          if (evt.results[i].isFinal) {
            finalTranscript += evt.results[i][0].transcript;
          } else {
            interim += evt.results[i][0].transcript;
          }
        }
        if (interimText) {
          const display = (finalTranscript || interim).trim();
          interimText.textContent = display ? `Listening: "${display}"` : 'Listening... Speak in Mandarin now';
        }
      };

      rec.onerror = (evt) => {
        console.warn('Speech recognition error:', evt.error);
        stopPronunciationRecording();
        const hintEl = document.getElementById('pronMicStatusText');
        if (hintEl) {
          if (evt.error === 'not-allowed') {
            hintEl.textContent = '⚠️ Microphone permission denied. Please allow mic in browser settings.';
          } else if (evt.error === 'no-speech') {
            hintEl.textContent = '⚠️ No speech detected. Click the mic and read the phrase again.';
          } else {
            hintEl.textContent = `Speech Notice: ${evt.error}. Click mic to retry.`;
          }
        }
      };

      rec.onspeechend = () => {
        try { rec.stop(); } catch (e) {}
      };

      rec.onend = () => {
        isPronunciationRecording = false;
        activeSpeechRecognition = null;
        updatePronunciationMicUI(false);
        if (finalTranscript.trim()) {
          evaluateAndRenderPronunciation(finalTranscript, currentSentence);
        }
      };

      rec.start();
    } catch (err) {
      console.warn("Failed to initialize speech recognition:", err);
      stopPronunciationRecording();
    }
  }

  // Word-by-word sequence alignment and pronunciation scoring
  function calculatePronunciationAccuracy(targetText, heardText, targetPinyin) {
    // Strip non-Hanzi and punctuation symbols for clean alignment
    const cleanTarget = (targetText || '').replace(/[\s\p{P}\p{S}]/gu, '');
    const cleanHeard = (heardText || '').replace(/[\s\p{P}\p{S}]/gu, '');

    const targetChars = Array.from(cleanTarget);
    const heardChars = Array.from(cleanHeard);

    if (targetChars.length === 0) {
      return { score: 100, matches: [], cleanTarget, cleanHeard };
    }

    if (heardChars.length === 0) {
      const matches = targetChars.map((char, idx) => ({
        char,
        pinyin: getCharacterPinyin(char, targetPinyin, idx),
        status: 'miss',
        heardChar: ''
      }));
      return { score: 0, matches, matchCount: 0, targetLength: targetChars.length, cleanTarget, cleanHeard };
    }

    // Longest Common Subsequence dynamic programming table
    const m = targetChars.length;
    const n = heardChars.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (targetChars[i - 1] === heardChars[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    // Backtrack to identify aligned matching characters
    const alignedTargetIndices = new Set();
    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (targetChars[i - 1] === heardChars[j - 1]) {
        alignedTargetIndices.add(i - 1);
        i--;
        j--;
      } else if (dp[i - 1][j] >= dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    // Common Chinese homophones / near matches
    const HOMOPHONE_SETS = [
      ['在', '再'], ['做', '作', '坐', '座'], ['他', '她', '它'],
      ['的', '得', '地'], ['以', '已'], ['向', '相'], ['只', '支'],
      ['好', '号'], ['要', '药'], ['车', '彻'], ['直', '只']
    ];

    function isNearMatch(tc, hc) {
      if (!tc || !hc) return false;
      return HOMOPHONE_SETS.some(set => set.includes(tc) && set.includes(hc));
    }

    // Build word-by-word evaluation cards
    let matchCount = 0;
    let closeCount = 0;

    const matches = targetChars.map((char, idx) => {
      const pinyin = getCharacterPinyin(char, targetPinyin, idx);
      if (alignedTargetIndices.has(idx)) {
        matchCount++;
        return { char, pinyin, status: 'match', heardChar: char };
      }

      // Check if character was near-match or spoken in approximate position
      const heardChar = heardChars[idx] || '';
      if (isNearMatch(char, heardChar)) {
        closeCount++;
        return { char, pinyin, status: 'close', heardChar };
      }

      return { char, pinyin, status: 'miss', heardChar };
    });

    const rawScore = Math.round(((matchCount * 1.0 + closeCount * 0.6) / targetChars.length) * 100);
    const score = Math.max(0, Math.min(100, rawScore));

    return {
      score,
      matches,
      matchCount,
      closeCount,
      targetLength: targetChars.length,
      cleanTarget,
      cleanHeard
    };
  }

  function evaluateAndRenderPronunciation(spokenText, sentence) {
    if (!sentence) return;
    const result = calculatePronunciationAccuracy(sentence.chinese, spokenText, sentence.pinyin);

    // Save score in session map
    const scoreKey = `${activePronunciationLesson ? activePronunciationLesson.id : 'lesson'}_${currentPronunciationIndex}`;
    if (!pronunciationSessionScores[scoreKey] || result.score > pronunciationSessionScores[scoreKey]) {
      pronunciationSessionScores[scoreKey] = result.score;
    }

    if (activePronunciationLesson && result.score >= 70) {
      saveUserScore(activePronunciationLesson.id, 'pronunciation', result.score);
    }

    // Audio chime feedback
    if (result.score >= 80) {
      playSound('correct');
    } else {
      playSound('click');
    }

    renderPronunciationFeedback(result, sentence);
    updatePronunciationNavDots();
  }

  function renderPronunciationFeedback(result, sentence) {
    const feedbackBox = document.getElementById('pronFeedbackContainer');
    if (!feedbackBox) return;

    let scoreClass = 'score-needs-work';
    let fillClass = 'fill-needs-work';
    let titleMsg = '加油！Keep Practicing!';
    let detailMsg = 'Listen to the native speaker and practice the highlighted red characters.';

    if (result.score >= 90) {
      scoreClass = 'score-excellent';
      fillClass = 'fill-excellent';
      titleMsg = '太棒了！Outstanding! 🌟';
      detailMsg = 'Fluent, accurate tones with near-native Mandarin cadence!';
    } else if (result.score >= 75) {
      scoreClass = 'score-good';
      fillClass = 'fill-good';
      titleMsg = '很好！Very Good! 👍';
      detailMsg = 'Clear articulation and strong rhythm. Minor adjustments on missed words.';
    } else if (result.score >= 60) {
      scoreClass = 'score-fair';
      fillClass = 'fill-fair';
      titleMsg = '不错！Good Effort! 💡';
      detailMsg = 'Understandable phrasing. Pay close attention to tone inflections.';
    }

    // Character cards markup
    const charCardsHtml = result.matches.map(m => {
      let badgeLabel = '✓ Match';
      if (m.status === 'close') badgeLabel = '~ Close';
      if (m.status === 'miss') badgeLabel = '✗ Check';

      return `
        <div class="pron-char-card ${m.status}" title="Click to hear '${escapeHTML(m.char)}'" data-char="${escapeHTML(m.char)}">
          <span class="pron-char-pinyin">${escapeHTML(m.pinyin || '')}</span>
          <span class="pron-char-text chinese-kaiti">${escapeHTML(m.char)}</span>
          <span class="pron-char-badge">${badgeLabel}</span>
        </div>
      `;
    }).join('');

    const isLastSentence = currentPronunciationIndex >= activePronunciationSentences.length - 1;

    feedbackBox.innerHTML = `
      <div class="pron-score-hero">
        <div class="pron-score-pill-wrap">
          <div class="pron-score-pill ${scoreClass}">
            <span>${result.score}</span><span class="unit">%</span>
          </div>
          <div class="pron-score-details">
            <h3>${titleMsg}</h3>
            <p>${detailMsg}</p>
          </div>
        </div>
        <div class="pron-audio-controls">
          <button type="button" class="btn-pron-audio" id="btnPronListenTarget">
            <span>🔊 Native Audio</span>
          </button>
        </div>
      </div>

      <div class="pron-progress-meter" role="progressbar" aria-valuenow="${result.score}" aria-valuemin="0" aria-valuemax="100">
        <div class="pron-progress-fill ${fillClass}" style="width: ${result.score}%;"></div>
      </div>

      <div class="pron-breakdown-heading">
        <h4><span>🎯 Word-by-Word Pronunciation Accuracy:</span></h4>
        <div class="pron-breakdown-legend">
          <span class="pron-legend-item"><span class="pron-legend-dot green"></span> Match</span>
          <span class="pron-legend-item"><span class="pron-legend-dot amber"></span> Near</span>
          <span class="pron-legend-item"><span class="pron-legend-dot red"></span> Missed</span>
        </div>
      </div>

      <div class="pron-char-cards-grid">
        ${charCardsHtml}
      </div>

      <div class="pron-compare-box">
        <div class="pron-compare-row">
          <span class="pron-compare-label">Target Text:</span>
          <span class="pron-compare-val chinese-kaiti" style="font-family: 'KaiTi', '楷体', serif; color: #ea580c;">${escapeHTML(sentence.chinese)}</span>
        </div>
        <div class="pron-compare-row">
          <span class="pron-compare-label">Microphone Heard:</span>
          <span class="pron-compare-val chinese-kaiti" style="font-family: 'KaiTi', '楷体', serif;">${escapeHTML(result.cleanHeard || '(No speech transcribed)')}</span>
        </div>
      </div>

      <div class="pron-actions-row">
        <button type="button" class="btn-pron-retry" id="btnPronRetry">
          <span>↺ Try Again</span>
        </button>
        <button type="button" class="btn-pron-next" id="btnPronNextSentence">
          <span>${isLastSentence ? '★ Finish Practice →' : 'Next Sentence →'}</span>
        </button>
      </div>
    `;

    feedbackBox.style.display = 'block';

    // Hook listeners
    feedbackBox.querySelectorAll('.pron-char-card').forEach(card => {
      card.onclick = () => {
        const char = card.dataset.char;
        if (char) speakChinese(char);
      };
    });

    const btnListen = document.getElementById('btnPronListenTarget');
    if (btnListen) {
      btnListen.onclick = () => speakChinese(sentence.chinese);
    }

    const btnRetry = document.getElementById('btnPronRetry');
    if (btnRetry) {
      btnRetry.onclick = () => {
        feedbackBox.style.display = 'none';
        togglePronunciationRecording(sentence);
      };
    }

    const btnNext = document.getElementById('btnPronNextSentence');
    if (btnNext) {
      btnNext.onclick = () => {
        if (!isLastSentence) {
          switchPronunciationSentence(currentPronunciationIndex + 1);
        } else {
          switchPronunciationSentence(0);
        }
      };
    }
  }

  function updatePronunciationNavDots() {
    const pillsWrap = document.getElementById('pronNavPills');
    if (!pillsWrap) return;

    pillsWrap.querySelectorAll('.pron-dot-btn').forEach((btn, idx) => {
      const scoreKey = `${activePronunciationLesson ? activePronunciationLesson.id : 'lesson'}_${idx}`;
      const bestScore = pronunciationSessionScores[scoreKey];
      btn.classList.toggle('active', idx === currentPronunciationIndex);
      btn.classList.toggle('completed', bestScore !== undefined && bestScore >= 70);
    });
  }

  function switchPronunciationSentence(index) {
    if (!activePronunciationSentences || !activePronunciationSentences.length) return;
    stopPronunciationRecording();

    currentPronunciationIndex = Math.max(0, Math.min(activePronunciationSentences.length - 1, index));
    renderCurrentPronunciationCard();
  }

  function renderCurrentPronunciationCard() {
    const sentence = activePronunciationSentences[currentPronunciationIndex];
    if (!sentence) return;

    // Update Top Badges & Progress
    const badgeStep = document.getElementById('pronBadgeStep');
    if (badgeStep) {
      badgeStep.textContent = `Sentence ${currentPronunciationIndex + 1} of ${activePronunciationSentences.length}`;
    }

    const topicBadge = document.getElementById('pronBadgeTopic');
    if (topicBadge) {
      topicBadge.textContent = sentence.focus || (activePronunciationLesson ? activePronunciationLesson.title : 'Mandarin Speech');
    }

    // Update Target Card Content
    const pinyinEl = document.getElementById('pronTargetPinyin');
    const chineseEl = document.getElementById('pronTargetChinese');
    const meaningEl = document.getElementById('pronTargetMeaning');

    if (pinyinEl) pinyinEl.textContent = sentence.pinyin || '';
    if (chineseEl) chineseEl.textContent = sentence.chinese || '';
    if (meaningEl) meaningEl.textContent = sentence.meaning ? `"${sentence.meaning}"` : '';

    // Reset Mic UI & Hide Feedback from previous sentence
    updatePronunciationMicUI(false);
    const feedbackBox = document.getElementById('pronFeedbackContainer');
    if (feedbackBox) feedbackBox.style.display = 'none';

    updatePronunciationNavDots();

    // Check if user already scored this sentence in current session
    const scoreKey = `${activePronunciationLesson ? activePronunciationLesson.id : 'lesson'}_${currentPronunciationIndex}`;
    const previousScore = pronunciationSessionScores[scoreKey];
    if (previousScore !== undefined) {
      // Re-evaluate with previous best transcript
      const result = calculatePronunciationAccuracy(sentence.chinese, sentence.chinese, sentence.pinyin);
      result.score = previousScore;
      renderPronunciationFeedback(result, sentence);
    }
  }

  // --- Main Pronunciation Section Renderer ---
  function renderPronunciationSection(lesson) {
    const panel = document.getElementById('panel-pronunciation');
    if (!panel) return;

    activePronunciationLesson = lesson;
    activePronunciationSentences = getLessonPronunciationSentences(lesson);
    currentPronunciationIndex = 0;

    const sentences = activePronunciationSentences;
    const currentSentence = sentences[0] || {
      chinese: "早上好！今天天气真好。",
      pinyin: "Zǎoshang hǎo! Jīntiān tiānqì zhēn hǎo.",
      meaning: "Good morning! The weather is really nice today.",
      focus: "Morning greetings"
    };

    const dotsHtml = sentences.map((_, idx) => `
      <button type="button" class="pron-dot-btn ${idx === 0 ? 'active' : ''}" data-idx="${idx}" title="Sentence ${idx + 1}" aria-label="Sentence ${idx + 1}">
        ${idx + 1}
      </button>
    `).join('');

    panel.innerHTML = `
      <div class="pronunciation-workspace">
        <!-- Top Status Bar with Badges and Carousel Navigation -->
        <div class="pron-top-bar">
          <div class="pron-badges-wrap">
            <span class="pron-badge-topic" id="pronBadgeTopic">
              ${escapeHTML(currentSentence.focus || lesson.title)}
            </span>
            <span class="pron-badge-step" id="pronBadgeStep">
              Sentence 1 of ${sentences.length}
            </span>
          </div>

          <div class="pron-nav-pills" id="pronNavPills" role="tablist" aria-label="Sentence Carousel">
            ${dotsHtml}
          </div>
        </div>

        <!-- Target Sentence Showcase Card -->
        <div class="pron-target-card">
          <div class="pron-target-pinyin" id="pronTargetPinyin">
            ${escapeHTML(currentSentence.pinyin)}
          </div>
          <div class="pron-target-chinese chinese-kaiti" id="pronTargetChinese" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', 'Ma Shan Zheng', serif;">
            ${escapeHTML(currentSentence.chinese)}
          </div>
          <div class="pron-target-meaning" id="pronTargetMeaning">
            "${escapeHTML(currentSentence.meaning)}"
          </div>

          <!-- Native Audio Reference Player -->
          <div class="pron-audio-controls">
            <button type="button" class="btn-pron-audio" id="btnPronListenNormal">
              <span>🔊 Listen Native (1.0x)</span>
            </button>
            <button type="button" class="btn-pron-audio" id="btnPronListenSlow">
              <span>🐢 Slow Speed (0.6x)</span>
            </button>
          </div>
        </div>

        <!-- Microphone Interactive Console -->
        <div class="pron-mic-console" id="pronMicConsole">
          <div class="pron-mic-btn-wrap">
            <div class="pron-mic-pulse-ring"></div>
            <button type="button" class="pron-mic-btn" id="btnPronRecord" title="Click to Read Aloud" aria-label="Start recording pronunciation">
              🎙️
            </button>
          </div>

          <div class="pron-mic-status-text" id="pronMicStatusText">
            🎙️ Click to Read Aloud
          </div>

          <p class="pron-mic-hint">
            Press the mic, read the Chinese sentence above clearly into your device, and get instant word-by-word visual accuracy feedback.
          </p>

          <!-- Sound Wave Animation Bars -->
          <div class="pron-sound-wave-bars" id="pronSoundWaveBars">
            <div class="pron-wave-bar"></div>
            <div class="pron-wave-bar"></div>
            <div class="pron-wave-bar"></div>
            <div class="pron-wave-bar"></div>
            <div class="pron-wave-bar"></div>
          </div>

          <!-- Live Interim Transcript Preview -->
          <div class="pron-interim-box" id="pronInterimBox">
            <span id="pronInterimText">Listening... Speak in Mandarin now</span>
          </div>
        </div>

        <!-- Visual Word-by-Word Feedback Card -->
        <div class="pron-feedback-container" id="pronFeedbackContainer"></div>

        <!-- Manual Evaluation Fallback for Browsers / Environments -->
        <div class="pron-manual-test-wrap">
          <span>💡 Or test feedback by typing what was said:</span>
          <form class="pron-manual-form" id="pronManualForm">
            <input type="text" class="pron-manual-input" id="pronManualInput" placeholder="e.g. 早上好天气好" value="" />
            <button type="submit" class="btn-pron-evaluate">Evaluate</button>
          </form>
        </div>
      </div>
    `;

    // Hook Carousel Dots
    panel.querySelectorAll('.pron-dot-btn').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.idx, 10);
        switchPronunciationSentence(idx);
      };
    });

    // Hook Audio Buttons
    const btnNormal = document.getElementById('btnPronListenNormal');
    if (btnNormal) {
      btnNormal.onclick = () => {
        const sentence = activePronunciationSentences[currentPronunciationIndex];
        if (sentence && sentence.chinese) speakChinese(sentence.chinese);
      };
    }

    const btnSlow = document.getElementById('btnPronListenSlow');
    if (btnSlow) {
      btnSlow.onclick = () => {
        const sentence = activePronunciationSentences[currentPronunciationIndex];
        if (sentence && sentence.chinese) {
          if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const utt = new SpeechSynthesisUtterance(sentence.chinese);
            utt.lang = 'zh-CN';
            utt.rate = 0.6;
            window.speechSynthesis.speak(utt);
          }
        }
      };
    }

    // Hook Mic Button
    const btnRecord = document.getElementById('btnPronRecord');
    if (btnRecord) {
      btnRecord.onclick = () => {
        const sentence = activePronunciationSentences[currentPronunciationIndex];
        togglePronunciationRecording(sentence);
      };
    }

    // Hook Manual Form
    const manualForm = document.getElementById('pronManualForm');
    if (manualForm) {
      manualForm.onsubmit = (e) => {
        e.preventDefault();
        const input = document.getElementById('pronManualInput');
        if (input && input.value.trim()) {
          const sentence = activePronunciationSentences[currentPronunciationIndex];
          evaluateAndRenderPronunciation(input.value.trim(), sentence);
        }
      };
    }
  }

  // --- PRACTICE RESULT MODAL ---
  function openPracticeResultModal(currentChar, lesson, chars) {
    const strokeVectors = getCharacterStrokeVectors(currentChar);
    const totalExpected = currentChar.strokeCount || strokeVectors.length || 4;

    const fullStrokeScores = [];
    for (let i = 0; i < totalExpected; i++) {
      if (i < drawnStrokes.length) {
        fullStrokeScores.push(strokeScores[i] !== undefined ? strokeScores[i] : evaluateSingleStroke(drawnStrokes[i], i, currentChar));
      } else {
        fullStrokeScores.push(0); // Un-drawn strokes score 0
      }
    }

    const totalScore = Math.round(fullStrokeScores.reduce((a, b) => a + b, 0) / totalExpected);

    let starCount = 3;
    let verdict = 'Good';
    if (totalScore >= 88) {
      starCount = 5;
      verdict = 'Excellent!';
    } else if (totalScore >= 75) {
      starCount = 4;
      verdict = 'Great Job!';
    } else if (totalScore >= 60) {
      starCount = 3;
      verdict = 'Good';
    } else if (totalScore >= 35) {
      starCount = 2;
      verdict = 'Keep Trying!';
    } else {
      starCount = 1;
      verdict = 'Needs Practice!';
    }

    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= starCount) {
        starsHtml += '★';
      } else {
        starsHtml += '<span class="practice-star-empty">★</span>';
      }
    }

    const badgesHtml = fullStrokeScores.map(s => `<span class="stroke-badge-pill">${s}</span>`).join('');

    const tryAnotherChars = chars.filter(c => c.character !== currentChar.character);
    if (!tryAnotherChars.length) {
      tryAnotherChars.push(
        { character: "坐", pinyin: "zuò" },
        { character: "做", pinyin: "zuò" },
        { character: "爱", pinyin: "ài" }
      );
    }

    const existing = document.getElementById('practiceResultModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'practiceResultModal';
    modal.className = 'practice-modal-backdrop';
    modal.innerHTML = `
      <div class="practice-modal-card">
        <div class="practice-modal-header">
          <div class="practice-modal-title">
            <span>Practice <span class="chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', 'Ma Shan Zheng', serif; font-size: 1.3em;">${escapeHTML(currentChar.character)}</span></span>
          </div>
          <button type="button" class="practice-modal-close-btn" id="btnClosePracticeModal" aria-label="Close">✕</button>
        </div>

        <div class="practice-modal-inner-frame">
          <div class="practice-inner-watermark chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', 'Ma Shan Zheng', serif;">${escapeHTML(currentChar.character)}</div>
          
          <div class="practice-stroke-badges-top">
            ${badgesHtml}
          </div>

          <div class="practice-stars-row">
            ${starsHtml}
          </div>

          <div class="practice-ring-wrapper">
            <svg class="practice-ring-svg" viewBox="0 0 100 100">
              <circle class="practice-ring-bg" cx="50" cy="50" r="42"></circle>
              <circle class="practice-ring-progress" id="practiceRingCircle" cx="50" cy="50" r="42"
                stroke-dasharray="264"
                stroke-dashoffset="264"
              ></circle>
            </svg>
            <div class="practice-ring-center-text">${totalScore}</div>
          </div>

          <div class="practice-verdict-text">${verdict}</div>

          <div class="practice-name-input-wrap">
            <span class="practice-name-icon">👤</span>
            <input type="text" id="practiceUserName" class="practice-name-input" placeholder="Your name (for the image)" />
          </div>

          <div class="practice-actions-grid">
            <button type="button" class="btn-practice-save" id="btnSavePracticeImage">
              📥 Save Image
            </button>
            <button type="button" class="btn-practice-again" id="btnPracticeAgain">
              🔄 Practice Again
            </button>
          </div>
        </div>

        <div class="practice-try-another-section">
          <div class="practice-try-another-label">Try another</div>
          <div class="practice-try-another-grid">
            ${tryAnotherChars.slice(0, 4).map(c => `
              <div class="try-another-char-box chinese-kaiti" data-char="${escapeHTML(c.character)}" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', 'Ma Shan Zheng', serif;">
                <span class="chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', 'Ma Shan Zheng', serif; font-size: 1.45rem;">${escapeHTML(c.character)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    setTimeout(() => {
      const ringCircle = document.getElementById('practiceRingCircle');
      if (ringCircle) {
        const circumference = 264;
        const offset = circumference - (totalScore / 100) * circumference;
        ringCircle.style.strokeDashoffset = offset;
      }
    }, 100);

    const closeBtn = document.getElementById('btnClosePracticeModal');
    if (closeBtn) {
      closeBtn.onclick = () => modal.remove();
    }

    const againBtn = document.getElementById('btnPracticeAgain');
    if (againBtn) {
      againBtn.onclick = () => {
        modal.remove();
        clearCanvas(currentChar);
      };
    }

    const saveBtn = document.getElementById('btnSavePracticeImage');
    if (saveBtn) {
      saveBtn.onclick = () => {
        const userName = document.getElementById('practiceUserName')?.value.trim() || 'Learner';
        exportPracticeCardImage(currentChar, userName, totalScore, starCount, fullStrokeScores);
      };
    }

    modal.querySelectorAll('.try-another-char-box').forEach(box => {
      box.onclick = () => {
        const targetChar = box.dataset.char;
        modal.remove();
        const charIndex = chars.findIndex(c => c.character === targetChar);
        if (charIndex >= 0) {
          activeWritingCharIndex = charIndex;
        }
        renderWritingSection(lesson);
      };
    });
  }

  // Export Practice Image Card Download
  function exportPracticeCardImage(currentChar, userName, totalScore, starCount, strokeScores) {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = 600;
    exportCanvas.height = 700;
    const ectx = exportCanvas.getContext('2d');

    ectx.fillStyle = '#1c1917';
    ectx.fillRect(0, 0, 600, 700);

    ectx.fillStyle = '#fafaf9';
    ectx.beginPath();
    ectx.roundRect(40, 50, 520, 600, 24);
    ectx.fill();
    ectx.strokeStyle = '#f5d0fe';
    ectx.lineWidth = 3;
    ectx.stroke();

    ectx.textAlign = 'center';
    ectx.textBaseline = 'middle';

    ectx.font = '700 240px "KaiTi", "STKaiti", "楷体", "Kaiti SC", "Ma Shan Zheng", "Noto Serif SC", serif';
    ectx.fillStyle = 'rgba(28, 25, 23, 0.05)';
    ectx.fillText(currentChar.character, 300, 320);

    ectx.font = '700 22px "KaiTi", "STKaiti", "楷体", "Plus Jakarta Sans", sans-serif';
    ectx.fillStyle = '#292524';
    ectx.fillText(`LinguaPath Practice: ${currentChar.character} (${currentChar.pinyin || ''})`, 300, 95);

    ectx.font = '600 16px "Plus Jakarta Sans", sans-serif';
    ectx.fillStyle = '#78716c';
    ectx.fillText(`Student: ${userName}`, 300, 125);

    ectx.font = 'bold 16px monospace';
    const badgesText = strokeScores.map(s => `[${s}]`).join('  ');
    ectx.fillStyle = '#c2410c';
    ectx.fillText(badgesText, 300, 165);

    ectx.font = '26px sans-serif';
    let starsStr = '';
    for (let i = 1; i <= 5; i++) starsStr += i <= starCount ? '★' : '☆';
    ectx.fillStyle = '#f59e0b';
    ectx.fillText(starsStr, 300, 205);

    ectx.beginPath();
    ectx.arc(300, 300, 48, 0, Math.PI * 2);
    ectx.strokeStyle = '#fee2e2';
    ectx.lineWidth = 9;
    ectx.stroke();

    ectx.beginPath();
    ectx.arc(300, 300, 48, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * (totalScore / 100)));
    ectx.strokeStyle = '#ef4444';
    ectx.lineWidth = 9;
    ectx.stroke();

    ectx.font = '900 42px "Plus Jakarta Sans", sans-serif';
    ectx.fillStyle = '#ef4444';
    ectx.fillText(`${totalScore}%`, 300, 302);

    if (canvas) {
      ectx.drawImage(canvas, 180, 380, 240, 240);
    }

    const link = document.createElement('a');
    link.download = `${currentChar.character}_practice_${userName.replace(/\s+/g, '_')}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  }

  // --- Active "Continue Lesson" Banner ---
  function renderContinueLessonBanner() {
    const container = document.getElementById('curriculumListSection') || document.querySelector('.container.section');
    if (!container) return;

    const existingBanner = document.getElementById('continueLessonBanner');
    if (existingBanner) existingBanner.remove();

    let activeLessonState = null;
    try {
      const raw = localStorage.getItem('linguapath_active_lesson');
      if (raw) activeLessonState = JSON.parse(raw);
    } catch (e) {}

    if (!activeLessonState || !activeLessonState.id) return;

    const lessonObj = allLessons.find(l => String(l.id) === String(activeLessonState.id)) || activeLessonState;

    const banner = document.createElement('div');
    banner.id = 'continueLessonBanner';
    banner.className = 'continue-lesson-card';
    banner.innerHTML = `
      <div>
        <div class="continue-badge-tag">⚡ Active Lesson in Progress</div>
        <div class="continue-title-group">
          <h3 class="continue-title">${escapeHTML(lessonObj.title || 'Lesson in Progress')}</h3>
          ${lessonObj.chineseTitle ? `<span class="continue-chinese-title chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', 'Ma Shan Zheng', serif;">${escapeHTML(lessonObj.chineseTitle)}</span>` : ''}
        </div>
        <div class="continue-meta">
          ${escapeHTML(lessonObj.audience || 'Adult')} Track • ${escapeHTML(lessonObj.level || 'Beginner')} • ${escapeHTML(lessonObj.category || 'Basics')}
        </div>
      </div>
      <div class="continue-action-btns">
        <button type="button" class="btn-continue-primary" id="btnContinueActiveLesson">
          🚀 Continue Lesson Now →
        </button>
        <button type="button" class="btn-continue-clear" id="btnDismissContinueBanner" title="Dismiss active lesson banner">
          ✕
        </button>
      </div>
    `;

    const grid = document.getElementById('lessonsGrid') || container.querySelector('.lesson-grid');
    if (grid) {
      grid.parentNode.insertBefore(banner, grid);
    } else {
      container.prepend(banner);
    }

    const continueBtn = document.getElementById('btnContinueActiveLesson');
    if (continueBtn) {
      continueBtn.onclick = () => {
        const targetAudience = (lessonObj.audience || '').toLowerCase() === 'kids' ? 'Kids' : 'Adult';
        const isCurrentKidsPage = window.location.pathname.includes('kids');
        if (targetAudience === 'Kids' && !isCurrentKidsPage) {
          window.location.href = `lessons-kids.html?lesson=${encodeURIComponent(lessonObj.id)}`;
        } else if (targetAudience === 'Adult' && isCurrentKidsPage) {
          window.location.href = `lessons-adult.html?lesson=${encodeURIComponent(lessonObj.id)}`;
        } else {
          openLessonWorkspace(lessonObj.id);
        }
      };
    }

    const dismissBtn = document.getElementById('btnDismissContinueBanner');
    if (dismissBtn) {
      dismissBtn.onclick = () => {
        banner.remove();
        localStorage.removeItem('linguapath_active_lesson');
      };
    }
  }

  // --- Excel Data Management Toolbar & Modal ---
  function renderExcelManagerToolbar() {
    const existingToolbar = document.getElementById('excelManagerToolbar');
    if (existingToolbar) existingToolbar.remove();
  }

  function openExcelManagerModal() {
    const existingModal = document.getElementById('excelManagerModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'excelManagerModal';
    modal.className = 'excel-modal-backdrop';
    modal.innerHTML = `
      <div class="excel-modal-card">
        <div class="excel-modal-header">
          <div class="excel-modal-title">
            <span>📊 Lesson Data Management Center</span>
          </div>
          <button type="button" class="excel-modal-close-btn" id="btnCloseExcelModal" aria-label="Close">✕</button>
        </div>

        <p style="font-size: 0.92rem; color: #64748b; margin-bottom: 16px; line-height: 1.5;">
          Easily export all Adult &amp; Kids Mandarin lessons to an Excel workbook (.xlsx) or CSV file. Edit lesson titles, pinyin, practice characters, and descriptions in Excel, then upload to update the app in real time!
        </p>

        <div class="excel-grid-cards">
          <!-- Download Option -->
          <div class="excel-option-box">
            <div class="excel-option-title">📥 1. Export Lessons Data to Excel / CSV</div>
            <div class="excel-option-desc">
              Download the complete curriculum dataset (Lessons, Practice Exercises, Stroke Writing, Vocabulary) as an edit-ready Excel file (.xlsx) or CSV.
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
              <button type="button" class="btn-excel-action btn-excel-download" id="btnExportExcelFile">
                📥 Download Lessons.xlsx
              </button>
              <button type="button" class="btn-excel-action btn-excel-download" id="btnExportCsvFile" style="background: #0284c7;">
                📄 Download Lessons.csv
              </button>
            </div>
          </div>

          <!-- Upload Option -->
          <div class="excel-option-box">
            <div class="excel-option-title">📤 2. Upload Updated Excel / CSV File</div>
            <div class="excel-option-desc">
              Select your updated Excel file (.xlsx or .csv) to refresh all lesson cards, titles, categories, practice exercises, and stroke writing across the entire site instantly.
            </div>
            <input type="file" id="excelFileInput" class="excel-file-input" accept=".xlsx, .xls, .csv" />
            <button type="button" class="btn-excel-action btn-excel-upload" id="btnUploadExcelFile">
              📤 Upload &amp; Update Lessons Data
            </button>
          </div>

          <!-- Reset Option -->
          <div class="excel-option-box" style="padding: 14px 20px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
              <div>
                <div class="excel-option-title" style="font-size: 0.95rem; margin: 0;">🔄 Reset to Default Lessons</div>
                <div class="excel-option-desc" style="margin: 0; font-size: 0.82rem;">Revert any uploaded changes back to default curriculum data.</div>
              </div>
              <button type="button" class="btn-excel-action btn-excel-reset" id="btnResetDefaultLessons" style="width: auto; padding: 8px 16px; font-size: 0.85rem;">
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = document.getElementById('btnCloseExcelModal');
    if (closeBtn) closeBtn.onclick = () => modal.remove();

    const exportBtn = document.getElementById('btnExportExcelFile');
    if (exportBtn) exportBtn.onclick = () => exportLessonsToExcel('xlsx');

    const exportCsvBtn = document.getElementById('btnExportCsvFile');
    if (exportCsvBtn) exportCsvBtn.onclick = () => exportLessonsToExcel('csv');

    const uploadBtn = document.getElementById('btnUploadExcelFile');
    if (uploadBtn) {
      uploadBtn.onclick = () => {
        const fileInput = document.getElementById('excelFileInput');
        if (!fileInput || !fileInput.files.length) {
          alert('Please select an Excel file (.xlsx) or CSV file first.');
          return;
        }
        importLessonsFromExcel(fileInput.files[0]);
      };
    }

    const resetBtn = document.getElementById('btnResetDefaultLessons');
    if (resetBtn) {
      resetBtn.onclick = () => {
        if (confirm('Are you sure you want to reset custom lesson data to default?')) {
          localStorage.removeItem('linguapath_custom_lessons');
          alert('Custom lesson data reset. Reloading defaults...');
          window.location.reload();
        }
      };
    }
  }

  // --- Export Lessons to Excel / CSV ---
  function exportLessonsToExcel(format = 'xlsx') {
    if (typeof XLSX === 'undefined') {
      alert('SheetJS (XLSX) library is loading. Please try again in a moment.');
      return;
    }

    const exportLessonsList = allLessons.length ? allLessons : FALLBACK_LESSONS;
    const exportExercisesList = allExercises.length ? allExercises : FALLBACK_EXERCISES;
    const exportWritingList = allWriting.length ? allWriting : FALLBACK_WRITING;

    const wb = XLSX.utils.book_new();

    const lessonsSheet = XLSX.utils.json_to_sheet(exportLessonsList);
    XLSX.utils.book_append_sheet(wb, lessonsSheet, 'Lessons');

    const exercisesSheet = XLSX.utils.json_to_sheet(exportExercisesList);
    XLSX.utils.book_append_sheet(wb, exercisesSheet, 'Exercises');

    const writingSheet = XLSX.utils.json_to_sheet(exportWritingList);
    XLSX.utils.book_append_sheet(wb, writingSheet, 'Writing');

    if (allVocabulary && allVocabulary.length) {
      const vocabSheet = XLSX.utils.json_to_sheet(allVocabulary);
      XLSX.utils.book_append_sheet(wb, vocabSheet, 'Vocabulary');
    }

    if (format === 'csv') {
      const csvContent = XLSX.utils.sheet_to_csv(lessonsSheet);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'Linguapath_Mandarin_Lessons.csv';
      link.click();
    } else {
      XLSX.writeFile(wb, 'Linguapath_Mandarin_Lessons.xlsx');
    }
  }

  // --- Import Lessons from Excel / CSV ---
  function importLessonsFromExcel(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        if (typeof XLSX === 'undefined') {
          alert('SheetJS library is not loaded.');
          return;
        }

        const workbook = XLSX.read(data, { type: 'array' });
        if (!workbook.SheetNames.includes('Lessons') && !workbook.SheetNames.length) {
          alert('Error: Uploaded file does not contain valid lesson data.');
          return;
        }

        const mainSheetName = workbook.SheetNames.includes('Lessons') ? 'Lessons' : workbook.SheetNames[0];
        const newLessons = XLSX.utils.sheet_to_json(workbook.Sheets[mainSheetName], { defval: '' });

        if (!newLessons.length) {
          alert('Error: Uploaded file contains 0 lesson rows.');
          return;
        }

        const newExercises = workbook.SheetNames.includes('Exercises') ? XLSX.utils.sheet_to_json(workbook.Sheets['Exercises'], { defval: '' }) : allExercises;
        const newWriting = workbook.SheetNames.includes('Writing') ? XLSX.utils.sheet_to_json(workbook.Sheets['Writing'], { defval: '' }) : allWriting;
        const newVocabulary = workbook.SheetNames.includes('Vocabulary') ? XLSX.utils.sheet_to_json(workbook.Sheets['Vocabulary'], { defval: '' }) : allVocabulary;

        allLessons = newLessons;
        allExercises = newExercises;
        allWriting = newWriting;
        allVocabulary = newVocabulary;

        const customPayload = {
          sheets: {
            Lessons: allLessons,
            Exercises: allExercises,
            Writing: allWriting,
            Vocabulary: allVocabulary
          }
        };

        localStorage.setItem('linguapath_custom_lessons', JSON.stringify(customPayload));

        try {
          await fetch('/api/upload-excel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: data
          });
        } catch (err) {
          console.warn('Server upload note:', err);
        }

        alert(`✅ Successfully imported ${allLessons.length} lessons from ${file.name}!`);

        const modal = document.getElementById('excelManagerModal');
        if (modal) modal.remove();

        renderCategoryBar();
        renderLessonGrid();
        renderContinueLessonBanner();
      } catch (err) {
        alert('Failed to parse file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // --- Deep Linking Handler ---
  function handleUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const categoryParam = params.get('category');
    const lessonParam = params.get('lesson');

    const categories = currentAudience === 'Kids' ? KIDS_CATEGORIES : ADULT_CATEGORIES;

    if (categoryParam && categories.some(c => c.key === categoryParam)) {
      activeCategoryKey = categoryParam;
    } else {
      activeCategoryKey = categories[0].key;
    }

    renderCategoryBar();
    renderLessonGrid();
    renderContinueLessonBanner();

    if (lessonParam) {
      openLessonWorkspace(lessonParam, false);
    }
  }

  // --- Initialization ---
  async function init() {
    if (window.location.pathname.includes('kids') || document.body.classList.contains('kids-theme') || document.body.dataset.audience === 'Kids') {
      currentAudience = 'Kids';
      activeCategoryKey = 'pinyin';
    } else {
      currentAudience = 'Adult';
      activeCategoryKey = 'basics';
    }

    setupWorkspaceTabs();
    await loadLessonsWorkbook();
    handleUrlParams();

    window.addEventListener('popstate', () => {
      handleUrlParams();
    });
  }

  // Expose global controller
  window.LinguaLessons = {
    init,
    switchCategory,
    openLessonWorkspace,
    closeLessonWorkspace,
    switchWorkspaceTab,
    speakChinese,
    exportLessonsToExcel,
    importLessonsFromExcel,
    openExcelManagerModal
  };

  document.addEventListener('DOMContentLoaded', () => {
    init();
  });
})();
