function parts(type, detail) {
  switch (type) {
    case "p":
      return '<circle cx="22.5" cy="12" r="5.2"/>' +
        '<path d="M15.5 32.5C15.5 25.5 18 22.5 22.5 20c4.5 2.5 7 5.5 7 12.5z"/>' +
        '<rect x="11.5" y="32.5" width="22" height="4.5" rx="2"/>';
    case "r":
      return '<path d="M13 32.5V19.5h19v13z"/>' +
        '<path d="M11.5 19.5V9.5h5v3h3.5v-3h5v3h3.5v-3h5v10z"/>' +
        '<rect x="10.5" y="32.5" width="24" height="4.5" rx="2"/>';
    case "n":
      return '<path d="M12.5 33C12.5 25 15 20.5 20 17.5L14.5 15 21.5 6.5 23.5 9.5C31 10.5 35 18 34 33z"/>' +
        '<circle cx="23" cy="13.5" r="1.4" fill="' + detail + '" stroke="none"/>' +
        '<rect x="10.5" y="32.5" width="24" height="4.5" rx="2"/>';
    case "b":
      return '<circle cx="22.5" cy="6.5" r="2.2"/>' +
        '<ellipse cx="22.5" cy="15" rx="5.3" ry="7"/>' +
        '<path d="M16 33C16 27 18 24 22.5 21.5c4.5 2.5 6.5 5.5 6.5 11.5z"/>' +
        '<rect x="11.5" y="32.5" width="22" height="4.5" rx="2"/>' +
        '<path d="M22.5 10.5v6.5M19.5 13.8h6" stroke="' + detail + '" stroke-width="1.6" stroke-linecap="round" fill="none"/>';
    case "q":
      return '<path d="M12 32.5 9 14l7.5 7 1.5-11.5 4.5 11 4.5-11 1.5 11.5 7.5-7-3 18.5z"/>' +
        '<circle cx="9" cy="12.5" r="2.2"/><circle cx="18" cy="8" r="2.2"/>' +
        '<circle cx="27" cy="8" r="2.2"/><circle cx="36" cy="12.5" r="2.2"/>' +
        '<rect x="10.5" y="32.5" width="24" height="4.5" rx="2"/>';
    default: // king
      return '<path d="M13 32.5C12 25 14.5 20.5 22.5 18.5 30.5 20.5 33 25 32 32.5z"/>' +
        '<path d="M22.5 5v10M18.5 9h8" stroke-width="2.8" stroke-linecap="round" fill="none"/>' +
        '<rect x="10.5" y="32.5" width="24" height="4.5" rx="2"/>';
  }
}

export function pieceSVG(color, type) {
  const white = color === "w";
  const fill = white ? "#f7f4ea" : "#2f3447";
  const stroke = white ? "#1b2033" : "#080b16";
  const detail = white ? "#1b2033" : "#c9cfe6";
  return '<svg viewBox="0 0 45 45" xmlns="http://www.w3.org/2000/svg" fill="' + fill +
    '" stroke="' + stroke + '" stroke-width="1.4" stroke-linejoin="round">' +
    parts(type, detail) + "</svg>";
}
