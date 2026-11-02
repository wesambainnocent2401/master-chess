export const BOARD_THEMES = [
  { id: "classic", name: "Classic Green" },
  { id: "wood", name: "Walnut Wood" },
  { id: "ocean", name: "Ocean Blue" },
  { id: "purple", name: "Royal Purple" },
  { id: "midnight", name: "Midnight" },
  { id: "coral", name: "Coral Sand" }
];

function applyBoardTheme(id) {
  document.documentElement.setAttribute("data-board", id);
}

// Apply the saved theme right away
applyBoardTheme(localStorage.getItem("boardTheme") || "classic");

export function initBoardThemes(select) {
  if (!select) return;
  const saved = localStorage.getItem("boardTheme") || "classic";

  BOARD_THEMES.forEach((t) => {
    const option = document.createElement("option");
    option.value = t.id;
    option.textContent = "Board: " + t.name;
    select.appendChild(option);
  });
  select.value = saved;

  select.addEventListener("change", () => {
    localStorage.setItem("boardTheme", select.value);
    applyBoardTheme(select.value);
  });
}
