class Game {
  static keys = Object.create(null);
  static inputInstalled = false;

  constructor(type = "game") {
    this.startTime = new Date();
    this.type = type;
    this.heroes = [];
    this.keysListeners = new Map();
    this.canvas = null;
    this.context = null;
    this.assets = Object.create(null);
    this.playing = false;
    this._frameId = null;
    this._lastTime = null;
    Game.installInput();
  }
  getTimeElapsed(){
    return (Date.now() - this.startTime) / 1000;
  }
  static installInput() {
    if (Game.inputInstalled || typeof window === "undefined") return;
    Game.inputInstalled = true;
    window.addEventListener("keydown", (event) => {
      const key = Game.normalizeKey(event.key);
      Game.keys[key] = true;
      if (key.toLowerCase().startsWith("arrow") && document.activeElement?.tagName === "CANVAS") {
        event.preventDefault();
      }
    });
    window.addEventListener("keyup", (event) => {
      Game.keys[Game.normalizeKey(event.key)] = false;
    });
    window.addEventListener("blur", () => {
      for (const key of Object.keys(Game.keys)) Game.keys[key] = false;
    });
  }

  static normalizeKey(key) {
    return key.length === 1 ? key.toLowerCase() : key;
  }

  setCanvas(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    return this;
  }

  background(color) {
    if (this.canvas) this.canvas.style.backgroundColor = color;
    return this;
  }

  loadAssets(sources = {}) {
    const entries = Object.entries(sources);
    return Promise.all(entries.map(([name, asset]) => new Promise((resolve, reject) => {
      const source = typeof asset === "string" ? asset : asset.src;
      const fallback = typeof asset === "string" ? null : asset.fallback;
      const image = new Image();
      image.onload = () => {
        this.assets[name] = image;
        resolve(image);
      };
      image.onerror = () => {
        if (fallback) {
          image.onerror = () => reject(new Error(`Could not load image asset "${name}" or its fallback.`));
          image.src = fallback;
        } else {
          reject(new Error(`Could not load image asset "${name}" from "${source}".`));
        }
      };
      image.src = source;
    })));
  }

  initCanvas(width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    document.body.appendChild(canvas);
    return this.setCanvas(canvas);
  }

  registerKey({ key, callback }) {
    const keys = Array.isArray(key) ? key : [key];
    for (const item of keys) {
      this.keysListeners.set(Game.normalizeKey(item), callback);
    }
    return this;
  }

  add(sprite) {
    this.heroes.push(sprite);
    return sprite;
  }

  draw(context = this.context) {
    if (!context) return;
    for (const sprite of this.heroes) {
      const image = sprite.asset ? this.assets[sprite.asset] : sprite.image;
      sprite.draw(context, image ? { image } : {});
    }
  }

  start({ update = () => {}, render = () => {}, afterDraw = () => {}, background = null } = {}) {
    if (!this.canvas || !this.context || !this.playing) return this;
    this.playing = true;
    this._lastTime = null;

    const frame = (time) => {
      if (!this.playing) return;
      const delta = this._lastTime === null ? 0 : Math.min((time - this._lastTime) / 1000, 0.05);
      this._lastTime = time;

      for (const [key, callback] of this.keysListeners) {
        if (Game.keys[key]) callback(delta, this);
      }
      update(delta, this);

      const ctx = this.context;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      if (typeof background === "string") {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      } else if (typeof background === "function") {
        background(ctx, this);
      }
      render(ctx, this, delta);
      this.draw(ctx);
      afterDraw(ctx, this, delta);
      this._frameId = requestAnimationFrame(frame);
    };

    this._frameId = requestAnimationFrame(frame);
    return this;
  }

