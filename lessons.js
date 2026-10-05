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
      setTimeout(() => initWritingCanvas(activeLesson), 50);
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
  let currentHanziWriter = null;
  let activeWritingChar = null;
  let activeWritingLesson = null;
  let activeWritingChars = [];

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
              <div id="hanziWriterTarget" class="${showGhostChar ? '' : 'hidden'}"></div>
              <div class="canvas-ghost-character ${showGhostChar ? '' : 'hidden'}" id="canvasGhostChar">
                ${escapeHTML(currentChar.character)}
              </div>
              <canvas id="strokeDrawCanvas" width="320" height="320" style="z-index: 5; touch-action: none; position: absolute; inset: 0;"></canvas>
            </div>

            <div class="canvas-toolbar">
              <button type="button" class="btn-canvas-action" id="btnGradeWriting" style="background: #ea580c; color: #ffffff; border-color: #ea580c;">
                ✨ Grade &amp; Check Writing
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
        const hwTarget = document.getElementById('hanziWriterTarget');
        if (hwTarget) hwTarget.classList.toggle('hidden', !showGhostChar);
        if (currentHanziWriter) {
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

    initWritingCanvas(currentChar, lesson, chars);
  }

  // Exact Character Stroke Animation Engine
  function getCharacterStrokeVectors(currentChar) {
    const char = currentChar.character;
    const count = currentChar.strokeCount || 4;

    const charMap = {
      "我": [
        { type: "left_fall", x1: 150, y1: 50, x2: 100, y2: 90, label: "1.ノ Top Left Fall" },
        { type: "horizontal", x1: 70, y1: 110, x2: 240, y2: 110, label: "2.一 Main Horizontal" },
        { type: "v_hook", x1: 120, y1: 90, x2: 120, y2: 260, x3: 95, y3: 240, label: "3.亅 Vertical Hook" },
        { type: "rising", x1: 60, y1: 220, x2: 140, y2: 170, label: "4.提 Lower Rising Stroke" },
        { type: "slant_hook", x1: 170, y1: 60, x2: 240, y2: 250, x3: 265, y3: 230, label: "5.㇂ Slant Hook" },
        { type: "left_fall", x1: 210, y1: 140, x2: 160, y2: 210, label: "6.撇 Middle Left Fall" },
        { type: "dot", x1: 220, y1: 70, x2: 250, y2: 100, label: "7.丶 Top Right Dot" }
      ],
      "你": [
        { type: "left_fall", x1: 90, y1: 60, x2: 60, y2: 140, label: "1.ノ Person Slant" },
        { type: "vertical", x1: 75, y1: 130, x2: 75, y2: 270, label: "2.丨 Person Vertical" },
        { type: "left_fall", x1: 200, y1: 60, x2: 170, y2: 100, label: "3.ノ Top Slant" },
        { type: "v_hook", x1: 150, y1: 100, x2: 250, y2: 100, x3: 230, y3: 140, label: "4.乛 Hook" },
        { type: "v_hook", x1: 195, y1: 110, x2: 195, y2: 260, x3: 170, y3: 240, label: "5.亅 Center Hook" },
        { type: "dot", x1: 140, y1: 150, x2: 120, y2: 210, label: "6.丶 Left Dot" },
        { type: "dot", x1: 230, y1: 150, x2: 260, y2: 210, label: "7.丶 Right Dot" }
      ],
      "他": [
        { type: "left_fall", x1: 90, y1: 60, x2: 60, y2: 140, label: "1.ノ Person Slant" },
        { type: "vertical", x1: 75, y1: 130, x2: 75, y2: 270, label: "2.丨 Person Vertical" },
        { type: "horizontal", x1: 140, y1: 120, x2: 260, y2: 120, label: "3.乛 Top Horizontal Hook" },
        { type: "vertical", x1: 170, y1: 80, x2: 170, y2: 240, label: "4.丨 Center Vertical" },
        { type: "v_hook", x1: 220, y1: 80, x2: 220, y2: 260, x3: 250, y3: 220, label: "5.乚 Curved Hook" }
      ],
      "早": [
        { type: "vertical", x1: 115, y1: 80, x2: 115, y2: 170, label: "1.丨 Left Vertical of 日" },
        { type: "corner", x1: 115, y1: 80, x2: 205, y2: 80, x3: 205, y3: 170, label: "2.𠃍 Top-Right Corner of 日" },
        { type: "horizontal", x1: 115, y1: 125, x2: 205, y2: 125, label: "3.一 Middle Bar of 日" },
        { type: "horizontal", x1: 115, y1: 170, x2: 205, y2: 170, label: "4.一 Bottom Bar of 日" },
        { type: "horizontal", x1: 85, y1: 215, x2: 235, y2: 215, label: "5.一 Lower Cross Bar" },
        { type: "vertical", x1: 160, y1: 125, x2: 160, y2: 275, label: "6.丨 Central Vertical Drop" }
      ],
      "好": [
        { type: "slant_angle", x1: 100, y1: 70, x2: 70, y2: 140, x3: 130, y3: 180, label: "1.ㄑ Slant Angle" },
        { type: "left_fall", x1: 130, y1: 90, x2: 60, y2: 250, label: "2.ノ Left Falling" },
        { type: "horizontal", x1: 40, y1: 150, x2: 140, y2: 150, label: "3.一 Cross Bar" },
        { type: "corner", x1: 180, y1: 80, x2: 250, y2: 80, x3: 220, y3: 120, label: "4.乛 Top Hook" },
        { type: "v_hook", x1: 215, y1: 120, x2: 215, y2: 260, x3: 190, y3: 240, label: "5.亅 Vertical Hook" },
        { type: "horizontal", x1: 150, y1: 160, x2: 270, y2: 160, label: "6.一 Center Bar" }
      ],
      "水": [
        { type: "v_hook", x1: 160, y1: 50, x2: 160, y2: 270, x3: 130, y3: 240, label: "1.亅 Center Hook" },
        { type: "corner_slant", x1: 70, y1: 120, x2: 120, y2: 120, x3: 80, y3: 170, label: "2.㇇ Horizontal Slant" },
        { type: "left_fall", x1: 120, y1: 170, x2: 50, y2: 260, label: "3.ノ Left Fall" },
        { type: "right_fall", x1: 180, y1: 130, x2: 270, y2: 260, label: "4.㇏ Right Fall" }
      ],
      "大": [
        { type: "horizontal", x1: 60, y1: 120, x2: 260, y2: 120, label: "1.一 Main Horizontal" },
        { type: "left_fall", x1: 160, y1: 70, x2: 60, y2: 270, label: "2.ノ Left Falling" },
        { type: "right_fall", x1: 160, y1: 120, x2: 260, y2: 270, label: "3.㇏ Right Falling" }
      ],
      "小": [
        { type: "v_hook", x1: 160, y1: 60, x2: 160, y2: 260, x3: 130, y3: 235, label: "1.亅 Center Hook" },
        { type: "dot", x1: 90, y1: 120, x2: 60, y2: 180, label: "2.丶 Left Dot" },
        { type: "dot", x1: 230, y1: 120, x2: 260, y2: 180, label: "3.丶 Right Dot" }
      ],
      "人": [
        { type: "left_fall", x1: 160, y1: 60, x2: 60, y2: 270, label: "1.ノ Left Falling" },
        { type: "right_fall", x1: 130, y1: 120, x2: 260, y2: 270, label: "2.㇏ Right Falling" }
      ],
      "一": [
        { type: "horizontal", x1: 50, y1: 160, x2: 270, y2: 160, label: "1.一 Horizontal Bar" }
      ],
      "二": [
        { type: "horizontal", x1: 80, y1: 110, x2: 240, y2: 110, label: "1.一 Top Bar" },
        { type: "horizontal", x1: 50, y1: 210, x2: 270, y2: 210, label: "2.一 Bottom Bar" }
      ],
      "三": [
        { type: "horizontal", x1: 80, y1: 90, x2: 240, y2: 90, label: "1.一 Top Bar" },
        { type: "horizontal", x1: 100, y1: 160, x2: 220, y2: 160, label: "2.一 Middle Bar" },
        { type: "horizontal", x1: 50, y1: 230, x2: 270, y2: 230, label: "3.一 Bottom Bar" }
      ],
      "坐": [
        { type: "left_fall", x1: 100, y1: 60, x2: 70, y2: 120, label: "1.ノ Left Person" },
        { type: "dot", x1: 110, y1: 85, x2: 130, y2: 120, label: "2.丶 Person Dot" },
        { type: "left_fall", x1: 220, y1: 60, x2: 190, y2: 120, label: "3.ノ Right Person" },
        { type: "dot", x1: 230, y1: 85, x2: 250, y2: 120, label: "4.丶 Person Dot" },
        { type: "horizontal", x1: 80, y1: 150, x2: 240, y2: 150, label: "5.一 Middle Bar" },
        { type: "vertical", x1: 160, y1: 40, x2: 160, y2: 270, label: "6.丨 Center Vertical" },
        { type: "horizontal", x1: 40, y1: 270, x2: 280, y2: 270, label: "7.一 Ground Bar" }
      ],
      "做": [
        { type: "left_fall", x1: 70, y1: 60, x2: 40, y2: 130, label: "1.ノ Person Slant" },
        { type: "vertical", x1: 55, y1: 130, x2: 55, y2: 270, label: "2.丨 Person Drop" },
        { type: "left_fall", x1: 130, y1: 60, x2: 100, y2: 100, label: "3.ノ Middle Slant" },
        { type: "horizontal", x1: 90, y1: 100, x2: 160, y2: 100, label: "4.一 Top Bar" },
        { type: "vertical", x1: 125, y1: 100, x2: 125, y2: 190, label: "5.丨 Center Bar" },
        { type: "corner", x1: 95, y1: 140, x2: 155, y2: 140, x3: 155, y3: 190, label: "6.𠃍 Corner" },
        { type: "horizontal", x1: 95, y1: 190, x2: 155, y2: 190, label: "7.一 Box Bottom" },
        { type: "left_fall", x1: 125, y1: 200, x2: 90, y2: 260, label: "8.ノ Lower Left" },
        { type: "right_fall", x1: 125, y1: 210, x2: 165, y2: 260, label: "9.㇏ Lower Right" },
        { type: "left_fall", x1: 220, y1: 60, x2: 190, y2: 130, label: "10.ノ Right Top Slant" },
        { type: "right_fall", x1: 190, y1: 130, x2: 270, y2: 260, label: "11.㇏ Right Falling" }
      ],
      "爱": [
        { type: "left_fall", x1: 160, y1: 40, x2: 120, y2: 80, label: "1.ノ Top Slant" },
        { type: "dot", x1: 80, y1: 80, x2: 100, y2: 110, label: "2.丶 Left Dot" },
        { type: "dot", x1: 140, y1: 80, x2: 160, y2: 110, label: "3.丶 Middle Dot" },
        { type: "left_fall", x1: 220, y1: 80, x2: 190, y2: 110, label: "4.ノ Right Slant" },
        { type: "corner", x1: 60, y1: 130, x2: 260, y2: 130, x3: 240, y3: 160, label: "5.冖 Crown" },
        { type: "left_fall", x1: 130, y1: 160, x2: 90, y2: 210, label: "6.ノ Heart Slant" },
        { type: "corner", x1: 90, y1: 190, x2: 230, y2: 190, x3: 210, y3: 230, label: "7.乛 Heart Hook" },
        { type: "left_fall", x1: 150, y1: 200, x2: 80, y2: 280, label: "8.ノ Lower Left" },
        { type: "right_fall", x1: 150, y1: 210, x2: 270, y2: 280, label: "9.㇏ Lower Right" }
      ]
    };

    if (charMap[char]) {
      return charMap[char];
    }

    const strokes = [];
    for (let i = 0; i < count; i++) {
      const t = i / Math.max(1, count - 1);
      const y = 65 + t * 170;
      if (i % 2 === 0) {
        strokes.push({
          type: "horizontal",
          x1: 60, y1: y, x2: 260, y2: y,
          label: `${i + 1}.一 Horizontal Stroke`
        });
      } else {
        strokes.push({
          type: "vertical",
          x1: 60 + ((i * 45) % 180), y1: Math.max(40, y - 50),
          x2: 60 + ((i * 45) % 180), y2: Math.min(280, y + 60),
          label: `${i + 1}.丨 Vertical Stroke`
        });
      }
    }
    return strokes;
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

    // Direct pointer event binding on the canvas for reliable stroke start & stop
    canvas.onpointerdown = handlePointerDown;
    canvas.onpointermove = handlePointerMove;
    canvas.onpointerup = handlePointerUp;
    canvas.onpointercancel = handlePointerCancel;
    canvas.onpointerleave = handlePointerCancel;

    // Initialize single, high-precision HanziWriter instance
    const targetElement = document.getElementById('hanziWriterTarget');
    if (targetElement) {
      targetElement.innerHTML = '';
      if (window.HanziWriter) {
        try {
          currentHanziWriter = HanziWriter.create(targetElement, currentChar.character, {
            width: 290,
            height: 290,
            padding: 10,
            showOutline: showGhostChar,
            showCharacter: false,
            strokeColor: '#ea580c',
            outlineColor: 'rgba(234, 88, 12, 0.28)',
            drawingWidth: 16,
            strokeAnimationSpeed: 1.2,
            delayBetweenStrokes: 250
          });
        } catch (err) {
          console.warn('HanziWriter init error:', err);
          targetElement.innerHTML = `<div class="fallback-ghost-char ${showGhostChar ? '' : 'hidden'}">${escapeHTML(currentChar.character)}</div>`;
        }
      } else {
        targetElement.innerHTML = `<div class="fallback-ghost-char ${showGhostChar ? '' : 'hidden'}">${escapeHTML(currentChar.character)}</div>`;
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

    if (currentStrokePoints.length > 1) {
      drawnStrokes.push([...currentStrokePoints]);
      const strokeIdx = drawnStrokes.length - 1;
      const score = evaluateSingleStroke(currentStrokePoints, strokeIdx, activeWritingChar);
      strokeScores.push(score);

      updateStrokeBadgesUI(activeWritingChar);

      const strokeVectors = getCharacterStrokeVectors(activeWritingChar);
      const totalExpected = activeWritingChar?.strokeCount || strokeVectors.length || 4;
      if (drawnStrokes.length >= totalExpected) {
        setTimeout(() => {
          openPracticeResultModal(activeWritingChar, activeWritingLesson, activeWritingChars);
        }, 500);
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

  // Evaluate single stroke accuracy (0-100%) against expected stroke vector
  function evaluateSingleStroke(points, strokeIdx, currentChar) {
    if (!points || points.length < 2) return 0;

    const strokeVectors = getCharacterStrokeVectors(currentChar);
    const totalExpected = currentChar.strokeCount || strokeVectors.length || 4;

    // Extra strokes beyond character limit get 0 points
    if (strokeIdx >= totalExpected) return 0;

    const expected = strokeVectors[strokeIdx];
    const startP = points[0];
    const endP = points[points.length - 1];
    const dx = endP.x - startP.x;
    const dy = endP.y - startP.y;
    const len = Math.hypot(dx, dy);

    if (len < 10) return 0; // scribble penalty

    if (expected) {
      const userAngle = Math.atan2(dy, dx);
      const expDx = (expected.x2 || 0) - (expected.x1 || 0);
      const expDy = (expected.y2 || 0) - (expected.y1 || 0);
      const expAngle = Math.atan2(expDy, expDx);

      let angleDiff = Math.abs(userAngle - expAngle);
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

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

      const distErr = Math.hypot(drawnMidX - expMidX, drawnMidY - expMidY);

      const dirFactor = Math.max(0, 1 - angleDiff / (Math.PI / 1.5));
      const posFactor = Math.max(0, 1 - distErr / 180);

      const strokeScore = Math.round((dirFactor * 0.6 + posFactor * 0.4) * 100);
      return Math.min(98, Math.max(0, strokeScore));
    }

    return 40;
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

    if (currentHanziWriter) {
      currentHanziWriter.hideCharacter();
      if (showGhostChar) {
        currentHanziWriter.showOutline();
      } else {
        currentHanziWriter.hideOutline();
      }
    }

    if (currentChar) {
      updateStrokeBadgesUI(currentChar);
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
          ${lessonObj.chineseTitle ? `<span class="continue-chinese-title">${escapeHTML(lessonObj.chineseTitle)}</span>` : ''}
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
