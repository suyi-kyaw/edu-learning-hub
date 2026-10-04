const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const lessons = [
  // ADULT - CATEGORY 1: Beginner & Everyday Basics
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
    fullAudio: "assets/audio/lesson-01-full.mp3",
    keywords: "Greetings, Hello, Morning, Politeness, 早上好, 您好, 谢谢, 不客气"
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
    fullAudio: "assets/audio/lesson-02-full.mp3",
    keywords: "Introduction, Name, Numbers, Country, 我叫, 认识你, 电话, 数字"
  },

  // ADULT - CATEGORY 2: Travel & Daily Life
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
    fullAudio: "assets/audio/lesson-01-full.mp3",
    keywords: "Restaurant, Menu, Spicy, Bill, 点餐, 菜单, 买单, 好吃"
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
    fullAudio: "assets/audio/lesson-02-full.mp3",
    keywords: "Directions, Metro, Taxi, Station, 问路, 地铁, 往左, 往右"
  },

  // ADULT - CATEGORY 3: Business & Workplace
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
    fullAudio: "assets/audio/lesson-01-full.mp3",
    keywords: "Business, Etiquette, Business Card, Cooperation, 名片, 合作, 经理, 幸会"
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
    fullAudio: "assets/audio/lesson-02-full.mp3",
    keywords: "Email, Meeting, Schedule, Confirm, 邮件, 开会, 安排, 确认"
  },

  // KIDS - CATEGORY 1: Fun with Pinyin & Tones
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
    fullAudio: "assets/audio/lesson-01-full.mp3",
    keywords: "Pinyin, Tones, Vowels, Music, 拼音, 声调, 妈妈, 快乐"
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
    fullAudio: "assets/audio/lesson-02-full.mp3",
    keywords: "Consonants, Animals, Panda, Sounds, 爸爸, 大, 小, 熊猫"
  },

  // KIDS - CATEGORY 2: Colors, Animals & Family
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
    fullAudio: "assets/audio/lesson-01-full.mp3",
    keywords: "Colors, Rainbow, Animals, Puppy, 红色, 黄色, 小狗, 小猫, 鸟"
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
    fullAudio: "assets/audio/lesson-02-full.mp3",
    keywords: "Family, Love, Grandpa, Grandma, 爷爷, 奶奶, 爸爸, 妈妈, 我爱我家"
  },

  // KIDS - CATEGORY 3: Nursery Rhymes & Short Stories
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
    fullAudio: "assets/audio/lesson-01-full.mp3",
    keywords: "Nursery Rhyme, Song, Tiger, Fast, 两只老虎, 跑得快, 尾巴, 歌谣"
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
    fullAudio: "assets/audio/lesson-02-full.mp3",
    keywords: "Story, Rabbit, Teamwork, Radish, 小白兔, 拔萝卜, 朋友, 一起"
  }
];

