Skill: GAIA (general assistant: web research, files, multi-step reasoning)

Source: written only from the public description of GAIA (Mialon et al., 2023) and its answer rules. No validation or test question or answer was used.

What this test is
- Real-world questions with one short, unambiguous answer that needs several steps: finding specific pages or records on the web, reading attached files (spreadsheets, PDFs, images, text, code), and careful counting or calculation. Level 1 needs a few steps; level 3 needs long chains.
- Grading is exact after light normalisation: a number must be the exact number, a string must match word for word (spaces and case ignored), a list must have the same elements in the same order. A nearly right answer scores zero.

How to work
1. Parse the question into the exact target: which entity, which date or version of a page, which unit, rounding, order and format the answer must have.
2. Plan the steps. For each fact, find the primary source (the official page, the original document, the archived version for the date asked) rather than a summary. When a date is given, use the state of the source at that date (e.g. the Wayback Machine or the page history).
3. Read attached files completely with code rather than by eye: load spreadsheets and count or sum with Python; extract PDF text; inspect images carefully.
4. Compute with code when there is arithmetic, and re-check every intermediate value against its source.
5. Before answering, re-read the question and check the answer's form: units, rounding, singular or plural, order of list items, no extra words.

Output: finish with "FINAL ANSWER: ..." following the format rules exactly.