  startPlatformer({
    player, platforms = [], enemies = [], goal = null, spawn = { x: 40, y: 300 },
    speed = 250, jumpSpeed = 560, gravity = 1500, lives = 3, timeLimit = 100,
    jumpThroughPlatforms = false,
    onUpdate = () => {}, onEnd = () => {}, render = () => {}
  } = {}) {
    if (!player || !this.canvas) return this;
    const actors = [player, ...platforms, ...enemies, ...(goal ? [goal] : [])];
    const totalEnemies = enemies.length;
    for (const actor of actors) if (!this.heroes.includes(actor)) this.add(actor);
    player._velocityY = 0;
    for (const enemy of enemies) enemy._velocityY = 0;
    this.startTime = Date.now();
    let remainingLives = lives;
    let invulnerable = 0;
    let wasJumping = false;
    let ended = false;

    this.start({
      render,
      update: (delta) => {
        if (ended) return;
        invulnerable = Math.max(0, invulnerable - delta);
        const left = Game.keys.arrowleft || Game.keys.a;
        const right = Game.keys.arrowright || Game.keys.d;
        const jumping = Game.keys.arrowup || Game.keys.w || Game.keys[' '];
        player.x += ((right ? 1 : 0) - (left ? 1 : 0)) * speed * delta;
        player.x = Math.max(0, Math.min(this.canvas.width - player.width, player.x));
        if (jumping && !wasJumping && player._grounded) {
          player._velocityY = -jumpSpeed;
          player._grounded = false;
        }
        wasJumping = jumping;

        const oldBottom = player.y + player.height;
        player._velocityY += gravity * delta;
        player.y += player._velocityY * delta;
        player._grounded = false;
        for (const platform of platforms) {
          if (!player.collidesWith(platform)) continue;
          if (player._velocityY >= 0 && oldBottom <= platform.y + 8) {
            player.y = platform.y - player.height;
            player._velocityY = 0;
            player._grounded = true;
          } else if (!jumpThroughPlatforms && player._velocityY < 0 && player.y < platform.y + platform.height) {
            player.y = platform.y + platform.height;
            player._velocityY = 0;
          }
        }
        if (player.y > this.canvas.height + player.height) {
          remainingLives--;
          player.setPosition(spawn.x, spawn.y);
          player._velocityY = 0;
          invulnerable = 1;
        }

        for (const enemy of [...enemies]) {
          enemy.x += (enemy._direction ?? 1) * (enemy.speed ?? 55) * delta;
          if (enemy.x <= (enemy.minX ?? 0) || enemy.x >= (enemy.maxX ?? this.canvas.width - enemy.width)) {
            enemy.x = Math.max(enemy.minX ?? 0, Math.min(enemy.maxX ?? this.canvas.width - enemy.width, enemy.x));
            enemy._direction = -(enemy._direction ?? 1);
          }

          const enemyOldBottom = enemy.y + enemy.height;
          enemy._velocityY = (enemy._velocityY ?? 0) + gravity * delta;
          enemy.y += enemy._velocityY * delta;
          for (const platform of platforms) {
            if (!enemy.collidesWith(platform)) continue;
            if (enemy._velocityY >= 0 && enemyOldBottom <= platform.y + 8) {
              enemy.y = platform.y - enemy.height;
              enemy._velocityY = 0;
            } else if (!jumpThroughPlatforms && enemy._velocityY < 0 && enemy.y < platform.y + platform.height) {
              enemy.y = platform.y + platform.height;
              enemy._velocityY = 0;
            }
          }

          if (!player.collidesWith(enemy) || invulnerable > 0) continue;
          if (player._velocityY > 0 && oldBottom <= enemy.y + 14) {
            player.y = enemy.y - player.height;
            player._velocityY = -jumpSpeed * 0.55;
            enemies.splice(enemies.indexOf(enemy), 1);
            this.heroes.splice(this.heroes.indexOf(enemy), 1);
          } else {
            remainingLives--;
            player.setPosition(spawn.x, spawn.y);
            player._velocityY = 0;
            invulnerable = 1;
          }
        }
        const elapsed = this.getTimeElapsed();
        const result = { lives: remainingLives, remaining: enemies.length, defeated: totalEnemies - enemies.length, elapsed };
        onUpdate(result);
        if (elapsed >= timeLimit) {
          ended = true;
          onEnd(false, { ...result, timeout: true });
        } else if (remainingLives <= 0) {
          ended = true;
          onEnd(false, result);
        } else if (enemies.length === 0) {
          ended = true;
          onEnd(true, { ...result, defeated: totalEnemies, remaining: 0 });
        }
      }
    });
    return this;
  }

