# game-2d3denginejs API Reference

This document describes the public API for the JavaScript 2D/3D game engine in this repository.

## Table of contents

- [Overview](#overview)
- [Browser usage](#browser-usage)
- [Module exports](#module-exports)
- [Game](#game)
- [Sprite](#sprite)
- [Game3D](#game3d)
- [Sprite3D](#sprite3d)
- [PhysicsBody](#physicsbody)
- [PhysicsWorld](#physicsworld)
- [Physics2D and Physics3D](#physics2d-and-physics3d)
- [Common option objects](#common-option-objects)

## Overview

The engine exposes these primary classes:

- `Game`
- `Sprite`
- `Game3D`
- `Sprite3D`
- `Physics2D`
- `Physics3D`

In a browser, these are attached to `window` when the script loads:

```html
<script src="./2d-engine.js"></script>
<script>
  const game = new Game("demo");
  const sprite = new Sprite(32, 32, { color: "#00d1b2" });
  console.log(window.Game, window.Sprite, window.Engine);
</script>
```

## Browser usage

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>2D Engine Demo</title>
  </head>
  <body>
    <canvas id="game" width="800" height="600"></canvas>

    <script src="./2d-engine.js"></script>
    <script>
      const canvas = document.getElementById("game");
      const game = new Game("demo").setCanvas(canvas);

      const player = new Sprite(64, 64, {
        x: 100,
        y: 100,
        color: "#fbbf24"
      });

      game.add(player);

      game.loadAssets({
        hero: "assets/hero.png"
      }).then(() => {
        game.start({
          update: (delta) => {
            player.x += 120 * delta;
            if (player.x > canvas.width) player.x = -player.width;
          },
          render: (ctx) => {
            ctx.fillStyle = "#111827";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (game.assets.hero) {
              ctx.drawImage(game.assets.hero, player.x, player.y, player.width, player.height);
            } else {
              player.draw(ctx);
            }
          }
        });
      });
    </script>
  </body>
</html>
```

## Module exports

CommonJS / Node style:

```js
const {
  Game,
  Sprite,
  Game3D,
  Sprite3D,
  Physics2D,
  Physics3D
} = require("./index.js");
```

There is also a convenience API object exported by the engine:

```js
const Engine = require("./index.js");

const game = Engine.createGame({ type: "demo" });
```

## Game

### Constructor

```js
new Game(type = "game")
```

### Parameters

- `type` (`string`, optional): label for the game instance. Default is `"game"`.

### Properties

- `startTime` (`number`): timestamp when the game instance was created.
- `type` (`string`): game type label.
- `heroes` (`Sprite[]`): array of sprites added to the game.
- `keysListeners` (`Map<string, Function>`): callbacks registered for keyboard keys.
- `canvas` (`HTMLCanvasElement | null`): canvas used by the game.
- `context` (`CanvasRenderingContext2D | null`): canvas 2D context.
- `assets` (`Object<string, HTMLImageElement>`): loaded image assets keyed by name.
- `playing` (`boolean`): whether the animation loop is running.
- `_frameId` (`number | null`): current animation frame ID.
- `_lastTime` (`number | null`): previous frame timestamp.

### Static properties

- `Game.keys` (`Object<string, boolean>`): global keyboard state.
- `Game.inputInstalled` (`boolean`): whether keyboard listeners were installed.

### Static methods

#### `Game.normalizeKey(key)`

Normalizes a key name.

```js
Game.normalizeKey("A"); // "a"
Game.normalizeKey("ArrowLeft"); // "ArrowLeft"
```

Parameters:
- `key` (`string | null | undefined`)

Returns:
- `string`

#### `Game.installInput()`

Attaches global input listeners for keyboard events.

Returns:
- `void`

### Instance methods

#### `getTimeElapsed()`

Returns game runtime in seconds.

```js
const elapsed = game.getTimeElapsed();
```

Returns:
- `number`

#### `setCanvas(canvas)`

```js
game.setCanvas(document.getElementById("game"));
```

Parameters:
- `canvas` (`HTMLCanvasElement`)

Returns:
- `this`

#### `background(color)`

```js
game.background("#111827");
```

Parameters:
- `color` (`string`): CSS color string

Returns:
- `this`

#### `loadAssets(sources = {})`

Loads image assets and stores them inside `this.assets`.

```js
await game.loadAssets({
  hero: "assets/hero.png",
  coin: {
    src: "assets/coin.png",
    fallback: "assets/coin-alt.png"
  }
});
```

Parameters:
- `sources` (`Object<string, string | { src: string, fallback?: string }>`)

Returns:
- `Promise`

Notes:
- each entry creates an `Image()` object
- if load fails and a fallback exists, it retries that fallback
- the resolved value is an array of loaded images in input order

#### `initCanvas(width, height)`

Creates a canvas element and appends it to the page.

```js
game.initCanvas(800, 600);
```

Parameters:
- `width` (`number`)
- `height` (`number`)

Returns:
- `this`

#### `registerKey({ key, callback })`

Registers a keyboard callback.

```js
game.registerKey({
  key: ["ArrowLeft", "a"],
  callback: (delta, currentGame) => {
    // move left
  }
});
```

Parameters:
- `key` (`string | string[]`)
- `callback` (`Function`): called when the key is active

Returns:
- `this`

#### `add(sprite)`

Adds a sprite to the game.

```js
game.add(player);
```

Parameters:
- `sprite` (`Sprite`)

Returns:
- `Sprite`

#### `draw(context = this.context)`

Draws every sprite in `this.heroes`.

Parameters:
- `context` (`CanvasRenderingContext2D`, optional)

Returns:
- `void`

#### `start({ update, render, afterDraw, background } = {})`

Starts the animation loop.

```js
game.start({
  update: (delta, g) => {
    player.x += 120 * delta;
  },
  render: (ctx, g, delta) => {
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, g.canvas.width, g.canvas.height);
  },
  background: "#111827"
});
```

Options:
```js
{
  update?: (delta, game) => void,
  render?: (ctx, game, delta) => void,
  afterDraw?: (ctx, game, delta) => void,
  background?: string | ((ctx, game) => void)
}
```

Returns:
- `this`

#### `startPlatformer(options = {})`

Starts a 2D platformer game loop.

```js
game.startPlatformer({
  player,
  platforms,
  enemies,
  spawn: { x: 40, y: 300 },
  speed: 250,
  jumpSpeed: 560,
  gravity: 1500,
  lives: 3,
  timeLimit: 100,
  onUpdate: (result) => console.log(result),
  onEnd: (won, result) => console.log(won, result)
});
```

Options:
```js
{
  player,
  platforms: [],
  enemies: [],
  goal: null,
  spawn: { x: 40, y: 300 },
  speed: 250,
  jumpSpeed: 560,
  gravity: 1500,
  lives: 3,
  timeLimit: 100,
  jumpThroughPlatforms: false,
  onUpdate: () => {},
  onEnd: () => {},
  render: () => {}
}
```

Properties:
- `player` (`Sprite`)
- `platforms` (`Sprite[]`)
- `enemies` (`Sprite[]`)
- `goal` (`Sprite | null`)
- `spawn` (`{ x: number, y: number }`)
- `speed` (`number`)
- `jumpSpeed` (`number`)
- `gravity` (`number`)
- `lives` (`number`)
- `timeLimit` (`number`)
- `jumpThroughPlatforms` (`boolean`)
- `onUpdate(result)`
- `onEnd(won, result)`
- `render` (`Function`)

Returns:
- `this`

#### `stop()`

Stops the current animation loop.

Returns:
- `this`

## Sprite

### Constructor

```js
new Sprite(width, height, ops = {})
```

### Parameters

- `width` (`number`)
- `height` (`number`)
- `ops` (`object`, optional)

### Common `ops` values

```js
{
  angle: 0,
  originX: 0.5,
  originY: 0.5,
  x: 0,
  y: 0,
  offsetX: 0,
  offsetY: 0,
  colliderWidth: width,
  colliderHeight: height,
  boundingColliderUpdater: null,
  shape: "rect",
  image: null,
  asset: null,
  color: "#4c83e6",
  stroke: null,
  lineWidth: 1,
  radius: 0,
  text: "",
  textColor: "#ffffff",
  font: "700 16px system-ui, sans-serif"
}
```

### Properties

- `angle` (`number`)
- `originX` (`number`)
- `originY` (`number`)
- `width` (`number`)
- `height` (`number`)
- `x` (`number`)
- `y` (`number`)
- `offsetX` (`number`)
- `offsetY` (`number`)
- `colliderWidth` (`number`)
- `colliderHeight` (`number`)
- `boundingColliderUpdater` (`Function | null`)
- `shape` (`"rect" | "circle" | "star"`)
- `image` (`HTMLImageElement | null`)
- `asset` (`string | null`)
- `color` (`string`)
- `stroke` (`string | null`)
- `lineWidth` (`number`)
- `radius` (`number`)
- `text` (`string`)
- `textColor` (`string`)
- `font` (`string`)

### Static property

- `Sprite.numSprites` (`number`)

### Methods

#### `rotate(radians)`

Parameters:
- `radians` (`number`)

Returns:
- `this`

#### `setAngle(radians)`

Parameters:
- `radians` (`number`)

Returns:
- `this`

#### `draw(context, options = {})`

```js
sprite.draw(ctx, { color: "#ff0000" });
```

Parameters:
- `context` (`CanvasRenderingContext2D`)
- `options` (`object`, optional)

Options can override properties like `image`, `color`, `shape`, `text`, `stroke`, `font`.

#### `getBoundingBox()`

Returns:
```js
{
  x, y, width, height,
  left, top, right, bottom
}
```

#### `collidesWith(other)`

Parameters:
- `other` (`Sprite | object with getBoundingBox`)

Returns:
- `boolean`

#### `setPosition(x, y)`

Parameters:
- `x` (`number`)
- `y` (`number`)

Returns:
- `this`

#### `move(dx, dy)`

Parameters:
- `dx` (`number`)
- `dy` (`number`)

Returns:
- `this`

#### `clampTo(width, height)`

Parameters:
- `width` (`number`)
- `height` (`number`)

Returns:
- `this`

## Game3D

### Constructor

```js
new Game3D()
```

### Properties

- `heroes` (`Sprite3D[]`)
- `keysListeners` (`Map<string, Function>`)
- `canvas` (`HTMLCanvasElement | null`)
- `gl` (`WebGLRenderingContext | null`)
- `assets` (`Object<string, HTMLImageElement>`)
- `textures` (`Object<string, WebGLTexture>`)
- `playing` (`boolean`)
- `_frameId` (`number | null`)
- `_lastTime` (`number | null`)
- `camera` (`object`)
  ```js
  {
    x: 0, y: 8, z: 14,
    targetX: 0, targetY: 0, targetZ: 0,
    fov: Math.PI / 3,
    near: 0.1,
    far: 1000
  }
  ```

### Static properties

- `Game3D.keys` (`Object<string, boolean>`)
- `Game3D.inputInstalled` (`boolean`)

### Static methods

#### `Game3D.normalizeKey(key)`

#### `Game3D.installInput()`

### Instance methods

#### `setCanvas(canvas)`

Sets the WebGL canvas and initializes the renderer.

Parameters:
- `canvas` (`HTMLCanvasElement`)

Returns:
- `this`

#### `initCanvas(width, height)`

Creates a WebGL canvas appended to the document.

#### `background(color)`

Parameters:
- `color` (`string`)

#### `registerKey({ key, callback })`

Same usage as `Game.registerKey`.

#### `add(sprite)`

Adds a `Sprite3D` object to the scene.

#### `loadAssets(sources = {})`

Loads image assets for 3D and creates WebGL textures.

Returns:
- `Promise`

#### `draw()`

Draws all visible 3D sprites.

#### `start({ update, render, afterDraw, background } = {})`

Starts the WebGL animation loop.

#### `startPlatformer3D(options = {})`

Starts a 3D platformer loop.

Options include:
```js
{
  player,
  platforms: [],
  enemies: [],
  spawn: { x: 0, y: 2, z: 0 },
  speed: 6,
  jumpSpeed: 10,
  gravity: 24,
  lives: 3,
  timeLimit: 100,
  jumpThroughPlatforms: false,
  bounds: null,
  cameraRelativeMovement: false,
  onUpdate: () => {},
  onEnd: () => {},
  render: () => {}
}
```

#### `getTimeElapsed()`

Returns elapsed time in seconds.

#### `stop()`

Stops the loop.

### Static helper methods

- `Game3D.colorToRgba(color)`
- `Game3D.cubeVertices()`
- `Game3D.identity()`
- `Game3D.multiply(a, b)`
- `Game3D.modelMatrix(sprite)`
- `Game3D.perspective(fov, aspect, near, far)`
- `Game3D.lookAt(eye, target, up)`

## Sprite3D

### Constructor

```js
new Sprite3D(width = 1, height = 1, depth = 1, options = {})
```

### Parameters

- `width` (`number`)
- `height` (`number`)
- `depth` (`number`)
- `options` (`object`)

### Common `options`

```js
{
  x: 0,
  y: 0,
  z: 0,
  color: "#4c83e6",
  asset: null,
  uvScale: [1, 1],
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  colliderWidth: width,
  colliderHeight: height,
  colliderDepth: depth,
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0
}
```

### Properties

- `width`, `height`, `depth`
- `x`, `y`, `z`
- `color`
- `asset`
- `uvScale`
- `rotationX`, `rotationY`, `rotationZ`
- `colliderWidth`, `colliderHeight`, `colliderDepth`
- `offsetX`, `offsetY`, `offsetZ`

### Methods

#### `setPosition(x, y, z)`

#### `move(dx, dy, dz)`

#### `setRotation(x, y, z)`

#### `rotate(x = 0, y = 0, z = 0)`

#### `setAngle(radians)`

Sets `rotationY`.

#### `getBoundingBox()`

Returns box values including `left`, `right`, `top`, `bottom`, `front`, and `back`.

#### `collidesWith(other)`

#### `clampTo(width, height, depth)`

## PhysicsBody

### Constructor

```js
new PhysicsBody(dimensions, options = {})
```

### Parameters

- `dimensions` (`2 | 3`)
- `options` (`object`)

### Common `options`

```js
{
  x: 0,
  y: 0,
  z: 0,
  width: 1,
  height: 1,
  depth: 1,
  static: false,
  mass: 1,
  restitution: 0.05,
  friction: 0.5,
  damping: 0,
  vx: 0,
  vy: 0,
  vz: 0
}
```

### Properties

- `dimensions` (`2 | 3`)
- `x`, `y`, `z`
- `width`, `height`, `depth`
- `static` (`boolean`)
- `mass` (`number`)
- `restitution` (`number`)
- `friction` (`number`)
- `damping` (`number`)
- `vx`, `vy`, `vz`
- `grounded` (`boolean`)
- `_force` (`{ x, y, z }`)

### Methods

#### `applyForce(x, y, z = 0)`

#### `setVelocity(x, y, z = 0)`

## PhysicsWorld

### Constructor

```js
new PhysicsWorld(dimensions, options = {})
```

### Options

```js
{
  gravityX: 0,
  gravityY: -9.81,
  gravityZ: 0,
  maxSubstep: 1 / 60
}
```

### Properties

- `dimensions` (`2 | 3`)
- `gravity` (`{ x, y, z }`)
- `maxSubstep` (`number`)
- `bodies` (`PhysicsBody[]`)

### Methods

#### `addBody(bodyOrOptions = {})`

Parameters:
- `bodyOrOptions` (`PhysicsBody | object`)

Returns:
- `PhysicsBody`

#### `removeBody(body)`

#### `step(delta)`

Parameters:
- `delta` (`number`)

#### `_stepOnce(dt)`

#### `_resolve(a, b, axes)`

## Physics2D and Physics3D

### Physics2D

```js
const world2d = new Physics2D.World({ gravityY: 600 });
const body2d = new Physics2D.Body({
  x: 50,
  y: 50,
  width: 40,
  height: 20
});
```

`Physics2D.World` extends `PhysicsWorld` and uses a 2D physics simulation.

`Physics2D.Body` extends `PhysicsBody` and uses 2D dimensions.

### Physics3D

```js
const world3d = new Physics3D.World({ gravityY: -9.81 });
const body3d = new Physics3D.Body({
  x: 0,
  y: 2,
  z: 0,
  width: 1,
  height: 1,
  depth: 1
});
```

`Physics3D.World` extends `PhysicsWorld` and uses a 3D physics simulation.

`Physics3D.Body` extends `PhysicsBody` and uses 3D dimensions.

## Common option objects

### Asset map

```js
{
  hero: "assets/hero.png",
  enemy: {
    src: "assets/enemy.png",
    fallback: "assets/enemy-alt.png"
  }
}
```

### Key binding

```js
{
  key: "ArrowLeft",
  callback: (delta, game) => {
    // input handling
  }
}
```

or:

```js
{
  key: ["ArrowLeft", "a"],
  callback: (delta, game) => {
    // input handling
  }
}
```

### Sprite creation options

```js
{
  x: 100,
  y: 100,
  color: "#00d1b2",
  asset: "hero",
  shape: "rect",
  text: "Player",
  textColor: "#ffffff",
  font: "700 16px sans-serif"
}
```

### Physics body configuration

```js
{
  x: 0,
  y: 0,
  z: 0,
  width: 32,
  height: 32,
  depth: 32,
  mass: 1,
  friction: 0.5,
  restitution: 0.1,
  damping: 0,
  static: false
}
```

## Quick summary

```js
const game = new Game("demo");
const sprite = new Sprite(32, 32, { x: 0, y: 0, color: "#fff" });

game.add(sprite);
game.loadAssets({ sprite: "assets/sprite.png" });

game.start({
  update(delta, g) {},
  render(ctx, g, delta) {},
  background: "#111827"
});
```

This is the public API currently exposed by the engine in this repository.
