/* Lightweight AABB physics for browser games. Bodies use center-based coordinates. */
(function (global) {
  class PhysicsBody {
    constructor(dimensions, options = {}) {
      this.dimensions = dimensions;
      this.x = options.x ?? 0;
      this.y = options.y ?? 0;
      this.z = dimensions === 3 ? (options.z ?? 0) : undefined;
      this.width = options.width ?? 1;
      this.height = options.height ?? 1;
      this.depth = dimensions === 3 ? (options.depth ?? 1) : undefined;
      this.static = Boolean(options.static);
      this.mass = this.static ? Infinity : Math.max(0.0001, options.mass ?? 1);
      this.restitution = Math.max(0, Math.min(1, options.restitution ?? 0.05));
      this.friction = Math.max(0, options.friction ?? 0.5);
      this.damping = Math.max(0, options.damping ?? 0);
      this.vx = options.vx ?? 0;
      this.vy = options.vy ?? 0;
      this.vz = dimensions === 3 ? (options.vz ?? 0) : undefined;
      this.grounded = false;
      this._force = { x: 0, y: 0, z: 0 };
    }

    applyForce(x, y, z = 0) {
      if (this.static) return this;
      this._force.x += x;
      this._force.y += y;
      if (this.dimensions === 3) this._force.z += z;
      return this;
    }

    setVelocity(x, y, z = 0) {
      this.vx = x;
      this.vy = y;
      if (this.dimensions === 3) this.vz = z;
      return this;
    }
  }

  class PhysicsWorld {
    constructor(dimensions, options = {}) {
      this.dimensions = dimensions;
      this.gravity = { x: options.gravityX ?? 0, y: options.gravityY ?? -9.81, z: options.gravityZ ?? 0 };
      this.maxSubstep = Math.max(1 / 1000, options.maxSubstep ?? 1 / 60);
      this.bodies = [];
    }

    addBody(bodyOrOptions = {}) {
      const body = bodyOrOptions instanceof PhysicsBody
        ? bodyOrOptions
        : new PhysicsBody(this.dimensions, bodyOrOptions);
      if (body.dimensions !== this.dimensions) throw new TypeError("Body dimensions do not match this physics world.");
      this.bodies.push(body);
      return body;
    }

    removeBody(body) {
      const index = this.bodies.indexOf(body);
      if (index !== -1) this.bodies.splice(index, 1);
      return this;
    }

    step(delta) {
      if (!Number.isFinite(delta) || delta <= 0) return this;
      const elapsed = Math.min(delta, 0.25);
      const count = Math.max(1, Math.ceil(elapsed / this.maxSubstep));
      const dt = elapsed / count;
      for (let step = 0; step < count; step++) this._stepOnce(dt);
      return this;
    }

    _stepOnce(dt) {
      const axes = this.dimensions === 3 ? ["x", "y", "z"] : ["x", "y"];
      for (const body of this.bodies) {
        body.grounded = false;
        if (body.static) continue;
        body.vx += (this.gravity.x + body._force.x / body.mass) * dt;
        body.vy += (this.gravity.y + body._force.y / body.mass) * dt;
        if (this.dimensions === 3) body.vz += (this.gravity.z + body._force.z / body.mass) * dt;
        const damping = Math.exp(-body.damping * dt);
        body.vx *= damping;
        body.vy *= damping;
        if (this.dimensions === 3) body.vz *= damping;
        body.x += body.vx * dt;
        body.y += body.vy * dt;
        if (this.dimensions === 3) body.z += body.vz * dt;
        body._force.x = body._force.y = body._force.z = 0;
      }

      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < this.bodies.length; i++) {
          for (let j = i + 1; j < this.bodies.length; j++) {
            this._resolve(this.bodies[i], this.bodies[j], axes);
          }
        }
      }
    }

    _resolve(a, b, axes) {
      const ***** = {};
      for (const axis of axes) {
        const size = axis === "x" ? "width" : axis === "y" ? "height" : "depth";
        *****[axis] = (a[size] + b[size]) / 2 - Math.abs(b[axis] - a[axis]);
        if (*****[axis] <= 0) return;
      }
      if (a.static && b.static) return;
      const axis = axes.reduce((best, item) => *****[item] < *****[best] ? item : best, axes[0]);
      const normal = b[axis] >= a[axis] ? 1 : -1;
      const invA = a.static ? 0 : 1 / a.mass;
      const invB = b.static ? 0 : 1 / b.mass;
      const invTotal = invA + invB;
      const correction = *****[axis] / invTotal;
      if (!a.static) a[axis] -= normal * correction * invA;
      if (!b.static) b[axis] += normal * correction * invB;

      const relativeNormal = (b[`v${axis}`] - a[`v${axis}`]) * normal;
      let impulse = 0;
      if (relativeNormal < 0) {
        const restitution = Math.min(a.restitution, b.restitution);
        impulse = -(1 + restitution) * relativeNormal / invTotal;
        if (!a.static) a[`v${axis}`] -= normal * impulse * invA;
        if (!b.static) b[`v${axis}`] += normal * impulse * invB;
      }
      if (axis === "y" && normal < 0) a.grounded = true;
      if (axis === "y" && normal > 0) b.grounded = true;

      const friction = Math.sqrt(a.friction * b.friction);
      for (const tangent of axes) {
        if (tangent === axis) continue;
        const relative = b[`v${tangent}`] - a[`v${tangent}`];
        const frictionImpulse = Math.max(-impulse * friction, Math.min(impulse * friction, -relative / invTotal));
        if (!a.static) a[`v${tangent}`] -= frictionImpulse * invA;
        if (!b.static) b[`v${tangent}`] += frictionImpulse * invB;
      }
    }
  }

  global.Physics2D = {
    Body: class PhysicsBody2D extends PhysicsBody { constructor(options) { super(2, options); } },
    World: class PhysicsWorld2D extends PhysicsWorld { constructor(options) { super(2, options); } }
  };
  global.Physics3D = {
    Body: class PhysicsBody3D extends PhysicsBody { constructor(options) { super(3, options); } },
    World: class PhysicsWorld3D extends PhysicsWorld { constructor(options) { super(3, options); } }
  };
})(typeof window !== "undefined" ? window : globalThis);
