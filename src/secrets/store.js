// Numbers some secrets keep (cranes folded, longest breath), in this
// visitor's browser.

export function remember(key) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

export function keep(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // not remembered; fine
  }
}
