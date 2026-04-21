This directory contains vendored MapLibre glyph PBF assets served from the app itself.

Current bundle:
- Noto Sans Regular/0-255.pbf

Source:
- Vendored from the public MapLibre demo glyph bundle at https://demotiles.maplibre.org/font/
- Runtime requests still resolve only to the local app path under /map-glyphs/.

Why only 0-255:
- The current fullscreen map uses this font only for cluster-count labels.
- Those labels stay within the ASCII range, so 0-255 covers the current production usage.

If future map labels need additional Unicode ranges, add the required `{start}-{end}.pbf` files under the same fontstack directory and keep the runtime glyph URL pointed at `/map-glyphs/{fontstack}/{range}.pbf`.