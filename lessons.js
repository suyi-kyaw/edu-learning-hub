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
  let allPronunciation = [];

  let activeCourseName = 'HSK 2'; // 'HSK 2' or custom courses added in Admin
  let activeLesson = null;
  let activeWorkspaceTab = 'video'; // 'video', 'exercises', 'writing', 'pronunciation'
  let activeWritingCharIndex = 0;
  let exerciseAnswersState = {}; // { questionIndex: { selectedOption, isCorrect } }
  const autoReviewedLessons = new Set();

  function backendApiUrl(path) {
    if (window.LinguaBackend && typeof window.LinguaBackend.apiUrl === 'function') {
      return window.LinguaBackend.apiUrl(path);
    }
    return path;
  }

  function backendAssetUrl(path) {
    if (window.LinguaBackend && typeof window.LinguaBackend.assetUrl === 'function') {
      return window.LinguaBackend.assetUrl(path);
    }
    return path;
  }

  function backendAvailable() {
    if (window.LinguaBackend && typeof window.LinguaBackend.hasBackend === 'function') {
      return window.LinguaBackend.hasBackend();
    }
    return true;
  }

  function isAuthenticatedMember() {
    return Boolean(window.LinguaAuth && typeof window.LinguaAuth.getState === 'function' && window.LinguaAuth.getState().user);
  }

  function getScopedProgressKey() {
    const uid = window.LinguaAuth?.getState()?.user?.uid;
    return uid ? `linguapath_lesson_progress_${uid}` : 'linguapath_lesson_progress';
  }

  // Canvas drawing state
  let canvas = null;
  let ctx = null;
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let showGhostChar = true;

  // --- Embedded Offline Fallbacks (HSK 2 starter only) ---
  const FALLBACK_LESSONS = [
    {
      id: "hsk2-01",
      course: "HSK 2",
      category: "HSK 2",
      categoryKey: "hsk2",
      categoryNum: "Course 1",
      title: "She treated us to Peking Duck",
      chineseTitle: "她请我们吃了北京烤鸭",
      pinyin: "Tā qǐng wǒmen chī le Běijīng kǎoyā",
      meaning: "Treating friends to Peking Duck, expressing thanks, and HSK 2 dining conversations",
      level: "HSK 2",
      description: "Learn how to use 请 (qǐng) for treating guests, past-action 了 (le), dining expressions, and Mandarin conversation around Peking Duck.",
      videoUrl: "assets/video/lesson-02.mp4",
      posterUrl: "assets/images/exercises/roast-duck.svg",
      keywords: "HSK 2, Peking Duck, Dining, Past Tense 了, Conversation",
      accessType: "paid",
      price: 75000
    }
  ];

  const FALLBACK_EXERCISES = [
    {
      lessonId: "hsk2-01",
      order: 1,
      type: "multiple-choice",
      question: "How do you say 'She treated us to Peking Duck' in Chinese?",
      optionA: "她请我们吃了北京烤鸭。",
      optionB: "我们每天去北京坐地铁。",
      optionC: "请问洗手间在哪里？",
      optionD: "我要一杯冰绿茶。",
      answer: "她请我们吃了北京烤鸭。",
      explanation: "请某人吃... (qǐng mǒurén chī...) means 'to treat someone to a meal', and 北京烤鸭 is Peking Duck."
    },
    {
      lessonId: "hsk2-01",
      order: 2,
      type: "image-choice",
      audioUrl: "assets/audio/tian-haochi.mp3",
      question: "她请我们吃了香脆可口的北京烤鸭。(She treated us to crispy, delicious Peking Duck.) Choose the matching picture.",
      optionA: "北京烤鸭 (Peking Duck)",
      optionB: "牛肉面 (Beef noodles)",
      optionC: "冰茶 (Iced tea)",
      optionAImage: "assets/images/exercises/roast-duck.svg",
      optionBImage: "assets/images/exercises/noodles-bowl.svg",
      optionCImage: "assets/images/exercises/iced-tea-cup.svg",
      answer: "A",
      explanation: "北京烤鸭 (Běijīng kǎoyā / Peking Duck) matches the roast duck platter in picture A."
    },
    {
      lessonId: "hsk2-01",
      order: 3,
      type: "shared-image-match",
      groupId: "hsk2-duck-pic",
      groupTitle: "Part II: Match Picture A, B, C, or D to each HSK 2 dining dialogue.",
      pinyin: "Wǒmen zài Běijīng lǎodiàn diǎn le yì zhī kǎoyā.",
      question: "我们在北京老店点了一只烤鸭。",
      optionA: "北京烤鸭 (Peking Duck)",
      optionB: "菜单 (Menu)",
      optionC: "牛肉面 (Beef noodles)",
      optionD: "冰茶 (Iced tea)",
      optionAImage: "assets/images/exercises/roast-duck.svg",
      optionBImage: "assets/images/exercises/menu-book.svg",
      optionCImage: "assets/images/exercises/noodles-bowl.svg",
      optionDImage: "assets/images/exercises/iced-tea-cup.svg",
      answer: "A",
      explanation: "烤鸭 (kǎoyā) means roast duck (Picture A)."
    },
    {
      lessonId: "hsk2-01",
      order: 4,
      type: "shared-text-match",
      groupId: "hsk2-duck-wordbank",
      groupTitle: "Sentence & Word Bank: Pick the best choice (A–E) for each HSK 2 sentence.",
      pinyin: "Jīntiān wǎnshang tā (   ) wǒmen chī Běijīng kǎoyā.",
      question: "今天晚上她 (   ) 我们吃北京烤鸭。",
      optionA: "请 (qǐng)",
      optionB: "吃 (chī)",
      optionC: "烤鸭 (kǎoyā)",
      optionD: "谢谢 (xièxie)",
      optionE: "好吃 (hǎochī)",
      answer: "A",
      explanation: "请 (qǐng) means 'to invite / treat someone to something'."
    },
    {
      lessonId: "hsk2-01",
      order: 5,
      type: "fill-blank",
      pinyin: "kǎoyā",
      question: "去北京旅游的时候，大家都很想吃正宗的北京 (   )。",
      answer: "烤鸭",
      explanation: "北京烤鸭 (Běijīng kǎoyā) is Beijing's famous Peking Duck."
    }
  ];

  const FALLBACK_WRITING = [
    {
      lessonId: "hsk2-01",
      order: 1,
      character: "请",
      pinyin: "qǐng",
      meaning: "to invite / treat / please",
      strokeCount: 10,
      radical: "讠 (Speech)",
      strokeOrderSteps: "1. Dot (丶), 2. Horizontal-vertical-turn (㇊), 3. Horizontal (一), 4. Horizontal (一), 5. Vertical (丨), 6. Horizontal (一), 7. Vertical (丨), 8. Horizontal-turn-hook (𠃌), 9. Horizontal (一), 10. Horizontal (一)"
    },
    {
      lessonId: "hsk2-01",
      order: 2,
      character: "鸭",
      pinyin: "yā",
      meaning: "duck",
      strokeCount: 10,
      radical: "鸟 (Bird)",
      strokeOrderSteps: "1. Vertical (丨), 2. Horizontal-turn (𠃍), 3. Horizontal (一), 4. Horizontal (一), 5. Vertical (丨), 6. Slant (丿), 7. Horizontal-turn-hook (㇆), 8. Dot (丶), 9. Vertical-turn-hook (㇉), 10. Horizontal (一)"
    },
    {
      lessonId: "hsk2-01",
      order: 3,
      character: "吃",
      pinyin: "chī",
      meaning: "to eat",
      strokeCount: 6,
      radical: "口 (Mouth)",
      strokeOrderSteps: "1. Vertical (丨), 2. Horizontal-turn (𠃍), 3. Horizontal (一), 4. Top slant (丿), 5. Horizontal (一), 6. Curved hook (乙)"
    }
  ];

  // --- Guaranteed Core Courses (plus any dynamic Admin courses with lessons) ---
  const BASE_COURSES = ['HSK 2'];

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

  function normalizeCourseName(val) {
    if (window.LinguaAuth && typeof window.LinguaAuth.normalizeCourseName === 'function') {
      return window.LinguaAuth.normalizeCourseName(val);
    }
    const raw = String(val || '').trim();
    if (!raw) return 'HSK 2';
    const compact = raw.toLowerCase().replace(/[\s_-]+/g, '');
    if (compact === 'hsk1') return 'HSK 1';
    if (compact === 'hsk2') return 'HSK 2';
    if (compact === 'hsk3') return 'HSK 3';
    if (compact === 'hsk4') return 'HSK 4';
    return raw.slice(0, 80);
  }

  function courseKeySlug(courseName) {
    return String(courseName || '').trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '');
  }

  function isSameLessonId(a, b) {
    const norm = (val) => String(val || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanA = norm(a);
    const cleanB = norm(b);
    if (!cleanA || !cleanB) return false;
    return cleanA === cleanB || cleanA === `lesson${cleanB}` || cleanB === `lesson${cleanA}`;
  }

  function normalizeLessonRow(l) {
    if (!l || typeof l !== 'object') return l;
    const id = String(l.id || l.lessonId || l.lesson_id || '').trim();
    const course = normalizeCourseName(l.course || l.courseName || l.category || 'HSK 2');
    const category = String(l.category || l.course || course).trim();
    const categoryKey = String(l.categoryKey || l.category_key || courseKeySlug(course)).trim();
    const categoryNum = String(l.categoryNum || l.category_num || 'Course 1').trim();
    const title = String(l.title || l.Title || id).trim();
    const chineseTitle = String(l.chineseTitle || l.chinese_title || l.chinese || '').trim();
    const pinyin = String(l.pinyin || l.Pinyin || '').trim();
    const meaning = String(l.meaning || l.Meaning || '').trim();
    const level = String(l.level || l.Level || course).trim();
    const description = String(l.description || l.Description || '').trim();
    const videoUrl = String(l.videoUrl || l.video_url || l.video || '').trim();
    const posterUrl = String(l.posterUrl || l.poster_url || l.poster || '').trim();
    const fullAudio = String(l.fullAudio || l.full_audio || l.audio || '').trim();
    const keywords = String(l.keywords || l.Keywords || '').trim();
    const accessType = String(l.accessType || l.access_type || 'paid').trim().toLowerCase() === 'free' ? 'free' : 'paid';
    const price = Number(l.price) || (accessType === 'paid' ? 75000 : 0);
    return {
      ...l,
      id,
      lessonId: id,
      lesson_id: id,
      title,
      chineseTitle,
      chinese_title: chineseTitle,
      pinyin,
      meaning,
      level,
      course,
      category,
      categoryKey,
      category_key: categoryKey,
      categoryNum,
      category_num: categoryNum,
      description,
      videoUrl,
      video_url: videoUrl,
      posterUrl,
      poster_url: posterUrl,
      fullAudio,
      full_audio: fullAudio,
      keywords,
      accessType,
      access_type: accessType,
      price
    };
  }

  function normalizeExerciseRow(r, idx) {
    if (!r || typeof r !== 'object') return r;
    const lessonId = String(r.lessonId || r.lesson_id || r.LessonId || r['Lesson ID'] || '').trim();
    const order = Number(r.order || r.Order || r.order_num) || idx + 1;
    const type = String(r.type || r.Type || 'multiple-choice').trim().toLowerCase() || 'multiple-choice';
    const groupId = String(r.groupId || r.group_id || r.GroupId || '').trim();
    const groupTitle = String(r.groupTitle || r.group_title || r.GroupTitle || '').trim();
    const pinyin = String(r.pinyin || r.Pinyin || r.pinyinHint || r.pinyin_hint || '').trim();
    const question = String(r.question || r.Question || '').trim();
    const audioUrl = String(r.audioUrl || r.audio_url || r.AudioUrl || r.audio || '').trim();
    const optionA = String(r.optionA ?? r.option_a ?? r.OptionA ?? '').trim();
    const optionB = String(r.optionB ?? r.option_b ?? r.OptionB ?? '').trim();
    const optionC = String(r.optionC ?? r.option_c ?? r.OptionC ?? '').trim();
    const optionD = String(r.optionD ?? r.option_d ?? r.OptionD ?? '').trim();
    const optionE = String(r.optionE ?? r.option_e ?? r.OptionE ?? '').trim();
    const optionAImage = String(r.optionAImage || r.option_a_image || r.OptionAImage || '').trim();
    const optionBImage = String(r.optionBImage || r.option_b_image || r.OptionBImage || '').trim();
    const optionCImage = String(r.optionCImage || r.option_c_image || r.OptionCImage || '').trim();
    const optionDImage = String(r.optionDImage || r.option_d_image || r.OptionDImage || '').trim();
    const optionEImage = String(r.optionEImage || r.option_e_image || r.OptionEImage || '').trim();
    const answer = String(r.answer || r.Answer || r.correct || r.correctAnswer || '').trim();
    const explanation = String(r.explanation || r.Explanation || '').trim();
    return {
      ...r,
      lessonId,
      lesson_id: lessonId,
      order,
      type,
      groupId,
      group_id: groupId,
      groupTitle,
      group_title: groupTitle,
      pinyin,
      question,
      audioUrl,
      audio_url: audioUrl,
      optionA,
      option_a: optionA,
      optionB,
      option_b: optionB,
      optionC,
      option_c: optionC,
      optionD,
      option_d: optionD,
      optionE,
      option_e: optionE,
      optionAImage,
      option_a_image: optionAImage,
      optionBImage,
      option_b_image: optionBImage,
      optionCImage,
      option_c_image: optionCImage,
      optionDImage,
      option_d_image: optionDImage,
      optionEImage,
      option_e_image: optionEImage,
      answer,
      explanation
    };
  }

  function normalizeWritingRow(w, idx) {
    if (!w || typeof w !== 'object') return w;
    const lessonId = String(w.lessonId || w.lesson_id || w.LessonId || w['Lesson ID'] || '').trim();
    const order = Number(w.order || w.Order || w.order_num) || idx + 1;
    const character = String(w.character || w.Character || '').trim();
    const pinyin = String(w.pinyin || w.Pinyin || '').trim();
    const meaning = String(w.meaning || w.Meaning || '').trim();
    const strokeCount = Number(w.strokeCount || w.stroke_count || w.StrokeCount) || 6;
    const radical = String(w.radical || w.Radical || '').trim();
    const strokeAnimationUrl = String(w.strokeAnimationUrl || w.stroke_animation_url || '').trim();
    const svgPath = String(w.svgPath || w.svg_path || '').trim();
    const strokeOrderSteps = String(w.strokeOrderSteps || w.stroke_order_steps || w.StrokeOrderSteps || '').trim();
    return {
      ...w,
      lessonId,
      lesson_id: lessonId,
      order,
      character,
      pinyin,
      meaning,
      strokeCount,
      stroke_count: strokeCount,
      radical,
      strokeAnimationUrl,
      stroke_animation_url: strokeAnimationUrl,
      svgPath,
      svg_path: svgPath,
      strokeOrderSteps,
      stroke_order_steps: strokeOrderSteps
    };
  }

  function normalizeVocabularyRow(v, idx) {
    if (!v || typeof v !== 'object') return v;
    const lessonId = String(v.lessonId || v.lesson_id || v.LessonId || v['Lesson ID'] || '').trim();
    const order = Number(v.order || v.Order || v.order_num) || idx + 1;
    const character = String(v.character || v.Character || v.word || v.chinese || '').trim();
    const pinyin = String(v.pinyin || v.Pinyin || '').trim();
    const meaning = String(v.meaning || v.Meaning || v.english || '').trim();
    const audio = String(v.audio || v.Audio || v.audioUrl || v.audio_url || '').trim();
    return {
      ...v,
      lessonId,
      lesson_id: lessonId,
      order,
      character,
      pinyin,
      meaning,
      audio,
      audioUrl: audio,
      audio_url: audio
    };
  }

  function normalizePronunciationRow(p, idx) {
    if (!p || typeof p !== 'object') return p;
    const lessonId = String(p.lessonId || p.lesson_id || p.LessonId || p['Lesson ID'] || '').trim();
    const order = Number(p.order || p.Order || p.order_num) || idx + 1;
    const chinese = String(p.chinese || p.Chinese || p.text || '').trim();
    const pinyin = String(p.pinyin || p.Pinyin || '').trim();
    const meaning = String(p.meaning || p.Meaning || '').trim();
    const focus = String(p.focus || p.Focus || '').trim();
    return {
      ...p,
      lessonId,
      lesson_id: lessonId,
      order,
      chinese,
      pinyin,
      meaning,
      focus
    };
  }

  function getLessonCourse(lesson) {
    if (!lesson || typeof lesson !== 'object') return 'HSK 2';
    if (window.LinguaAuth && typeof window.LinguaAuth.getLessonCourseName === 'function') {
      return window.LinguaAuth.getLessonCourseName(lesson);
    }
    const raw = String(lesson.course || lesson.courseName || lesson.category || '').trim();
    if (raw) return normalizeCourseName(raw);
    return 'HSK 2';
  }

  function getCategoryKey(lesson) {
    return courseKeySlug(getLessonCourse(lesson));
  }

  function computeCoursesList() {
    const result = [];
    const seen = new Set();
    const pushCourse = (name) => {
      const raw = String(name || '').trim();
      if (!raw) return;
      const norm = normalizeCourseName(raw);
      const slug = courseKeySlug(norm);
      if (slug && !seen.has(slug)) {
        seen.add(slug);
        result.push(norm);
      }
    };
    const siteCfg = window.LinguaAuth && typeof window.LinguaAuth.getSiteConfig === 'function'
      ? window.LinguaAuth.getSiteConfig()
      : null;
    if (siteCfg && Array.isArray(siteCfg.courses) && siteCfg.courses.length) {
      siteCfg.courses.forEach(pushCourse);
    } else if (!allLessons || !allLessons.length) {
      BASE_COURSES.forEach(pushCourse);
    }
    (allLessons || []).forEach((l) => pushCourse(getLessonCourse(l)));
    if (!result.length) {
      BASE_COURSES.forEach(pushCourse);
    }
    return result;
  }

  function getCoursePricingInfo(courseName) {
    const norm = normalizeCourseName(courseName);
    const price = window.LinguaAuth && typeof window.LinguaAuth.getCoursePrice === 'function'
      ? window.LinguaAuth.getCoursePrice(norm)
      : 120;
    const practicePrice = window.LinguaAuth && typeof window.LinguaAuth.getPracticePrice === 'function'
      ? window.LinguaAuth.getPracticePrice()
      : 55000;
    const accessMode = window.LinguaAuth && typeof window.LinguaAuth.getCourseAccessMode === 'function'
      ? window.LinguaAuth.getCourseAccessMode(norm)
      : (window.LinguaAuth && typeof window.LinguaAuth.hasCourseAccess === 'function' && window.LinguaAuth.hasCourseAccess(norm) ? 'full' : 'none');
    return {
      courseName: norm,
      price,
      practicePrice,
      accessMode,
      unlocked: accessMode === 'full',
      isPracticeOnly: accessMode === 'practice'
    };
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
  let loadedFromStoreOrRepo = false;

  async function loadLessonsWorkbook() {
    let loaded = false;

    // Strategy 0: Shared Excel Content Store (Local Admin Draft -> D1/Server Excel -> .xlsx -> .json)
    if (window.LinguaContentStore && typeof window.LinguaContentStore.loadLessonsWorkbook === 'function') {
      try {
        const storeRes = await window.LinguaContentStore.loadLessonsWorkbook();
        if (storeRes && storeRes.sheets && ['local-draft', 'cloudflare-d1', 'xlsx', 'json'].includes(storeRes.source)) {
          allLessons = Array.isArray(storeRes.sheets.Lessons) ? storeRes.sheets.Lessons : [];
          allExercises = Array.isArray(storeRes.sheets.Exercises) ? storeRes.sheets.Exercises : [];
          allWriting = Array.isArray(storeRes.sheets.Writing) ? storeRes.sheets.Writing : [];
          allVocabulary = Array.isArray(storeRes.sheets.Vocabulary) ? storeRes.sheets.Vocabulary : [];
          allPronunciation = Array.isArray(storeRes.sheets.Pronunciation) ? storeRes.sheets.Pronunciation : [];
          loaded = true;
          loadedFromStoreOrRepo = true;
          if (storeRes.source !== 'local-draft') {
            try {
              localStorage.removeItem('linguapath_custom_lessons');
            } catch (_) {}
          }
        }
      } catch (err) {
        console.warn("LinguaContentStore lessons load note:", err);
      }
    }

    // Strategy 1: Direct Binary Excel Parsing via SheetJS (XLSX)
    if (!loaded && typeof XLSX !== 'undefined') {
      try {
        const res = await fetch('data/lessons.xlsx?t=' + Date.now());
        if (res.ok) {
          const buf = await res.arrayBuffer();
          lessonsWorkbook = XLSX.read(buf, { type: 'array' });
          allLessons = lessonsWorkbook.SheetNames.includes('Lessons')
            ? XLSX.utils.sheet_to_json(lessonsWorkbook.Sheets['Lessons'], { defval: '' })
            : [];
          allExercises = lessonsWorkbook.SheetNames.includes('Exercises')
            ? XLSX.utils.sheet_to_json(lessonsWorkbook.Sheets['Exercises'], { defval: '' })
            : [];
          allWriting = lessonsWorkbook.SheetNames.includes('Writing')
            ? XLSX.utils.sheet_to_json(lessonsWorkbook.Sheets['Writing'], { defval: '' })
            : [];
          allVocabulary = lessonsWorkbook.SheetNames.includes('Vocabulary')
            ? XLSX.utils.sheet_to_json(lessonsWorkbook.Sheets['Vocabulary'], { defval: '' })
            : [];
          allPronunciation = lessonsWorkbook.SheetNames.includes('Pronunciation')
            ? XLSX.utils.sheet_to_json(lessonsWorkbook.Sheets['Pronunciation'], { defval: '' })
            : [];
          loaded = true;
          loadedFromStoreOrRepo = true;
        }
      } catch (err) {
        console.warn("Direct XLSX load note:", err);
      }
    }

    // Strategy 2: Static lessons.json fallback
    if (!loaded) {
      try {
        const res = await fetch('data/lessons.json?t=' + Date.now());
        if (res.ok) {
          const data = await res.json();
          if (data && data.sheets) {
            allLessons = Array.isArray(data.sheets.Lessons) ? data.sheets.Lessons : [];
            allExercises = Array.isArray(data.sheets.Exercises) ? data.sheets.Exercises : [];
            allWriting = Array.isArray(data.sheets.Writing) ? data.sheets.Writing : [];
            allVocabulary = Array.isArray(data.sheets.Vocabulary) ? data.sheets.Vocabulary : [];
            allPronunciation = Array.isArray(data.sheets.Pronunciation) ? data.sheets.Pronunciation : [];
            loaded = true;
            loadedFromStoreOrRepo = true;
          }
        }
      } catch (err) {
        console.warn("Static lessons.json load note:", err);
      }
    }

    // Final Fallback: In-memory arrays ONLY when all data sources failed to load
    if (!loaded) {
      allLessons = FALLBACK_LESSONS;
      allExercises = FALLBACK_EXERCISES;
      allWriting = FALLBACK_WRITING;
    }

    // Normalize all rows to support camelCase, snake_case, and clean IDs
    allLessons = (allLessons || []).map(normalizeLessonRow);
    allExercises = (allExercises || []).map(normalizeExerciseRow);
    allWriting = (allWriting || []).map(normalizeWritingRow);
    allVocabulary = (allVocabulary || []).map(normalizeVocabularyRow);
    allPronunciation = (allPronunciation || []).map(normalizePronunciationRow);

    // Apply any saved local pricing overrides onto in-memory lessons
    applyLocalPricingOverrides(allLessons);
  }

  function getLocalPricingOverrides() {
    try {
      const raw = localStorage.getItem('linguapath_local_lesson_pricing');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function applyLocalPricingOverrides(list) {
    const localMap = getLocalPricingOverrides();
    if (!Array.isArray(list)) return;
    list.forEach((l) => {
      const id = String(l.id || '').trim();
      if (id && localMap[id]) {
        l.accessType = localMap[id].accessType;
        l.price = localMap[id].price;
      }
    });
  }

  function resolveLessonPricing(lesson) {
    if (window.LinguaAuth && typeof window.LinguaAuth.getLessonPricing === 'function') {
      const state = window.LinguaAuth.getState();
      const id = String(lesson?.id || lesson?.lessonId || '').trim().replace(/[^a-zA-Z0-9_\-]+/g, '-');
      // If lessonCatalog has an entry, it takes highest priority
      if (state.lessonCatalog && state.lessonCatalog[id]) {
        return window.LinguaAuth.getLessonPricing(lesson);
      }
      // Next check local override map if set
      const localMap = getLocalPricingOverrides();
      if (localMap[id]) {
        return {
          accessType: localMap[id].accessType === 'paid' ? 'paid' : 'free',
          price: Number(localMap[id].price) || (localMap[id].accessType === 'paid' ? 75000 : 0)
        };
      }
      return window.LinguaAuth.getLessonPricing(lesson);
    }

    const rawAccess = String(lesson?.accessType || lesson?.access || '').trim().toLowerCase();
    if (rawAccess === 'free') return { accessType: 'free', price: 0 };
    if (rawAccess === 'paid') return { accessType: 'paid', price: Number(lesson?.price) || 75000 };
    return { accessType: 'paid', price: Number(lesson?.price) || 75000 };
  }

  function getLessonAccessTier(lesson) {
    const pricing = resolveLessonPricing(lesson);
    if (pricing.accessType === 'free') return 'full';
    if (window.LinguaAuth && typeof window.LinguaAuth.getLessonAccessMode === 'function') {
      return window.LinguaAuth.getLessonAccessMode({
        ...lesson,
        course: getLessonCourse(lesson),
        accessType: pricing.accessType,
        price: pricing.price
      });
    }
    if (window.LinguaAuth && typeof window.LinguaAuth.canAccessLesson === 'function') {
      const ok = window.LinguaAuth.canAccessLesson({
        ...lesson,
        course: getLessonCourse(lesson),
        accessType: pricing.accessType,
        price: pricing.price
      });
      return ok ? 'full' : 'none';
    }
    return 'none';
  }

  function canUserAccessLesson(lesson) {
    return getLessonAccessTier(lesson) !== 'none';
  }

  // --- Render Left Sidebar Course Menu ---
  function renderCourseSidebar() {
    const sidebar = document.getElementById('lessonsCourseSidebar');
    if (!sidebar) return;

    const courses = computeCoursesList();
    if (!courses.some((c) => courseKeySlug(c) === courseKeySlug(activeCourseName))) {
      activeCourseName = courses[0] || 'HSK 2';
    }

    sidebar.innerHTML = `
      <div class="lessons-sidebar-header">
        <span class="lessons-sidebar-kicker">Courses</span>
        <h2 class="lessons-sidebar-title">Curriculum Menu</h2>
      </div>
      <nav class="lessons-course-nav" role="tablist" aria-label="Chinese Courses">
        ${courses
          .map((courseName) => {
            const slug = courseKeySlug(courseName);
            const count = allLessons.filter((l) => courseKeySlug(getLessonCourse(l)) === slug).length;
            const isActive = courseKeySlug(activeCourseName) === slug;
            const cInfo = getCoursePricingInfo(courseName);
            return `
              <button
                type="button"
                class="course-nav-btn ${isActive ? 'active' : ''}"
                data-course="${escapeHTML(courseName)}"
                role="tab"
                aria-selected="${isActive ? 'true' : 'false'}"
              >
                <span class="course-nav-main">
                  <span class="course-nav-name">${escapeHTML(courseName)}</span>
                  <span class="course-nav-meta">${cInfo.unlocked ? 'Unlocked' : cInfo.isPracticeOnly ? 'Practice Only' : `${cInfo.price} Kyat`}</span>
                </span>
                <span class="course-nav-count">${count}</span>
              </button>
            `;
          })
          .join('')}
      </nav>
    `;

    sidebar.querySelectorAll('.course-nav-btn').forEach((btn) => {
      btn.onclick = () => {
        switchCourse(btn.dataset.course);
      };
    });
  }

  function renderActiveCourseHeader(courseLessonCount) {
    const header = document.getElementById('activeCourseHeader');
    if (!header) return;

    const info = getCoursePricingInfo(activeCourseName);
    const authState = window.LinguaAuth ? window.LinguaAuth.getState() : { isAdmin: false };
    const isUnlocked = info.unlocked || Boolean(authState.isAdmin);
    const isPractice = !isUnlocked && info.isPracticeOnly;
    const practicePriceFmt = Number(info.practicePrice || 55000).toLocaleString('en-US');

    header.innerHTML = `
      <div class="course-banner-info">
        <div class="course-banner-kicker">Active Course</div>
        <h2 class="course-banner-title">${escapeHTML(info.courseName)}</h2>
        <p class="course-banner-desc">
          <span class="tabular-nums">${courseLessonCount}</span> lesson${courseLessonCount === 1 ? '' : 's'} available · Unlock full lessons (with Video) or choose <strong>Practice Only (${practicePriceFmt} Kyat)</strong> for Exercises, Writing &amp; Pronunciation.
        </p>
      </div>
      <div class="course-banner-actions">
        ${
          isUnlocked
            ? `<span class="course-unlocked-badge">✓ Full Course Unlocked</span>`
            : isPractice
            ? `<span class="course-practice-badge">✓ Practice Only Active (No Video)</span>
               <button type="button" class="btn btn-primary" id="btnUnlockFullCourse">Upgrade for Video (${escapeHTML(info.price)} Kyat)</button>`
            : `<button type="button" class="btn btn-secondary" id="btnUnlockPracticeCourse">Practice Only (${practicePriceFmt} Kyat)</button>
               <button type="button" class="btn btn-primary" id="btnUnlockFullCourse">Unlock Full Course (${escapeHTML(info.price)} Kyat)</button>`
        }
      </div>
    `;

    const unlockBtn = document.getElementById('btnUnlockFullCourse');
    if (unlockBtn) {
      unlockBtn.onclick = () => {
        if (window.LinguaAuthUI && typeof window.LinguaAuthUI.openSubscribeCourseModal === 'function') {
          window.LinguaAuthUI.openSubscribeCourseModal(info.courseName, 'course');
        } else if (window.LinguaAuthUI && typeof window.LinguaAuthUI.openSubscribeModal === 'function') {
          window.LinguaAuthUI.openSubscribeModal({ mode: 'course', courseName: info.courseName, planType: 'course' });
        }
      };
    }

    const practiceBtn = document.getElementById('btnUnlockPracticeCourse');
    if (practiceBtn) {
      practiceBtn.onclick = () => {
        if (window.LinguaAuthUI && typeof window.LinguaAuthUI.openSubscribeCourseModal === 'function') {
          window.LinguaAuthUI.openSubscribeCourseModal(info.courseName, 'practice_course');
        } else if (window.LinguaAuthUI && typeof window.LinguaAuthUI.openSubscribeModal === 'function') {
          window.LinguaAuthUI.openSubscribeModal({ mode: 'course', courseName: info.courseName, planType: 'practice_course' });
        }
      };
    }
  }

  function switchCourse(courseName, updateUrl = true) {
    activeCourseName = normalizeCourseName(courseName);
    renderCourseSidebar();
    renderLessonGrid();
    closeLessonWorkspace(false);

    if (updateUrl) {
      const url = new URL(window.location);
      url.searchParams.set('course', activeCourseName);
      url.searchParams.delete('category');
      url.searchParams.delete('lesson');
      window.history.pushState({}, '', url);
    }
  }

  // --- Render Upload & Pricing Action Bar ---
  function renderCurriculumManageBar() {
    const section = document.getElementById('curriculumListSection');
    const grid = document.getElementById('lessonsGrid');
    if (!section || !grid) return;

    let bar = document.getElementById('curriculumAccessManageBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'curriculumAccessManageBar';
      bar.className = 'curriculum-manage-bar';
      grid.parentNode.insertBefore(bar, grid);
    }

    const authState = window.LinguaAuth ? window.LinguaAuth.getState() : { user: null, isAdmin: false, profile: null };
    const courseInfo = getCoursePricingInfo(activeCourseName);

    let accessSummary = 'Free starter lessons open · Choose Full Access or 55,000 Kyat Practice-Only (No Video)';
    if (authState.isAdmin) {
      accessSummary = 'Admin signed in · Manage courses, pricing & Excel curriculum';
    } else if (courseInfo.unlocked) {
      accessSummary = `${courseInfo.courseName} Course Pass Active · All Lessons Unlocked`;
    } else if (courseInfo.isPracticeOnly) {
      accessSummary = `${courseInfo.courseName} Practice-Only Active · Exercises, Writing & Pronunciation (No Video)`;
    } else if (authState.user) {
      accessSummary = 'Choose Full Access (with Video) or Practice-Only (55,000 Kyat · No Video)';
    }

    bar.innerHTML = `
      <span class="curriculum-access-summary">${escapeHTML(accessSummary)}</span>
      <div class="curriculum-manage-actions">
        ${
          !courseInfo.unlocked && !authState.isAdmin
            ? `<button type="button" class="btn-manage-inline btn-manage-upgrade" id="btnGridViewPlans">${courseInfo.isPracticeOnly ? 'Upgrade for Video' : 'Unlock Lesson / Course'}</button>`
            : ''
        }
        ${
          authState.isAdmin
            ? `<button type="button" class="btn-manage-inline" id="btnGridManagePricing">Upload &amp; Set Free/Paid</button>`
            : ''
        }
      </div>
    `;

    const viewPlansBtn = document.getElementById('btnGridViewPlans');
    if (viewPlansBtn) {
      viewPlansBtn.onclick = () => {
        if (window.LinguaAuthUI && typeof window.LinguaAuthUI.openSubscribeCourseModal === 'function') {
          window.LinguaAuthUI.openSubscribeCourseModal(activeCourseName);
        } else if (window.LinguaAuthUI) {
          window.LinguaAuthUI.openSubscribeModal();
        }
      };
    }

    const manageBtn = document.getElementById('btnGridManagePricing');
    if (manageBtn) {
      manageBtn.onclick = () => openExcelManagerModal();
    }
  }

  // --- Render Lesson Cards Grid ---
  function renderLessonGrid() {
    const grid = document.getElementById('lessonsGrid');
    if (!grid) return;

    const targetSlug = courseKeySlug(activeCourseName);
    const filtered = allLessons.filter((l) => courseKeySlug(getLessonCourse(l)) === targetSlug);

    renderActiveCourseHeader(filtered.length);
    renderCurriculumManageBar();

    if (!filtered.length) {
      grid.innerHTML = `
        <div class="course-empty-box">
          <h3>No lessons added under ${escapeHTML(activeCourseName)} yet</h3>
          <p>Admin can create new lessons under ${escapeHTML(activeCourseName)} from the Admin Portal.</p>
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
      const courseName = getLessonCourse(lesson);
      const level = lesson.level || courseName;
      const poster = backendAssetUrl(lesson.posterUrl || lesson.poster || `assets/images/story-0${(idx % 5) + 1}.jpg`);
      const pricing = resolveLessonPricing(lesson);
      const isPaid = pricing.accessType === 'paid';
      const accessTier = getLessonAccessTier(lesson);
      const isUnlocked = accessTier !== 'none';
      const isPracticeOnly = accessTier === 'practice';
      const isLocked = isPaid && !isUnlocked;

      const formattedPrice = Number(pricing.price || 0).toLocaleString();
      const accessMetaText = !isPaid
        ? 'Free Lesson'
        : accessTier === 'full'
        ? `Unlocked · ${formattedPrice} Kyat`
        : isPracticeOnly
        ? 'Practice Only (No Video)'
        : `${formattedPrice} Kyat`;
      const accessTagClass = !isPaid ? 'is-free' : isPracticeOnly ? 'is-practice' : isUnlocked ? 'is-unlocked' : 'is-paid';
      const featuresLine = isPracticeOnly
        ? '✏️ Exercises · 🖌️ Stroke Writing · 🎤 Pronunciation (Video Excluded)'
        : '📺 Video · ✏️ Exercises · 🖌️ Stroke Writing · 🎤 Pronunciation';
      const btnText = isLocked
        ? `🔒 Unlock (${escapeHTML(formattedPrice)} Kyat) →`
        : isPracticeOnly
        ? '✏️ Start Practice (3 Pages) →'
        : '🚀 Start Lesson →';

      return `
        <article class="lesson-card ${isLocked ? 'lesson-card-locked' : ''}" id="card-${escapeHTML(lessonId)}">
          <div class="lesson-card-image">
            <img src="${escapeHTML(poster)}" alt="${escapeHTML(title)}" onerror="this.onerror=null; this.src='assets/images/story-poster.jpg';" loading="lazy">
          </div>
          <div class="lesson-card-content">
            <div class="lesson-meta-line">
              <span class="lesson-category-tag">${escapeHTML(courseName)}</span>
              <span class="lesson-access-tag ${accessTagClass}">${escapeHTML(accessMetaText)}</span>
            </div>
            <span class="lesson-level">${escapeHTML(level)}</span>
            <h3>${escapeHTML(title)}</h3>
            ${cnTitle ? `<div class="lesson-chinese-title chinese-kaiti" style="font-family: 'KaiTi', 'STKaiti', '楷体', 'Kaiti SC', 'Ma Shan Zheng', serif;">${escapeHTML(cnTitle)}</div>` : ''}
            ${pinyin ? `<div class="lesson-pinyin">${escapeHTML(pinyin)}</div>` : ''}
            ${meaning ? `<div class="lesson-meaning">${escapeHTML(meaning)}</div>` : ''}
            <p class="lesson-description">${escapeHTML(desc)}</p>

            <div class="lesson-features-line">${escapeHTML(featuresLine)}</div>

            <div class="lesson-card-actions" style="margin-top: auto;">
              <button type="button" class="btn ${isLocked ? 'lesson-button-locked' : 'btn-primary'} lesson-button" style="width: 100%; text-align: center;" data-lesson-id="${escapeHTML(lessonId)}">
                ${btnText}
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    grid.querySelectorAll('.lesson-button').forEach(btn => {
      btn.onclick = () => {
        const lessonId = btn.dataset.lessonId;
        openLessonWorkspace(lessonId);
      };
    });
  }

  let pendingDeepLinkLessonId = null;

  function applyWorkspaceVideoTabVisibility(lesson) {
    const allowVideo = getLessonAccessTier(lesson) === 'full';
    const videoTabBtn = document.querySelector('.workspace-tab-btn[data-tab="video"]');
    const videoPanel = document.getElementById('panel-video');
    if (videoTabBtn) {
      videoTabBtn.hidden = !allowVideo;
      videoTabBtn.disabled = !allowVideo;
      videoTabBtn.style.display = allowVideo ? '' : 'none';
      if (!allowVideo) {
        videoTabBtn.classList.remove('active');
        videoTabBtn.setAttribute('aria-selected', 'false');
      }
    }
    if (videoPanel && !allowVideo) {
      const vid = videoPanel.querySelector('#workspaceVideoPlayer');
      if (vid && typeof vid.pause === 'function') vid.pause();
      videoPanel.innerHTML = '';
      videoPanel.classList.remove('active');
      videoPanel.style.display = 'none';
    } else if (videoPanel) {
      videoPanel.style.display = '';
    }
    return allowVideo;
  }

  // --- Open Lesson Workspace (4 Core Sections; 3 Practice Sections for Practice-Only Tier) ---
  function openLessonWorkspace(lessonId, updateUrl = true) {
    const lesson = allLessons.find(l => isSameLessonId(l.id, lessonId)) || allLessons[0];
    if (!lesson) return;

    const accessTier = getLessonAccessTier(lesson);

    // Gate Paid Lessons unless user has course access / per-lesson unlock / practice-only / admin
    if (accessTier === 'none') {
      const authState = window.LinguaAuth ? window.LinguaAuth.getState() : null;
      if (authState && !authState.ready && !updateUrl) {
        pendingDeepLinkLessonId = lesson.id;
        return;
      }
      if (window.LinguaAuthUI && typeof window.LinguaAuthUI.openSubscribeModal === 'function') {
        const pricing = resolveLessonPricing(lesson);
        window.LinguaAuthUI.openSubscribeModal({
          ...lesson,
          course: getLessonCourse(lesson),
          accessType: pricing.accessType,
          price: pricing.price
        });
      }
      return;
    }

    pendingDeepLinkLessonId = null;
    activeLesson = lesson;
    activeCourseName = getLessonCourse(lesson);
    const allowVideo = applyWorkspaceVideoTabVisibility(lesson);
    const initialTab = allowVideo ? 'video' : 'exercises';
    activeWorkspaceTab = initialTab;
    activeWritingCharIndex = 0;
    exerciseAnswersState = {};

    try {
      localStorage.setItem('linguapath_active_lesson', JSON.stringify({
        id: lesson.id,
        course: activeCourseName,
        title: lesson.title,
        chineseTitle: lesson.chineseTitle || '',
        pinyin: lesson.pinyin || '',
        level: lesson.level || activeCourseName,
        category: activeCourseName,
        timestamp: Date.now()
      }));
    } catch (e) {}

    const workspace = document.getElementById('lessonWorkspace');
    const curriculumSection = document.getElementById('curriculumListSection');

    if (workspace) {
      if (curriculumSection) curriculumSection.style.display = 'none';

      workspace.classList.add('active');
      workspace.style.display = 'block';

      renderWorkspaceHeader(lesson);
      if (allowVideo) {
        renderVideoSection(lesson);
      }
      renderExercisesSection(lesson);
      renderWritingSection(lesson);
      renderPronunciationSection(lesson);
      switchWorkspaceTab(initialTab);

      workspace.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.location.href = `lessons.html?lesson=${encodeURIComponent(lesson.id)}`;
      return;
    }

    if (updateUrl) {
      const url = new URL(window.location);
      url.searchParams.set('lesson', lesson.id);
      url.searchParams.set('course', activeCourseName);
      window.history.pushState({}, '', url);
    }
  }

  function closeLessonWorkspace(updateUrl = true) {
    const workspace = document.getElementById('lessonWorkspace');
    const curriculumSection = document.getElementById('curriculumListSection');

    stopPronunciationRecording();

    if (workspace) {
      workspace.classList.remove('active');
      workspace.style.display = 'none';
    }

    if (curriculumSection) curriculumSection.style.display = 'block';

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

    const courseName = getLessonCourse(lesson);
    const catName = lesson.category || courseName || 'HSK 2';
    const isPracticeOnly = getLessonAccessTier(lesson) === 'practice';

    hero.innerHTML = `
      <div class="workspace-top-bar">
        <button type="button" class="btn-back-to-curriculum" id="btnBackToCurriculum">
          ← Back to ${escapeHTML(courseName)} Lessons
        </button>
        <div class="workspace-top-right">
          <div class="workspace-breadcrumbs">
            <span>Courses</span>
            <span class="sep">›</span>
            <span>${escapeHTML(courseName)}</span>
            <span class="sep">›</span>
            <span style="color: #ea580c;">${escapeHTML(lesson.title)}</span>
          </div>
          <button type="button" class="btn-workspace-finish" id="btnHeroFinishReview">
            ✓ Finish &amp; Review
          </button>
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

      ${
        isPracticeOnly
          ? `<div class="practice-only-workspace-banner" role="status">
               <div>
                 <strong>Practice-Only Plan (55,000 Kyat):</strong> You have access to <strong>Exercises, Writing &amp; Pronunciation</strong>. Video lessons are excluded on this plan.
               </div>
               <button type="button" class="btn-upgrade-video" id="btnUpgradeFromWorkspaceBanner">Unlock Full Video</button>
             </div>`
          : ''
      }
    `;

    document.getElementById('btnBackToCurriculum').onclick = () => closeLessonWorkspace();
    const heroFinishBtn = document.getElementById('btnHeroFinishReview');
    if (heroFinishBtn) {
      heroFinishBtn.onclick = () => completeCurriculumLesson(lesson, { score: 100 });
    }
    const speakBtn = document.getElementById('btnSpeakLessonTitle');
    if (speakBtn && lesson.chineseTitle) {
      speakBtn.onclick = () => speakChinese(lesson.chineseTitle);
    }
    const upgradeBannerBtn = document.getElementById('btnUpgradeFromWorkspaceBanner');
    if (upgradeBannerBtn) {
      upgradeBannerBtn.onclick = () => {
        if (window.LinguaAuthUI && typeof window.LinguaAuthUI.openSubscribeModal === 'function') {
          const pricing = resolveLessonPricing(lesson);
          window.LinguaAuthUI.openSubscribeModal({
            ...lesson,
            course: courseName,
            accessType: pricing.accessType,
            price: pricing.price
          });
        }
      };
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
    if (tabName === 'video' && activeLesson && getLessonAccessTier(activeLesson) !== 'full') {
      tabName = 'exercises';
    }
    activeWorkspaceTab = tabName;

    // Stop active speech recognition recording if user leaves pronunciation tab
    if (tabName !== 'pronunciation') {
      stopPronunciationRecording();
    }

    document.querySelectorAll('.workspace-tab-btn').forEach(b => {
      const isActive = b.dataset.tab === tabName && !b.disabled;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (isActive) {
        try {
          b.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        } catch (_) {}
      }
    });

    document.querySelectorAll('.workspace-panel').forEach(p => {
      const shouldShow = p.id === `panel-${tabName}` && !(p.id === 'panel-video' && activeLesson && getLessonAccessTier(activeLesson) !== 'full');
      p.classList.toggle('active', shouldShow);
    });

    // Smooth scroll to the workspace tabs bar (practice exercise menu header) with sticky offset
    const tabsBarEl = document.querySelector('.workspace-tabs-bar');
    if (tabsBarEl) {
      const rect = tabsBarEl.getBoundingClientRect();
      const stickyOffset = window.innerWidth <= 768 ? 72 : 82;
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

    if (getLessonAccessTier(lesson) !== 'full') {
      const vid = panel.querySelector('#workspaceVideoPlayer');
      if (vid && typeof vid.pause === 'function') vid.pause();
      panel.innerHTML = '';
      panel.classList.remove('active');
      panel.style.display = 'none';
      return;
    }
    panel.style.display = '';

    const videoUrl = backendAssetUrl(lesson.videoUrl || lesson.video_url || lesson.video || 'assets/video/lesson-02.mp4');
    const poster = backendAssetUrl(lesson.posterUrl || lesson.poster_url || lesson.poster || 'assets/images/story-02.jpg');

    // Find vocabulary or story lines for this lesson
    const vocabItems = allVocabulary.filter(v => isSameLessonId(v.lessonId || v.lesson_id, lesson.id));

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

    let exercises = allExercises.filter(ex => isSameLessonId(ex.lessonId || ex.lesson_id, lesson.id));

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

    // Normalize exercise records (supports camelCase or snake_case from Excel / D1)
    const normalizedExercises = exercises
      .map((raw, idx) => ({
        lessonId: String(raw.lessonId || raw.lesson_id || lesson.id || '').trim(),
        order: Number(raw.order || raw.order_num) || idx + 1,
        type: String(raw.type || 'multiple-choice').trim().toLowerCase(),
        groupId: String(raw.groupId || raw.group_id || '').trim(),
        groupTitle: String(raw.groupTitle || raw.group_title || '').trim(),
        pinyin: String(raw.pinyin || raw.pinyinHint || raw.pinyin_hint || '').trim(),
        question: String(raw.question || '').trim(),
        audioUrl: String(raw.audioUrl || raw.audio_url || raw.audio || '').trim(),
        optionA: String(raw.optionA ?? raw.option_a ?? '').trim(),
        optionB: String(raw.optionB ?? raw.option_b ?? '').trim(),
        optionC: String(raw.optionC ?? raw.option_c ?? '').trim(),
        optionD: String(raw.optionD ?? raw.option_d ?? '').trim(),
        optionE: String(raw.optionE ?? raw.option_e ?? '').trim(),
        optionAImage: String(raw.optionAImage || raw.option_a_image || '').trim(),
        optionBImage: String(raw.optionBImage || raw.option_b_image || '').trim(),
        optionCImage: String(raw.optionCImage || raw.option_c_image || '').trim(),
        optionDImage: String(raw.optionDImage || raw.option_d_image || '').trim(),
        optionEImage: String(raw.optionEImage || raw.option_e_image || '').trim(),
        answer: String(raw.answer || '').trim(),
        explanation: String(raw.explanation || '').trim()
      }))
      .sort((a, b) => a.order - b.order);

    const buildExerciseAudioHTML = (ex) => {
      const audioSrc = ex.audioUrl ? backendAssetUrl(ex.audioUrl) : '';
      const hasChinese = /[\u4e00-\u9fa5]/.test(ex.question || '');
      if (!audioSrc && !hasChinese) return '';

      return `
        <div class="quiz-audio-bar">
          ${
            audioSrc
              ? `<audio src="${escapeHTML(audioSrc)}" controls preload="none" class="quiz-audio-player"></audio>`
              : ''
          }
          ${
            hasChinese
              ? `<button type="button" class="quiz-tts-btn" data-speak-text="${escapeHTML(ex.question)}">🔊 Listen</button>`
              : ''
          }
        </div>
      `;
    };

    const formatBlankQuestionHTML = (text, pinyinHint = '') => {
      const escaped = wrapChineseInKaiti(escapeHTML(String(text || '')));
      const shortCue = pinyinHint && String(pinyinHint).trim().length <= 24 ? String(pinyinHint).trim() : '';
      const blankMarkup = `<span class="quiz-inline-blank">${shortCue ? escapeHTML(shortCue) : '&nbsp;&nbsp;&nbsp;&nbsp;'}</span>`;
      return escaped.replace(/(\(\s*\)|（\s*）|\[\s*\]|_{2,})/g, blankMarkup);
    };

    const getExerciseSlots = (ex) => {
      return ['A', 'B', 'C', 'D', 'E']
        .map((letter) => ({
          letter,
          text: ex[`option${letter}`] || '',
          image: ex[`option${letter}Image`] || ''
        }))
        .filter((slot) => slot.text || slot.image);
    };

    // Build render blocks, grouping shared-image-match / shared-text-match rows sharing the same groupId
    const renderBlocks = [];
    const seenSharedGroups = new Map();
    normalizedExercises.forEach((ex, idx) => {
      const qNum = idx + 1;
      const isSharedMatch = ex.type === 'shared-image-match' || ex.type === 'shared-text-match';
      if (isSharedMatch) {
        const gKey = (ex.groupId || 'default-group').toLowerCase();
        if (!seenSharedGroups.has(gKey)) {
          const groupObj = {
            kind: 'shared-match',
            groupId: ex.groupId || 'Part II',
            groupTitle: ex.groupTitle || '',
            sharedSlots: [],
            items: []
          };
          seenSharedGroups.set(gKey, groupObj);
          renderBlocks.push(groupObj);
        }
        const groupObj = seenSharedGroups.get(gKey);
        if (!groupObj.groupTitle && ex.groupTitle) {
          groupObj.groupTitle = ex.groupTitle;
        }
        // Populate sharedSlots from the first item that provides options/images, or merge missing slots
        const itemSlots = getExerciseSlots(ex);
        if (!groupObj.sharedSlots.length) {
          groupObj.sharedSlots = itemSlots;
        } else {
          itemSlots.forEach((s) => {
            const existing = groupObj.sharedSlots.find((es) => es.letter === s.letter);
            if (!existing) {
              groupObj.sharedSlots.push(s);
            } else {
              if (!existing.image && s.image) existing.image = s.image;
              if (!existing.text && s.text) existing.text = s.text;
            }
          });
        }
        groupObj.items.push({ ex, qNum });
      } else {
        renderBlocks.push({
          kind: ex.type,
          ex,
          qNum
        });
      }
    });

    panel.innerHTML = `
      <div class="exercises-workspace">
        <div class="quiz-header-bar">
          <div>
            <h3 style="margin: 0 0 4px; font-size: 1.3rem; font-weight: 800;">Interactive Practice Exercises</h3>
            <span class="quiz-progress-counter">${normalizedExercises.length} Questions to Test Your Mastery</span>
          </div>
          <div class="quiz-score-badge" id="quizScoreBadge">
            <span>⭐ Score: 0 / ${normalizedExercises.length}</span>
          </div>
        </div>

        <div class="quiz-questions-stack">
          ${renderBlocks.map((block) => {
            if (block.kind === 'shared-match') {
              const slots = block.sharedSlots.length
                ? block.sharedSlots
                : [
                    { letter: 'A', text: 'A', image: '' },
                    { letter: 'B', text: 'B', image: '' },
                    { letter: 'C', text: 'C', image: '' },
                    { letter: 'D', text: 'D', image: '' }
                  ];
              const hasSharedImages = slots.some((s) => Boolean(s.image));
              const isWordBank = !hasSharedImages && slots.every((s) => (s.text || '').length <= 24);
              const qNumbersLabel = block.items.length > 1
                ? `Questions ${block.items[0].qNum}–${block.items[block.items.length - 1].qNum}`
                : `Question ${block.items[0].qNum}`;
              const bankTypeBadge = hasSharedImages
                ? 'Picture Matching'
                : isWordBank
                ? 'Word Bank Matching'
                : 'Sentence Matching';
              const defaultGroupInstruction = hasSharedImages
                ? 'Look at the pictures below and choose the matching choice for each question.'
                : 'Read the choices at the top and choose the matching letter for each question below.';

              return `
                <div class="quiz-card-item quiz-shared-bank-card">
                  <div class="quiz-question-number">${escapeHTML(qNumbersLabel)} • ${escapeHTML(bankTypeBadge)}</div>
                  <h4 class="quiz-question-text">
                    ${wrapChineseInKaiti(escapeHTML(block.groupTitle || defaultGroupInstruction))}
                  </h4>

                  ${
                    hasSharedImages
                      ? `
                    <div class="quiz-shared-top-images ${slots.length === 3 || slots.length === 5 ? 'cols-3' : 'cols-2'}">
                      ${slots.map((slot) => {
                        const imgSrc = slot.image ? backendAssetUrl(slot.image) : '';
                        return `
                          <div class="quiz-shared-picture-tile">
                            <div class="quiz-picture-letter-badge">${escapeHTML(slot.letter)}</div>
                            <div class="quiz-picture-frame">
                              ${
                                imgSrc
                                  ? `<img src="${escapeHTML(imgSrc)}" alt="Choice ${escapeHTML(slot.letter)}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                                     <div class="quiz-picture-fallback" style="display:none;">Picture ${escapeHTML(slot.letter)}</div>`
                                  : `<div class="quiz-picture-fallback">Picture ${escapeHTML(slot.letter)}</div>`
                              }
                            </div>
                            ${slot.text ? `<div class="quiz-picture-caption">${wrapChineseInKaiti(escapeHTML(slot.text))}</div>` : ''}
                          </div>
                        `;
                      }).join('')}
                    </div>
                  `
                      : `
                    <div class="quiz-shared-top-textbank ${isWordBank ? 'is-word-bank' : 'is-sentence-bank'}">
                      ${slots.map((slot) => `
                        <div class="quiz-shared-text-tile">
                          <span class="quiz-shared-text-badge">${escapeHTML(slot.letter)}</span>
                          <span class="quiz-shared-text-value">${wrapChineseInKaiti(escapeHTML(slot.text || slot.letter))}</span>
                        </div>
                      `).join('')}
                    </div>
                  `
                  }

                  <div class="quiz-shared-questions-list">
                    ${block.items.map(({ ex, qNum }) => `
                      <div class="quiz-shared-question-row" id="quizCard-${qNum}">
                        <div class="quiz-shared-row-main">
                          <div class="quiz-shared-row-prompt">
                            <span class="quiz-shared-row-num">${qNum}.</span>
                            <div class="quiz-shared-row-text">
                              ${ex.pinyin ? `<div class="quiz-shared-row-pinyin">${escapeHTML(ex.pinyin)}</div>` : ''}
                              ${
                                ex.question
                                  ? `<div class="quiz-shared-prompt-line">${formatBlankQuestionHTML(ex.question)}</div>`
                                  : `<div class="quiz-shared-prompt-line muted">Choose ${slots.map((s) => s.letter).join(', ')} for Question ${qNum}</div>`
                              }
                              ${buildExerciseAudioHTML(ex)}
                            </div>
                          </div>
                          <div class="quiz-letter-choices" role="group" aria-label="Choices for Question ${qNum}">
                            ${slots.map((slot) => `
                              <button
                                type="button"
                                class="quiz-option-btn quiz-letter-btn"
                                data-question-index="${qNum}"
                                data-letter="${escapeHTML(slot.letter)}"
                                data-option="${escapeHTML(slot.text || slot.letter)}"
                                data-answer="${escapeHTML(ex.answer || '')}"
                                data-explanation="${escapeHTML(ex.explanation || '')}"
                              >
                                <span class="quiz-letter-label">${escapeHTML(slot.letter)}</span>
                                <span class="quiz-opt-icon"></span>
                              </button>
                            `).join('')}
                          </div>
                        </div>
                        <div class="quiz-feedback-box" id="quizFeedback-${qNum}">
                          <div class="quiz-feedback-status" id="feedbackStatus-${qNum}"></div>
                          <p class="quiz-explanation-text" id="feedbackText-${qNum}"></p>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              `;
            }

            const { ex, qNum } = block;
            const slots = getExerciseSlots(ex);
            const hasOptionImages = slots.some((s) => Boolean(s.image));
            const isFillBlank =
              ex.type === 'fill-blank' ||
              ex.type === 'pinyin-write' ||
              ex.type === 'write-hanzi' ||
              (!hasOptionImages && !slots.length);
            const isImageChoice = !isFillBlank && (ex.type === 'image-choice' || hasOptionImages);

            return `
              <div class="quiz-card-item" id="quizCard-${qNum}">
                <div class="quiz-question-number">Question ${qNum} • ${
              isFillBlank
                ? 'Write Chinese Character (Pinyin)'
                : isImageChoice
                ? 'Picture Multiple Choice'
                : 'Multiple Choice'
            }</div>
                ${
                  ex.pinyin
                    ? `
                  <div class="quiz-pinyin-cue-bar">
                    <span class="quiz-pinyin-cue-label">Pinyin:</span>
                    <span class="quiz-pinyin-cue-value">${escapeHTML(ex.pinyin)}</span>
                  </div>
                `
                    : ''
                }
                ${
                  ex.question
                    ? `<h4 class="quiz-question-text">${
                        isFillBlank
                          ? formatBlankQuestionHTML(ex.question, ex.pinyin)
                          : wrapChineseInKaiti(escapeHTML(ex.question))
                      }</h4>`
                    : ''
                }
                ${buildExerciseAudioHTML(ex)}

                ${
                  isFillBlank
                    ? `
                  <div class="quiz-fill-answer-bar">
                    <input
                      type="text"
                      class="quiz-fill-input chinese-kaiti"
                      id="quizFillInput-${qNum}"
                      data-question-index="${qNum}"
                      data-answer="${escapeHTML(ex.answer || '')}"
                      data-explanation="${escapeHTML(ex.explanation || '')}"
                      placeholder="Type Chinese character (汉字)..."
                      aria-label="Chinese character answer for Question ${qNum}"
                      autocomplete="off"
                    />
                    <button
                      type="button"
                      class="quiz-fill-submit-btn"
                      data-question-index="${qNum}"
                      data-answer="${escapeHTML(ex.answer || '')}"
                      data-explanation="${escapeHTML(ex.explanation || '')}"
                    >✓ Check Answer</button>
                  </div>
                `
                    : isImageChoice
                    ? `
                  <div class="quiz-image-options-grid ${slots.length === 3 || slots.length === 5 ? 'cols-3' : 'cols-2'}">
                    ${slots.map((slot) => {
                      const imgSrc = slot.image ? backendAssetUrl(slot.image) : '';
                      return `
                        <button
                          type="button"
                          class="quiz-option-btn quiz-image-option-card"
                          data-question-index="${qNum}"
                          data-letter="${escapeHTML(slot.letter)}"
                          data-option="${escapeHTML(slot.text || slot.letter)}"
                          data-answer="${escapeHTML(ex.answer || '')}"
                          data-explanation="${escapeHTML(ex.explanation || '')}"
                        >
                          <div class="quiz-image-option-frame">
                            ${
                              imgSrc
                                ? `<img src="${escapeHTML(imgSrc)}" alt="Option ${escapeHTML(slot.letter)}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                                   <div class="quiz-picture-fallback" style="display:none;">Image ${escapeHTML(slot.letter)}</div>`
                                : `<div class="quiz-picture-fallback">Option ${escapeHTML(slot.letter)}</div>`
                            }
                          </div>
                          <div class="quiz-image-option-footer">
                            <span class="quiz-image-option-letter">${escapeHTML(slot.letter)}</span>
                            ${slot.text ? `<span class="quiz-image-option-caption">${wrapChineseInKaiti(escapeHTML(slot.text))}</span>` : ''}
                            <span class="quiz-opt-icon"></span>
                          </div>
                        </button>
                      `;
                    }).join('')}
                  </div>
                `
                    : `
                  <div class="quiz-options-grid">
                    ${slots.map((slot) => `
                      <button
                        type="button"
                        class="quiz-option-btn"
                        data-question-index="${qNum}"
                        data-letter="${escapeHTML(slot.letter)}"
                        data-option="${escapeHTML(slot.text)}"
                        data-answer="${escapeHTML(ex.answer || '')}"
                        data-explanation="${escapeHTML(ex.explanation || '')}"
                      >
                        <span>${wrapChineseInKaiti(escapeHTML(slot.text))}</span>
                        <span class="quiz-opt-icon"></span>
                      </button>
                    `).join('')}
                  </div>
                `
                }

                <div class="quiz-feedback-box" id="quizFeedback-${qNum}">
                  <div class="quiz-feedback-status" id="feedbackStatus-${qNum}"></div>
                  <p class="quiz-explanation-text" id="feedbackText-${qNum}"></p>
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

    // Attach TTS listen listeners for optional audio read-aloud
    panel.querySelectorAll('.quiz-tts-btn').forEach((btn) => {
      btn.onclick = () => {
        const txt = btn.getAttribute('data-speak-text');
        if (txt) speakChinese(txt);
      };
    });

    // Attach quiz multiple-choice / shared-match answer validation listeners
    panel.querySelectorAll('.quiz-option-btn').forEach((btn) => {
      btn.onclick = () => {
        const qNum = btn.dataset.questionIndex;
        const selectedLetter = btn.dataset.letter || '';
        const selected = btn.dataset.option || selectedLetter;
        const correct = btn.dataset.answer || '';
        const explanation = btn.dataset.explanation || '';

        handleQuizSelection(qNum, selected, selectedLetter, correct, explanation, normalizedExercises.length);
      };
    });

    // Attach fill-in-the-blank Chinese character validation listeners (button + Enter key)
    panel.querySelectorAll('.quiz-fill-submit-btn').forEach((btn) => {
      btn.onclick = () => {
        const qNum = btn.dataset.questionIndex;
        const inputEl = document.getElementById(`quizFillInput-${qNum}`);
        if (!inputEl) return;
        handleFillBlankSubmit(
          qNum,
          inputEl.value,
          btn.dataset.answer || '',
          btn.dataset.explanation || '',
          normalizedExercises.length
        );
      };
    });

    panel.querySelectorAll('.quiz-fill-input').forEach((inp) => {
      inp.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const qNum = inp.dataset.questionIndex;
          handleFillBlankSubmit(
            qNum,
            inp.value,
            inp.dataset.answer || '',
            inp.dataset.explanation || '',
            normalizedExercises.length
          );
        }
      };
    });

    const resetBtn = document.getElementById('btnResetQuiz');
    if (resetBtn) {
      resetBtn.onclick = () => {
        exerciseAnswersState = {};
        renderExercisesSection(lesson);
      };
    }

    const nextWritingBtn = document.getElementById('btnNextToWriting');
    if (nextWritingBtn) {
      nextWritingBtn.onclick = () => switchWorkspaceTab('writing');
    }
  }

  function handleFillBlankSubmit(qNum, rawUserInput, correct, explanation, totalQuestions) {
    const card = document.getElementById(`quizCard-${qNum}`);
    const inputEl = document.getElementById(`quizFillInput-${qNum}`);
    if (!card || !inputEl) return;

    const userClean = String(rawUserInput || '').replace(/\s+/g, '').trim();
    if (!userClean) {
      inputEl.focus();
      return;
    }

    const acceptedAnswers = String(correct || '')
      .split(/[/|;、]+/)
      .map((s) => s.replace(/\s+/g, '').trim())
      .filter(Boolean);

    const isCorrect = acceptedAnswers.some((ans) => ans.toLowerCase() === userClean.toLowerCase());

    inputEl.disabled = true;
    inputEl.classList.add(isCorrect ? 'correct' : 'incorrect');

    const submitBtn = card.querySelector('.quiz-fill-submit-btn');
    if (submitBtn) submitBtn.disabled = true;

    const feedbackBox = document.getElementById(`quizFeedback-${qNum}`);
    const statusEl = document.getElementById(`feedbackStatus-${qNum}`);
    const textEl = document.getElementById(`feedbackText-${qNum}`);

    const displayCorrect = acceptedAnswers[0] || String(correct || '').trim();
    if (feedbackBox) {
      feedbackBox.classList.add('active');
      if (isCorrect) {
        statusEl.className = 'quiz-feedback-status correct';
        statusEl.innerHTML = '<span>✅ Correct! Great job!</span>';
        playSound('correct');
      } else {
        statusEl.className = 'quiz-feedback-status incorrect';
        statusEl.innerHTML = `<span>❌ Incorrect. The correct character is: <strong>${wrapChineseInKaiti(escapeHTML(displayCorrect))}</strong></span>`;
        playSound('incorrect');
      }
      textEl.innerHTML = wrapChineseInKaiti(escapeHTML(explanation || (isCorrect ? 'Well done!' : 'Keep practicing!')));
    }

    exerciseAnswersState[qNum] = isCorrect;

    const correctCount = Object.values(exerciseAnswersState).filter(Boolean).length;
    const scoreBadge = document.getElementById('quizScoreBadge');
    if (scoreBadge) {
      scoreBadge.innerHTML = `<span>⭐ Score: ${correctCount} / ${totalQuestions} (${Math.round((correctCount / totalQuestions) * 100)}%)</span>`;
    }
  }

  function handleQuizSelection(qNum, selected, selectedLetter, correct, explanation, totalQuestions) {
    const card = document.getElementById(`quizCard-${qNum}`);
    if (!card) return;

    const selNorm = String(selected || '').trim().toLowerCase();
    const selLetterNorm = String(selectedLetter || '').trim().toLowerCase();
    const corrNorm = String(correct || '').trim().toLowerCase();
    const isLetterAnswer = ['a', 'b', 'c', 'd', 'e'].includes(corrNorm);

    const isOptionMatch = (optText, optLetter) => {
      const oText = String(optText || '').trim().toLowerCase();
      const oLet = String(optLetter || '').trim().toLowerCase();
      if (!corrNorm) return false;
      if (isLetterAnswer) {
        return oLet === corrNorm;
      }
      return oText === corrNorm || (oText && (oText.startsWith(corrNorm) || corrNorm.startsWith(oText)));
    };

    const isCorrect = isLetterAnswer
      ? selLetterNorm === corrNorm
      : isOptionMatch(selected, selectedLetter);

    let resolvedCorrectDisplay = String(correct || '').trim();

    // Disable buttons on this question card / row and highlight correct vs chosen
    card.querySelectorAll('.quiz-option-btn').forEach((btn) => {
      btn.disabled = true;
      const opt = btn.dataset.option || '';
      const letVal = btn.dataset.letter || '';
      const iconEl = btn.querySelector('.quiz-opt-icon');

      if (isOptionMatch(opt, letVal)) {
        btn.classList.add('correct');
        if (iconEl) iconEl.textContent = '✓';
        if (isLetterAnswer && opt && opt.toLowerCase() !== letVal.toLowerCase()) {
          resolvedCorrectDisplay = `${letVal} — ${opt}`;
        } else if (isLetterAnswer && letVal) {
          resolvedCorrectDisplay = letVal;
        }
      } else if (
        !isCorrect &&
        ((selLetterNorm && letVal.toLowerCase() === selLetterNorm) || (!selLetterNorm && opt.toLowerCase() === selNorm))
      ) {
        btn.classList.add('incorrect');
        if (iconEl) iconEl.textContent = '✗';
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
        statusEl.innerHTML = `<span>❌ Incorrect. The correct answer is: <strong>${wrapChineseInKaiti(escapeHTML(resolvedCorrectDisplay))}</strong></span>`;
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

    let chars = allWriting.filter(w => isSameLessonId(w.lessonId || w.lesson_id, lesson.id));

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
      const storageKey = getScopedProgressKey();
      let allProgress = {};
      try {
        allProgress = JSON.parse(localStorage.getItem(storageKey) || '{}');
      } catch (e) {}

      const prev = allProgress[cleanId] || {};
      const isDone = Boolean(completed || prev.completed);
      allProgress[cleanId] = {
        percent: isDone ? 100 : Math.max(prev.percent || 0, Math.min(100, score || 0)),
        completed: isDone,
        score: Math.max(prev.score || 0, score || 0),
        lastUpdated: Date.now()
      };
      localStorage.setItem(storageKey, JSON.stringify(allProgress));

      if (isAuthenticatedMember() && window.LinguaAuth && typeof window.LinguaAuth.recordLessonCompletedProgress === 'function' && isDone) {
        window.LinguaAuth.recordLessonCompletedProgress(cleanId, true).catch(() => {});
      }
    } catch (e) {
      console.warn('Could not save lesson progress to localStorage:', e);
    }
  }
  window.saveLessonProgressRecord = saveLessonProgressRecord;

  function completeCurriculumLesson(lesson, options = {}) {
    if (!lesson) return;
    const score = typeof options.score === 'number' ? options.score : 100;
    if (lesson.id) {
      saveLessonProgressRecord(lesson.id, score, true);
    }
    if (window.LinguaAuthUI && typeof window.LinguaAuthUI.syncMemberMenuTools === 'function') {
      window.LinguaAuthUI.syncMemberMenuTools();
    }
    renderLessonGrid();

    const lessonTitle = lesson.title
      ? `${lesson.title}${lesson.chineseTitle ? ` (${lesson.chineseTitle})` : ''}`
      : lesson.id || 'Mandarin Lesson';

    if (window.LinguaReview && typeof window.LinguaReview.openLessonReviewModal === 'function') {
      window.LinguaReview.openLessonReviewModal({
        lessonId: lesson.id || 'lesson',
        title: lessonTitle,
        audience: `${getLessonCourse(lesson) || activeCourseName || 'HSK 2'} Track`
      });
    }
  }
  window.completeCurriculumLesson = completeCurriculumLesson;

  function saveUserScore(points) {
    try {
      const currentScore = parseInt(localStorage.getItem('linguapath_user_score') || '0', 10) || 0;
      const addPoints = parseInt(points, 10) || 10;
      const newScore = currentScore + addPoints;
      localStorage.setItem('linguapath_user_score', String(newScore));

      if (isAuthenticatedMember() && window.LinguaAuthUI && typeof window.LinguaAuthUI.syncMemberMenuTools === 'function') {
        window.LinguaAuthUI.syncMemberMenuTools();
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
    "hsk1-01": [
      {
        chinese: "早上好！今天天气真不错。",
        pinyin: "Zǎoshang hǎo! Jīntiān tiānqì zhēn búcuò.",
        meaning: "Good morning! The weather is really nice today.",
        focus: "HSK 1 Morning greetings"
      },
      {
        chinese: "您好，请问老师在吗？",
        pinyin: "Nín hǎo, qǐngwèn lǎoshī zài ma?",
        meaning: "Hello, excuse me, is the teacher here?",
        focus: "Polite address (您好 / 请问)"
      },
      {
        chinese: "非常感谢您的帮助，不客气！",
        pinyin: "Fēicháng gǎnxiè nín de bāngzhù, bú kèqi!",
        meaning: "Thank you very much for your help — you're welcome!",
        focus: "Gratitude & polite response"
      },
      {
        chinese: "明天见，再见！",
        pinyin: "Míngtiān jiàn, zàijiàn!",
        meaning: "See you tomorrow, goodbye!",
        focus: "Farewell expressions"
      }
    ],
    "hsk2-01": [
      {
        chinese: "她请我们吃了北京烤鸭。",
        pinyin: "Tā qǐng wǒmen chī le Běijīng kǎoyā.",
        meaning: "She treated us to Peking Duck.",
        focus: "HSK 2 Treating guests (请...吃...)"
      },
      {
        chinese: "服务员，请给我们一碗米饭和一盘烤鸭。",
        pinyin: "Fúwùyuán, qǐng gěi wǒmen yì wǎn mǐfàn hé yì pán kǎoyā.",
        meaning: "Waiter, please bring us a bowl of rice and a plate of roast duck.",
        focus: "HSK 2 Dining & measure words"
      },
      {
        chinese: "这家老店的北京烤鸭又香又脆，真好吃！",
        pinyin: "Zhè jiā lǎodiàn de Běijīng kǎoyā yòu xiāng yòu cuì, zhēn hǎochī!",
        meaning: "The Peking Duck at this traditional restaurant is fragrant and crispy, really delicious!",
        focus: "Food adjectives (又...又...)"
      },
      {
        chinese: "谢谢你的招待，下次我请大家吃烤鸭吧！",
        pinyin: "Xièxie nǐ de zhāodài, xià cì wǒ qǐng dàjiā chī kǎoyā ba!",
        meaning: "Thank you for the treat — next time I'll treat everyone to roast duck!",
        focus: "Gratitude & reciprocating hospitality"
      }
    ],
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
  let accumulatedPronunciationTranscript = '';
  let latestPronunciationInterim = '';
  let activePronunciationSentence = null;
  let userManuallyStoppedRecording = false;
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
    "娥": "é", "奔": "bēn", "传": "chuán", "说": "shuō", "流": "liú", "千": "qiān",
    "她": "tā", "了": "le", "烤": "kǎo", "鸭": "yā", "又": "yòu", "脆": "cuì",
    "碗": "wǎn", "米": "mǐ", "饭": "fàn", "盘": "pán", "下": "xià", "吧": "ba",
    "欢": "huān", "太": "tài", "味": "wèi", "道": "dào", "极": "jí", "皮": "pí",
    "卷": "juǎn", "葱": "cōng", "酱": "jiàng", "筷": "kuài", "晚": "wǎn",
    "友": "yǒu", "朋": "péng", "待": "dài", "招": "zhāo", "只": "zhī"
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

    // Prioritize custom Pronunciation lines from lessons.xlsx / LinguaContentStore
    const customPron = (allPronunciation || []).filter(
      p => isSameLessonId(p.lessonId || p.lesson_id, lessonId) && String(p.chinese || '').trim()
    );
    if (customPron.length > 0) {
      return customPron
        .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
        .map((p, idx) => ({
          chinese: String(p.chinese || '').trim(),
          pinyin: String(p.pinyin || '').trim(),
          meaning: String(p.meaning || `Practice line ${idx + 1} for ${lesson.title}`).trim(),
          focus: String(p.focus || lesson.title || 'Mandarin Speech').trim()
        }));
    }

    for (const [key, list] of Object.entries(PRONUNCIATION_PRACTICE_BANK)) {
      if (isSameLessonId(key, lessonId)) return list;
    }
    // Check if vocabulary items exist for this lesson
    const vocab = allVocabulary.filter(v => isSameLessonId(v.lessonId || v.lesson_id, lessonId));
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

  function stopPronunciationRecording(shouldEvaluate = false) {
    userManuallyStoppedRecording = true;
    isPronunciationRecording = false;

    const recToStop = activeSpeechRecognition;
    activeSpeechRecognition = null;

    // Capture combined transcript from both accumulated final chunks and active interim speech
    let finalTranscript = (accumulatedPronunciationTranscript + (latestPronunciationInterim ? ' ' + latestPronunciationInterim : '')).trim();

    if (recToStop) {
      try {
        // If finalTranscript is currently empty and evaluation is requested,
        // attach a flush listener so trailing speech buffer processed by stop() is not lost
        if (!finalTranscript && shouldEvaluate) {
          recToStop.onresult = (evt) => {
            let flushText = '';
            for (let i = evt.resultIndex; i < evt.results.length; ++i) {
              const trans = evt.results[i][0]?.transcript || '';
              if (trans) flushText += trans;
            }
            if (flushText) {
              finalTranscript = (finalTranscript + ' ' + flushText).trim();
            }
          };
        } else {
          recToStop.onresult = null;
        }
        recToStop.onend = null;
        recToStop.onerror = null;
        recToStop.onspeechend = null;
        recToStop.stop();
      } catch (e) {}
    }

    updatePronunciationMicUI(false);

    if (shouldEvaluate && activePronunciationSentence) {
      const sentenceToEval = activePronunciationSentence;
      const executeEvaluation = (transcript) => {
        const cleaned = (transcript || '').trim();
        if (cleaned) {
          evaluateAndRenderPronunciation(cleaned, sentenceToEval);
        } else {
          const hintEl = document.getElementById('pronMicStatusText');
          if (hintEl) {
            hintEl.textContent = '⚠️ No speech detected. Click the mic to try reading aloud again!';
          }
        }
      };

      if (finalTranscript) {
        executeEvaluation(finalTranscript);
      } else {
        const statusText = document.getElementById('pronMicStatusText');
        if (statusText) {
          statusText.innerHTML = '⏳ Evaluating pronunciation...';
        }
        setTimeout(() => {
          executeEvaluation(finalTranscript);
        }, 250);
      }
    }
  }

  // Converts Arabic numerals and percentages into Chinese characters
  function normalizeChineseNumbers(text, targetText) {
    if (!text || typeof text !== 'string') return '';
    let result = text;

    const DIGIT_MAP = {
      '0': '零', '1': '一', '2': '二', '3': '三', '4': '四',
      '5': '五', '6': '六', '7': '七', '8': '八', '9': '九',
      '０': '零', '１': '一', '２': '二', '３': '三', '４': '四',
      '５': '五', '６': '六', '７': '七', '８': '八', '９': '九'
    };

    function integerToChinese(num) {
      const n = parseInt(num, 10);
      if (isNaN(n)) return '';
      if (n === 0) return '零';
      if (n <= 10) return ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'][n];
      if (n < 20) return '十' + (n % 10 !== 0 ? ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'][n % 10] : '');
      if (n < 100) {
        const tens = Math.floor(n / 10);
        const ones = n % 10;
        return DIGIT_MAP[tens] + '十' + (ones !== 0 ? DIGIT_MAP[ones] : '');
      }
      if (n < 1000) {
        const hundreds = Math.floor(n / 100);
        const remainder = n % 100;
        let str = DIGIT_MAP[hundreds] + '百';
        if (remainder === 0) return str;
        if (remainder < 10) return str + '零' + DIGIT_MAP[remainder];
        const tens = Math.floor(remainder / 10);
        const ones = remainder % 10;
        return str + DIGIT_MAP[tens] + '十' + (ones !== 0 ? DIGIT_MAP[ones] : '');
      }
      return String(num).split('').map(d => DIGIT_MAP[d] || d).join('');
    }

    // 1. Handle percentages: e.g. 5% or %5 or 百分之 5
    result = result.replace(/(\d+(?:\.\d+)?)\s*%/g, (_, num) => {
      return '百分之' + (num.includes('.') 
        ? num.split('.').map(p => integerToChinese(p)).join('点') 
        : integerToChinese(num));
    });
    result = result.replace(/%\s*(\d+(?:\.\d+)?)/g, (_, num) => {
      return '百分之' + (num.includes('.') 
        ? num.split('.').map(p => integerToChinese(p)).join('点') 
        : integerToChinese(num));
    });

    // 2. Remove hyphens/dashes or spaces between digits (e.g. 138-0012 -> 1380012)
    result = result.replace(/(?<=[0-9０-９])[-–—\s]+(?=[0-9０-９])/g, '');

    // 3. Check if target text uses compound numbers or individual digits
    const targetHasCompound = targetText && /[十百千万]/.test(targetText);
    const targetHasDigits = targetText && /[零一二三四五六七八九]/.test(targetText);

    if (targetHasCompound && !targetHasDigits) {
      result = result.replace(/\b(\d+)\b/g, (_, num) => integerToChinese(num));
    } else {
      result = result.replace(/[0-9０-９]/g, (char) => DIGIT_MAP[char] || char);
    }

    return result;
  }

  function updatePronunciationMicUI(recording) {
    const consoleEl = document.getElementById('pronMicConsole');
    const statusText = document.getElementById('pronMicStatusText');
    const micBtn = document.getElementById('btnPronRecord');
    const interimBox = document.getElementById('pronInterimBox');
    const interimText = document.getElementById('pronInterimText');

    if (consoleEl) {
      consoleEl.classList.toggle('is-recording', recording);
    }
    if (micBtn) {
      micBtn.setAttribute('title', recording ? 'Click to finish & check score' : 'Click to Read Aloud');
      micBtn.setAttribute('aria-label', recording ? 'Finish recording and evaluate pronunciation' : 'Start recording pronunciation');
      micBtn.innerHTML = recording ? '⏹️' : '🎙️';
    }
    if (statusText) {
      statusText.innerHTML = recording ? '🔴 Listening... Click to Finish &amp; Check Score' : '🎙️ Click to Read Aloud';
    }
    if (interimBox) {
      interimBox.style.display = recording ? 'inline-block' : 'none';
      if (recording && interimText) {
        const rawDisplay = (accumulatedPronunciationTranscript + (latestPronunciationInterim ? ' ' + latestPronunciationInterim : '')).trim();
        const targetStr = activePronunciationSentence ? activePronunciationSentence.chinese : '';
        const currentDisplay = normalizeChineseNumbers(rawDisplay, targetStr);
        interimText.textContent = currentDisplay
          ? `Listening: "${currentDisplay}" (Click mic when done)`
          : 'Listening... Speak in Mandarin now (Click mic when done)';
      }
    }
  }

  function startSpeechRecognitionSession() {
    if (!isPronunciationRecording || userManuallyStoppedRecording) return;
    const SpeechRecClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecClass) return;

    try {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      const rec = new SpeechRecClass();
      rec.lang = 'zh-CN';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 3;

      activeSpeechRecognition = rec;

      rec.onresult = (evt) => {
        let interim = '';
        for (let i = evt.resultIndex; i < evt.results.length; ++i) {
          const trans = evt.results[i][0].transcript || '';
          if (evt.results[i].isFinal) {
            accumulatedPronunciationTranscript += trans;
          } else {
            interim += trans;
          }
        }
        latestPronunciationInterim = interim;
        const interimText = document.getElementById('pronInterimText');
        if (interimText) {
          const rawDisplay = (accumulatedPronunciationTranscript + (interim ? ' ' + interim : '')).trim();
          const targetStr = activePronunciationSentence ? activePronunciationSentence.chinese : '';
          const display = normalizeChineseNumbers(rawDisplay, targetStr);
          interimText.textContent = display
            ? `Listening: "${display}" (Click mic when done)`
            : 'Listening... Speak in Mandarin now (Click mic when done)';
        }
      };

      rec.onerror = (evt) => {
        // 'no-speech' is common when pausing - do NOT abort if user is still recording!
        if (evt.error === 'no-speech') {
          return;
        }
        console.warn('Speech recognition notice:', evt.error);
        if (evt.error === 'not-allowed') {
          stopPronunciationRecording(false);
          const hintEl = document.getElementById('pronMicStatusText');
          if (hintEl) {
            hintEl.textContent = '⚠️ Microphone permission denied. Please allow mic in browser settings.';
          }
        }
      };

      // Ensure browser engine does not stop automatically on pauses
      rec.onspeechend = null;

      rec.onend = () => {
        // If user hasn't clicked stop and recording is still marked active,
        // automatically restart the session so pauses never stop the recording!
        if (isPronunciationRecording && !userManuallyStoppedRecording) {
          setTimeout(() => {
            if (isPronunciationRecording && !userManuallyStoppedRecording) {
              startSpeechRecognitionSession();
            }
          }, 100);
        }
      };

      rec.start();
    } catch (err) {
      console.warn("Speech recognition session start error:", err);
      if (isPronunciationRecording && !userManuallyStoppedRecording) {
        setTimeout(() => {
          if (isPronunciationRecording && !userManuallyStoppedRecording) {
            startSpeechRecognitionSession();
          }
        }, 300);
      }
    }
  }

  // Pure Client-side Speech Recognition with zh-CN - Manual Toggle Control
  function togglePronunciationRecording(currentSentence) {
    if (isPronunciationRecording) {
      // User clicked again to finish speaking and evaluate!
      stopPronunciationRecording(true);
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

    // Immediately hide and clear previous feedback card on retry or new recording
    const feedbackBox = document.getElementById('pronFeedbackContainer');
    if (feedbackBox) {
      feedbackBox.style.display = 'none';
      feedbackBox.innerHTML = '';
    }

    // Initialize recording session
    activePronunciationSentence = currentSentence;
    accumulatedPronunciationTranscript = '';
    latestPronunciationInterim = '';
    userManuallyStoppedRecording = false;
    isPronunciationRecording = true;
    updatePronunciationMicUI(true);

    startSpeechRecognitionSession();
  }

  // Word-by-word sequence alignment and pronunciation scoring
  function calculatePronunciationAccuracy(targetText, heardText, targetPinyin) {
    // Normalize spoken numbers and digits into standard Chinese characters
    const normalizedHeard = normalizeChineseNumbers(heardText, targetText);

    // Strip non-Hanzi and punctuation symbols for clean alignment
    const cleanTarget = (targetText || '').replace(/[\s\p{P}\p{S}]/gu, '');
    const cleanHeard = (normalizedHeard || '').replace(/[\s\p{P}\p{S}]/gu, '');

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

    // Equivalent characters (e.g. 幺 for 一 in phone numbers, 两 for 二, 〇 for 零)
    function areCharsEquivalent(tc, hc) {
      if (!tc || !hc) return false;
      if (tc === hc) return true;
      if ((tc === '一' && hc === '幺') || (tc === '幺' && hc === '一')) return true;
      if ((tc === '二' && hc === '两') || (tc === '两' && hc === '二')) return true;
      if ((tc === '零' && hc === '〇') || (tc === '〇' && hc === '零')) return true;
      return false;
    }

    // Longest Common Subsequence dynamic programming table
    const m = targetChars.length;
    const n = heardChars.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (areCharsEquivalent(targetChars[i - 1], heardChars[j - 1])) {
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
      if (areCharsEquivalent(targetChars[i - 1], heardChars[j - 1])) {
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
      ['好', '号'], ['要', '药'], ['车', '彻'], ['直', '只'],
      ['一', '幺'], ['二', '两'], ['零', '〇']
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

    const isLastSentence = currentPronunciationIndex >= activePronunciationSentences.length - 1;
    if (
      isLastSentence &&
      result.score >= 60 &&
      activePronunciationLesson &&
      !autoReviewedLessons.has(activePronunciationLesson.id)
    ) {
      autoReviewedLessons.add(activePronunciationLesson.id);
      const finishedLesson = activePronunciationLesson;
      setTimeout(() => {
        if (activeLesson && activeLesson.id === finishedLesson.id) {
          completeCurriculumLesson(finishedLesson, { score: result.score });
        }
      }, 650);
    }
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
        feedbackBox.innerHTML = '';
        togglePronunciationRecording(sentence);
      };
    }

    const btnNext = document.getElementById('btnPronNextSentence');
    if (btnNext) {
      btnNext.onclick = () => {
        if (!isLastSentence) {
          switchPronunciationSentence(currentPronunciationIndex + 1);
        } else if (activePronunciationLesson) {
          completeCurriculumLesson(activePronunciationLesson, { score: result.score });
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
            Press the mic, read at your own pace, and click the mic again when finished to check your score.
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

        <div class="workspace-complete-bar">
          <div>
            <strong>Finished this lesson?</strong>
            <span>Mark complete and leave a lesson review for our team.</span>
          </div>
          <button type="button" class="btn btn-primary" id="btnPronFinishLessonReview">
            ✓ Finish Lesson &amp; Leave Review
          </button>
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

    // Hook Finish Lesson & Review CTA
    const finishLessonBtn = document.getElementById('btnPronFinishLessonReview');
    if (finishLessonBtn) {
      finishLessonBtn.onclick = () => {
        completeCurriculumLesson(lesson, { score: 100 });
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
          ${escapeHTML(getLessonCourse(lessonObj))} • ${escapeHTML(lessonObj.level || getLessonCourse(lessonObj))}
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
        openLessonWorkspace(lessonObj.id);
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

  function setExcelStatusBanner(text, tone = 'info') {
    const el = document.getElementById('excelManagerStatusBanner');
    if (!el) return;
    el.className = `lp-feedback lp-feedback-${tone}`;
    el.style.display = 'block';
    el.textContent = text;
  }

  function renderExcelPricingTableRows() {
    const listWrap = document.getElementById('excelPricingTableBody');
    if (!listWrap) return;

    const lessonsList = loadedFromStoreOrRepo ? allLessons : (allLessons.length ? allLessons : FALLBACK_LESSONS);
    if (!lessonsList.length) {
      listWrap.innerHTML = `<div style="padding:14px; text-align:center; color:#64748b; font-size:0.9rem;">No lessons currently in curriculum. Add lessons from the Admin Portal or upload an Excel file above.</div>`;
      return;
    }
    listWrap.innerHTML = lessonsList
      .map((l, idx) => {
        const id = String(l.id || `lesson-${idx + 1}`).trim();
        const pricing = resolveLessonPricing(l);
        return `
          <div class="excel-pricing-row" data-pricing-row="${escapeHTML(id)}">
            <div class="excel-pricing-info">
              <strong>${escapeHTML(l.title || id)}</strong>
              <span>${escapeHTML(getLessonCourse(l))} (${escapeHTML(id)})</span>
            </div>
            <div class="excel-pricing-controls">
              <select class="lp-inline-select" data-pricing-access="${escapeHTML(id)}" aria-label="Access type for ${escapeHTML(l.title || id)}">
                <option value="free" ${pricing.accessType === 'free' ? 'selected' : ''}>Free</option>
                <option value="paid" ${pricing.accessType === 'paid' ? 'selected' : ''}>Paid</option>
              </select>
              <div class="excel-price-input-wrap">
                <span>Kyat</span>
                <input
                  type="number"
                  min="0"
                  max="10000000"
                  step="1"
                  class="lp-inline-price"
                  data-pricing-price="${escapeHTML(id)}"
                  value="${pricing.accessType === 'free' ? 0 : pricing.price}"
                  ${pricing.accessType === 'free' ? 'disabled' : ''}
                  aria-label="Price in Kyat for ${escapeHTML(l.title || id)}"
                />
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    listWrap.querySelectorAll('[data-pricing-access]').forEach((sel) => {
      sel.onchange = () => {
        const lid = sel.dataset.pricingAccess;
        const priceInput = listWrap.querySelector(`[data-pricing-price="${lid}"]`);
        if (priceInput) {
          if (sel.value === 'free') {
            priceInput.value = '0';
            priceInput.disabled = true;
          } else {
            priceInput.disabled = false;
            if (!Number(priceInput.value)) priceInput.value = '75000';
          }
        }
      };
    });
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
            <span>📊 Lesson Upload &amp; Free / Paid Pricing</span>
          </div>
          <button type="button" class="excel-modal-close-btn" id="btnCloseExcelModal" aria-label="Close">✕</button>
        </div>

        <p style="font-size: 0.92rem; color: var(--text-muted, #64748b); margin-bottom: 14px; line-height: 1.5;">
          Export or upload HSK Mandarin lessons (.xlsx / .csv) and choose which lessons are Free vs. Paid (Kyat).
          <a href="admin.html#lessons" style="font-weight: 700; color: #ea580c; margin-left: 6px; text-decoration: none;">Open Full Admin CMS →</a>
        </p>

        <div id="excelManagerStatusBanner" style="display:none; margin-bottom: 14px;"></div>

        <div class="excel-grid-cards">
          <!-- Download Option -->
          <div class="excel-option-box">
            <div class="excel-option-title">📥 1. Export Lessons Data to Excel / CSV</div>
            <div class="excel-option-desc">
              Download the complete curriculum dataset (including <code>accessType</code> and <code>price</code> columns) to edit offline.
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
              Upload your updated workbook (.xlsx or .csv). After uploading, review Free / Paid lesson access right below.
            </div>
            <input type="file" id="excelFileInput" class="excel-file-input" accept=".xlsx, .xls, .csv" />
            <button type="button" class="btn-excel-action btn-excel-upload" id="btnUploadExcelFile">
              📤 Upload &amp; Import Lessons
            </button>
          </div>

          <!-- Free vs Paid Pricing Editor -->
          <div class="excel-option-box">
            <div class="excel-option-title-row">
              <div>
                <div class="excel-option-title">🏷️ 3. Set Free / Paid Lessons &amp; Pricing</div>
                <div class="excel-option-desc" style="margin-bottom: 8px;">
                  Choose which lessons are Free for all learners and which require a Paid subscription or single-lesson unlock.
                </div>
              </div>
              <button type="button" class="btn-excel-action btn-excel-download" id="btnSaveLessonPricing" style="width: auto; padding: 10px 18px;">
                💾 Save Free / Paid Settings
              </button>
            </div>
            <div id="excelPricingTableBody" class="excel-pricing-table"></div>
          </div>

          <!-- Reset Option -->
          <div class="excel-option-box" style="padding: 14px 20px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
              <div>
                <div class="excel-option-title" style="font-size: 0.95rem; margin: 0;">🔄 Reset Uploaded Curriculum</div>
                <div class="excel-option-desc" style="margin: 0; font-size: 0.82rem;">Revert custom uploaded curriculum &amp; local pricing back to defaults.</div>
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
    renderExcelPricingTableRows();

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
          setExcelStatusBanner('Please choose an Excel (.xlsx) or CSV (.csv) file first.', 'error');
          return;
        }
        importLessonsFromExcel(fileInput.files[0]);
      };
    }

    const savePricingBtn = document.getElementById('btnSaveLessonPricing');
    if (savePricingBtn) {
      savePricingBtn.onclick = async () => {
        const rows = document.querySelectorAll('#excelPricingTableBody [data-pricing-row]');
        const localMap = getLocalPricingOverrides();
        const catalogItems = [];

        rows.forEach((row) => {
          const lid = row.dataset.pricingRow;
          const accessSel = row.querySelector(`[data-pricing-access="${lid}"]`);
          const priceInput = row.querySelector(`[data-pricing-price="${lid}"]`);
          const accessType = accessSel?.value === 'paid' ? 'paid' : 'free';
          const price = accessType === 'free' ? 0 : Math.max(0, Number(priceInput?.value || 75000));
          localMap[lid] = { accessType, price };

          const lessonObj = allLessons.find((l) => String(l.id || '').trim() === lid);
          if (lessonObj) {
            lessonObj.accessType = accessType;
            lessonObj.price = price;
          }
          catalogItems.push({
            lessonId: lid,
            title: lessonObj?.title || lid,
            course: getLessonCourse(lessonObj),
            accessType,
            price
          });
        });

        try {
          localStorage.setItem('linguapath_local_lesson_pricing', JSON.stringify(localMap));
          if (window.LinguaContentStore && typeof window.LinguaContentStore.saveLessonsSheets === 'function') {
            await window.LinguaContentStore.saveLessonsSheets({
              Lessons: allLessons,
              Exercises: allExercises,
              Writing: allWriting,
              Vocabulary: allVocabulary,
              Pronunciation: allPronunciation
            });
          }
        } catch (e) {}

        renderLessonGrid();

        const authState = window.LinguaAuth ? window.LinguaAuth.getState() : null;
        if (authState && authState.isAdmin && window.LinguaAuth.saveLessonCatalogItems) {
          savePricingBtn.disabled = true;
          savePricingBtn.textContent = 'Publishing…';
          try {
            await window.LinguaAuth.saveLessonCatalogItems(catalogItems);
            setExcelStatusBanner('Saved & published Free/Paid settings live to Excel & Database!', 'success');
            if (window.LinguaAuthUI) window.LinguaAuthUI.showToast('Lesson Free/Paid pricing synced to Excel & DB.');
          } catch (err) {
            setExcelStatusBanner('Saved locally, but server sync failed: ' + (err instanceof Error ? err.message : String(err)), 'error');
          } finally {
            savePricingBtn.disabled = false;
            savePricingBtn.textContent = '💾 Save Free / Paid Settings';
          }
        } else {
          setExcelStatusBanner(
            'Free/Paid settings applied on this browser. Sign in with your Admin account to publish them live for all learners.',
            'info'
          );
          if (window.LinguaAuthUI) window.LinguaAuthUI.showToast('Pricing saved locally.');
        }
      };
    }

    const resetBtn = document.getElementById('btnResetDefaultLessons');
    if (resetBtn) {
      resetBtn.onclick = async () => {
        localStorage.removeItem('linguapath_custom_lessons');
        localStorage.removeItem('linguapath_local_lesson_pricing');
        if (window.LinguaContentStore && typeof window.LinguaContentStore.clearDraft === 'function') {
          try {
            await window.LinguaContentStore.clearDraft('lessons');
          } catch (_) {}
        }
        setExcelStatusBanner('Local draft cleared. Reloading from Excel & Database…', 'info');
        setTimeout(() => window.location.reload(), 600);
      };
    }
  }

  // --- Export Lessons to Excel / CSV ---
  function exportLessonsToExcel(format = 'xlsx') {
    if (typeof XLSX === 'undefined') {
      setExcelStatusBanner('SheetJS library is still loading. Please try again in a moment.', 'error');
      return;
    }

    const rawLessonsList = loadedFromStoreOrRepo ? allLessons : (allLessons.length ? allLessons : FALLBACK_LESSONS);
    const exportLessonsList = rawLessonsList.map((l) => {
      const pricing = resolveLessonPricing(l);
      return {
        ...l,
        accessType: pricing.accessType,
        price: pricing.price
      };
    });
    const exportExercisesList = loadedFromStoreOrRepo ? allExercises : (allExercises.length ? allExercises : FALLBACK_EXERCISES);
    const exportWritingList = loadedFromStoreOrRepo ? allWriting : (allWriting.length ? allWriting : FALLBACK_WRITING);

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

    if (allPronunciation && allPronunciation.length) {
      const pronSheet = XLSX.utils.json_to_sheet(allPronunciation);
      XLSX.utils.book_append_sheet(wb, pronSheet, 'Pronunciation');
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
          setExcelStatusBanner('SheetJS library is not loaded.', 'error');
          return;
        }

        const workbook = XLSX.read(data, { type: 'array' });
        if (!workbook.SheetNames.includes('Lessons') && !workbook.SheetNames.length) {
          setExcelStatusBanner('Error: Uploaded file does not contain valid lesson data.', 'error');
          return;
        }

        const mainSheetName = workbook.SheetNames.includes('Lessons') ? 'Lessons' : workbook.SheetNames[0];
        const newLessons = XLSX.utils.sheet_to_json(workbook.Sheets[mainSheetName], { defval: '' });

        if (!newLessons.length) {
          setExcelStatusBanner('Error: Uploaded file contains 0 lesson rows.', 'error');
          return;
        }

        const newExercises = workbook.SheetNames.includes('Exercises') ? XLSX.utils.sheet_to_json(workbook.Sheets['Exercises'], { defval: '' }) : allExercises;
        const newWriting = workbook.SheetNames.includes('Writing') ? XLSX.utils.sheet_to_json(workbook.Sheets['Writing'], { defval: '' }) : allWriting;
        const newVocabulary = workbook.SheetNames.includes('Vocabulary') ? XLSX.utils.sheet_to_json(workbook.Sheets['Vocabulary'], { defval: '' }) : allVocabulary;
        const newPronunciation = workbook.SheetNames.includes('Pronunciation') ? XLSX.utils.sheet_to_json(workbook.Sheets['Pronunciation'], { defval: '' }) : allPronunciation;

        allLessons = newLessons.map((l) => {
          const p = resolveLessonPricing(l);
          return { ...l, accessType: p.accessType, price: p.price };
        });
        allExercises = newExercises;
        allWriting = newWriting;
        allVocabulary = newVocabulary;
        allPronunciation = newPronunciation;

        const customPayload = {
          sheets: {
            Lessons: allLessons,
            Exercises: allExercises,
            Writing: allWriting,
            Vocabulary: allVocabulary,
            Pronunciation: allPronunciation
          }
        };

        let syncOk = false;
        if (window.LinguaContentStore && typeof window.LinguaContentStore.saveLessonsSheets === 'function') {
          try {
            const syncRes = await window.LinguaContentStore.saveLessonsSheets({
              Lessons: allLessons,
              Exercises: allExercises,
              Writing: allWriting,
              Vocabulary: allVocabulary,
              Pronunciation: allPronunciation
            });
            syncOk = Boolean(syncRes && syncRes.syncedToServer);
          } catch (syncErr) {
            console.warn('Server workbook sync note:', syncErr);
          }
        }

        if (!syncOk) {
          localStorage.setItem('linguapath_custom_lessons', JSON.stringify(customPayload));
        }

        renderCourseSidebar();
        renderLessonGrid();
        renderContinueLessonBanner();
        renderExcelPricingTableRows();

        setExcelStatusBanner(
          `Imported ${allLessons.length} lessons from "${file.name}". Review Free / Paid status in Section 3 below and click "Save Free / Paid Settings".`,
          'success'
        );
        if (window.LinguaAuthUI) {
          window.LinguaAuthUI.showToast(`Imported ${allLessons.length} lessons.`);
        }
      } catch (err) {
        setExcelStatusBanner('Failed to parse file: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  // --- Deep Linking Handler ---
  function handleUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const courseParam = params.get('course') || params.get('category');
    const lessonParam = params.get('lesson');
    const managePricingParam = params.get('managePricing');

    const courses = computeCoursesList();
    let targetLessonObj = null;

    if (lessonParam) {
      targetLessonObj = allLessons.find(
        (l) => String(l.id || '').trim().toLowerCase() === String(lessonParam).trim().toLowerCase()
      );
    }

    if (targetLessonObj) {
      activeCourseName = getLessonCourse(targetLessonObj);
    } else if (courseParam) {
      const matchedCourse = courses.find((c) => courseKeySlug(c) === courseKeySlug(courseParam));
      activeCourseName = matchedCourse || courses[0] || 'HSK 2';
    } else {
      activeCourseName = courses[0] || 'HSK 2';
    }

    renderCourseSidebar();
    renderLessonGrid();
    renderContinueLessonBanner();

    if (managePricingParam === '1') {
      openExcelManagerModal();
    }

    if (lessonParam) {
      openLessonWorkspace(lessonParam, false);
    }
  }

  // --- Initialization ---
  async function init() {
    setupWorkspaceTabs();
    await loadLessonsWorkbook();
    handleUrlParams();

    window.addEventListener('lingua-auth-change', (e) => {
      const authState = e?.detail;
      renderCourseSidebar();
      renderLessonGrid();
      if (pendingDeepLinkLessonId && authState && authState.ready) {
        const lid = pendingDeepLinkLessonId;
        pendingDeepLinkLessonId = null;
        openLessonWorkspace(lid, false);
      }
    });

    window.addEventListener('lingua-site-config-change', () => {
      renderCourseSidebar();
      renderLessonGrid();
    });

    window.addEventListener('popstate', () => {
      handleUrlParams();
    });

    window.addEventListener('linguapath-content-change', (e) => {
      if (e?.detail?.domain === 'lessons' && e?.detail?.sheets) {
        if (Array.isArray(e.detail.sheets.Lessons)) allLessons = e.detail.sheets.Lessons.map(normalizeLessonRow);
        if (Array.isArray(e.detail.sheets.Writing)) allWriting = e.detail.sheets.Writing.map(normalizeWritingRow);
        if (Array.isArray(e.detail.sheets.Vocabulary)) allVocabulary = e.detail.sheets.Vocabulary.map(normalizeVocabularyRow);
        if (Array.isArray(e.detail.sheets.Pronunciation)) allPronunciation = e.detail.sheets.Pronunciation.map(normalizePronunciationRow);
        if (Array.isArray(e.detail.sheets.Exercises)) allExercises = e.detail.sheets.Exercises.map(normalizeExerciseRow);
        renderCourseSidebar();
        renderLessonGrid();
        if (activeLesson) {
          const fresh = allLessons.find(l => isSameLessonId(l.id, activeLesson.id));
          if (fresh) activeLesson = fresh;
          const allowVideo = applyWorkspaceVideoTabVisibility(activeLesson);
          renderWorkspaceHeader(activeLesson);
          renderVideoSection(activeLesson);
          renderExercisesSection(activeLesson);
          renderWritingSection(activeLesson);
          renderPronunciationSection(activeLesson);
          if (!allowVideo && activeWorkspaceTab === 'video') {
            switchWorkspaceTab('exercises');
          }
        }
      }
    });
  }

  // Expose global controller
  window.LinguaLessons = {
    init,
    switchCourse,
    switchCategory: switchCourse,
    getAllCourses: computeCoursesList,
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