const exercises = [
  // adult-basics-01
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
  },
  {
    lessonId: "adult-basics-01",
    order: 4,
    type: "multiple-choice",
    question: "According to the 3rd Tone Sandhi rule, how is '你好' (nǐ hǎo) pronounced in actual speech?",
    optionA: "Two dipping 3rd tones",
    optionB: "First tone rises (ní) + second remains dipping (hǎo)",
    optionC: "Both become 1st tone",
    optionD: "Both become 4th tone",
    answer: "First tone rises (ní) + second remains dipping (hǎo)",
    explanation: "When two 3rd tones occur back-to-back, the first shifts to a rising 2nd tone: Ní hǎo."
  },

  // adult-basics-02
  {
    lessonId: "adult-basics-02",
    order: 1,
    type: "multiple-choice",
    question: "Which phrase is the most natural way to introduce your name in Chinese?",
    optionA: "我叫... (Wǒ jiào...)",
    optionB: "我吃... (Wǒ chī...)",
    optionC: "我有... (Wǒ yǒu...)",
    optionD: "我去... (Wǒ qù...)",
    answer: "我叫... (Wǒ jiào...)",
    explanation: "我叫 (Wǒ jiào + Name) means 'My name is / I am called'."
  },
  {
    lessonId: "adult-basics-02",
    order: 2,
    type: "fill-blank",
    question: "Complete the sentence: 我___中国人。(I am Chinese)",
    optionA: "是",
    optionB: "在",
    optionC: "有",
    optionD: "叫",
    answer: "是",
    explanation: "是 (shì) functions as the linking verb 'to be' (am/is/are)."
  },
  {
    lessonId: "adult-basics-02",
    order: 3,
    type: "multiple-choice",
    question: "How do you write the number 88 in Chinese characters?",
    optionA: "八十八 (Bāshíbā)",
    optionB: "八八 (Bābā)",
    optionC: "十八 (Shíbā)",
    optionD: "八十 (Bāshí)",
    answer: "八十八 (Bāshíbā)",
    explanation: "88 is structured as 8 (八) × 10 (十) + 8 (八) = 八十八."
  },

  // adult-travel-01
  {
    lessonId: "adult-travel-01",
    order: 1,
    type: "multiple-choice",
    question: "How do you ask for the restaurant bill in Chinese?",
    optionA: "买单 (Mǎidān)",
    optionB: "点菜 (Diǎncài)",
    optionC: "菜单 (Càidān)",
    optionD: "倒水 (Dàoshuǐ)",
    answer: "买单 (Mǎidān)",
    explanation: "买单 (mǎidān) or 结账 (jiézhàng) is the standard request to pay the restaurant check."
  },
  {
    lessonId: "adult-travel-01",
    order: 2,
    type: "multiple-choice",
    question: "What does '我不吃辣' (Wǒ bù chī là) mean?",
    optionA: "I don't eat spicy food",
    optionB: "I love chili peppers",
    optionC: "Make it extra spicy please",
    optionD: "Is this food hot?",
    answer: "I don't eat spicy food",
    explanation: "不 (not) + 吃 (eat) + 辣 (spicy) clearly informs servers of non-spicy preferences."
  },
  {
    lessonId: "adult-travel-01",
    order: 3,
    type: "fill-blank",
    question: "Fill in the blank: 请给我一份___。(Please give me a menu)",
    optionA: "菜单",
    optionB: "手机",
    optionC: "桌子",
    optionD: "护照",
    answer: "菜单",
    explanation: "菜单 (càidān) means menu."
  },

  // adult-travel-02
  {
    lessonId: "adult-travel-02",
    order: 1,
    type: "multiple-choice",
    question: "How do you ask 'Where is the subway station?'",
    optionA: "地铁站在哪儿？ (Dìtiě zhàn zài nǎr?)",
    optionB: "地铁多少钱？ (Dìtiě duōshao qián?)",
    optionC: "这是地铁吗？ (Zhè shì dìtiě ma?)",
    optionD: "地铁快吗？ (Dìtiě kuài ma?)",
    answer: "地铁站在哪儿？ (Dìtiě zhàn zài nǎr?)",
    explanation: "在哪儿 (zài nǎr) means 'where is'."
  },
  {
    lessonId: "adult-travel-02",
    order: 2,
    type: "multiple-choice",
    question: "What does '往右拐' (wǎng yòu guǎi) mean?",
    optionA: "Turn right",
    optionB: "Turn left",
    optionC: "Go straight ahead",
    optionD: "Stop here",
    answer: "Turn right",
    explanation: "往 (toward) + 右 (right) + 拐 (turn) means 'turn right'."
  },

  // adult-business-01
  {
    lessonId: "adult-business-01",
    order: 1,
    type: "multiple-choice",
    question: "In Chinese business etiquette, how should you present and receive a business card (名片)?",
    optionA: "Hold with both hands and review with interest",
    optionB: "Take with one hand and put in pocket immediately",
    optionC: "Fold it in half to fit in your wallet",
    optionD: "Write notes on the front immediately",
    answer: "Hold with both hands and review with interest",
    explanation: "Holding with both hands (双手递接) demonstrates respect and professional sincerity."
  },
  {
    lessonId: "adult-business-01",
    order: 2,
    type: "multiple-choice",
    question: "What is an elegant, formal greeting for meeting a new business partner?",
    optionA: "幸会幸会！ (Xìnghuì xìnghuì!)",
    optionB: "喂，你好！ (Wèi, nǐ hǎo!)",
    optionC: "拜拜！ (Báibái!)",
    optionD: "吃了吗？ (Chī le ma?)",
    answer: "幸会幸会！ (Xìnghuì xìnghuì!)",
    explanation: "幸会 (xìnghuì) is an elevated business expression meaning 'Honored to meet you'."
  },
  {
    lessonId: "adult-business-01",
    order: 3,
    type: "fill-blank",
    question: "Fill in: 这是我的___，请多指教。(This is my business card, please advise)",
    optionA: "名片",
    optionB: "发票",
    optionC: "合同",
    optionD: "手机",
    answer: "名片",
    explanation: "名片 (míngpiàn) means business card."
  },

  // adult-business-02
  {
    lessonId: "adult-business-02",
    order: 1,
    type: "multiple-choice",
    question: "What is the standard formal opening for a business email in Chinese?",
    optionA: "尊敬的 [Name] [Title] 您好：",
    optionB: "嗨，在吗？",
    optionC: "收到请回复：",
    optionD: "哈哈你好：",
    answer: "尊敬的 [Name] [Title] 您好：",
    explanation: "尊敬的 (Respected / Esteemed) + Name/Title + 您好 is the standard professional salutation."
  },
  {
    lessonId: "adult-business-02",
    order: 2,
    type: "multiple-choice",
    question: "What does '开会' (kāihuì) mean?",
    optionA: "To hold or attend a meeting",
    optionB: "To open an email",
    optionC: "To sign a contract",
    optionD: "To leave for lunch",
    answer: "To hold or attend a meeting",
    explanation: "开会 (kāi huì) means to hold or conduct a meeting."
  },

  // kids-pinyin-01
  {
    lessonId: "kids-pinyin-01",
    order: 1,
    type: "multiple-choice",
    question: "Which tone goes UP like hiking a hill: mā -> má?",
    optionA: "2nd Tone (Rising / ˊ)",
    optionB: "1st Tone (High Flat / ¯)",
    optionC: "4th Tone (Falling / ˋ)",
    optionD: "3rd Tone (Dipping / ˇ)",
    answer: "2nd Tone (Rising / ˊ)",
    explanation: "The 2nd tone rises upward from middle to high pitch: Má!"
  },
  {
    lessonId: "kids-pinyin-01",
    order: 2,
    type: "multiple-choice",
    question: "How does the Chinese pinyin vowel 'o' sound?",
    optionA: "Round like 'oh!' (rooster crowing)",
    optionB: "Wide like 'ah!' at the dentist",
    optionC: "Smiling like 'ee!' in cheese",
    optionD: "Blowing like 'oo!' in moon",
    answer: "Round like 'oh!' (rooster crowing)",
    explanation: "Pinyin 'o' makes a pure rounded 'oh' vowel sound."
  },
  {
    lessonId: "kids-pinyin-01",
    order: 3,
    type: "fill-blank",
    question: "Fill in the tone mark for 'Mother' (mā): m___",
    optionA: "ā",
    optionB: "á",
    optionC: "ǎ",
    optionD: "à",
    answer: "ā",
    explanation: "Mā (1st high flat tone) means Mom / Mother."
  },

  // kids-pinyin-02
  {
    lessonId: "kids-pinyin-02",
    order: 1,
    type: "multiple-choice",
    question: "What is the initial sound of '爸爸' (Bàba)?",
    optionA: "b",
    optionB: "p",
    optionC: "m",
    optionD: "f",
    answer: "b",
    explanation: "爸爸 (Bàba) begins with the unaspirated 'b' consonant initial."
  },
  {
    lessonId: "kids-pinyin-02",
    order: 2,
    type: "multiple-choice",
    question: "What does '大' (dà) mean in Chinese?",
    optionA: "Big 🐘",
    optionB: "Small 🐜",
    optionC: "Fast 🐆",
    optionD: "Happy 🐼",
    answer: "Big 🐘",
    explanation: "大 (dà) means big or large."
  },

  // kids-colors-01
  {
    lessonId: "kids-colors-01",
    order: 1,
    type: "multiple-choice",
    question: "What color is '红色' (Hóngsè)?",
    optionA: "Red 🔴",
    optionB: "Blue 🔵",
    optionC: "Yellow 🟡",
    optionD: "Green 🟢",
    answer: "Red 🔴",
    explanation: "红色 (hóngsè) is the color red, a traditional symbol of happiness in China!"
  },
  {
    lessonId: "kids-colors-01",
    order: 2,
    type: "multiple-choice",
    question: "Which animal says 'wāng wāng' and is called '小狗' (Xiǎogǒu)?",
    optionA: "Puppy / Dog 🐶",
    optionB: "Kitten / Cat 🐱",
    optionC: "Bird 🐦",
    optionD: "Fish 🐟",
    answer: "Puppy / Dog 🐶",
    explanation: "小狗 (xiǎogǒu) means puppy or dog."
  },
  {
    lessonId: "kids-colors-01",
    order: 3,
    type: "fill-blank",
    question: "Complete: 天空是___色的。(The sky is blue)",
    optionA: "蓝",
    optionB: "红",
    optionC: "黑",
    optionD: "绿",
    answer: "蓝",
    explanation: "蓝色 (lánsè) means blue."
  },

  // kids-family-01
  {
    lessonId: "kids-family-01",
    order: 1,
    type: "multiple-choice",
    question: "How do you call your grandfather (paternal grandpa) in Chinese?",
    optionA: "爷爷 (Yéye)",
    optionB: "奶奶 (Nǎinai)",
    optionC: "哥哥 (Gēge)",
    optionD: "叔叔 (Shūshu)",
    answer: "爷爷 (Yéye)",
    explanation: "爷爷 (yéye) is the affectionate term for grandpa."
  },
  {
    lessonId: "kids-family-01",
    order: 2,
    type: "multiple-choice",
    question: "What does '我爱我家' (Wǒ ài wǒ jiā) mean?",
    optionA: "I love my family and home ❤️",
    optionB: "I want to go home",
    optionC: "Where is my house?",
    optionD: "My family is big",
    answer: "I love my family and home ❤️",
    explanation: "爱 (ài) = love, 我家 (wǒ jiā) = my family/home."
  },

  // kids-rhymes-01
  {
    lessonId: "kids-rhymes-01",
    order: 1,
    type: "multiple-choice",
    question: "In the song '两只老虎', what are the two tigers doing?",
    optionA: "跑得快！ (Running fast!)",
    optionB: "睡觉呢！ (Sleeping!)",
    optionC: "吃苹果！ (Eating apples!)",
    optionD: "学游泳！ (Swimming!)",
    answer: "跑得快！ (Running fast!)",
    explanation: "The famous lyrics sing: '两只老虎，两只老虎，跑得快，跑得快！'"
  },
  {
    lessonId: "kids-rhymes-01",
    order: 2,
    type: "multiple-choice",
    question: "What body part is '耳朵' (ěrduo)?",
    optionA: "Ears 👂",
    optionB: "Eyes 👀",
    optionC: "Tail 🐅",
    optionD: "Nose 👃",
    answer: "Ears 👂",
    explanation: "耳朵 (ěrduo) means ears."
  },
  {
    lessonId: "kids-rhymes-01",
    order: 3,
    type: "fill-blank",
    question: "Complete the lyric: 一只没有___，真奇怪！(One has no tail)",
    optionA: "尾巴",
    optionB: "牙齿",
    optionC: "眼睛",
    optionD: "衣服",
    answer: "尾巴",
    explanation: "尾巴 (wěiba) means tail."
  },

  // kids-rhymes-02
  {
    lessonId: "kids-rhymes-02",
    order: 1,
    type: "multiple-choice",
    question: "What vegetable does Little White Rabbit pull up in the story?",
    optionA: "大萝卜 (Big sweet radish) 🥕",
    optionB: "红苹果 (Red apple) 🍎",
    optionC: "绿西瓜 (Green watermelon) 🍉",
    optionD: "黄香蕉 (Yellow banana) 🍌",
    answer: "大萝卜 (Big sweet radish) 🥕",
    explanation: "拔萝卜 (Bá luóbo) is the classic tale of pulling the big radish."
  },
  {
    lessonId: "kids-rhymes-02",
    order: 2,
    type: "multiple-choice",
    question: "What does '小白兔' (Xiǎo bái tù) mean?",
    optionA: "Little White Rabbit 🐰",
    optionB: "Little Brown Bear 🐻",
    optionC: "Little Duckling 🐥",
    optionD: "Little Dragon 🐲",
    answer: "Little White Rabbit 🐰",
    explanation: "小 (little) + 白 (white) + 兔 (rabbit) = Little White Rabbit."
  }
];

