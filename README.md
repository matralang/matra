# Matra Graphics

An expressive, state-based TypeScript API for composing lightweight SVG graphics.

```ts
import { circle, fill, strokeStyle, strokeWeight, svgLayout } from './module.ts';

fill('#ff4d6d');
strokeStyle('#171717');
strokeWeight(3);

const artwork = svgLayout([circle(128, 128, 72)], 256, 256, {
  background: '#fffaf0',
  title: 'A coral circle',
});
```

## API

- Shapes: `circle`, `rect`, `ellipse`, `line`, `path`, `polygon`, `polyline`, `text`
- Composition: `g`, `element`, `svg`, `svgLayout`, `fromAst`
- Style: `fill`, `noFill`, `strokeStyle`, `noStroke`, `strokeWeight`, `textSize`
- State: `push`, `pop`, `reset`, `setCanvasSize`, `getCtx`

`svgLayout` escapes XML, supports transparent or coloured backgrounds, and can add an accessible title and description.

## Development

```sh
npm test
npm run build
```

The build command renders each file in `example/page/` to `example/dist/<name>.svg`.
