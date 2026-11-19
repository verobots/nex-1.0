Skill: ARC-AGI-2 (abstract reasoning on grids)

Source: written only from the public description of ARC-AGI-2 (arcprize.org, technical report 2025) and the public training set. No evaluation task or answer was used.

What this test is
- You see a few input/output grid pairs that share one hidden transformation, then one or more test inputs. You must produce the exact output grid for each test input. Every cell and the grid size must be exactly right; nearly right scores zero.
- ARC-AGI-2 tasks are built to resist pattern matching. They usually need: symbolic interpretation (a shape or colour stands for a meaning, e.g. a marker says which direction or which colour to use), compositional rules (two or three simple rules applied together), and contextual rules (the same rule applies differently depending on something in the grid).
- You get two attempts per test input. A test counts as solved if either attempt is exact.

How to work through a task
1. Describe each training pair in words: background colour, objects (connected cells of one colour, or multi-colour shapes), their positions, sizes, counts, symmetry, holes, borders, lines and any special marker cells. Note the output size compared with the input size.
2. List what changes and what stays fixed between input and output. Look for: objects moved, recoloured, copied, extended, filled, cropped, counted, sorted, mirrored, rotated, connected by lines, or selected by a property (largest, unique, odd one out, most frequent).
3. Form one precise hypothesis that explains ALL training pairs, including the output size. A rule that fits only some pairs is wrong; look for the context that makes the other pairs differ.
4. Verify the hypothesis cell by cell on every training pair by mentally (or, if you can run code, programmatically) applying it to the training inputs and comparing with the given outputs. If you can run code, write a small program for the rule and confirm it reproduces every training output exactly before using it.
5. Apply the rule to each test input. Check the test input for cases the training pairs did not show (new colours, more objects, objects touching an edge) and decide how the rule extends.
6. Re-check the output: dimensions, every row length, colours used, and that nothing outside the changed region was altered by accident.

How to use the two attempts
- Attempt 1: your best verified hypothesis.
- Attempt 2: the strongest genuinely different interpretation (an alternative reading of the ambiguous part of the rule), not a copy of attempt 1 with a random cell changed. If you are sure of attempt 1, attempt 2 can repeat it.

Common traps
- Wrong output size, off-by-one at borders, rows of unequal length.
- Treating colour as decoration when it encodes the rule (or the reverse).
- Missing that the rule is applied per object, per row, or per region, not to the whole grid.
- Stopping at the first rule that fits one example.

Output: follow the JSON format requested by the task exactly, with integer cells 0-9.
