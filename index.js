(function (global) {
  const api = {
    version: "1.0.0",

    Game,
    Sprite,
    Game3D,
    Sprite3D,
    Physics2D,
    Physics3D,

    createGame(options = {}) {
      return new Game(options.type || "game");
    },

    create3DGame(options = {}) {
      return new Game3D(options);
    },

    createPhysics2D(options = {}) {
      return new Physics2D.World(options);
    },

    createPhysics3D(options = {}) {
      return new Physics3D.World(options);
    },

    installInput() {
      Game.installInput();
      return api;
    },

    normalizeKey(key) {
      return Game.normalizeKey(key);
    }
  };

  global.Game = Game;
  global.Sprite = Sprite;
  global.Game3D = Game3D;
  global.Sprite3D = Sprite3D;
  global.Physics2D = Physics2D;
  global.Physics3D = Physics3D;
  global.Engine = api;
  global.GameEngine = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
