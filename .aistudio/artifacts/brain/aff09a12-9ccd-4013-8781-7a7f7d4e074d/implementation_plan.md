# Chinese Character Step-by-Step Stroke Order & Format Validation Engine

A precision stroke order checking and grading system for the interactive calligraphy canvas. Validates each stroke against strict standard stroke steps (stroke sequence, orientation, trajectory direction, and spatial placement), prevents advancing on invalid strokes while preserving the learner's authentic handwriting for evaluation.

## User Review & Critical Decisions

> [!IMPORTANT]
> Stroke order and stroke direction validation must be rigorous enough to prevent skipping or writing backwards, while allowing natural variation in user brush handwriting.

- **Confirmed Decision 1 (Strict Step Order & Blocking)**: The user must write strokes strictly matching the standard step order (Step 1, Step 2, ...). If a stroke is incorrect in direction, shape, or position, the invalid stroke line is cleared from the canvas, an informative correction alert is displayed, and the learner is blocked from advancing until drawn correctly.
- **Confirmed Decision 2 (Preserving User Strokes for Authentic Grading)**: When a stroke is drawn correctly, the system retains the learner's exact brush stroke points on the canvas (rather than snapping or replacing it with an artificial vector font outline), ensuring practice grading reflects true handwriting fidelity.
- **Confirmed Decision 3 (Reference Guide & Demo)**: The learner can view the animated step-by-step stroke demonstration on demand (via "Demonstrate / 演示") and toggle the background character outline to learn proper stroke technique without the animation interfering with the drawing canvas.

---

## 1. Overview & Core Concept

- **What It Does**: Enhances the Character Writing & Stroke Order practice module in lessons. Every stroke drawn by the learner is evaluated against the authoritative stroke definition of the active Chinese character (e.g., 横 héng, 竖 shù, 撇 piě, 捺 nà, 折 zhé, 提 tí, 钩 gōu). Strokes that violate the step sequence, start at the wrong point, or travel in the wrong direction are rejected with clear instructional feedback.
- **Target Audience**: Students and language learners mastering Chinese hanzi handwriting who need strict stroke order guidance to develop muscle memory and correct stroke mechanics.
- **Key Value**: Eliminates incorrect stroke habits early by enforcing standard calligraphy rules before character completion, while providing positive reinforcement and detailed handwriting grading.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Interactive Stage & Zero State**:
   - Learner navigates to "Writing & Stroke Order" in any lesson.
   - The canvas shows a standard calligraphy Mi Zi Ge (米字格) red grid with an optional faint KaiTi watermark outline.
   - The top status bar highlights: `Stroke 1 / N`, current stroke name (e.g., `1. 丨 竖 (Top to Bottom)`), and helper guidance.
2. **Stroke Drawing & Instant Evaluation**:
   - Learner presses down and draws a stroke with their finger, stylus, or mouse.
   - As the pointer releases (`pointerup`), the system evaluates:
     1. **Stroke Sequence**: Must correspond to the current step index.
     2. **Start & End Anchors**: Validates stroke starting quadrant/point and ending quadrant/point.
     3. **Direction Vector & Angle**: Ensures strokes flow in correct calligraphy directions (e.g., horizontal left-to-right, vertical top-to-bottom, falling left-to-right).
     4. **Path Curvature / Aspect**: Distinguishes dots, slants, verticals, and hooks.
3. **Branch A — Stroke Correct**:
   - Pleasant positive audio chime plays.
   - The learner's stroke remains rendered on the canvas in their selected brush color and thickness.
   - The step counter updates to `Stroke 2 / N`, the step bar fills progressively, and the hint instructs on the next stroke step.
4. **Branch B — Stroke Incorrect**:
   - Low warning tone plays.
   - The invalid drawn stroke is smoothly cleared from the canvas.
   - An alert message indicates the exact expected stroke (e.g., `⚠️ Incorrect stroke! Stroke 2 must be drawn from top to bottom`).
   - The step bar shakes gently (`stroke-error-shake`) to visually signal the mistake without disrupting previously written valid strokes.
   - Advance is blocked until the learner draws the required stroke correctly.
5. **Character Completion & Practice Grading**:
   - Once all strokes are completed in proper order, the character triggers a celebration burst.
   - The learner's completed handwritten character is scored across stroke direction, proportion, and accuracy.
   - Lesson progress and stars are persisted to local storage and user profile.

