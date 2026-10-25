---
name: ac-panels
description: Find which car panel is where, and which way up
version: 0.1.0
license: PolyForm-Noncommercial-1.0.0
---

# Panels

A panel is a named patch of the texture that wraps one piece of bodywork (for example a name like `left_door`, or whatever the model author used).

```
aclivery panel regions <car>                          9 human-named regions, panels inside each
aclivery panel list <car> --side left --min-visible 0.8 --limit 10
aclivery panel list <car> --region hood_and_front_fenders
aclivery panel get <car> <panel>                     one panel in full
aclivery panel textures <car>                         other textures a skin can override
aclivery panel list <car> --texture <small texture>       small textures: a `whole` panel, plus `left`/`right` if each side uses a part
```

Reading a row: `left_rear  left  rot=0  vis=0.980  rect=[0.304 0.638 0.308 0.359]  4:left_side`

- `side`: from the panel name. `right` panels are the car's right.
- `rot`: degrees the image must be turned so it reads upright on the car. `aclivery decal` applies it for you.
- `vis`: share of the panel visible from outside (0..1). Below ~0.3 it is mostly hidden; do not put sponsors there.
  High `vis` does not mean the right place: a roof-edge or window strip can read 0.84. Check `centroid3d` height (doors sit around 0.5-0.8 m)
  and probe with `render --probe` before placing anything that matters.
- `rect`: `[u v w h]` in the texture, fractions, `v` from the top.
- Names are the model author's and differ from car to car (a side, an end, `_upper`/`_lower` and numbers for sub-panels are common):
  read them from `panel list` and `car notes <car>`. Do not trust a name alone: check with `--probe` in `ac-render` when unsure.
- **Choosing between candidates** (e.g. which panel is the door): `aclivery panel get <car> <name>` shows `centroid3d`
  and `extent3d` in metres (x: +left, y: up, z: forward). A door is about 1.2 m long at mid-z. `vis` can be low for a
  real panel that is partly shielded (a door can read about 0.4 because the mirror and the wheel shield part of it): judge by position and size, and use `vis` to
  avoid hidden panels (under 0.3).
- Many panels are tagged `mirrored`: their partner is on the other side. Do both sides explicitly.
- `rot=-` means no rotation is needed (same as 0).
- `aclivery panel list` shows the 25 biggest first. Use `--limit` and filters instead of asking for everything.
