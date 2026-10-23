# game-2d3denginejs

A lightweight JavaScript game engine for 2D, 3D, and browser physics demos.

## Features
- 2D canvas engine and sprite system
- 3D WebGL engine with cube rendering and camera helpers
- Physics worlds for 2D and 3D AABB collision
- Keyboard input helpers for platformer and arcade gameplay
- Demo pages for quick prototyping

## Quick start

### Browser usage

```html
<script src="./2d-engine.js"></script>
<script src="./game-engine-3d.js"></script>
<script src="./physics.js"></script>
<script src="./index.js"></script>

<script>
  const game = new Game("demo");
  const canvas = document.getElementById("game");
  game.setCanvas(canvas);

  const player = new Sprite(32, 48, { color: "#fbbf24" });
  player.setPosition(100, 100);
  game.add(player);

  game.start({
    render: (ctx) => {
      ctx.fillStyle = "#111827";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    },
    update: () => {
      player.x += 2;
    }
  });
</script>
```

### CommonJS / Node-compatible export

```js
const { Game, Sprite, Game3D, Sprite3D, Physics2D, Physics3D } = require("./index.js");
```

### CDN-style browser bundle

```html
<script src="https://cdn.example.com/engine.bundle.js"></script>
<script>
  const game = new Game();
  const world = new Physics2D.World({ gravityY: 600 });
</script>
```

## API overview

### Game
- `new Game(type = "game")`
- `setCanvas(canvas)`
- `initCanvas(width, height)`
- `background(color)`
- `add(sprite)`
- `loadAssets(sources)`
- `registerKey({ key, callback })`
- `start({ update, render, afterDraw, background })`
- `startPlatformer(options)`
- `stop()`

### Sprite
- `new Sprite(width, height, options)`
- `setPosition(x, y)`
- `move(dx, dy)`
- `draw(context)`
- `collidesWith(other)`
- `clampTo(width, height)`

### Game3D
- `new Game3D()`
- `setCanvas(canvas)`
- `initCanvas(width, height)`
- `background(color)`
- `loadAssets(sources)`
- `registerKey({ key, callback })`
- `start({ update, render, afterDraw })`
- `startPlatformer3D(options)`
- `stop()`

### Sprite3D
- `new Sprite3D(width, height, depth, options)`
- `setPosition(x, y, z)`
- `move(dx, dy, dz)`
- `setRotation(x, y, z)`
- `rotate(x, y, z)`
- `collidesWith(other)`

### Physics2D / Physics3D
- `new Physics2D.World(options)`
- `new Physics3D.World(options)`
- `addBody(bodyOrOptions)`
- `removeBody(body)`
- `step(delta)`
- `Body` objects with `setVelocity`, `applyForce`, `grounded`

## Demo pages
- `demos/2d-platformer.html`
- `demos/3d-scene.html`
- `demos/physics-demo.html`
- `demos/shooting.html`
- `demos/topdown.html`
- `demos/tilemap.html`
- `demos/particles.html`

## Local development

```bash
npm test
```

This verifies the JavaScript syntax for the engine source files and the packaged export file.
