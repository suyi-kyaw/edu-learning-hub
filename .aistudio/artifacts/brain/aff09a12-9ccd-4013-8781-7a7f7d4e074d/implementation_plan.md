# Pronunciation Check Chinese Number Normalization

Convert spoken digits and numbers transcribed by the Web Speech API into Chinese characters so pronunciation scoring and transcript displays accurately match target Chinese text.

### Completed Work & Implemented Decisions

- **Chinese Number Normalization (`normalizeChineseNumbers`)**:
  - Automatically converts Arabic digits (`0-9` and full-width `０-９`) into standard Chinese characters (`零一二三四五六七八九`).
  - Supports percentages (e.g. `5%` -> `百分之五`, `百分之5` -> `百分之五`).
  - Cleans up hyphens, dashes, and spaces between digits (e.g. `138-0012` -> `一三八零零一二`).
  - Handles compound quantities when target sentences contain compound number markers (`十`, `百`, `千`).
- **Character Equivalence & Alignment**:
  - Integrated `areCharsEquivalent` into the sequence alignment dynamic programming table, accepting standard phone digit pronunciations such as `幺` (yāo) for `一` (yī), `两` for `二`, and `〇` for `零` with full credit.
  - Added number homophone pairs into `HOMOPHONE_SETS`.
- **Live Preview & Comparison Display**:
  - The live recording banner now displays normalized Chinese characters in real time as the user speaks.
  - The "Microphone Heard" comparison box in the evaluation feedback card now presents clean Chinese characters (e.g., `我的手机号码是一三八零零一二`) instead of Arabic digits, yielding accurate 100% scores.

### Verification
- Tested syntax via `node -c lessons.js` (clean).
- Verified linting via `lint_applet` (clean).
- Successfully built applet via `compile_applet`.
