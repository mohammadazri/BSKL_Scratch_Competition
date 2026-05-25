# Seed Rubrics — Rebalanced to 70/30

**Shared reference.** Track 1 imports this data into `criteria` and `criterion_levels` as a one-time seed.

**Source of truth:** the JSON block at the bottom of this file (`§ Seed data — JSON`). The tables above it are for human review; if they ever diverge from the JSON, the JSON wins and the tables get fixed.

---

## How this differs from the printed PDFs

The original PDF rubrics in `../Rubrics - Internal Only/` have inconsistent section weights:

| Cat | PDF Section A | PDF Section B |
| --- | ------------- | ------------- |
| A   | 65            | 35            |
| B   | 65            | 35            |
| C   | 60            | 40            |

Mohammad has normalised the weights to **70 / 30 across all categories** (2026-05-25). Per-criterion max points were scaled proportionally and rounded to integers, with level bands kept contiguous (no gaps, no overlaps, all integers from 0 to max are reachable).

**The website is the source of truth.** PDFs are NOT being regenerated — judges score only on the website on event day.

**Descriptors are kept verbatim** from the PDFs — they're well-written and pedagogically calibrated, no reason to rewrite them.

---

## Category A — Beginner (ages 7–9)

Sprint focus: Sprite + collision + score. Section A = 70 pts, Section B = 30 pts, total 100.

### Section A — Phase 1 At-Home Build (70 pts)

| #   | Criterion            | Max |
| --- | -------------------- | --- |
| 1   | Theme Integration    | 16  |
| 2   | Animation & Costumes | 22  |
| 3   | Core Functionality   | 32  |

**1. Theme Integration (16 pts)**

| Level        | Band  | Descriptor                                                                 |
| ------------ | ----- | -------------------------------------------------------------------------- |
| Excellent    | 14–16 | Backdrop & sprites clearly match theme. Original asset(s) in Paint Editor. |
| Proficient   | 10–13 | Theme recognisable; minor mismatch on one sprite or backdrop.              |
| Developing   | 4–9   | Partial theme; multiple off-topic or generic elements.                     |
| Insufficient | 0–3   | Little to no theme; default assets only.                                   |

**2. Animation & Costumes (22 pts)**

| Level        | Band  | Descriptor                                                                     |
| ------------ | ----- | ------------------------------------------------------------------------------ |
| Excellent    | 19–22 | ≥1 sprite: Next/Switch Costume + Wait in a loop. Smooth, contextually correct. |
| Proficient   | 13–18 | Loop present but timing is off or wrong costume indices used.                  |
| Developing   | 6–12  | Costume change exists but missing Wait block or loop structure.                |
| Insufficient | 0–5   | No animation or costume sequencing.                                            |

**3. Core Functionality (32 pts)**

