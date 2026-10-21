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
4. **Accents**: small bold colours (mirrors, endplates, stripes, splatters). Which parts, which colour.
5. **Logos and wordmarks**: which brand, which variant (colour, mono), where, size, what they sit next to.
6. **Text and numbers**: names, number, plate lettering; font style; where.
7. **Plates and stickers**: door plates, windshield banner, other separate textures.
8. **Order and overlap**: what sits on top of what in the photos. Logos do not overlap each other unless a photo
   shows it. Write the exceptions in `overlapRules`; everything else is "keep apart".

## Method

- Look at each reference in turn; note which view it is (`left` means the car's left side, nose to the left of the picture).
- Use more than one photo per element: size and colour are easier to judge from a straight side or front view.
- Ask yourself what you would draw first if you could only keep three things. Those are the layers that carry the look.
- Write the analysis into the brief as the JSON above, one object per layer:
  `{"kind":"tonal-art","what":"grey ink feathers","where":"all body panels","tone":"subtle","notes":"slightly darker than body, denser near the doors"}`.
  Kinds: `base large-graphic tonal-art accent logo text plate`. Tone: `subtle` or `bold`.
- Then turn each layer into one or more brief elements (`aclivery brief add <slug> elements ...`) with a panel target.
  `aclivery brief show <slug>` will insist that subtle layers have an element.

## Output check

Before you start placing: the brief has an analysis with a layer for every kind you can see, each subtle layer has an
element, and you can say in one sentence what makes this livery recognisable.
