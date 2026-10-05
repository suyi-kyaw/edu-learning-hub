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

    // Strategy 1: Fetch API /api/lessons-data
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
            ${cnTitle ? `<div class="lesson-chinese-title">${escapeHTML(cnTitle)}</div>` : ''}
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
    const lesson = allLessons.find(l => String(l.id) === String(lessonId)) || allLessons[0];
    if (!lesson) return;

    activeLesson = lesson;
    activeWorkspaceTab = 'video';
    activeWritingCharIndex = 0;
    exerciseAnswersState = {};

    const workspace = document.getElementById('lessonWorkspace');
    const curriculumSection = document.getElementById('curriculumListSection');

    if (workspace && curriculumSection) {
      curriculumSection.style.display = 'none';
      workspace.classList.add('active');
    }

    renderWorkspaceHeader(lesson);
    renderVideoSection(lesson);
    renderExercisesSection(lesson);
    renderWritingSection(lesson);
    switchWorkspaceTab('video');

    // Scroll to top of workspace smoothly
    if (workspace) {
      workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    if (workspace && curriculumSection) {
      workspace.classList.remove('active');
      curriculumSection.style.display = 'block';
    }

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
          <span class="workspace-chinese-text">${escapeHTML(lesson.chineseTitle)}</span>
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

    document.querySelectorAll('.workspace-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabName);
    });

    document.querySelectorAll('.workspace-panel').forEach(p => {
      p.classList.toggle('active', p.id === `panel-${tabName}`);
    });

    // If writing tab is opened, initialize canvas
    if (tabName === 'writing' && activeLesson) {
      setTimeout(() => initWritingCanvas(), 50);
    }
  }

  // --- SECTION 1: VIDEO LESSON ---
  function renderVideoSection(lesson) {
    const panel = document.getElementById('panel-video');
    if (!panel) return;

    const videoUrl = lesson.videoUrl || lesson.video || 'assets/video/lesson-01.mp4';
    const poster = lesson.posterUrl || lesson.poster || 'assets/images/story-poster.jpg';

    // Find vocabulary or story lines for this lesson
    const vocabItems = allVocabulary.filter(v => String(v.lessonId) === String(lesson.id));

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
  }

  // --- SECTION 2: PRACTICE EXERCISES ---
  function renderExercisesSection(lesson) {
    const panel = document.getElementById('panel-exercises');
    if (!panel) return;

    const exercises = allExercises.filter(ex => String(ex.lessonId) === String(lesson.id));

    if (!exercises.length) {
      panel.innerHTML = `
        <div class="exercises-workspace" style="text-align: center; padding: 50px;">
          <h3>✏️ Practice Quiz Loading</h3>
          <p>Interactive practice questions are loading from lessons.xlsx for this lesson.</p>
        </div>
      `;
      return;
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
                <h4 class="quiz-question-text">${escapeHTML(ex.question)}</h4>

                <div class="quiz-options-grid">
                  ${options.map(opt => `
                    <button type="button" class="quiz-option-btn" data-question-index="${num}" data-option="${escapeHTML(opt)}" data-answer="${escapeHTML(ex.answer || '')}" data-explanation="${escapeHTML(ex.explanation || '')}">
                      <span>${escapeHTML(opt)}</span>
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
        statusEl.innerHTML = `<span>❌ Incorrect. The correct answer is: <strong>${escapeHTML(correct)}</strong></span>`;
        playSound('incorrect');
      }
      textEl.textContent = explanation || (isCorrect ? 'Well done!' : 'Keep practicing!');
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

  function renderWritingSection(lesson) {
    const panel = document.getElementById('panel-writing');
    if (!panel) return;

    drawnStrokes = [];
    strokeScores = [];
    currentStrokePoints = [];

    const chars = allWriting.filter(w => String(w.lessonId) === String(lesson.id));

    if (!chars.length) {
      const defaultChars = [
        { character: "早", pinyin: "zǎo", meaning: "morning", strokeCount: 6, radical: "日", strokeOrderSteps: "1.丨 2.𠃍 3.一 4.一 5.一 6.丨" },
        { character: "好", pinyin: "hǎo", meaning: "good", strokeCount: 6, radical: "女", strokeOrderSteps: "1.ㄑ 2.ノ 3.一 4.乛 5.亅 6.一" }
      ];
      chars.push(...defaultChars);
    }

    const currentChar = chars[activeWritingCharIndex] || chars[0];

    panel.innerHTML = `
      <div class="writing-workspace">
        <div class="writing-char-picker">
          <span class="writing-char-picker-label">Select Character to Practice:</span>
          ${chars.map((c, i) => `
            <button type="button" class="writing-char-chip ${i === activeWritingCharIndex ? 'active' : ''}" data-index="${i}">
              ${escapeHTML(c.character)}
            </button>
          `).join('')}
        </div>

        <div class="writing-stage-grid">
          <!-- Left Column: Character Breakdown -->
          <div class="writing-info-col">
            <div class="writing-character-hero-card">
              <div class="char-giant-display" id="charBigDisplay">${escapeHTML(currentChar.character)}</div>
              <div class="char-pinyin-badge" id="charPinyinDisplay">${escapeHTML(currentChar.pinyin || '')}</div>
              <div class="char-meaning-badge" id="charMeaningDisplay">"${escapeHTML(currentChar.meaning || '')}"</div>
              
              <div class="char-meta-row">
                <span class="char-stat-pill" id="charStrokeCountDisplay">✏️ ${currentChar.strokeCount || '?'} Strokes</span>
                ${currentChar.radical ? `<span class="char-stat-pill" id="charRadicalDisplay">Radical: ${escapeHTML(currentChar.radical)}</span>` : ''}
                <button type="button" class="btn-canvas-action" id="btnSpeakWritingChar">🔊 Pronounce</button>
              </div>
            </div>

            <div class="stroke-steps-card">
              <h4>🖌️ Stroke-by-Stroke Order Guidance</h4>
              <p class="stroke-steps-text" id="charStepsDisplay">
                ${escapeHTML(currentChar.strokeOrderSteps || 'Follow standard stroke order: top to bottom, left to right.')}
              </p>
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
              <div class="canvas-ghost-character ${showGhostChar ? '' : 'hidden'}" id="canvasGhostChar">
                ${escapeHTML(currentChar.character)}
              </div>
              <canvas id="strokeDrawCanvas" width="320" height="320"></canvas>
            </div>

            <div class="canvas-toolbar">
              <button type="button" class="btn-canvas-action" id="btnGradeWriting" style="background: #ea580c; color: #ffffff; border-color: #ea580c;">
                ✨ Grade &amp; Check Writing
              </button>
              <button type="button" class="btn-canvas-action" id="btnDemoStrokeOrder">
                ▶️ Demo Stroke Order
              </button>
              <button type="button" class="btn-canvas-action" id="btnClearCanvas">
                🧹 Clear Canvas
              </button>
              <button type="button" class="btn-canvas-action" id="btnToggleGhostChar">
                ${showGhostChar ? '👁️ Hide Guide' : '👁️ Show Guide'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Character selector chips
    panel.querySelectorAll('.writing-char-chip').forEach(btn => {
      btn.onclick = () => {
        activeWritingCharIndex = parseInt(btn.dataset.index, 10) || 0;
        renderWritingSection(lesson);
        setTimeout(() => initWritingCanvas(currentChar, lesson, chars), 50);
      };
    });

    const speakCharBtn = document.getElementById('btnSpeakWritingChar');
    if (speakCharBtn) {
      speakCharBtn.onclick = () => speakChinese(currentChar.character);
    }

    const clearBtn = document.getElementById('btnClearCanvas');
    if (clearBtn) {
      clearBtn.onclick = () => clearCanvas(currentChar);
    }

    const toggleGhostBtn = document.getElementById('btnToggleGhostChar');
    if (toggleGhostBtn) {
      toggleGhostBtn.onclick = () => {
        showGhostChar = !showGhostChar;
        const ghost = document.getElementById('canvasGhostChar');
        if (ghost) ghost.classList.toggle('hidden', !showGhostChar);
        toggleGhostBtn.textContent = showGhostChar ? '👁️ Hide Guide' : '👁️ Show Guide';
      };
    }

    const gradeBtn = document.getElementById('btnGradeWriting');
    if (gradeBtn) {
      gradeBtn.onclick = () => openPracticeResultModal(currentChar, lesson, chars);
    }

    const demoBtn = document.getElementById('btnDemoStrokeOrder');
    if (demoBtn) {
      demoBtn.onclick = () => demoStrokeOrder(currentChar);
    }

    initWritingCanvas(currentChar, lesson, chars);
  }

  // --- HTML5 Canvas Writing & Real-Time Evaluation Engine ---
  let currentColor = '#ea580c';
  let brushSizes = [6, 10, 16];
  let currentBrushIndex = 1;

  function initWritingCanvas(currentChar, lesson, chars) {
    canvas = document.getElementById('strokeDrawCanvas');
    if (!canvas) return;

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

    canvas.onmousedown = (e) => handleMouseDown(e, currentChar, lesson, chars);
    canvas.onmousemove = handleMouseMove;
    canvas.onmouseup = (e) => handleMouseUp(e, currentChar, lesson, chars);
    canvas.onmouseleave = (e) => handleMouseUp(e, currentChar, lesson, chars);

    canvas.ontouchstart = (e) => handleTouchStart(e, currentChar, lesson, chars);
    canvas.ontouchmove = handleTouchMove;
    canvas.ontouchend = (e) => handleTouchEnd(e, currentChar, lesson, chars);
  }

  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function handleMouseDown(e, currentChar, lesson, chars) {
    isDrawing = true;
    const { x, y } = getCanvasCoords(e);
    lastX = x;
    lastY = y;
    currentStrokePoints = [{ x, y }];

    ctx.beginPath();
    ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  }

  function handleMouseMove(e) {
    if (!isDrawing) return;
    const { x, y } = getCanvasCoords(e);
    currentStrokePoints.push({ x, y });

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastX = x;
    lastY = y;
  }

  function handleMouseUp(e, currentChar, lesson, chars) {
    if (isDrawing && currentStrokePoints.length > 2) {
      drawnStrokes.push([...currentStrokePoints]);
      const strokeIdx = drawnStrokes.length - 1;
      const score = evaluateSingleStroke(currentStrokePoints, strokeIdx, currentChar);
      strokeScores.push(score);

      updateStrokeBadgesUI(currentChar);

      // Auto check when all expected strokes are completed
      const totalExpected = currentChar.strokeCount || 4;
      if (drawnStrokes.length >= totalExpected) {
        setTimeout(() => {
          openPracticeResultModal(currentChar, lesson, chars);
        }, 550);
      }
    }
    isDrawing = false;
    currentStrokePoints = [];
  }

  function handleTouchStart(e, currentChar, lesson, chars) {
    e.preventDefault();
    if (!e.touches.length) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    isDrawing = true;
    lastX = x;
    lastY = y;
    currentStrokePoints = [{ x, y }];

    ctx.beginPath();
    ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  }

  function handleTouchMove(e) {
    e.preventDefault();
    if (!isDrawing || !e.touches.length) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    currentStrokePoints.push({ x, y });

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastX = x;
    lastY = y;
  }

  function handleTouchEnd(e, currentChar, lesson, chars) {
    e.preventDefault();
    if (isDrawing && currentStrokePoints.length > 2) {
      drawnStrokes.push([...currentStrokePoints]);
      const strokeIdx = drawnStrokes.length - 1;
      const score = evaluateSingleStroke(currentStrokePoints, strokeIdx, currentChar);
      strokeScores.push(score);

      updateStrokeBadgesUI(currentChar);

      const totalExpected = currentChar.strokeCount || 4;
      if (drawnStrokes.length >= totalExpected) {
        setTimeout(() => {
          openPracticeResultModal(currentChar, lesson, chars);
        }, 550);
      }
    }
    isDrawing = false;
    currentStrokePoints = [];
  }

  // Evaluate single stroke accuracy (0-100%)
  function evaluateSingleStroke(points, strokeIdx, currentChar) {
    if (!points || points.length < 2) return 65;

    const totalExpected = currentChar.strokeCount || 4;
    const cSize = 320;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    points.forEach(p => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const midY = (minY + maxY) / 2;
    const startP = points[0];
    const endP = points[points.length - 1];
    const dx = endP.x - startP.x;
    const dy = endP.y - startP.y;
    const len = Math.hypot(dx, dy);

    // Heuristic stroke position matching
    const expectedZoneY = (strokeIdx / Math.max(1, totalExpected)) * cSize * 0.75 + 40;
    const posDiffY = Math.abs(midY - expectedZoneY);
    const posScore = Math.max(50, 100 - (posDiffY / cSize) * 85);

    let dirScore = 88;
    if (len < 12) {
      dirScore = 52; // scribble penalty
    }

    // Hit coverage estimate
    let validSampleCount = 0;
    const sampleStep = Math.max(1, Math.floor(points.length / 10));
    for (let i = 0; i < points.length; i += sampleStep) {
      const pt = points[i];
      if (pt.x >= 20 && pt.x <= 300 && pt.y >= 20 && pt.y <= 300) {
        validSampleCount++;
      }
    }
    const sampleTotal = Math.ceil(points.length / sampleStep);
    const coverageRatio = sampleTotal > 0 ? validSampleCount / sampleTotal : 0.8;
    const coverageScore = 60 + coverageRatio * 35;

    let totalScore = Math.round(posScore * 0.35 + dirScore * 0.35 + coverageScore * 0.30);

    // Sequence order penalty if user exceeds stroke count
    if (strokeIdx >= totalExpected) {
      totalScore = Math.max(45, totalScore - 15);
    }

    return Math.min(98, Math.max(51, totalScore));
  }

  // Update stroke live scores row & step indicator
  function updateStrokeBadgesUI(currentChar) {
    const totalExpected = currentChar.strokeCount || 4;
    const stepBadge = document.getElementById('strokeStepBadge');
    const stepHint = document.getElementById('strokeOrderHintText');
    const liveScoresRow = document.getElementById('strokeLiveScoresRow');

    const nextStrokeNum = Math.min(drawnStrokes.length + 1, totalExpected);

    if (stepBadge) {
      stepBadge.textContent = `Stroke ${nextStrokeNum} / ${totalExpected}`;
    }
    if (stepHint) {
      if (drawnStrokes.length >= totalExpected) {
        stepHint.textContent = 'All strokes drawn! Click Grade below.';
      } else {
        stepHint.textContent = `Draw stroke #${nextStrokeNum}`;
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

    if (strokeOrderDemoTimer) clearInterval(strokeOrderDemoTimer);

    if (currentChar) {
      updateStrokeBadgesUI(currentChar);
    }
  }

  // Demo Stroke Order Animation
  function demoStrokeOrder(currentChar) {
    clearCanvas(currentChar);
    const strokeCount = currentChar.strokeCount || 4;
    let step = 0;

    if (strokeOrderDemoTimer) clearInterval(strokeOrderDemoTimer);

    const stepBadge = document.getElementById('strokeStepBadge');
    const stepHint = document.getElementById('strokeOrderHintText');

    strokeOrderDemoTimer = setInterval(() => {
      step++;
      if (step > strokeCount) {
        clearInterval(strokeOrderDemoTimer);
        if (stepHint) stepHint.textContent = 'Demo complete! Now try drawing yourself.';
        return;
      }

      if (ctx && canvas) {
        ctx.lineWidth = brushSizes[currentBrushIndex] + 2;
        ctx.strokeStyle = '#22c55e'; // Green guide ink

        const x1 = 50 + ((step - 1) * 40) % 220;
        const y1 = 50 + Math.floor(((step - 1) * 40) / 220) * 80;
        const x2 = x1 + 60;
        const y2 = y1 + (step % 2 === 0 ? 40 : 0);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.fillStyle = '#ea580c';
        ctx.font = '800 16px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(String(step), x1 - 8, y1 - 8);
      }

      if (stepBadge) stepBadge.textContent = `Demo Stroke ${step} / ${strokeCount}`;
      if (stepHint) stepHint.textContent = `Stroke #${step} direction guide`;
    }, 500);
  }

  // --- PRACTICE RESULT MODAL (Matching Uploaded Screenshot Design) ---
  function openPracticeResultModal(currentChar, lesson, chars) {
    if (!strokeScores.length) {
      const defaultCount = currentChar.strokeCount || 4;
      strokeScores = Array.from({ length: defaultCount }, () => Math.floor(Math.random() * 20 + 72));
    }

    const totalScore = Math.round(strokeScores.reduce((a, b) => a + b, 0) / strokeScores.length);

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
    } else {
      starCount = 2;
      verdict = 'Keep Trying!';
    }

    let starsHtml = '';
    for (let i = 1; i <= 5; i++) {
      if (i <= starCount) {
        starsHtml += '★';
      } else {
        starsHtml += '<span class="practice-star-empty">★</span>';
      }
    }

    const badgesHtml = strokeScores.map(s => `<span class="stroke-badge-pill">${s}</span>`).join('');

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
            <span>Practice ${escapeHTML(currentChar.character)}</span>
          </div>
          <button type="button" class="practice-modal-close-btn" id="btnClosePracticeModal" aria-label="Close">✕</button>
        </div>

        <div class="practice-modal-inner-frame">
          <div class="practice-inner-watermark">${escapeHTML(currentChar.character)}</div>
          
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
              <div class="try-another-char-box" data-char="${escapeHTML(c.character)}">
                ${escapeHTML(c.character)}
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
        exportPracticeCardImage(currentChar, userName, totalScore, starCount, strokeScores);
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
        setTimeout(() => initWritingCanvas(currentChar, lesson, chars), 50);
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

    ectx.font = '900 240px "Noto Serif SC", serif';
    ectx.fillStyle = 'rgba(28, 25, 23, 0.05)';
    ectx.fillText(currentChar.character, 300, 320);

    ectx.font = '700 22px "Plus Jakarta Sans", sans-serif';
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
    speakChinese
  };

  document.addEventListener('DOMContentLoaded', () => {
    init();
  });
})();
