import "./detalles-galeria.css";

const book = document.getElementById("book");
const butterflies = new Map();
let queued = false;

const butterflySvg = `<span class="diary-butterfly-fly">
  <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
    <g class="diary-wing-left" fill="#da9a57" stroke="#98633d" stroke-width=".7">
      <path d="M16 18C10 1 0 4 3 13C4 18 10 20 16 18Z"/>
      <path d="M16 18C4 13 4 29 11 27C15 26 16 22 16 18Z" fill="#efc17c"/>
      <path d="M13 15L7 9M13 20L10 24" fill="none" stroke="#fff0c9" stroke-width="1.4"/>
    </g>
    <g class="diary-wing-right" fill="#da9a57" stroke="#98633d" stroke-width=".7">
      <path d="M16 18C22 1 32 4 29 13C28 18 22 20 16 18Z"/>
      <path d="M16 18C28 13 28 29 21 27C17 26 16 22 16 18Z" fill="#efc17c"/>
      <path d="M19 15L25 9M19 20L22 24" fill="none" stroke="#fff0c9" stroke-width="1.4"/>
    </g>
    <path d="M15 13Q16 11 17 13L17 24Q16 27 15 24Z" fill="#79533c"/>
    <path d="M16 14Q11 7 11 9M16 14Q21 7 21 9" fill="none" stroke="#79533c" stroke-width=".8"/>
  </svg>
</span>`;

function placeButterflies() {
  queued = false;
  for (const [page, entry] of butterflies) {
    const grid = entry.grid;
    if (!page.isConnected || !grid.isConnected) {
      entry.observer.disconnect();
      butterflies.delete(page);
      continue;
    }
    if (!grid.offsetWidth || !grid.offsetHeight) continue;
    let left = 0;
    let top = 0;
    let node = grid;
    while (node && node !== page) {
      left += node.offsetLeft;
      top += node.offsetTop;
      node = node.offsetParent;
    }
    entry.layer.style.left = `${left}px`;
    entry.layer.style.top = `${top}px`;
    entry.layer.style.width = `${grid.offsetWidth}px`;
    entry.layer.style.height = `${grid.offsetHeight}px`;
  }
}

function schedulePlacement() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(placeButterflies);
}

function enhance() {
  for (const page of book.querySelectorAll(".story-page")) {
    if (butterflies.has(page)) continue;
    const grid = page.querySelector(".polaroid-grid");
    if (!grid) continue;
    const description = page.querySelector(".story-description");
    if (page.dataset.photos === "2" && !description?.textContent.trim()) {
      page.classList.add("duo-without-description");
    }
    const layer = document.createElement("div");
    layer.className = "diary-butterfly-layer no-print";
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML = butterflySvg;
    // Se añade fuera de la cuadrícula: no cambia el recuento de fotos ni su impresión.
    page.appendChild(layer);
    const observer = new ResizeObserver(schedulePlacement);
    observer.observe(grid);
    butterflies.set(page, { grid, layer, observer });
  }
  schedulePlacement();
}

if (book) {
  const changes = new MutationObserver(enhance);
  changes.observe(book, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  enhance();
  addEventListener("resize", schedulePlacement);
  document.addEventListener("visibilitychange", () => {
    document.body.classList.toggle("diary-tab-hidden", document.hidden);
  });
}
