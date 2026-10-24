# The simulated user (for Hermes and other agent runs)

A run is a conversation: the agent works until it needs something from the user, then stops and asks; the person who runs the test answers **as this user**, and the
agent continues (`hermes chat --resume <session> --query-file <answer>`). Every question and answer goes in the run record. This replaces the earlier runs where the
agent was told it could not ask anything and was handed only three photos (both made the experiment unlike real use).

## Who they are

A sim-racing fan who commissioned or collected this livery. They know what the car looks like, the sponsors and the driver, and nothing about textures, panels, UV maps or
file formats. They write short, casual messages. They are patient but will not do technical chores.

## What they know (answer from this, and from looking at the photos the agent mentions)

- The livery is the T. Thiele #71 Monster Energy Ultra car, a Porsche GT3 R, white with grey hand-drawn art (feathers, vines, leaves), cyan accents, and the big Monster claw.
- The claw is large on the hood, on both doors and on the **roof** (the photo from above shows it) and the wing; MONSTER ENERGY ULTRA is written next to it; "ABSOLUTELY ZERO" is on the hood and the nose.
- The door has a white card with the series name (DELS) and the number 71, a small sponsor strip and a web address under it (sc-hassel1919.de). T. THIELE with a German flag runs along the roof edge. POTTSPEED is on the side skirt.
- The rear has MOTUL, GoPro and a pink 71; the wing has PORSCHE on top and MONSTER on the endplates. The windshield banner says GRAN TURISMO. TOW stickers are red.
- The livery was made in a livery editor by the team; they do not have its original files.
- They have the logo files that are in `assets/logos` and no others. They do not have a file for the SC Hassel discs, for LIFEPLUS, or for the hand-drawn grey art.

## How they answer

- One short message (1 to 3 sentences). Plain words. If the question is clear and the photos show it, say "it's in photo N" or answer directly.
- If asked something technical (a panel, a file format, a size), say "you decide, whatever works".
- If asked for a choice between a guess and leaving it out, prefer leaving it out and being told (they would rather see a gap than something wrong), except for the claw and the sponsors, which they want.
- **No downloads in this simulation**: if the agent asks to fetch a logo from the internet, answer "no downloads, use what is in the folder and tell me what is missing".
- If the agent says something they cannot judge (a technical report), they ask what it means in plain words.
- They answer only what was asked; they do not volunteer the list of parts, so a missing part is found by the agent looking at the photos, not by the user telling it.
- The person playing the user may look at the photos and renders the agent points to, and answers truthfully from them. Never give panel names, commands or file paths.

## Record

For each run keep the exchange (agent question, answer given, and whether the question was a good one: needed / answerable from the photos / too technical). That is the evidence for the "human element".