| Level        | Band  | Descriptor                                                                                     |
| ------------ | ----- | ---------------------------------------------------------------------------------------------- |
| Excellent    | 27–32 | Player moves via keyboard/mouse. Collision triggers reaction. Score visible, resets to 0 on ⚑. |
| Proficient   | 19–26 | Movement & collision both work; one minor bug (e.g. Score doesn't reset).                      |
| Developing   | 10–18 | Movement works; collision absent or non-functional.                                            |
| Insufficient | 0–9   | Controls broken or no collision logic.                                                         |

### Section B — Live Sprint Mystery Objective (30 pts)

| #   | Criterion                     | Max |
| --- | ----------------------------- | --- |
| 1   | Sprite Added Correctly        | 6   |
| 2   | Mystery Sprite — Movement     | 8   |
| 3   | Collision Logic — All Actions | 16  |

**1. Sprite Added Correctly (6 pts)** — 3 levels (no "Developing")

| Level        | Band | Descriptor                                               |
| ------------ | ---- | -------------------------------------------------------- |
| Excellent    | 6    | Correct sprite from Scratch Library; not manually drawn. |
| Proficient   | 3–5  | Sprite added but wrong variant or drawn manually.        |
| Insufficient | 0–2  | Required sprite missing.                                 |

**2. Mystery Sprite — Movement (8 pts)** — 3 levels

| Level        | Band | Descriptor                                                   |
| ------------ | ---- | ------------------------------------------------------------ |
| Excellent    | 7–8  | Moves continuously as specified; no stalling or looping bug. |
| Proficient   | 4–6  | Moves but stops, glitches, or is extremely slow.             |
| Insufficient | 0–3  | No movement programmed.                                      |

**3. Collision Logic — All Actions (16 pts)**

| Level        | Band  | Descriptor                                                                          |
| ------------ | ----- | ----------------------------------------------------------------------------------- |
| Excellent    | 14–16 | ALL actions triggered correctly (speech + score / bounce + sound / costume + stop). |
| Proficient   | 8–13  | Collision fires; one required action missing or partially broken.                   |
| Developing   | 3–7   | Collision block exists; logic does not execute as specified.                        |
| Insufficient | 0–2   | No collision detection for mystery sprite.                                          |

---

## Category B — Intermediate (ages 10–12)

Sprint focus: Broadcasts + variables + flow. Section A = 70 pts, Section B = 30 pts, total 100.

### Section A — Phase 1 At-Home Build (70 pts)

| #   | Criterion              | Max |
| --- | ---------------------- | --- |
| 1   | Theme & Visual Design  | 16  |
| 2   | Variables & Gameplay   | 22  |
| 3   | Broadcasts & Game Flow | 22  |
| 4   | Code Organisation      | 10  |

**1. Theme & Visual Design (16 pts)**

| Level        | Band  | Descriptor                                                                |
| ------------ | ----- | ------------------------------------------------------------------------- |
| Excellent    | 14–16 | 3+ sprites, 2 backdrops, visible scene transition. Thematically coherent. |
| Proficient   | 10–13 | Required sprites & backdrops present; transition exists but abrupt.       |
| Developing   | 4–9   | Some theming; missing 2nd backdrop or scene transition.                   |
| Insufficient | 0–3   | Minimal theming; visual requirements not met.                             |

**2. Variables & Gameplay (22 pts)**

| Level        | Band  | Descriptor                                                                        |
| ------------ | ----- | --------------------------------------------------------------------------------- |
| Excellent    | 19–22 | Variable updates dynamically; balanced difficulty; visible on stage; resets on ⚑. |
| Proficient   | 14–18 | Variable updates with occasional bugs or incorrect reset.                         |
| Developing   | 8–13  | Variable visible but only partially functional.                                   |
| Insufficient | 0–7   | Variable missing, static, or never updates.                                       |

**3. Broadcasts & Game Flow (22 pts)**

| Level        | Band  | Descriptor                                                                  |
| ------------ | ----- | --------------------------------------------------------------------------- |
| Excellent    | 19–22 | Broadcast/When I Receive manages ≥1 transition correctly. No broken events. |
| Proficient   | 14–18 | Structure present; one event fails or receives wrong data.                  |
| Developing   | 8–13  | Broadcast exists but inconsistent or causes duplicate triggers.             |
| Insufficient | 0–7   | No broadcast system or completely broken.                                   |

**4. Code Organisation (10 pts)**

| Level        | Band | Descriptor                                                            |
| ------------ | ---- | --------------------------------------------------------------------- |
| Excellent    | 9–10 | My Blocks group repeated logic. No orphaned scripts. Clean workspace. |
| Proficient   | 6–8  | Some My Blocks; minor redundancy.                                     |
| Developing   | 3–5  | Little organisation; many duplicate scripts.                          |
| Insufficient | 0–2  | No optimisation; chaotic workspace.                                   |

### Section B — Live Sprint Mystery Objective (30 pts)

| #   | Criterion                        | Max |
| --- | -------------------------------- | --- |
| 1   | Sprite & Variable Setup          | 7   |
| 2   | Broadcast Conditions & Receivers | 12  |
| 3   | Game-Ending / Response Condition | 11  |

**1. Sprite & Variable Setup (7 pts)** — 3 levels

| Level        | Band | Descriptor                                                        |
| ------------ | ---- | ----------------------------------------------------------------- |
| Excellent    | 7    | Correct sprite added; variable created, named correctly, visible. |
| Proficient   | 4–6  | Sprite added; variable or visibility missing.                     |
| Insufficient | 0–3  | Sprite missing or wrong.                                          |

**2. Broadcast Conditions & Receivers (12 pts)**

| Level        | Band  | Descriptor                                                                            |
| ------------ | ----- | ------------------------------------------------------------------------------------- |
| Excellent    | 10–12 | All broadcasts fire under correct conditions. Receivers respond exactly as specified. |
| Proficient   | 7–9   | Most broadcasts work; one condition or receiver broken.                               |
| Developing   | 3–6   | Broadcast sent; receiver logic incomplete or wrong event name.                        |
| Insufficient | 0–2   | No broadcast logic programmed.                                                        |

**3. Game-Ending / Response Condition (11 pts)**

| Level        | Band | Descriptor                                                     |
| ------------ | ---- | -------------------------------------------------------------- |
| Excellent    | 9–11 | Terminal/response condition executes perfectly & consistently. |
| Proficient   | 6–8  | Condition triggers; one action (stop/pause/direction) fails.   |
| Developing   | 3–5  | Partially coded; does not execute fully.                       |
| Insufficient | 0–2  | Condition absent or non-functional.                            |

---

## Category C — Advanced (ages 13–15)

Sprint focus: Cloning + Lists + Extensions. Section A = 70 pts, Section B = 30 pts, total 100.

### Section A — Phase 1 At-Home Build (70 pts)

| #   | Criterion                      | Max |
| --- | ------------------------------ | --- |
| 1   | Theme Complexity & Originality | 12  |
| 2   | UX & Polish                    | 17  |
| 3   | Lists & Extensions             | 29  |
| 4   | Code Efficiency & Cloning      | 12  |

**1. Theme Complexity & Originality (12 pts)**

| Level        | Band  | Descriptor                                                                                 |
| ------------ | ----- | ------------------------------------------------------------------------------------------ |
| Excellent    | 11–12 | Innovative interpretation; interactive UI enhances narrative; substantial original assets. |
| Proficient   | 7–10  | Theme clear; some interactive elements present.                                            |
| Developing   | 4–6   | Basic theming; limited originality or interaction.                                         |
| Insufficient | 0–3   | Generic or off-theme; no interactive elements.                                             |

**2. UX & Polish (17 pts)**

| Level        | Band  | Descriptor                                                                                |
| ------------ | ----- | ----------------------------------------------------------------------------------------- |
| Excellent    | 15–17 | Smooth transitions, responsive UI buttons, polished physics/animation. Professional feel. |
| Proficient   | 10–14 | Good polish; minor UX issues (e.g. slight lag on transitions).                            |
| Developing   | 5–9   | Functional but rough; limited UI interaction.                                             |
| Insufficient | 0–4   | Poor UX; broken transitions or non-responsive UI.                                         |

**3. Lists & Extensions (29 pts)**

| Level        | Band  | Descriptor                                                                               |
| ------------ | ----- | ---------------------------------------------------------------------------------------- |
| Excellent    | 24–29 | List stores/retrieves ≥1 data type. Extension fully integrated into gameplay. Zero bugs. |
| Proficient   | 19–23 | Both present; minor functional bug in one.                                               |
| Developing   | 9–18  | One of List or Extension works; the other broken or absent.                              |
| Insufficient | 0–8   | Neither List nor Extension functional.                                                   |

**4. Code Efficiency & Cloning (12 pts)**

| Level        | Band  | Descriptor                                                                           |
| ------------ | ----- | ------------------------------------------------------------------------------------ |
| Excellent    | 11–12 | All repetitive logic in Custom Blocks. No orphaned scripts. Cloning used throughout. |
| Proficient   | 7–10  | Most in Custom Blocks; 1–2 orphaned scripts.                                         |
| Developing   | 4–6   | Some Custom Blocks; notable redundancy or one manual duplication.                    |
| Insufficient | 0–3   | No Custom Blocks; manual sprite duplication present.                                 |

### Section B — Live Sprint Mystery Objective (30 pts)

| #   | Criterion                      | Max |
| --- | ------------------------------ | --- |
| 1   | Sprite & System Setup          | 6   |
| 2   | Clone Loop / Extension Trigger | 13  |
| 3   | Data & Response Action         | 11  |

**1. Sprite & System Setup (6 pts)** — 3 levels

| Level        | Band | Descriptor                                                             |
| ------------ | ---- | ---------------------------------------------------------------------- |
| Excellent    | 5–6  | Correct sprite(s) added. List/Extensions set up and named per mission. |
| Proficient   | 3–4  | Sprite added; setup partially done (e.g. List named wrong).            |
| Insufficient | 0–2  | Sprite missing or setup absent.                                        |

**2. Clone Loop / Extension Trigger (13 pts)**

| Level        | Band  | Descriptor                                                                         |
| ------------ | ----- | ---------------------------------------------------------------------------------- |
| Excellent    | 11–13 | Logic works exactly as specified. All parameters correct (coords, language, loop). |
| Proficient   | 8–10  | Core logic works; one parameter wrong.                                             |
| Developing   | 4–7   | Partially coded; does not execute without errors.                                  |
| Insufficient | 0–3   | No clone or extension logic.                                                       |

**3. Data & Response Action (11 pts)**

| Level        | Band  | Descriptor                                                                             |
| ------------ | ----- | -------------------------------------------------------------------------------------- |
| Excellent    | 10–11 | List updates correctly / sound plays / clone deletes / TTS speaks — all steps correct. |
| Proficient   | 7–9   | Most actions work; one step missing.                                                   |
| Developing   | 3–6   | Partially coded; inconsistent execution.                                               |
| Insufficient | 0–2   | No data action programmed.                                                             |

---

## § Seed data — JSON (source of truth)

Track 1 places this file at `supabase/seed/rubrics.json` and runs a Node/TS script that inserts the rows into `criteria` and `criterion_levels`. The script is idempotent (safe to re-run) by using `ON CONFLICT (category, section, sort_order) DO UPDATE` on `criteria`, and `ON CONFLICT (criterion_id, level) DO UPDATE` on `criterion_levels`.

```json
{
	"categories": [
		{
			"category": "A",
			"sections": [
				{
					"section": "A",
					"criteria": [
						{
							"sort_order": 1,
							"name": "Theme Integration",
							"max_points": 16,
							"levels": [
								{
									"level": "Excellent",
									"min_pts": 14,
									"max_pts": 16,
									"descriptor": "Backdrop & sprites clearly match theme. Original asset(s) in Paint Editor."
								},
								{
									"level": "Proficient",
									"min_pts": 10,
									"max_pts": 13,
									"descriptor": "Theme recognisable; minor mismatch on one sprite or backdrop."
								},
								{
									"level": "Developing",
									"min_pts": 4,
									"max_pts": 9,
									"descriptor": "Partial theme; multiple off-topic or generic elements."
								},
								{
									"level": "Insufficient",
									"min_pts": 0,
									"max_pts": 3,
									"descriptor": "Little to no theme; default assets only."
								}
							]
						},
						{
							"sort_order": 2,
							"name": "Animation & Costumes",
							"max_points": 22,
							"levels": [
								{
									"level": "Excellent",
									"min_pts": 19,
									"max_pts": 22,
									"descriptor": "≥1 sprite: Next/Switch Costume + Wait in a loop. Smooth, contextually correct."
								},
								{
									"level": "Proficient",
									"min_pts": 13,
									"max_pts": 18,
									"descriptor": "Loop present but timing is off or wrong costume indices used."
								},
								{
									"level": "Developing",
									"min_pts": 6,
									"max_pts": 12,
									"descriptor": "Costume change exists but missing Wait block or loop structure."
								},
								{
									"level": "Insufficient",
									"min_pts": 0,
									"max_pts": 5,
									"descriptor": "No animation or costume sequencing."
								}
							]
						},
						{
							"sort_order": 3,
							"name": "Core Functionality",
							"max_points": 32,
							"levels": [
								{
									"level": "Excellent",
									"min_pts": 27,
									"max_pts": 32,
									"descriptor": "Player moves via keyboard/mouse. Collision triggers reaction. Score visible, resets to 0 on ⚑."
								},
								{
									"level": "Proficient",
									"min_pts": 19,
									"max_pts": 26,
									"descriptor": "Movement & collision both work; one minor bug (e.g. Score doesn't reset)."
								},
								{
									"level": "Developing",
									"min_pts": 10,
									"max_pts": 18,
									"descriptor": "Movement works; collision absent or non-functional."
								},
								{
									"level": "Insufficient",
									"min_pts": 0,
									"max_pts": 9,
									"descriptor": "Controls broken or no collision logic."
								}
							]
						}
					]
				},
				{
					"section": "B",
					"criteria": [
						{
							"sort_order": 1,
							"name": "Sprite Added Correctly",
							"max_points": 6,
							"levels": [
								{
									"level": "Excellent",
									"min_pts": 6,
									"max_pts": 6,
									"descriptor": "Correct sprite from Scratch Library; not manually drawn."
								},
								{
									"level": "Proficient",
									"min_pts": 3,
									"max_pts": 5,
									"descriptor": "Sprite added but wrong variant or drawn manually."
								},
								{
									"level": "Insufficient",
									"min_pts": 0,
									"max_pts": 2,
									"descriptor": "Required sprite missing."
								}
							]
						},
						{
							"sort_order": 2,
							"name": "Mystery Sprite — Movement",
							"max_points": 8,
							"levels": [
								{
									"level": "Excellent",
									"min_pts": 7,
									"max_pts": 8,
									"descriptor": "Moves continuously as specified; no stalling or looping bug."
								},
								{
									"level": "Proficient",
									"min_pts": 4,
									"max_pts": 6,
									"descriptor": "Moves but stops, glitches, or is extremely slow."
								},
								{
									"level": "Insufficient",
									"min_pts": 0,
									"max_pts": 3,
									"descriptor": "No movement programmed."
								}
							]
						},
						{
							"sort_order": 3,
							"name": "Collision Logic — All Actions",
							"max_points": 16,
							"levels": [
								{
									"level": "Excellent",
									"min_pts": 14,
									"max_pts": 16,
									"descriptor": "ALL actions triggered correctly (speech + score / bounce + sound / costume + stop)."
								},
								{
									"level": "Proficient",
									"min_pts": 8,
									"max_pts": 13,
									"descriptor": "Collision fires; one required action missing or partially broken."
								},
								{
									"level": "Developing",
									"min_pts": 3,
									"max_pts": 7,
									"descriptor": "Collision block exists; logic does not execute as specified."
								},
								{
									"level": "Insufficient",
									"min_pts": 0,
									"max_pts": 2,
									"descriptor": "No collision detection for mystery sprite."
								}
							]
						}
					]
				}
			]
		},

		{
			"category": "B",
			"sections": [
				{
					"section": "A",
					"criteria": [
						{
							"sort_order": 1,
							"name": "Theme & Visual Design",
							"max_points": 16,
							"levels": [
								{
									"level": "Excellent",
									"min_pts": 14,
									"max_pts": 16,
									"descriptor": "3+ sprites, 2 backdrops, visible scene transition. Thematically coherent."
								},
								{
									"level": "Proficient",
									"min_pts": 10,
									"max_pts": 13,
									"descriptor": "Required sprites & backdrops present; transition exists but abrupt."
								},
								{
									"level": "Developing",
									"min_pts": 4,
									"max_pts": 9,
									"descriptor": "Some theming; missing 2nd backdrop or scene transition."
								},
								{
									"level": "Insufficient",
									"min_pts": 0,
									"max_pts": 3,
									"descriptor": "Minimal theming; visual requirements not met."
								}
							]
						},
						{
							"sort_order": 2,
							"name": "Variables & Gameplay",
							"max_points": 22,
							"levels": [
								{
									"level": "Excellent",
									"min_pts": 19,
									"max_pts": 22,
									"descriptor": "Variable updates dynamically; balanced difficulty; visible on stage; resets on ⚑."
								},
								{
									"level": "Proficient",
									"min_pts": 14,
									"max_pts": 18,
									"descriptor": "Variable updates with occasional bugs or incorrect reset."
								},
								{
									"level": "Developing",
									"min_pts": 8,
									"max_pts": 13,
									"descriptor": "Variable visible but only partially functional."
								},
								{
									"level": "Insufficient",
									"min_pts": 0,
									"max_pts": 7,
									"descriptor": "Variable missing, static, or never updates."
								}
							]
						},
						{
							"sort_order": 3,
							"name": "Broadcasts & Game Flow",
							"max_points": 22,
							"levels": [
								{
									"level": "Excellent",
									"min_pts": 19,
									"max_pts": 22,
									"descriptor": "Broadcast/When I Receive manages ≥1 transition correctly. No broken events."
								},
								{
									"level": "Proficient",
									"min_pts": 14,
									"max_pts": 18,
									"descriptor": "Structure present; one event fails or receives wrong data."
								},
								{
									"level": "Developing",
									"min_pts": 8,
									"max_pts": 13,
									"descriptor": "Broadcast exists but inconsistent or causes duplicate triggers."
								},
								{
									"level": "Insufficient",
									"min_pts": 0,
									"max_pts": 7,
									"descriptor": "No broadcast system or completely broken."
								}
							]
						},
						{
							"sort_order": 4,
							"name": "Code Organisation",
							"max_points": 10,
							"levels": [
								{
									"level": "Excellent",
									"min_pts": 9,
									"max_pts": 10,
									"descriptor": "My Blocks group repeated logic. No orphaned scripts. Clean workspace."
								},
								{
									"level": "Proficient",
									"min_pts": 6,
									"max_pts": 8,
									"descriptor": "Some My Blocks; minor redundancy."
								},
								{
									"level": "Developing",
									"min_pts": 3,
									"max_pts": 5,
									"descriptor": "Little organisation; many duplicate scripts."
								},
								{
									"level": "Insufficient",
									"min_pts": 0,
									"max_pts": 2,
									"descriptor": "No optimisation; chaotic workspace."
								}
							]
						}
					]
				},
				{
					"section": "B",
					"criteria": [
						{
							"sort_order": 1,
							"name": "Sprite & Variable Setup",
							"max_points": 7,
							"levels": [
								{
									"level": "Excellent",
									"min_pts": 7,
									"max_pts": 7,
									"descriptor": "Correct sprite added; variable created, named correctly, visible."
								},
								{
									"level": "Proficient",
									"min_pts": 4,
									"max_pts": 6,
									"descriptor": "Sprite added; variable or visibility missing."
								},
								{
									"level": "Insufficient",
									"min_pts": 0,
									"max_pts": 3,
									"descriptor": "Sprite missing or wrong."
								}
							]
						},
						{
							"sort_order": 2,
							"name": "Broadcast Conditions & Receivers",
							"max_points": 12,
							"levels": [
								{
									"level": "Excellent",
									"min_pts": 10,
									"max_pts": 12,
									"descriptor": "All broadcasts fire under correct conditions. Receivers respond exactly as specified."
								},
								{
									"level": "Proficient",
									"min_pts": 7,
									"max_pts": 9,
									"descriptor": "Most broadcasts work; one condition or receiver broken."
								},
								{
									"level": "Developing",
									"min_pts": 3,
									"max_pts": 6,
									"descriptor": "Broadcast sent; receiver logic incomplete or wrong event name."
								},
								{
									"level": "Insufficient",
									"min_pts": 0,
									"max_pts": 2,
									"descriptor": "No broadcast logic programmed."
								}
							]
						},
						{
							"sort_order": 3,
							"name": "Game-Ending / Response Condition",
							"max_points": 11,
							"levels": [
								{
									"level": "Excellent",
									"min_pts": 9,
									"max_pts": 11,
									"descriptor": "Terminal/response condition executes perfectly & consistently."
								},
								{
									"level": "Proficient",
									"min_pts": 6,
									"max_pts": 8,
									"descriptor": "Condition triggers; one action (stop/pause/direction) fails."
								},
								{
									"level": "Developing",
									"min_pts": 3,
									"max_pts": 5,
									"descriptor": "Partially coded; does not execute fully."
								},
								{
									"level": "Insufficient",
									"min_pts": 0,
									"max_pts": 2,
									"descriptor": "Condition absent or non-functional."
								}
							]
						}
					]
				}
			]
		},

		{
			"category": "C",
			"sections": [
				{
					"section": "A",
					"criteria": [
						{
							"sort_order": 1,
							"name": "Theme Complexity & Originality",
							"max_points": 12,
							"levels": [
								{
									"level": "Excellent",
									"min_pts": 11,
									"max_pts": 12,
									"descriptor": "Innovative interpretation; interactive UI enhances narrative; substantial original assets."
								},
								{
									"level": "Proficient",
									"min_pts": 7,
									"max_pts": 10,
									"descriptor": "Theme clear; some interactive elements present."
								},
								{
									"level": "Developing",
									"min_pts": 4,
									"max_pts": 6,
									"descriptor": "Basic theming; limited originality or interaction."
								},
								{
									"level": "Insufficient",
									"min_pts": 0,
									"max_pts": 3,
									"descriptor": "Generic or off-theme; no interactive elements."
								}
							]
						},
						{
							"sort_order": 2,
							"name": "UX & Polish",
							"max_points": 17,
							"levels": [
								{
									"level": "Excellent",
									"min_pts": 15,
									"max_pts": 17,
									"descriptor": "Smooth transitions, responsive UI buttons, polished physics/animation. Professional feel."
								},
								{
									"level": "Proficient",
									"min_pts": 10,
									"max_pts": 14,
									"descriptor": "Good polish; minor UX issues (e.g. slight lag on transitions)."
								},
								{
									"level": "Developing",
									"min_pts": 5,
									"max_pts": 9,
									"descriptor": "Functional but rough; limited UI interaction."
								},
								{
									"level": "Insufficient",
									"min_pts": 0,
									"max_pts": 4,
									"descriptor": "Poor UX; broken transitions or non-responsive UI."
								}
							]
						},
						{
							"sort_order": 3,
							"name": "Lists & Extensions",
							"max_points": 29,
							"levels": [
								{
									"level": "Excellent",
									"min_pts": 24,
									"max_pts": 29,
									"descriptor": "List stores/retrieves ≥1 data type. Extension fully integrated into gameplay. Zero bugs."
								},
								{
									"level": "Proficient",
									"min_pts": 19,
									"max_pts": 23,
									"descriptor": "Both present; minor functional bug in one."
								},
								{
									"level": "Developing",
									"min_pts": 9,
									"max_pts": 18,
									"descriptor": "One of List or Extension works; the other broken or absent."
								},
								{
									"level": "Insufficient",
									"min_pts": 0,
									"max_pts": 8,
									"descriptor": "Neither List nor Extension functional."
								}
							]
						},
						{
							"sort_order": 4,
							"name": "Code Efficiency & Cloning",
							"max_points": 12,
							"levels": [
								{
									"level": "Excellent",
									"min_pts": 11,
									"max_pts": 12,
									"descriptor": "All repetitive logic in Custom Blocks. No orphaned scripts. Cloning used throughout."
								},
								{
									"level": "Proficient",
									"min_pts": 7,
									"max_pts": 10,
									"descriptor": "Most in Custom Blocks; 1–2 orphaned scripts."
								},
								{
									"level": "Developing",
									"min_pts": 4,
									"max_pts": 6,
									"descriptor": "Some Custom Blocks; notable redundancy or one manual duplication."
								},
								{
									"level": "Insufficient",
									"min_pts": 0,
									"max_pts": 3,
									"descriptor": "No Custom Blocks; manual sprite duplication present."
								}
							]
						}
					]
				},
				{
					"section": "B",
					"criteria": [
						{
							"sort_order": 1,
							"name": "Sprite & System Setup",
							"max_points": 6,
							"levels": [
								{
									"level": "Excellent",
									"min_pts": 5,
									"max_pts": 6,
									"descriptor": "Correct sprite(s) added. List/Extensions set up and named per mission."
								},
								{
									"level": "Proficient",
									"min_pts": 3,
									"max_pts": 4,
									"descriptor": "Sprite added; setup partially done (e.g. List named wrong)."
								},
								{
									"level": "Insufficient",
									"min_pts": 0,
									"max_pts": 2,
									"descriptor": "Sprite missing or setup absent."
								}
							]
						},
						{
							"sort_order": 2,
							"name": "Clone Loop / Extension Trigger",
							"max_points": 13,
							"levels": [
								{
									"level": "Excellent",
									"min_pts": 11,
									"max_pts": 13,
									"descriptor": "Logic works exactly as specified. All parameters correct (coords, language, loop)."
								},
								{
									"level": "Proficient",
									"min_pts": 8,
									"max_pts": 10,
									"descriptor": "Core logic works; one parameter wrong."
								},
								{
									"level": "Developing",
									"min_pts": 4,
									"max_pts": 7,
									"descriptor": "Partially coded; does not execute without errors."
								},
								{
									"level": "Insufficient",
									"min_pts": 0,
									"max_pts": 3,
									"descriptor": "No clone or extension logic."
								}
							]
						},
						{
							"sort_order": 3,
							"name": "Data & Response Action",
							"max_points": 11,
							"levels": [
								{
									"level": "Excellent",
									"min_pts": 10,
									"max_pts": 11,
									"descriptor": "List updates correctly / sound plays / clone deletes / TTS speaks — all steps correct."
								},
								{
									"level": "Proficient",
									"min_pts": 7,
									"max_pts": 9,
									"descriptor": "Most actions work; one step missing."
								},
								{
									"level": "Developing",
									"min_pts": 3,
									"max_pts": 6,
									"descriptor": "Partially coded; inconsistent execution."
								},
								{
									"level": "Insufficient",
									"min_pts": 0,
									"max_pts": 2,
									"descriptor": "No data action programmed."
								}
							]
						}
					]
				}
			]
		}
	]
}
```

---

## Sanity-check totals (run this mentally before merging any change)

| Cat | Sec A criteria sum         | Sec B criteria sum   | Grand total |
| --- | -------------------------- | -------------------- | ----------- |
| A   | 16 + 22 + 32 = **70**      | 6 + 8 + 16 = **30**  | **100**     |
| B   | 16 + 22 + 22 + 10 = **70** | 7 + 12 + 11 = **30** | **100**     |
| C   | 12 + 17 + 29 + 12 = **70** | 6 + 13 + 11 = **30** | **100**     |

If any total changes when editing this file, you've broken the contract — fix it before committing.
