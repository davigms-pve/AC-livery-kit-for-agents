# AC-livery-kit-for-agents

> ## Work in progress: not a released version
> This project is under active development and **has not been released**. Interfaces, commands and file formats will change without notice.
> It is proven on one car and one use case only, and nothing it produces has been loaded into the game by the kit itself: always check a skin in
> Content Manager. Expect gaps (see [Not done yet](#not-done-yet) and [docs/TODO.md](docs/TODO.md)). Source-available and free for noncommercial use under the
> [PolyForm Noncommercial License 1.0.0](LICENSE); see [License](#license).

A kit that lets AI agents, including small local models, help create and modify **Assetto Corsa** liveries.

It started from a failed attempt: a local Qwen 27B driving GIMP and Blender through MCP could not paint a livery
onto a mod car. The diagnosis (a hypothesis, still to be measured) is that low-level tools make a small model
chain dozens of exact calls with no idea where a texture lands on the car. So this kit does the opposite: **a few
high-level commands that talk about named panels, deterministic code that does the pixels and the geometry, and
short skills that tell a model how to drive them.**

> Status: early. The pieces below work on one real car (the RSS GT-M Protech P92 F6, a community mod).
> Nothing here has been loaded into the game by this kit yet; you verify in Content Manager.

## How it works

```
 car model (.kn5)  --prep once-->  car pack (small, measurements only)
                                        |
   reference photos, logos  -->  agent  +  aclivery commands  -->  texture PNGs  -->  DDS skin zip
                                        |        panel list / decal / render / validate / export
                                  look at a render, fix, repeat
```

- **Engine:** [liverykit](https://github.com/mishan/liverykit) (MIT), pinned to a commit, reads the `.kn5`, measures
  UV panels and renders headlessly. All access to it goes through [src/engine.mjs](src/engine.mjs).
- **This repo:** the agent layer on top: commands, skills, safety rules, and the research and evaluation.

## Commands

```
aclivery photos <folder> --brief <slug>           look at ALL the user's photos (numbered contact sheets, added to the brief)
aclivery car prep <car.kn5> --skins <skins dir>   one-time: build the car pack
aclivery panel list|get|regions|textures <car>    which panels exist, where, which way up
aclivery apply design.json [--export]            build the whole skin from one design file (assets, layers, sheet, zip)
aclivery decal <car> --panel left_mid --image logo.png --out work/EXT_Main.png
aclivery text <car> --panel right_rear --text "T. THIELE" --out work/EXT_Main.png
aclivery compare <car> --skin work --brief <slug>  reference photo next to our render from the same view
aclivery status | aclivery brief ...               where am I, and the project memory (decisions, next step)
aclivery render <car> --skin work                 one contact-sheet image of several views (~2 s per view)
aclivery logo fetch|inspect|prep                  get and prepare logos (asks before downloading)
aclivery validate dds|skin ...                    check files before installing
aclivery export work --car <id> --name "My Skin"  PNG -> DDS, zip for Content Manager
```

Skills for agents live in [skills/](skills) (index in [skills/README.md](skills/README.md)) (`SKILL.md`, the Hermes / agentskills format). Start with
[ac-livery](skills/ac-livery/SKILL.md). The agent works **with the user**: it looks at every photo they give it, checks it has the basic views, and asks
about anything it cannot find or is unsure of ([ac-intake](skills/ac-intake/SKILL.md)); it does not guess in silence.

## Quick start

```
npm install                  # Node 20.9+
node bin/aclivery.mjs --help
npm test
```

`aclivery` is not on your PATH until you run `npm link` in this folder; without it, run
`node <repo>/bin/aclivery.mjs <command>` (the skills say so too). Commands work from any folder.

Hermes (trials parked until a Haiku run succeeds, see docs/milestones.md): the skills use Hermes' loader format (verified against its installed `skills_tool.py`: only `name` up to 64
characters and `description` up to 1024 are required). Copy or link `skills/*` into your Hermes skills folder.

You supply the game's files: this repo contains no car models, textures or logos, and never will. Logos fetched
by the kit go to the gitignored `assets/` folder.

## Documentation

- [docs/user-journey.md](docs/user-journey.md): what a person goes through, including when they arrive without everything
- [docs/workflow-map.md](docs/workflow-map.md): the order of things, requirements and tools in one page
- [docs/TODO.md](docs/TODO.md): what is done, what is next, and how to resume
- [docs/milestones.md](docs/milestones.md): the Haiku milestone and when Hermes comes back; [eval/](eval) holds the run prompt and rubric
- [docs/session-log/2026-10-21.md](docs/session-log/2026-10-21.md): the story and reasoning of the first session
- [docs/architecture.md](docs/architecture.md): the design rules and why
- [examples/rss-p92-thiele71/design.json](examples/rss-p92-thiele71/design.json): a rough first pass as one design file (`build.sh` runs it)
- [docs/use-cases/rss-p92-thiele71.md](docs/use-cases/rss-p92-thiele71.md): the use case that started this, with what is verified and what is not
- [docs/research/landscape.md](docs/research/landscape.md): what already exists (tools, repos, formats) and the gaps
- [AGENTS.md](AGENTS.md): rules for agents working on this repo

## Not done yet

- Matching a render against reference photos taken from arbitrary angles automatically (today: side by side, a person or model judges).
- A single design that drives all textures at once (door plates work by hand; the windshield banner and decals do not yet).
- The silver ink art, cyan splatter and the real Monster claw have no source (a crude placeholder claw is used in the example).
- A benchmark of models and approaches (tool-calling LLM vs image-edit model vs hybrid) on the same tasks.
- Cross-car livery transfer.
- Verifying skins load in the game, and what DDS sizes each car accepts.

## License

**PolyForm Noncommercial License 1.0.0**, Copyright 2026 Davi de Souza. See [LICENSE](LICENSE). This is a *source-available, noncommercial* licence,
not an open-source (OSI) licence. In plain words (the [LICENSE](LICENSE) text is what counts; this is not legal advice):

- **You may** use, study, modify and share the kit for personal, hobby, research, educational and other **noncommercial** purposes, including leagues and teams that
  do not make money from it.
- **You may not** sell it, include it in a product or service you sell, or use it for commercial purposes. You must keep the copyright notice and the licence with
  any copy you share, and you may not present the work as your own.
- **Commercial use** (for example a paid livery service or a company product) needs a separate licence: ask the owner via the repository's issues.
- The licence covers **the kit itself**. Liveries you make with it belong to you, subject to the rights of others in what you put on them: sponsor logos and brand
  names belong to their owners, and cars, textures and templates belong to their authors (see [NOTICE](NOTICE)). Check the terms of any mod you use.
- Contributions are welcome under the same terms (see [CONTRIBUTING.md](CONTRIBUTING.md)).

Third-party components keep their own licences, listed in [NOTICE](NOTICE). This project is not affiliated with or endorsed by Kunos Simulazioni, Race Sim
Studio, Content Manager or any brand shown in the docs.
