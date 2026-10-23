# Skills index (in the order you use them)

Load only the one you need; each is short. The full map of order, requirements and tools is `docs/workflow-map.md`.

| Order | Skill | Use it when |
|---|---|---|
| 0 | `ac-intake` | someone asks for a livery and you do not know what they have or want |
| 1 | `ac-car-prep` | there is no car pack yet (`aclivery car info <id>` says so) |
| 2 | `ac-analyze` | you have reference images: study them into layers (including the subtle ones) before placing anything |
| 3 | `ac-logos` | you need logo files (asks before downloading) |
| 4 | `ac-panels` | you must choose which panel an element goes on |
| 5 | `ac-decal` | placing images, solid colours and text on panels (door plates and other small textures too) |
| 5b | `ac-apply` | you know the panels and have the assets: put every element in one `design.json` and build with one command |
| 2b | `ac-read-photo` | you must decide which view a reference photo shows, or what in it can be trusted |
| 6 | `ac-render` | looking at the result and comparing with the references |
| 6b | `ac-verify` | checking one element against a reference crop and recording the verdict |
| 7 | `ac-skin-export` | shipping: validate, DDS, zip |
| all | `ac-livery` | the overall workflow and the rules; start here if unsure |

Before working on a car, run `aclivery car notes <id>`: facts already learned about that car (panels, textures, pitfalls).
