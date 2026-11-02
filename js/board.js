const GLYPH = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
import { pieceSVG } from "./pieces.js";
const FILES = "abcdefgh";

export function glyph(type) {
  return GLYPH[type] + "\uFE0E";
}

export class ChessBoard {
  constructor(el, options) {
    this.el = el;
    this.onMove = options.onMove;
    this.canMove = options.canMove || function () { return true; };
    this.game = null;
    this.flipped = false;
    this.selected = null;
    this.targets = [];
    this.lastMove = null;
    this.locked = false;

    this.el.addEventListener("click", (e) => {
      const sq = e.target.closest(".sq");
      if (sq) this.handleClick(sq.dataset.square);
    });
  }

  setGame(game) { this.game = game; }
  setLastMove(move) { this.lastMove = move; }
  setLocked(value) { this.locked = value; }
  clearSelection() { this.selected = null; this.targets = []; }

  flip() {
    this.flipped = !this.flipped;
    this.render();
  }

  kingSquare(grid, color) {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const p = grid[row][col];
        if (p && p.type === "k" && p.color === color) {
          return FILES[col] + (8 - row);
        }
      }
    }
    return null;
  }

  render() {
    const game = this.game;
    if (!game) return;

    const grid = game.board();
    const checkSquare = game.inCheck() ? this.kingSquare(grid, game.turn()) : null;
    const targetSet = new Set(this.targets.map((m) => m.to));

    this.el.innerHTML = "";

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const row = this.flipped ? 7 - r : r;
        const col = this.flipped ? 7 - c : c;
        const name = FILES[col] + (8 - row);
        const piece = grid[row][col];

        const sq = document.createElement("div");
        sq.className = "sq " + ((row + col) % 2 === 0 ? "light" : "dark");
        sq.dataset.square = name;

        if (name === this.selected) sq.classList.add("selected");
        if (this.lastMove && (name === this.lastMove.from || name === this.lastMove.to)) {
          sq.classList.add("last-move");
        }
        if (name === checkSquare) sq.classList.add("in-check");
        if (targetSet.has(name)) {
          sq.classList.add("legal");
          if (piece) sq.classList.add("has-piece");
        }

        if (piece) {
          const span = document.createElement("span");
          span.className = "piece " + piece.color;
          span.textContent = glyph(piece.type);
          sq.appendChild(span);
        }

        if (c === 0) {
          const rank = document.createElement("span");
          rank.className = "coord rank";
          rank.textContent = String(8 - row);
          sq.appendChild(rank);
        }
        if (r === 7) {
          const file = document.createElement("span");
          file.className = "coord file";
          file.textContent = FILES[col];
          sq.appendChild(file);
        }

        this.el.appendChild(sq);
      }
    }
  }

  async handleClick(square) {
    if (this.locked || !this.game) return;
    const game = this.game;

    const matching = this.targets.filter((m) => m.to === square);
    if (this.selected && matching.length > 0) {
      const from = this.selected;
      let promotion;
      if (matching[0].promotion) {
        promotion = await this.askPromotion(game.turn());
      }
      this.clearSelection();
      this.render();
      await this.onMove(from, square, promotion);
      return;
    }

    const piece = game.get(square);
    if (piece && piece.color === game.turn() && this.canMove(piece.color)) {
      this.selected = square;
      this.targets = game.moves({ square: square, verbose: true });
    } else {
      this.clearSelection();
    }
    this.render();
  }

  askPromotion(color) {
    return new Promise((resolve) => {
      const modal = document.getElementById("promo-modal");
      const box = document.getElementById("promo-choices");
      box.innerHTML = "";

      ["q", "r", "b", "n"].forEach((type) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = glyph(type);
        btn.style.background = "#ebecd0";
        btn.style.color = color === "w" ? "#fff" : "#111";
        btn.style.textShadow = color === "w" ? "0 0 2px #000, 0 0 3px #000" : "none";
        btn.addEventListener("click", () => {
          modal.classList.add("hidden");
          resolve(type);
        });
        box.appendChild(btn);
      });

      modal.classList.remove("hidden");
    });
  }
}
