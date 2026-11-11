The task text of the painting benchmark. Everything below the line is given to the model, word for word, with the
case filled in from `cases.json`. The model works in a folder made by `make-kit.mjs`; it needs a shell with Node
and a way to look at PNG files. Nothing else is given: no hints, no examples of the case.

---
This folder contains PaintSim, a paint simulator. Read README.md and GUIDE.md first.

Paint this picture with it:

"{SUBJECT}"

The page is {W} × {H} units. Deliver three files: paintings/{STEM}.gen.mjs (the program that composes the picture), paintings/{STEM}.json (the painting document it writes) and paintings/{STEM}.png (the document rendered at scale 2). Compose the picture yourself; do not imitate a particular existing painting. Do not change the engine, the recipes or the tools.

People will judge the PNG, whole and close up, as a photograph of an oil painting: is it beautiful, is it the picture that was asked for, and does it look painted by hand.
