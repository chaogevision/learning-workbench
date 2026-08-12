# Child Learning Adventure Base V3.0 Alpha

[中文](README.md) | [English](README_EN.md)

> Build a semester-long learning adventure base around a child's grade level, curriculum package, interests, and learning pace.

**V3.0 Alpha** is not primarily about turning AI into a black box that automatically generates an entire textbook. Its main goal is to establish a platform architecture that cleanly separates the workbench UI, curriculum content, child personalization, and learning progress, so families can create their own learning workspace without editing code.

---

## Why V3.0 exists

V2.0 already provided a complete family learning experience, including a home dashboard, daily tasks, an interactive six-step preview workflow, growth maps, growth records, ability badges, and the V2 growth incentive system.

However, the curriculum was still largely centered on a Grade 5 mathematics example.

V3.0 addresses a more important question:

> **How can different families turn this project into a learning base for their own child, grade, and textbook edition without touching the source code?**

The core V3 model is:

```text
Personal Learning Adventure Base
=
Shared Workbench Shell
+
Curriculum Package
+
Grade-Band Teaching Adapter
+
Child Personalization Overlay
+
Learning Runtime State
```

The curriculum determines **what to learn**. The grade-band adapter determines **how to learn it**. The personalization layer determines **how the experience feels**, while runtime state records the child's actual learning progress.

---

## Quick Start

### Option 1: Offline demo

After downloading the project, open:

```text
START_HERE.html
```

The project can run in local offline mode with **no API key required**.

### Option 2: Start the local server

For the Mock API or later model integration, use Node.js 18+:

```bash
node server.mjs
```

Then open the local URL shown in the terminal.

You can also run:

```bash
npm install
npm start
```

---

# What V3.0 Alpha includes

## 1. First-run Learning Base Setup Wizard

Instead of opening directly into a fixed Grade 5 mathematics demo, parents can create a learning base for their own child.

The setup flow supports:

- Child nickname;
- Current grade;
- Daily learning time;
- Weekly learning days;
- Interest preferences;
- Themes such as dinosaurs, racing, space, and islands;
- Relaxed / Standard / Advanced learning pace;
- Light hints / Step-by-step hints / More detailed scaffolding;
- Curriculum packages available for the selected grade.

A newly created profile starts with its own task and progress state.

A “Quick Demo” path is still available so new users can immediately explore the finished experience.

---

## 2. Curriculum Package V3

The most important V3 change is that **curriculum content is no longer hard-coded into the core web application**.

Each textbook or semester can be packaged independently:

```text
curriculum-package/
├── manifest.json
├── textbook.json
├── curriculum.json
├── units/
│   └── unit-xx.json
├── quality/
│   ├── source-map.json
│   └── review-report.json
└── README.md
```

Unified schema:

```text
schemas/curriculum-package-v3.schema.json
```

Because curriculum packages and child data are separated:

- One curriculum package can serve multiple children;
- Switching textbooks does not require frontend code changes;
- Exported packages do not include a child's name, avatar, or learning history;
- The architecture can later support package review, versioning, and a community catalog.

---

## 3. Curriculum Library and Textbook Center

V3.0 introduces curriculum package management with support for:

- Viewing grade, semester, and textbook edition;
- Viewing package trust / review status;
- Installing curriculum packages;
- Keeping multiple textbooks installed;
- Switching the active textbook;
- Switching the active unit;
- Importing local curriculum packages;
- Exporting curriculum packages;
- Managing curriculum data separately from child profiles and learning progress.

Packages can carry trust labels such as:

- Officially maintained;
- Community reviewed;
- Built-in demo;
- AI-generated, pending review;
- Personal use only.

---

## 4. Two switchable mathematics demo packages

The Alpha release includes two mathematics packages to validate that the same workbench can run different grade levels and curriculum content.

### Grade 5 Semester 2 demo

```text
pep-math-g5-s2-demo
```

Includes the original interactive six-step preview content for the unit on the meaning and properties of fractions.

### Grade 4 Semester 1 architecture demo

```text
pep-math-g4-s1-demo
```

Includes an interactive unit on angle measurement and is used to validate cross-grade curriculum switching.

> The Grade 4 package is architecture/demo content marked as **AI-assisted and pending textbook review**. It should not be treated as fully reviewed official curriculum content.

---

## 5. Reusable Six-Step Preview Player

The six-step preview method remains one of the core learning mechanisms:

```text
See the Big Picture
→ Check Foundations
→ Think It Through
→ Verify Understanding
→ Transfer and Apply
→ Set Class Priorities
```

In V3.0, the player no longer depends on a specific Grade 5 mathematics unit. It reads the currently active Curriculum Package V3 data model.

The current interaction system retains:

- Clickable knowledge maps;
- Two prerequisite checks;
- Progressive Socratic guidance;
- Recognize / Explain / Apply challenges;
- Base problems and structured variations;
- Error-reason tracking;
- Class focus summaries;
- 1–3–7 review planning;
- Integration with ability badges and the growth incentive system.

---

## 6. Grade-Band Teaching Adapter foundation

The same six-step method should not be presented identically to a Grade 1 learner and a Grade 6 learner. V3 therefore introduces grade-band teaching adapters.

### Grades 1–2

Planned interaction style:

