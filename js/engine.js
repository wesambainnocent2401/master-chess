const ENGINE_URL = "https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js";

export const LEVELS = [
  { id: 1, name: "Beginner", skill: 0, depth: 1, time: 100 },
  { id: 2, name: "Amateur", skill: 3, depth: 3, time: 300 },
  { id: 3, name: "Expert", skill: 8, depth: 6, time: 600 },
  { id: 4, name: "Pro", skill: 13, depth: 10, time: 1000 },
  { id: 5, name: "Legend", skill: 18, depth: 16, time: 1500 },
  { id: 6, name: "Super Legend", skill: 20, depth: 20, time: 3000 }
];

export class Engine {
  constructor() {
    // A worker cannot load a CDN script directly, so a tiny wrapper script loads it
    const wrapper = 'importScripts("' + ENGINE_URL + '");';
    const blob = new Blob([wrapper], { type: "text/javascript" });
    this.worker = new Worker(URL.createObjectURL(blob));
    this.lineHandler = null;
    this.failed = false;

    this.worker.onmessage = (e) => {
      const line = typeof e.data === "string" ? e.data : "";
      if (this.lineHandler) this.lineHandler(line);
    };
    this.worker.onerror = () => {
      this.failed = true;
      if (this.lineHandler) this.lineHandler("__error__");
    };

    this.ready = this.start();
  }

  // Send a command, then wait for a reply line that starts with `prefix`
  ask(command, prefix, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.lineHandler = null;
        reject(new Error("engine-timeout"));
      }, timeoutMs || 20000);

      this.lineHandler = (line) => {
        if (line === "__error__") {
          clearTimeout(timer);
          this.lineHandler = null;
          reject(new Error("engine-failed"));
        } else if (line.indexOf(prefix) === 0) {
          clearTimeout(timer);
          this.lineHandler = null;
          resolve(line);
        }
      };
      this.worker.postMessage(command);
    });
  }

  async start() {
    await this.ask("uci", "uciok", 30000);
    await this.ask("isready", "readyok", 30000);
  }

  newGame() {
    this.worker.postMessage("ucinewgame");
  }

  // Returns { from, to, promotion } for the best move at the chosen level
  async bestMove(fen, level) {
    await this.ready;
    this.worker.postMessage("setoption name Skill Level value " + level.skill);
    this.worker.postMessage("position fen " + fen);
    const line = await this.ask(
      "go depth " + level.depth + " movetime " + level.time,
      "bestmove",
      30000
    );
    const move = line.split(" ")[1];
    if (!move || move === "(none)") return null;
    return {
      from: move.slice(0, 2),
      to: move.slice(2, 4),
      promotion: move.length > 4 ? move[4] : undefined
    };
  }

  stop() {
    this.worker.terminate();
  }
}