  stop() {
    this.playing = false;
    if (this._frameId !== null) cancelAnimationFrame(this._frameId);
    this._frameId = null;
    return this;
  }
}

class Sprite {
  static numSprites = 0;

  constructor(width, height, ops = {}) {
    Sprite.numSprites++;
    this.angle = ops.angle ?? 0;
    this.originX = ops.originX ?? 0.5;
    this.originY = ops.originY ?? 0.5;
    this.width = width;
    this.height = height;
    this.x = 0;
    this.y = 0;
    this.offsetX = ops.offsetX ?? 0;
    this.offsetY = ops.offsetY ?? 0;
    this.colliderWidth = ops.colliderWidth ?? width;
    this.colliderHeight = ops.colliderHeight ?? height;
    this.boundingColliderUpdater =
      typeof ops.boundingColliderUpdater === "function" ? ops.boundingColliderUpdater : null;
    this.shape = ops.shape ?? "rect";
    this.image = ops.image ?? null;
    this.asset = ops.asset ?? null;
    this.color = ops.color ?? "#4c83e6";
    this.stroke = ops.stroke ?? null;
    this.lineWidth = ops.lineWidth ?? 1;
    this.radius = ops.radius ?? 0;
    this.text = ops.text ?? "";
    this.textColor = ops.textColor ?? "#ffffff";
    this.font = ops.font ?? "700 16px system-ui, sans-serif";
  }
  rotate(radians) {
    this.angle += radians;
    return this;
  }

  setAngle(radians) {
    this.angle = radians;
    return this;
  } 
  draw(context, options = {}) {
    if (!context) return;
    const style = { ...this, ...options };
    context.save();
    if (style.image?.complete && style.image.naturalWidth > 0) {
      context.drawImage(style.image, this.x, this.y, this.width, this.height);
      context.restore();
      return;
    }
    context.fillStyle = style.color;
    context.beginPath();

    if (style.shape === "circle") {
      context.ellipse(
        this.x + this.width / 2,
        this.y + this.height / 2,
        this.width / 2,
        this.height / 2,
        0,
        0,
        Math.PI * 2
      );
    } else if (style.shape === "star") {
      const cx = this.x + this.width / 2;
      const cy = this.y + this.height / 2;
      const outer = Math.min(this.width, this.height) / 2;
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? outer : outer * 0.45;
        const angle = -Math.PI / 2 + i * Math.PI / 5;
        const px = cx + Math.cos(angle) * radius;
        const py = cy + Math.sin(angle) * radius;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
    } else if (style.radius > 0 && typeof context.roundRect === "function") {
      context.roundRect(this.x, this.y, this.width, this.height, style.radius);
    } else {
      context.rect(this.x, this.y, this.width, this.height);
    }

    context.fill();
    if (style.stroke) {
      context.strokeStyle = style.stroke;
      context.lineWidth = style.lineWidth;
      context.stroke();
    }
    if (style.text) {
      context.fillStyle = style.textColor;
      context.font = style.font;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(style.text, this.x + this.width / 2, this.y + this.height / 2);
    }
    context.restore();
  }

  getBoundingBox() {
    const custom = this.boundingColliderUpdater?.(this) ?? {};
    const x = custom.x ?? custom.left ?? this.x + this.offsetX;
    const y = custom.y ?? custom.top ?? this.y + this.offsetY;
    const width = custom.width ?? this.colliderWidth;
    const height = custom.height ?? this.colliderHeight;
    const left = custom.left ?? x;
    const top = custom.top ?? y;
    const right = custom.right ?? left + width;
    const bottom = custom.bottom ?? top + height;
    return { x: left, y: top, width: right - left, height: bottom - top, left, top, right, bottom };
  }

  collidesWith(other) {
    if (!other || typeof other.getBoundingBox !== "function") return false;
    const a = this.getBoundingBox();
    const b = other.getBoundingBox();
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }

  move(dx, dy) {
    return this.setPosition(this.x + dx, this.y + dy);
  }

  clampTo(width, height) {
    return this.setPosition(
      Math.max(0, Math.min(width - this.width, this.x)),
      Math.max(0, Math.min(height - this.height, this.y))
    );
  }
}