- Image-based selection;
- Drag and drop;
- Voice responses;
- One main question per screen;
- Short learning sessions;
- Parent-assisted mode.

### Grades 3–4

Primary interaction style:

- Selection;
- Ordering;
- Short-form text responses;
- Visual / geometric manipulation;
- Progressive hints.

### Grades 5–6

Primary interaction style:

- Full knowledge maps;
- Multi-step reasoning;
- Self-explanation;
- Three-level challenges;
- Problem variations;
- Class-priority summaries.

The Alpha release establishes the adapter data structure and page-level recognition. Dedicated low-grade voice and drag-and-drop components are still planned work.

---

# V2 capabilities remain available

V3.0 evolves from the full V2 workbench rather than replacing it.

The project continues to include:

- Learning calendar;
- Parent-assigned tasks;
- AI-assisted task planning;
- Daily task tracking;
- Interactive six-step previews;
- Growth map;
- Growth records;
- Child-specific character assets;
- Dino companion system;
- Ability badge system;
- Experience Points (XP);
- Growth Stars;
- Explore Coins;
- Reward ledger and duplicate-claim protection;
- Parent center;
- AI service settings;
- Local progress storage.

---

# Data and privacy model

V3.0 follows a local-first design philosophy.

- Child nicknames are preferred over real names;
- AI-generated character representations are preferred over requiring real photos;
- Curriculum packages do not contain child personal information;
- Learning progress and curriculum data are stored separately;
- Exporting a curriculum package does not export child data;
- The project does not bundle original textbook PDFs;
- In production, API keys should be stored in the local/server-side proxy, not frontend source code;
- AI-generated curriculum content that has not been reviewed must be clearly labeled and checked against the textbook.

---

# Current scope and limitations

V3.0 Alpha **does not yet** provide the full workflow where a parent uploads a textbook PDF in the frontend and automatically generates a complete semester curriculum package.

That capability belongs to the next phase, V3.1.

The Alpha release focuses first on stabilizing the curriculum package model, runtime, content/workbench decoupling, and first-run setup experience.

---

# V3.1 Roadmap: Custom Textbook Generation

The next phase will convert the existing `math-semester-preview` Skill into a headless curriculum generation engine callable from the workbench.

Target workflow:

```text
Upload textbook PDF
→ Check file quality
→ OCR / table-of-contents detection
→ Parent confirms the outline
→ Generate one sample unit
→ Parent approves the sample
→ Generate remaining units incrementally
→ Validate mathematics / sources / completeness
→ Export Curriculum Package V3
→ Install into the learning base
```

Planned capabilities include:

- PDF upload;
- Local OCR;
- Textbook outline parsing;
- Editable outline confirmation;
- Sample-unit generation;
- Unit-level generation jobs;
- Pause / resume;
- Failure retry;
- Regenerate a single unit;
- Source-page mapping;
- Automated quality checks;
- Curriculum package installation.

---

# V3.2 Roadmap: Curriculum Package Community

Longer-term, the project aims to support a reusable and maintainable curriculum package ecosystem:

- Package versioning;
- Textbook fingerprints;
- Official / community review status;
- Community-contributed packages;
- Issue reporting;
- Content revision;
- Multiple textbook editions.

The default path for families should be to install a reviewed curriculum package in one click. Uploading and generating a textbook from PDF should become the advanced fallback when the curriculum library does not already contain the needed edition.

---

# Key directories

```text
curriculum-packages/
├── catalog.json
├── pep-math-g5-s2-demo/
└── pep-math-g4-s1-demo/

assets/js/
├── curriculum-runtime.js
├── six-step-preview.js
└── app.js

schemas/
└── curriculum-package-v3.schema.json

docs/
├── CURRICULUM_PACKAGE_V3.md
├── V3_PRODUCT_ARCHITECTURE_SPEC.md
└── V3_ALPHA_IMPLEMENTATION.md
```

---

# Testing

Run the base checks:

```bash
npm run check
```

Run the V3 Alpha smoke tests:

```bash
npm run v3-smoke
```

The current V3 validation covers:

- First-run setup wizard;
- Grade and interest configuration;
- Curriculum package installation;
- Multiple-package switching;
- Independent package export;
- Grade 4 / Grade 5 curriculum switching;
- Six-step preview player interactions;
- 390px mobile layout checks;
- Browser console error checks.

Detailed report:

```text
reports/V3_ALPHA_VALIDATION.md
```

---

# Roadmap

```text
V2.0
Growth Incentive System + Complete Family Learning Workbench
        ↓
V3.0 Alpha
Curriculum Package Platform + Content Decoupling + Personalized Base Setup
        ↓
V3.1
Upload Textbook PDF → Generate Curriculum Package V3
        ↓
V3.2
Curriculum Package Community + Review + Versioning
        ↓
Future
Mathematics → Chinese / English / Science and additional subject adapters
```

---

# Vision

The long-term goal is not to build a fixed “Grade 5 mathematics workbench.” It is to create a reusable family learning framework:

> **Choose or upload a child's textbook, combine it with the child's grade, interests, and learning pace, and create a personalized learning adventure base for the semester.**

Contributions and discussions around AI + family education, gamified learning, textbook preview, child-focused agents, and curriculum package generation are welcome.