const writing = [
  // adult-basics-01
  {
    lessonId: "adult-basics-01",
    order: 1,
    character: "早",
    pinyin: "zǎo",
    meaning: "morning / early",
    strokeCount: 6,
    radical: "日 (Sun)",
    strokeAnimationUrl: "https://raw.githubusercontent.com/skishore/makemeahanzi/master/svgs/26089.svg",
    svgPath: "M20 20 L80 20 L80 50 L20 50 Z M20 35 L80 35 M50 20 L50 90",
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
    strokeAnimationUrl: "https://raw.githubusercontent.com/skishore/makemeahanzi/master/svgs/22909.svg",
    svgPath: "M30 20 L20 50 L45 50 M15 35 L45 35 M60 20 L60 80 M48 40 L72 40",
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
    strokeAnimationUrl: "https://raw.githubusercontent.com/skishore/makemeahanzi/master/svgs/24744.svg",
    svgPath: "M25 20 L25 80 M50 20 L50 80",
    strokeOrderSteps: "1. Slant (ノ), 2. Vertical (丨), 3. Slant (ノ), 4. Horizontal-hook (𠃍), 5. Vertical (丨), 6. Left dot (丶), 7. Right dot (丶), 8. Heart dot (丶), 9. Heart curve (㇃), 10. Inner dot (丶), 11. Outer dot (丶)"
  },

  // adult-basics-02
  {
    lessonId: "adult-basics-02",
    order: 1,
    character: "我",
    pinyin: "wǒ",
    meaning: "I / me",
    strokeCount: 7,
    radical: "戈 (Halberd)",
    strokeAnimationUrl: "",
    svgPath: "",
    strokeOrderSteps: "1. Top slant (丿), 2. Horizontal (一), 3. Vertical hook (亅), 4. Rising slash (㇀), 5. Slanted hook (㇂), 6. Top dot (丶), 7. Inner slant (丿)"
  },
  {
    lessonId: "adult-basics-02",
    order: 2,
    character: "叫",
    pinyin: "jiào",
    meaning: "to call / to be called",
    strokeCount: 5,
    radical: "口 (Mouth)",
    strokeAnimationUrl: "",
    svgPath: "",
    strokeOrderSteps: "1. Left vertical (丨), 2. Horizontal-turn (𠃍), 3. Bottom horizontal (一), 4. Left slant (丿), 5. Vertical hook (亅)"
  },
  {
    lessonId: "adult-basics-02",
    order: 3,
    character: "是",
    pinyin: "shì",
    meaning: "to be / yes",
    strokeCount: 9,
    radical: "日 (Sun)",
    strokeAnimationUrl: "",
    svgPath: "",
    strokeOrderSteps: "1. Vertical (丨), 2. Horizontal-turn (𠃍), 3. Horizontal (一), 4. Horizontal close (一), 5. Middle horizontal (一), 6. Vertical (丨), 7. Horizontal (一), 8. Left slant (丿), 9. Right slant (乀)"
  },

  // adult-travel-01
  {
    lessonId: "adult-travel-01",
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
    lessonId: "adult-travel-01",
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

  // adult-travel-02
  {
    lessonId: "adult-travel-02",
    order: 1,
    character: "左",
    pinyin: "zuǒ",
    meaning: "left",
    strokeCount: 5,
    radical: "工 (Work)",
    strokeAnimationUrl: "",
    svgPath: "",
    strokeOrderSteps: "1. Horizontal (一), 2. Left slant (丿), 3. Horizontal (一), 4. Vertical (丨), 5. Horizontal (一)"
  },
  {
    lessonId: "adult-travel-02",
    order: 2,
    character: "右",
    pinyin: "yòu",
    meaning: "right",
    strokeCount: 5,
    radical: "口 (Mouth)",
    strokeAnimationUrl: "",
    svgPath: "",
    strokeOrderSteps: "1. Horizontal (一), 2. Left slant (丿), 3. Vertical (丨), 4. Horizontal-turn (𠃍), 5. Horizontal (一)"
  },

  // adult-business-01
  {
    lessonId: "adult-business-01",
    order: 1,
    character: "名",
    pinyin: "míng",
    meaning: "name / famous",
    strokeCount: 6,
    radical: "口 (Mouth)",
    strokeAnimationUrl: "",
    svgPath: "",
    strokeOrderSteps: "1. Slant (丿), 2. Horizontal-turn (㇇), 3. Dot (丶), 4. Vertical (丨), 5. Horizontal-turn (𠃍), 6. Horizontal (一)"
  },
  {
    lessonId: "adult-business-01",
    order: 2,
    character: "片",
    pinyin: "piàn",
    meaning: "card / slice / piece",
    strokeCount: 4,
    radical: "片 (Slice)",
    strokeAnimationUrl: "",
    svgPath: "",
    strokeOrderSteps: "1. Top slant (丿), 2. Vertical (丨), 3. Horizontal (一), 4. Horizontal-fold-hook (𠃍)"
  },

  // adult-business-02
  {
    lessonId: "adult-business-02",
    order: 1,
    character: "开",
    pinyin: "kāi",
    meaning: "open / hold meeting",
    strokeCount: 4,
    radical: "廾 (Two Hands)",
    strokeAnimationUrl: "",
    svgPath: "",
    strokeOrderSteps: "1. Top horizontal (一), 2. Bottom horizontal (一), 3. Left vertical (丨), 4. Right vertical (丨)"
  },
  {
    lessonId: "adult-business-02",
    order: 2,
    character: "会",
    pinyin: "huì",
    meaning: "meeting / can",
    strokeCount: 6,
    radical: "人 (Person)",
    strokeAnimationUrl: "",
    svgPath: "",
    strokeOrderSteps: "1. Slant (丿), 2. Press (乀), 3. Horizontal (一), 4. Horizontal (一), 5. Turning stroke (ㄥ), 6. Dot (丶)"
  },

  // kids-pinyin-01
  {
    lessonId: "kids-pinyin-01",
    order: 1,
    character: "一",
    pinyin: "yī",
    meaning: "one",
    strokeCount: 1,
    radical: "一",
    strokeAnimationUrl: "",
    svgPath: "",
    strokeOrderSteps: "1. Single smooth horizontal line from left to right (一)"
  },
  {
    lessonId: "kids-pinyin-01",
    order: 2,
    character: "二",
    pinyin: "èr",
    meaning: "two",
    strokeCount: 2,
    radical: "二",
    strokeAnimationUrl: "",
    svgPath: "",
    strokeOrderSteps: "1. Shorter top horizontal (一), 2. Longer bottom horizontal (一)"
  },
  {
    lessonId: "kids-pinyin-01",
    order: 3,
    character: "三",
    pinyin: "sān",
    meaning: "three",
    strokeCount: 3,
    radical: "一",
    strokeAnimationUrl: "",
    svgPath: "",
    strokeOrderSteps: "1. Top horizontal (一), 2. Middle shorter horizontal (一), 3. Bottom longest horizontal (一)"
  },

  // kids-pinyin-02
  {
    lessonId: "kids-pinyin-02",
    order: 1,
    character: "大",
    pinyin: "dà",
    meaning: "big / tall",
    strokeCount: 3,
    radical: "大 (Big)",
    strokeAnimationUrl: "",
    svgPath: "",
    strokeOrderSteps: "1. Wide horizontal (一), 2. Center downward left slant (丿), 3. Right sweeping press (乀)"
  },
  {
    lessonId: "kids-pinyin-02",
    order: 2,
    character: "小",
    pinyin: "xiǎo",
    meaning: "small / little",
    strokeCount: 3,
    radical: "小 (Small)",
    strokeAnimationUrl: "",
    svgPath: "",
    strokeOrderSteps: "1. Center vertical hook (亅), 2. Left side dot (丶), 3. Right side slant (丿)"
  },

  // kids-colors-01
  {
    lessonId: "kids-colors-01",
    order: 1,
    character: "红",
    pinyin: "hóng",
    meaning: "red",
    strokeCount: 6,
    radical: "纟 (Silk)",
    strokeAnimationUrl: "",
    svgPath: "",
    strokeOrderSteps: "1. Silk fold (ㄥ), 2. Silk fold (ㄥ), 3. Rising dot (㇀), 4. Horizontal (一), 5. Vertical (丨), 6. Horizontal (一)"
  },
  {
    lessonId: "kids-colors-01",
    order: 2,
    character: "白",
    pinyin: "bái",
    meaning: "white",
    strokeCount: 5,
    radical: "白 (White)",
    strokeAnimationUrl: "",
    svgPath: "",
    strokeOrderSteps: "1. Top slant (丿), 2. Left vertical (丨), 3. Horizontal-turn (𠃍), 4. Middle horizontal (一), 5. Bottom horizontal (一)"
  },

  // kids-family-01
  {
    lessonId: "kids-family-01",
    order: 1,
    character: "人",
    pinyin: "rén",
    meaning: "person / people",
    strokeCount: 2,
    radical: "人 (Person)",
    strokeAnimationUrl: "",
    svgPath: "",
    strokeOrderSteps: "1. Left downward slant (丿), 2. Right downward press (乀)"
  },
  {
    lessonId: "kids-family-01",
    order: 2,
    character: "家",
    pinyin: "jiā",
    meaning: "family / home",
    strokeCount: 10,
    radical: "宀 (Roof)",
    strokeAnimationUrl: "",
    svgPath: "",
    strokeOrderSteps: "1. Top roof dot (丶), 2. Left roof dot (丶), 3. Roof hook (乛), 4. Horizontal (一), 5. Left slant (丿), 6. Curved hook (㇁), 7. Slant (丿), 8. Slant (丿), 9. Slant (丿), 10. Press (乀)"
  },

  // kids-rhymes-01
  {
    lessonId: "kids-rhymes-01",
    order: 1,
    character: "虎",
    pinyin: "hǔ",
    meaning: "tiger",
    strokeCount: 8,
    radical: "虍 (Tiger)",
    strokeAnimationUrl: "",
    svgPath: "",
    strokeOrderSteps: "1. Vertical (丨), 2. Horizontal (一), 3. Hook (乛), 4. Slant (丿), 5. Horizontal (一), 6. Vertical hook (亅), 7. Slant (丿), 8. Curved hook (乚)"
  },
  {
    lessonId: "kids-rhymes-01",
    order: 2,
    character: "快",
    pinyin: "kuài",
    meaning: "fast / quick",
    strokeCount: 7,
    radical: "忄 (Heart)",
    strokeAnimationUrl: "",
    svgPath: "",
    strokeOrderSteps: "1. Left heart dot (丶), 2. Right heart dot (丶), 3. Heart vertical (丨), 4. Horizontal (一), 5. Horizontal-turn (𠃍), 6. Left slant (丿), 7. Right press (乀)"
  },

  // kids-rhymes-02
  {
    lessonId: "kids-rhymes-02",
    order: 1,
    character: "山",
    pinyin: "shān",
    meaning: "mountain",
    strokeCount: 3,
    radical: "山 (Mountain)",
    strokeAnimationUrl: "",
    svgPath: "",
    strokeOrderSteps: "1. Center vertical (丨), 2. Left vertical-horizontal (𠄌), 3. Right vertical (丨)"
  },
  {
    lessonId: "kids-rhymes-02",
    order: 2,
    character: "友",
    pinyin: "yǒu",
    meaning: "friend",
    strokeCount: 4,
    radical: "又 (Again)",
    strokeAnimationUrl: "",
    svgPath: "",
    strokeOrderSteps: "1. Top horizontal (一), 2. Long left slant (丿), 3. Horizontal-turn (㇇), 4. Right press (乀)"
  }
];

const vocabulary = [
  // adult-basics-01
  { lessonId: "adult-basics-01", order: 1, character: "早上好", pinyin: "zǎoshang hǎo", meaning: "good morning", audio: "assets/audio/zaoshang.mp3" },
  { lessonId: "adult-basics-01", order: 2, character: "您好", pinyin: "nín hǎo", meaning: "hello (polite)", audio: "assets/audio/zaoshang.mp3" },
  { lessonId: "adult-basics-01", order: 3, character: "谢谢", pinyin: "xièxie", meaning: "thank you", audio: "assets/audio/zaoshang.mp3" },
  { lessonId: "adult-basics-01", order: 4, character: "不客气", pinyin: "bú kèqi", meaning: "you're welcome", audio: "assets/audio/zaoshang.mp3" },

  // adult-basics-02
  { lessonId: "adult-basics-02", order: 1, character: "我叫", pinyin: "wǒ jiào", meaning: "my name is", audio: "assets/audio/zaoshang.mp3" },
  { lessonId: "adult-basics-02", order: 2, character: "认识你", pinyin: "rènshi nǐ", meaning: "pleased to meet you", audio: "assets/audio/zaoshang.mp3" },
  { lessonId: "adult-basics-02", order: 3, character: "很高兴", pinyin: "hěn gāoxìng", meaning: "very happy", audio: "assets/audio/kaixin.mp3" },
  { lessonId: "adult-basics-02", order: 4, character: "数字", pinyin: "shùzì", meaning: "number", audio: "assets/audio/zaoshang.mp3" },

  // adult-travel-01
  { lessonId: "adult-travel-01", order: 1, character: "菜单", pinyin: "càidān", meaning: "menu", audio: "assets/audio/shichang.mp3" },
  { lessonId: "adult-travel-01", order: 2, character: "点菜", pinyin: "diǎncài", meaning: "to order food", audio: "assets/audio/shichang.mp3" },
  { lessonId: "adult-travel-01", order: 3, character: "服务员", pinyin: "fúwùyuán", meaning: "waiter / server", audio: "assets/audio/shichang.mp3" },
  { lessonId: "adult-travel-01", order: 4, character: "买单", pinyin: "mǎidān", meaning: "pay the bill", audio: "assets/audio/shichang.mp3" },

  // adult-travel-02
  { lessonId: "adult-travel-02", order: 1, character: "地铁站", pinyin: "dìtiě zhàn", meaning: "subway station", audio: "assets/audio/xuexiao.mp3" },
  { lessonId: "adult-travel-02", order: 2, character: "往右拐", pinyin: "wǎng yòu guǎi", meaning: "turn right", audio: "assets/audio/xuexiao.mp3" },
  { lessonId: "adult-travel-02", order: 3, character: "直走", pinyin: "zhí zǒu", meaning: "go straight", audio: "assets/audio/xuexiao.mp3" },

  // adult-business-01
  { lessonId: "adult-business-01", order: 1, character: "名片", pinyin: "míngpiàn", meaning: "business card", audio: "assets/audio/zaoshang.mp3" },
  { lessonId: "adult-business-01", order: 2, character: "合作", pinyin: "hézuò", meaning: "cooperation / collaborate", audio: "assets/audio/zaoshang.mp3" },
  { lessonId: "adult-business-01", order: 3, character: "经理", pinyin: "jīnglǐ", meaning: "manager", audio: "assets/audio/zaoshang.mp3" },

  // adult-business-02
  { lessonId: "adult-business-02", order: 1, character: "开会", pinyin: "kāihuì", meaning: "hold a meeting", audio: "assets/audio/zaoshang.mp3" },
  { lessonId: "adult-business-02", order: 2, character: "邮件", pinyin: "yóujiàn", meaning: "email", audio: "assets/audio/zaoshang.mp3" },
  { lessonId: "adult-business-02", order: 3, character: "安排", pinyin: "ānpái", meaning: "schedule / arrangement", audio: "assets/audio/zaoshang.mp3" },

  // kids-pinyin-01
  { lessonId: "kids-pinyin-01", order: 1, character: "妈妈", pinyin: "māma", meaning: "mother", audio: "assets/audio/zaoshang.mp3" },
  { lessonId: "kids-pinyin-01", order: 2, character: "一二三", pinyin: "yī èr sān", meaning: "one, two, three", audio: "assets/audio/zaoshang.mp3" },
  { lessonId: "kids-pinyin-01", order: 3, character: "声调", pinyin: "shēngdiào", meaning: "tones", audio: "assets/audio/zaoshang.mp3" },

  // kids-pinyin-02
  { lessonId: "kids-pinyin-02", order: 1, character: "爸爸", pinyin: "bàba", meaning: "dad / father", audio: "assets/audio/zaoshang.mp3" },
  { lessonId: "kids-pinyin-02", order: 2, character: "大熊猫", pinyin: "dà xióngmāo", meaning: "giant panda", audio: "assets/audio/kaixin.mp3" },

  // kids-colors-01
  { lessonId: "kids-colors-01", order: 1, character: "红色", pinyin: "hóngsè", meaning: "red", audio: "assets/audio/pingguo.mp3" },
  { lessonId: "kids-colors-01", order: 2, character: "小狗", pinyin: "xiǎogǒu", meaning: "puppy", audio: "assets/audio/shuiguo.mp3" },
  { lessonId: "kids-colors-01", order: 3, character: "小猫", pinyin: "xiǎomāo", meaning: "kitten", audio: "assets/audio/shuiguo.mp3" },

  // kids-family-01
  { lessonId: "kids-family-01", order: 1, character: "爷爷", pinyin: "yéye", meaning: "grandpa", audio: "assets/audio/zaoshang.mp3" },
  { lessonId: "kids-family-01", order: 2, character: "奶奶", pinyin: "nǎinai", meaning: "grandma", audio: "assets/audio/zaoshang.mp3" },
  { lessonId: "kids-family-01", order: 3, character: "我爱我家", pinyin: "wǒ ài wǒ jiā", meaning: "I love my family", audio: "assets/audio/kaixin.mp3" },

  // kids-rhymes-01
  { lessonId: "kids-rhymes-01", order: 1, character: "两只老虎", pinyin: "liǎng zhī lǎohǔ", meaning: "two tigers", audio: "assets/audio/kaixin.mp3" },
  { lessonId: "kids-rhymes-01", order: 2, character: "跑得快", pinyin: "pǎo de kuài", meaning: "running fast", audio: "assets/audio/kaixin.mp3" },
  { lessonId: "kids-rhymes-01", order: 3, character: "尾巴", pinyin: "wěiba", meaning: "tail", audio: "assets/audio/kaixin.mp3" },

  // kids-rhymes-02
  { lessonId: "kids-rhymes-02", order: 1, character: "小白兔", pinyin: "xiǎo bái tù", meaning: "little white rabbit", audio: "assets/audio/kaixin.mp3" },
  { lessonId: "kids-rhymes-02", order: 2, character: "拔萝卜", pinyin: "bá luóbo", meaning: "pull up radish", audio: "assets/audio/shuiguo.mp3" }
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

const wsLessons = XLSX.utils.json_to_sheet(lessons);
const wsExercises = XLSX.utils.json_to_sheet(exercises);
const wsWriting = XLSX.utils.json_to_sheet(writing);
const wsVocabulary = XLSX.utils.json_to_sheet(vocabulary);
const wsGames = XLSX.utils.json_to_sheet(games);

XLSX.utils.book_append_sheet(wb, wsLessons, "Lessons");
XLSX.utils.book_append_sheet(wb, wsExercises, "Exercises");
XLSX.utils.book_append_sheet(wb, wsWriting, "Writing");
XLSX.utils.book_append_sheet(wb, wsVocabulary, "Vocabulary");
XLSX.utils.book_append_sheet(wb, wsGames, "Games");

const outExcel = path.join(__dirname, 'data', 'lessons.xlsx');
XLSX.writeFile(wb, outExcel);
console.log('Wrote data/lessons.xlsx successfully!');

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
