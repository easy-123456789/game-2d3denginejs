class Game3D {
  static keys = Object.create(null);
  static inputInstalled = false;

  constructor() {
    this.heroes = [];
    this.keysListeners = new Map();
    this.canvas = null;
    this.gl = null;
    this.assets = Object.create(null);
    this.textures = Object.create(null);
    this.playing = false;
    this._frameId = null;
    this._lastTime = null;
    this.camera = {
      x: 0, y: 8, z: 14,
      targetX: 0, targetY: 0, targetZ: 0,
      fov: Math.PI / 3, near: 0.1, far: 1000
    };
    Game3D.installInput();
  }

  static normalizeKey(key) {
    return key.toLowerCase();
  }

  static installInput() {
    if (Game3D.inputInstalled || typeof window === "undefined") return;
    Game3D.inputInstalled = true;
    window.addEventListener("keydown", (event) => {
      const key = Game3D.normalizeKey(event.key);
      Game3D.keys[key] = true;
      if (key.startsWith("arrow") && document.activeElement?.tagName === "CANVAS") {
        event.preventDefault();
      }
    });
    window.addEventListener("keyup", (event) => {
      Game3D.keys[Game3D.normalizeKey(event.key)] = false;
    });
    window.addEventListener("blur", () => {
      for (const key of Object.keys(Game3D.keys)) Game3D.keys[key] = false;
    });
  }

  setCanvas(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl", { antialias: true, alpha: false });
    if (!this.gl) throw new Error("WebGL is not available in this browser.");
    this._initRenderer();
    return this;
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

  background(color) {
    this.clearColor = color;
    return this;
  }

  registerKey({ key, callback }) {
    for (const item of (Array.isArray(key) ? key : [key])) {
      this.keysListeners.set(Game3D.normalizeKey(item), callback);
    }
    return this;
  }

  add(sprite) {
    this.heroes.push(sprite);
    return sprite;
  }

  loadAssets(sources = {}) {
    return Promise.all(Object.entries(sources).map(([name, asset]) => new Promise((resolve, reject) => {
      const source = typeof asset === "string" ? asset : asset.src;
      const fallback = typeof asset === "string" ? null : asset.fallback;
      const image = new Image();
      const load = (url, isFallback = false) => {
        image.onload = () => {
          this.assets[name] = image;
          if (this.gl) this.textures[name] = this._createTexture(image);
          resolve(image);
        };
        image.onerror = () => {
          if (fallback && !isFallback) load(fallback, true);
          else reject(new Error(`Could not load image asset "${name}".`));
        };
        image.src = url;
      };
      load(source);
    })));
  }

  _initRenderer() {
    const gl = this.gl;
    const vertexShader = `
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      attribute vec2 aUV;
      uniform mat4 uModel;
      uniform mat4 uView;
      uniform mat4 uProjection;
      uniform vec2 uUVScale;
      varying vec3 vNormal;
      varying vec2 vUV;
      void main() {
        gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
        vNormal = mat3(uModel) * aNormal;
        vUV = aUV * uUVScale;
      }
    `;
    const fragmentShader = `
      precision mediump float;
      uniform vec4 uColor;
      uniform sampler2D uTexture;
      uniform bool uUseTexture;
      varying vec3 vNormal;
      varying vec2 vUV;
      void main() {
        vec3 light = normalize(vec3(-0.4, 0.8, 0.6));
        float shade = 0.38 + 0.62 * max(dot(normalize(vNormal), light), 0.0);
        vec4 surface = uUseTexture ? texture2D(uTexture, vUV) : uColor;
        gl_FragColor = vec4(surface.rgb * shade, surface.a);
      }
    `;
    const program = gl.createProgram();
    gl.attachShader(program, this._compileShader(gl.VERTEX_SHADER, vertexShader));
    gl.attachShader(program, this._compileShader(gl.FRAGMENT_SHADER, fragmentShader));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Could not initialize WebGL renderer: ${gl.getProgramInfoLog(program)}`);
    }
    this.program = program;
    this.locations = {
      position: gl.getAttribLocation(program, "aPosition"),
      normal: gl.getAttribLocation(program, "aNormal"),
      uv: gl.getAttribLocation(program, "aUV"),
      model: gl.getUniformLocation(program, "uModel"),
      view: gl.getUniformLocation(program, "uView"),
      projection: gl.getUniformLocation(program, "uProjection"),
      color: gl.getUniformLocation(program, "uColor"),
      texture: gl.getUniformLocation(program, "uTexture"),
      useTexture: gl.getUniformLocation(program, "uUseTexture"),
      uvScale: gl.getUniformLocation(program, "uUVScale")
    };
    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(Game3D.cubeVertices()), gl.STATIC_DRAW);
    this.vertexCount = 36;
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    for (const [name, image] of Object.entries(this.assets)) {
      this.textures[name] = this._createTexture(image);
    }
  }

  _compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(`Could not compile WebGL shader: ${gl.getShaderInfoLog(shader)}`);
    }
    return shader;
  }

  _createTexture(image) {
    const gl = this.gl;
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return texture;
  }

  draw() {
    if (!this.gl || !this.program) return;
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    const stride = 8 * Float32Array.BYTES_PER_ELEMENT;
    gl.enableVertexAttribArray(this.locations.position);
    gl.vertexAttribPointer(this.locations.position, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(this.locations.normal);
    gl.vertexAttribPointer(this.locations.normal, 3, gl.FLOAT, false, stride, 3 * Float32Array.BYTES_PER_ELEMENT);
    gl.enableVertexAttribArray(this.locations.uv);
    gl.vertexAttribPointer(this.locations.uv, 2, gl.FLOAT, false, stride, 6 * Float32Array.BYTES_PER_ELEMENT);

    const camera = this.camera;
    const view = Game3D.lookAt(
      [camera.x, camera.y, camera.z],
      [camera.targetX, camera.targetY, camera.targetZ],
      [0, 1, 0]
    );
    const projection = Game3D.perspective(
      camera.fov,
      this.canvas.width / this.canvas.height,
      camera.near,
      camera.far
    );
    gl.uniformMatrix4fv(this.locations.view, false, view);
    gl.uniformMatrix4fv(this.locations.projection, false, projection);

    for (const sprite of this.heroes) {
      if (sprite.visible === false) continue;
      const model = Game3D.modelMatrix(sprite);
      gl.uniformMatrix4fv(this.locations.model, false, model);
      const color = Game3D.colorToRgba(sprite.color);
      gl.uniform4fv(this.locations.color, color);
      const uv = sprite.uvScale;
      gl.uniform2f(
        this.locations.uvScale,
        Array.isArray(uv) ? uv[0] : 1,
        Array.isArray(uv) ? uv[1] : 1
      );
      const texture = sprite.asset ? this.textures[sprite.asset] : null;
      gl.uniform1i(this.locations.useTexture, texture ? 1 : 0);
      if (texture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(this.locations.texture, 0);
      }
      gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
    }
  }

  start({ update = () => {}, render = () => {}, afterDraw = () => {}, background = null } = {}) {
    if (!this.canvas || !this.gl || this._frameId !== null) return this;
    this.playing = true;
    this._lastTime = null;
    const frame = (time) => {
      if (!this.playing) return;
      const delta = this._lastTime === null ? 0 : Math.min((time - this._lastTime) / 1000, 0.05);
      this._lastTime = time;
      for (const [key, callback] of this.keysListeners) {
        if (Game3D.keys[key]) callback(delta, this);
      }
      update(delta, this);
      const gl = this.gl;
      const color = Game3D.colorToRgba(typeof background === "string" ? background : (this.clearColor || "#18202b"));
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(color[0], color[1], color[2], color[3]);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      render(gl, this, delta);
      this.draw();
      afterDraw(gl, this, delta);
      this._frameId = requestAnimationFrame(frame);
    };
    this._frameId = requestAnimationFrame(frame);
    return this;
  }

  startPlatformer3D({
    player, platforms = [], enemies = [], spawn = { x: 0, y: 2, z: 0 },
    speed = 6, jumpSpeed = 10, gravity = 24, lives = 3, timeLimit = 100,
    jumpThroughPlatforms = false, bounds = null, cameraRelativeMovement = false,
    onUpdate = () => {}, onEnd = () => {}, render = () => {}
  } = {}) {
    if (!player || !this.canvas) return this;
    const totalEnemies = enemies.length;
    for (const actor of [player, ...platforms, ...enemies]) {
      if (!this.heroes.includes(actor)) this.add(actor);
    }
    player._velocityY = 0;
    for (const enemy of enemies) enemy._velocityY = 0;
    this.startTime = Date.now();
    let remainingLives = lives;
    let invulnerable = 0;
    let wasJumping = false;
    let ended = false;

    const resetPlayer = () => {
      player.setPosition(spawn.x, spawn.y, spawn.z);
      player._velocityY = 0;
      invulnerable = 1;
    };
    const overlapsXZ = (a, b) => {
      const aa = a.getBoundingBox();
      const bb = b.getBoundingBox();
      return aa.left < bb.right && aa.right > bb.left && aa.front < bb.back && aa.back > bb.front;
    };

    this.start({
      render,
      update: (delta) => {
        if (ended) return;
        invulnerable = Math.max(0, invulnerable - delta);
        const left = Game3D.keys.arrowleft || Game3D.keys.a;
        const right = Game3D.keys.arrowright || Game3D.keys.d;
        const forward = Game3D.keys.arrowup || Game3D.keys.w;
        const backward = Game3D.keys.arrowdown || Game3D.keys.s;
        const jumping = Game3D.keys[" "] || Game3D.keys.space;
        const strafe = (right ? 1 : 0) - (left ? 1 : 0);
        const forwardInput = (forward ? 1 : 0) - (backward ? 1 : 0);
        if (cameraRelativeMovement) {
          let forwardX = this.camera.targetX - this.camera.x;
          let forwardZ = this.camera.targetZ - this.camera.z;
          const length = Math.hypot(forwardX, forwardZ) || 1;
          forwardX /= length;
          forwardZ /= length;
          player.x += (forwardX * forwardInput - forwardZ * strafe) * speed * delta;
          player.z += (forwardZ * forwardInput + forwardX * strafe) * speed * delta;
        } else {
          player.x += strafe * speed * delta;
          player.z += ((backward ? 1 : 0) - (forward ? 1 : 0)) * speed * delta;
        }
        if (bounds) {
          player.x = Math.max(bounds.minX, Math.min(bounds.maxX - player.width, player.x));
          player.z = Math.max(bounds.minZ, Math.min(bounds.maxZ - player.depth, player.z));
        }
        if (jumping && !wasJumping && player._grounded) {
          player._velocityY = jumpSpeed;
          player._grounded = false;
        }
        wasJumping = jumping;

        const oldBottom = player.y;
        player._velocityY -= gravity * delta;
        player.y += player._velocityY * delta;
        player._grounded = false;
        for (const platform of platforms) {
          if (!overlapsXZ(player, platform)) continue;
          const platformTop = platform.y + platform.height;
          if (player._velocityY <= 0 && oldBottom >= platformTop - 0.08 && player.y <= platformTop) {
            player.y = platformTop;
            player._velocityY = 0;
            player._grounded = true;
          } else if (!jumpThroughPlatforms && player._velocityY > 0 && player.y + player.height > platform.y && oldBottom + player.height <= platform.y) {
            player.y = platform.y - player.height;
            player._velocityY = 0;
          }
        }
        if (player.y + player.height < (bounds?.minY ?? -20)) {
          remainingLives--;
          resetPlayer();
        }

        for (const enemy of [...enemies]) {
          enemy.x += (enemy._direction ?? 1) * (enemy.speed ?? 1.5) * delta;
          if (enemy.x <= (enemy.minX ?? -Infinity) || enemy.x >= (enemy.maxX ?? Infinity)) {
            enemy._direction = -(enemy._direction ?? 1);
            enemy.x = Math.max(enemy.minX ?? enemy.x, Math.min(enemy.maxX ?? enemy.x, enemy.x));
          }
          const enemyBottom = enemy.y;
          enemy._velocityY = (enemy._velocityY ?? 0) - gravity * delta;
          enemy.y += enemy._velocityY * delta;
          for (const platform of platforms) {
            if (!overlapsXZ(enemy, platform)) continue;
            const top = platform.y + platform.height;
            if (enemy._velocityY <= 0 && enemyBottom >= top - 0.08 && enemy.y <= top) {
              enemy.y = top;
              enemy._velocityY = 0;
            }
          }
          if (!player.collidesWith(enemy) || invulnerable > 0) continue;
          if (player._velocityY < 0 && oldBottom >= enemy.y + enemy.height * 0.65) {
            player.y = enemy.y + enemy.height;
            player._velocityY = jumpSpeed * 0.55;
            enemies.splice(enemies.indexOf(enemy), 1);
            this.heroes.splice(this.heroes.indexOf(enemy), 1);
          } else {
            remainingLives--;
            resetPlayer();
          }
        }

        const elapsed = (Date.now() - this.startTime) / 1000;
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

  getTimeElapsed() {
    return (Date.now() - this.startTime) / 1000;
  }

  stop() {
    this.playing = false;
    if (this._frameId !== null) cancelAnimationFrame(this._frameId);
    this._frameId = null;
    return this;
  }

  static colorToRgba(color) {
    if (Array.isArray(color)) return color;
    if (typeof color !== "string") return [0.1, 0.13, 0.17, 1];
    const hex = color.trim().replace(/^#/, "");
    if (/^[\da-f]{3}$/i.test(hex)) {
      return [...hex].map((digit) => parseInt(digit + digit, 16) / 255).concat(1);
    }
    if (/^[\da-f]{6}$/i.test(hex)) {
      return [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16) / 255).concat(1);
    }
    return [0.1, 0.13, 0.17, 1];
  }

  static cubeVertices() {
    const data = [];
    const face = (normal, a, b, c, d) => {
      const points = [a, b, c, a, c, d];
      const uvs = [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]];
      points.forEach((point, i) => data.push(...point, ...normal, ...uvs[i]));
    };
    face([0, 0, 1], [-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5]);
    face([0, 0, -1], [.5, -.5, -.5], [-.5, -.5, -.5], [-.5, .5, -.5], [.5, .5, -.5]);
    face([1, 0, 0], [.5, -.5, .5], [.5, -.5, -.5], [.5, .5, -.5], [.5, .5, .5]);
    face([-1, 0, 0], [-.5, -.5, -.5], [-.5, -.5, .5], [-.5, .5, .5], [-.5, .5, -.5]);
    face([0, 1, 0], [-.5, .5, .5], [.5, .5, .5], [.5, .5, -.5], [-.5, .5, -.5]);
    face([0, -1, 0], [-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5], [-.5, -.5, .5]);
    return data;
  }

  static identity() {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  }

  static multiply(a, b) {
    const out = new Float32Array(16);
    for (let column = 0; column < 4; column++) {
      for (let row = 0; row < 4; row++) {
        out[column * 4 + row] = a[row] * b[column * 4] + a[4 + row] * b[column * 4 + 1] + a[8 + row] * b[column * 4 + 2] + a[12 + row] * b[column * 4 + 3];
      }
    }
    return out;
  }

  static modelMatrix(sprite) {
    const translation = Game3D.identity();
    translation[12] = sprite.x + sprite.width / 2;
    translation[13] = sprite.y + sprite.height / 2;
    translation[14] = sprite.z + sprite.depth / 2;
    const scale = Game3D.identity();
    scale[0] = sprite.width; scale[5] = sprite.height; scale[10] = sprite.depth;
    const cx = Math.cos(sprite.rotationX), sx = Math.sin(sprite.rotationX);
    const cy = Math.cos(sprite.rotationY), sy = Math.sin(sprite.rotationY);
    const cz = Math.cos(sprite.rotationZ), sz = Math.sin(sprite.rotationZ);
    const rx = Game3D.identity(), ry = Game3D.identity(), rz = Game3D.identity();
    rx[5] = cx; rx[6] = sx; rx[9] = -sx; rx[10] = cx;
    ry[0] = cy; ry[2] = -sy; ry[8] = sy; ry[10] = cy;
    rz[0] = cz; rz[1] = sz; rz[4] = -sz; rz[5] = cz;
    return Game3D.multiply(translation, Game3D.multiply(Game3D.multiply(Game3D.multiply(rz, ry), rx), scale));
  }

  static perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2);
    const range = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (near + far) * range, -1,
      0, 0, near * far * 2 * range, 0
    ]);
  }

  static lookAt(eye, target, up) {
    const normalize = (v) => {
      const length = Math.hypot(...v) || 1;
      return v.map((n) => n / length);
    };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const subtract = (a, b) => a.map((n, i) => n - b[i]);
    const z = normalize(subtract(eye, target));
    const x = normalize(cross(up, z));
    const y = cross(z, x);
    return new Float32Array([
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -x.reduce((sum, n, i) => sum + n * eye[i], 0),
      -y.reduce((sum, n, i) => sum + n * eye[i], 0),
      -z.reduce((sum, n, i) => sum + n * eye[i], 0), 1
    ]);
  }
}

class Sprite3D {
  constructor(width = 1, height = 1, depth = 1, options = {}) {
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.x = options.x ?? 0;
    this.y = options.y ?? 0;
    this.z = options.z ?? 0;
    this.color = options.color ?? "#4c83e6";
    this.asset = options.asset ?? null;
    this.uvScale = options.uvScale ?? [1, 1];
    this.rotationX = options.rotationX ?? 0;
    this.rotationY = options.rotationY ?? 0;
    this.rotationZ = options.rotationZ ?? 0;
    this.colliderWidth = options.colliderWidth ?? width;
    this.colliderHeight = options.colliderHeight ?? height;
    this.colliderDepth = options.colliderDepth ?? depth;
    this.offsetX = options.offsetX ?? 0;
    this.offsetY = options.offsetY ?? 0;
    this.offsetZ = options.offsetZ ?? 0;
  }

  setPosition(x, y, z) {
    this.x = x; this.y = y; this.z = z;
    return this;
  }

  move(dx, dy, dz) {
    return this.setPosition(this.x + dx, this.y + dy, this.z + dz);
  }

  setRotation(x, y, z) {
    this.rotationX = x; this.rotationY = y; this.rotationZ = z;
    return this;
  }

  rotate(x = 0, y = 0, z = 0) {
    this.rotationX += x; this.rotationY += y; this.rotationZ += z;
    return this;
  }

  setAngle(radians) {
    this.rotationY = radians;
    return this;
  }

  getBoundingBox() {
    const width = this.colliderWidth, height = this.colliderHeight, depth = this.colliderDepth;
    const x = this.x + this.offsetX, y = this.y + this.offsetY, z = this.z + this.offsetZ;
    return {
      left: x, right: x + width,
      bottom: y, top: y + height,
      front: z, back: z + depth,
      x, y, z, width, height, depth
    };
  }

  collidesWith(other) {
    if (!other || typeof other.getBoundingBox !== "function") return false;
    const a = this.getBoundingBox(), b = other.getBoundingBox();
    return a.left < b.right && a.right > b.left &&
      a.bottom < b.top && a.top > b.bottom &&
      a.front < b.back && a.back > b.front;
  }

  clampTo(width, height, depth) {
    return this.setPosition(
      Math.max(0, Math.min(width - this.width, this.x)),
      Math.max(0, Math.min(height - this.height, this.y)),
      Math.max(0, Math.min(depth - this.depth, this.z))
    );
  }
}
