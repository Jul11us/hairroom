# Hairstyle comparison demonstration assets

Generated on 2026-10-15 using the built-in `image_gen.imagegen` tool.

Both contact sheets show fictional AI-generated adult models. They are demonstration examples, not user photos, real customer results, or evidence of personalized analysis. They must be labeled as examples in the interface. Each contact sheet was generated once as one complete image, then copied without image editing. Natural generative variation exists between panels; identity preservation on a real user's photo has not been validated by these assets.

## Files and panels

Both files are 1254 x 1254 PNG images. Each panel is 627 x 627. Pixel coordinates below use a top-left origin and right/bottom-exclusive rectangles.

| File | Panel | Rectangle `(x, y, width, height)` | CSS background position |
| --- | --- | --- | --- |
| `hairstyle-demo.png` | original | `(0, 0, 627, 627)` | `0% 0%` |
| `hairstyle-demo.png` | curtain-layers | `(627, 0, 627, 627)` | `100% 0%` |
| `hairstyle-demo.png` | airy-bob | `(0, 627, 627, 627)` | `0% 100%` |
| `hairstyle-demo.png` | soft-waves | `(627, 627, 627, 627)` | `100% 100%` |
| `hairstyle-demo-men.png` | original | `(0, 0, 627, 627)` | `0% 0%` |
| `hairstyle-demo-men.png` | crop | `(627, 0, 627, 627)` | `100% 0%` |
| `hairstyle-demo-men.png` | side-part | `(0, 627, 627, 627)` | `0% 100%` |
| `hairstyle-demo-men.png` | textured-quiff | `(627, 627, 627, 627)` | `100% 100%` |

Use a square container and `background-size: 200% 200%` for a single panel. Both sheets were visually inspected: all four panels render, hairstyles are distinct, and no added border, logo, or text appears. The requested size was 2048 x 2048; the tool returned 1254 x 1254.

## Women contact sheet: complete prompt

```text
Create one square photographic contact sheet, exactly 2 columns by 2 rows, four equal square panels tightly touching with no border, no divider, no gaps, no text, no logo, no collage decoration. Preferred output 2048x2048. This is a comparison of hairstyles on the SAME ONE fictional adult East Asian woman, around 26 years old. Maintain identical facial identity, facial proportions, eyes, nose, lips, face shape, expression, skin texture, and a calm subtle neutral expression in all four panels. Each panel has exactly the same straight-on camera pose and camera framing: head, complete hairstyle, neck and shoulders, enough headroom so no hair is cropped, face centered at the same relative coordinates within every panel. She wears the same plain minimalist white top in every panel. Soft natural warm-gray studio background and refined natural editorial photographic lighting, realistic pores and skin texture, authentic understated editorial beauty photography rather than a retouched beauty advertisement. Do not beautify or slim the face. Change ONLY her hair between panels. Top-left panel: original hairstyle, medium-long dark brown straight hair, no bangs, natural center-ish part. Top-right panel: curtain-layers hairstyle, dark brown medium-long layers with curtain bangs gently framing both sides of the face. Bottom-left panel: airy-bob hairstyle, dark brown lightweight chin-length short bob, airy natural ends. Bottom-right panel: soft-waves hairstyle, dark brown collarbone-length soft gentle waves. Ensure all four styles are clearly distinct and photorealistic, while her face, pose, clothing, lighting, and composition stay the same. This model is fictional, AI generated, and not based on a real person.
```

## Men contact sheet: complete prompt

```text
Create one square photographic contact sheet, exactly 2 columns by 2 rows, four equal square panels tightly touching with no border, no divider, no gaps, no text, no logo, no collage decoration. Preferred output 2048x2048. This is a comparison of hairstyles on the SAME ONE fictional adult East Asian man, around 27 years old, clean-shaven. Maintain identical facial identity, facial proportions, eyes, nose, lips, face shape, expression, skin texture, and a calm subtle neutral expression in all four panels. Each panel has exactly the same straight-on camera pose and camera framing: head, complete hairstyle, neck and shoulders, enough headroom so no hair is cropped, face centered at the same relative coordinates within every panel. He wears the same plain minimalist white crewneck top in every panel. Soft natural warm-gray studio background and refined natural editorial photographic lighting, realistic pores and skin texture, authentic understated editorial portrait photography rather than a retouched beauty advertisement. Do not beautify or slim the face. Change ONLY his hair between panels. Top-left panel: original hairstyle, natural slightly overgrown black straight hair without deliberate styling, soft fringe covering some forehead and slightly longer sides. Top-right panel: crop hairstyle, clean textured short crop, shorter tidy sides and textured short fringe. Bottom-left panel: side-part hairstyle, neat natural side part with medium-short black hair, subtle volume, soft swept fringe, clean sides. Bottom-right panel: textured-quiff hairstyle, voluminous textured black short hair brushed upward and backward on top, short tidy sides, relaxed natural finish. Ensure all four styles are clearly distinct and photorealistic, while his face, pose, clothing, lighting, and composition stay the same. This model is fictional, AI generated, and not based on a real person.
```
