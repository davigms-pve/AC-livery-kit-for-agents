---
name: ac-analyze
description: Study reference images into layers before building
version: 0.1.0
license: PolyForm-Noncommercial-1.0.0
---

# Analyse the references

Do this after you have reference images and before you place anything. Goal: a list of **layers** that together make the
livery recognisable. The mistake to avoid: placing only the obvious logos and dropping the quiet details that give the
livery its character.

```
aclivery render <car> --regions                        know the car's parts first
aclivery brief add <slug> references '{"file":"photo.jpg","view":"right","notes":"..."}'
aclivery brief set <slug> analysis '{"summary":"...","layers":[...],"overlapRules":"...","feel":"..."}'
```

## What to look for (in this order)

1. **Base**: the body colour, and whether it is flat, gradient or metallic.
2. **Large graphics**: big shapes, stripes, a big logo or claw. Where, how large (fraction of the panel), what colour.
3. **Subtle tonal art**: faint patterns on the base (for example light grey ink feathers or vines on an almost white car,
   mimicking the artwork of a can). They are low-contrast, so easy to miss, and they are often *the* identity of the
   livery. Record where they appear, their colour (a slightly darker tint of the base) and rough density. **Never drop
   them for lack of an asset.** Plan a placeholder (a procedural or traced pattern) or ask for the original file.
4. **Functional race-car markings**: tiny stickers that copy real scrutineering features: TOW arrows, N (neutral) and E (fire extinguisher) pull indicators, battery cut-off, fuel and jack points, sponsor-free number panels. They are small and easy to take for decoration or to skip; look for them near the windshield base, bumpers, and rear. If you cannot read one, record it as low confidence and ask. Kind: `marking`.
5. **Accents**: small bold colours (mirrors, endplates, stripes, splatters). Which parts, which colour.
6. **Logos and wordmarks**: which brand, which variant (colour, mono), where, size, what they sit next to.
7. **Text and numbers**: names, number, plate lettering; font style; where.
8. **Plates and stickers**: door plates, windshield banner, other separate textures.
9. **Order and overlap**: what sits on top of what in the photos. Logos do not overlap each other unless a photo
   shows it. Write the exceptions in `overlapRules`; everything else is "keep apart".

## Method

- **Views worth finding before you decide the layers are complete:** a straight front, a flat side, a close-up of a door, the rear, and above all a **top view** (roof, wing top and rear window show nowhere else). If the brief has none, look through the folder of photos for one. This is a suggestion from experience, not a rule: a livery may need others.

- Look at each reference in turn; note which view it is (`left` means the car's left side, nose to the left of the picture).
- Use more than one photo per element: size and colour are easier to judge from a straight side or front view.
- Ask yourself what you would draw first if you could only keep three things. Those are the layers that carry the look.
- Write the analysis into the brief as the JSON above, one object per layer:
  `{"kind":"tonal-art","what":"grey ink feathers","where":"all body panels","tone":"subtle","confidence":"medium","evidence":"a.jpg left, door and rear quarter","notes":"slightly darker than body, denser near the doors"}`.
  Kinds: `base large-graphic tonal-art accent marking logo text plate`. Tone: `subtle` or `bold`.
- **Write `where` with the car's own words** (hood, roof, doors, sills, rear, wing, nose, mirrors): `apply`'s review checks that something is placed in each place you name ("claw: hood, roof, doors" fails if the roof has none).
  Give a design element `"covers": "<word from the layer>"` when its name does not match the layer.
- **Then give every layer a `source`** (the next `brief show` step asks for it): `fetch` = a brand mark or logo that exists as a file (the claw, MOTUL, GoPro, PORSCHE, a club crest): never redraw it; `generate` = livery art with no file (grey leaves, vines, cracks, splatter: `pattern` placeholders);
  `construct` = text, numbers, plates, solid colours the kit draws; `stock` = already on the car's own texture (the N/E stickers); `skip` = leave out, with `why` and a decision. For `fetch`, set `asset` to the prepared file once it exists.
- **Every layer needs `confidence` and `evidence`** (`brief show` will not move on without them):
  `high` = clearly seen and identified in a photo; `medium` = seen but small or blurred, or identified by shape or context only;
  `low` = a guess. `evidence` names the reference photo and view (and where in it) that shows the layer. If you cannot name a photo, the
  confidence is not high.
- **Marks you recognise by shape.** Three slanted bars on a Monster Energy car are very likely the Monster claw; a lion between two bars is
  Peugeot. Write `"brand"` and `"part"` (`wordmark`, `symbol` or `both`) and put `medium` unless a word or caption confirms it. The brief
  then asks the user to confirm the read before anything is searched or downloaded; once confirmed, the usual "needs an image file" step finds the asset: search for the brand's own file (skill `ac-logos`), never redraw a brand mark.
  The same brand often has two parts on the car (a symbol and a wordmark): list them as two layers.
- **Doubt is information, not failure.** A `low` layer becomes a question to the user that quotes your evidence ("I am not sure about the
  small script near the roof (b.jpg front): what is it?"). Ask it; do not build a guess into the livery. Record the answer in the brief.
- **Self-check before you place anything:** re-read each layer as if someone else wrote it. Could you point to the photo? Did you mix up two
  similar marks? Did you split symbol and wordmark? Are numbers or lettering in a made-up style (note the style: italic, stencil, brush)?
- Then turn each layer into one or more brief elements (`aclivery brief add <slug> elements ...`) with a panel target.
  `aclivery brief show <slug>` will insist that subtle layers have an element.

## Output check

Before you start placing: the brief has an analysis with a layer for every kind you can see, each subtle layer has an
element, and you can say in one sentence what makes this livery recognisable.