### Visual Identity & Theme Tokens
- **Canvas Grid**: Traditional Chinese calligraphy Mi Zi Ge (`#dc2626` / `#b91c1c` 0.15 opacity dashed guidelines on clean parchment off-white `#fffdf9`).
- **Brush Color Palette**:
  - Classic Vermilion / Calligraphy Ink: `#ea580c` (primary default)
  - Traditional Ink Black: `#18181b`
  - Deep Indigo: `#2563eb`
- **Validation Signals**:
  - Success / Correct: Emerald `#059669` badge and text with checkmark glyph.
  - Error / Correction Needed: Crimson `#dc2626` warning with stroke name and directional indicator.
  - Directional Guidance: Orange Amber `#d97706` step indicator.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Vector-Based Stroke Recognition vs. Freehand Acceptance
- **Chosen Approach**: Calibrated multi-factor stroke scoring comparing drawn pointer trajectory with canonical character stroke vectors (direction angle tolerance $\pm 45^\circ$, length threshold $> 12\text{px}$, start coordinate window within radius).
- **Why**: Allows users natural handwriting freedom without arbitrary rejections of minor stylistic curves, while strictly catching backwards strokes (e.g. writing horizontal right-to-left or vertical bottom-to-top) and out-of-order strokes.
- **Alternative Considered**: Pixel-mask overlap testing was rejected because it does not encode stroke directionality (a line drawn backwards produces identical pixel masks).

### Decision 2: HanziWriter Mode Separation
- **Chosen Approach**: Use HanziWriter strictly in demonstration and outline mode (`animateCharacter()`, `showOutline: true`) while delegating writing capture and step validation to our dedicated high-precision HTML5 Canvas engine.
- **Why**: HanziWriter's internal quiz engine forcibly snaps user strokes into computerized vector paths and intercepts pointer events, causing crashes and destroying user handwriting. Separating the two gives full control over custom error blocking and authentic handwriting preservation.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        User Practice Interface                         │
│                                                                        │
│   [Brush Picker]   [Stroke 1 / 4: 丨 竖]   [Demonstrate / 演示]        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                     Pointer Events (Down / Move / Up)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   HTML5 Canvas Drawing Layer (#strokeDrawCanvas)       │
│                                                                        │
│   - Captures raw touch/stylus/mouse points [{x, y}, ...]               │
│   - Renders live brush curve with pressure & velocity smoothing        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ on pointerup
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                Stroke Step Order & Format Evaluator                    │
│                                                                        │
│   1. Retrieve canonical stroke step definition for active character   │
│   2. Extract drawn trajectory (start point, end point, angle, length)  │
│   3. Validate stroke index = drawnStrokes.length (Strict Step Order)  │
│   4. Compute direction angle error: Δθ = |θ_drawn - θ_expected|       │
│   5. Compute positional offset: Δpos = dist(p_start, exp_start)       │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
             Pass (Score >= 45)               Fail (Score < 45)
                    │                                │
                    ▼                                ▼
┌──────────────────────────────────┐ ┌──────────────────────────────────┐
│         Accept & Advance         │ │        Reject & Block Step       │
│                                  │ │                                  │
│ - Append to drawnStrokes         │ │ - Increment userMistakesCount    │
│ - Play positive chime            │ │ - Play error tone                │
│ - Update step badge & hint text  │ │ - Erase current invalid stroke   │
│ - Retain user handwriting lines  │ │ - Redraw previous valid strokes  │
│ - If complete -> open score modal│ │ - Display correction guidance    │
└──────────────────────────────────┘ └──────────────────────────────────┘
```

### Component & State Mapping
- `activeWritingChar`: The current vocabulary character object (e.g. `{ char: "早", pinyin: "zǎo", ... }`).
- `getCharacterStrokeVectors(char)`: Authoritative dictionary mapping each character's sequential strokes with name, type (horizontal, vertical, left_fall, right_fall, hook, corner, dot), start coordinates, and expected direction vectors.
- `evaluateSingleStroke(points, strokeIdx, currentChar)`: Performs geometric scoring comparing user drawn points against `strokeVectors[strokeIdx]`. Enforces directional fidelity and rejects reverse/invalid strokes.
- `drawnStrokes`: Array storing accepted user strokes as coordinate lists for persistent handwriting rendering on canvas.
- `redrawCanvasFromStrokes()`: Clears the drawing context and redraws only verified valid user strokes, immediately wiping out any rejected attempts.
