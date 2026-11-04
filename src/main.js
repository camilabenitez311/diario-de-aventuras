/* =========================================
   ELEMENTOS DEL LIBRO
   ========================================= */

const book = document.getElementById("book");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const pageCounter = document.getElementById("pageCounter");

const addPageBtn = document.getElementById("addPageBtn");
const printBtn = document.getElementById("printBtn");

const pageModal = document.getElementById("pageModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");

const pageForm = document.getElementById("pageForm");
const photoInputs = document.getElementById("photoInputs");
const photoCount = document.getElementById("photoCount");

const musicBtn = document.getElementById("musicBtn");
const backgroundMusic = document.getElementById("backgroundMusic");

const heartsContainer = document.getElementById("heartsContainer");

const STORAGE_KEY = "diario_aventuras_pages";

let pages = [];
let currentIndex = 0;
let isTurning = false;
let isSaving = false;

/* =========================================
   LEER RECUERDOS GUARDADOS
   ========================================= */

try {
  const stored = JSON.parse(
    localStorage.getItem(STORAGE_KEY) || "[]"
  );

  pages = Array.isArray(stored) ? stored : [];
} catch (error) {
  console.error("No se pudo leer el diario:", error);
}

/* =========================================
   UTILIDADES
   ========================================= */

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return replacements[character];
  });
}

function normalizePhotos(photos = []) {
  if (!Array.isArray(photos)) return [];

  return photos
    .map((photo) => {
      if (typeof photo === "string") {
        return {
          src: photo,
          caption: "",
        };
      }

      return {
        src: photo?.src || "",
        caption: photo?.caption || "",
      };
    })
    .filter((photo) => photo.src);
}

function persistPages(nextPages) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(nextPages)
    );

    pages = nextPages;

    return true;
  } catch (error) {
    console.error("Error de guardado:", error);

    alert(
      "No se pudo guardar. El almacenamiento del navegador " +
      "puede estar lleno. Prueba con fotos más livianas. " +
      "El formulario seguirá abierto."
    );

    return false;
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);

    reader.onerror = () => {
      reject(new Error("No se pudo leer la imagen."));
    };

    reader.readAsDataURL(file);
  });
}
function createBackCover() {
  const section = document.createElement("section");

  section.className = "book-back-cover";

  section.innerHTML = `
    <img class="back-cover-photo" src="/foto-contraportada.jpg" alt="Foto de la contraportada" loading="eager" />
    <div class="back-cover-veil" aria-hidden="true"></div>
    <div class="back-cover-content">
      <span class="back-cover-heart" aria-hidden="true">
        ♥
      </span>

      <p class="back-cover-message">
        Lo más bonito de nuestra historia es que todavía
        nos quedan muchas páginas por vivir.
      </p>

      <div class="back-cover-divider" aria-hidden="true"></div>

      <p class="back-cover-signature">
        Contigo, siempre.
      </p>

      <span class="back-cover-small">
        Nuestro Diario de Aventuras
      </span>
    </div>
  `;

  return section;
}
/* =========================================
   PORTADA
   ========================================= */

function createCoverPage() {
  const section = document.createElement("section");

  section.className = "page cover";

  section.innerHTML = `
    <div class="cover-content">
      <p class="cover-small">
        Un libro hecho con amor
      </p>

      <h1 class="cover-title">
        Nuestro Diario de Aventuras
      </h1>

      <p class="cover-text">
        Cada foto, cada lugar y cada momento
        forman parte de nuestra historia.
      </p>

      <button
        type="button"
        class="btn btn-primary cover-open no-print"
        data-open-book
      >
        Abrir nuestro libro
      </button>
    </div>
  `;

  return section;
}

/* =========================================
   DEDICATORIA DE CUMPLEAÑOS
   ========================================= */

function createDedicationPage() {
  const section = document.createElement("section");

  section.className = "page birthday-text-page";

  section.innerHTML = `
    <div class="birthday-text-layout">

      <header class="birthday-text-heading">
        <span class="birthday-text-date">
          8 de noviembre
        </span>

        <h2 class="birthday-text-title">
          Feliz cumpleaños,<br />
          mi chico
        </h2>

        <div class="birthday-text-divider" aria-hidden="true">
          <span></span>
          <i>♥</i>
          <span></span>
        </div>
      </header>

      <div
        class="birthday-text-scroll"
        tabindex="0"
        role="region"
        aria-label="Dedicatoria de cumpleaños. Desplázate para leer el mensaje completo."
      >
        <article class="birthday-text-letter">

          <p class="birthday-text-greeting">
            Monito mío:
          </p>

          <p>
            Cada año siento que es más especial que el anterior,
            cada año quiero que sea más recordado por ti que el
            anterior, y aunque para ti es como “un día cualquiera”,
            para mí siempre será más importante que mi propio día.
          </p>

          <p>
            Monito mío, hoy es un día más para recordarte lo
            importante que es tu existencia para todos los que
            te amamos, lo feliz que me hacen los 8 de noviembre
            desde que estás en mi vida y, en general, lo feliz
            que me hace tu existencia tan bonita.
          </p>

          <p>
            Gracias por cada uno de tus esfuerzos, gracias por
            ser ese niño de ojitos bonitos que llena mi vida
            de amor, gracias por siempre estar para mí,
            en mis momentos felices y en los que no tanto,
            por amarme y consentirme cada día de tu vida.
          </p>

          <p>
            Gracias por permitirme conocerte, estar para ti y
            apoyarte en cada uno de tus momentos, y si sigo
            agradeciéndote, este libro se quedaría sin páginas.
            Solo me queda decirte...
          </p>

          <p class="birthday-text-highlight">
            FELIZ CUMPLEAÑOS MI CHICO.
          </p>

          <p>
            Y sí, esta página quizás no sea referente a tu
            cumpleaños, pero está llena de amor y de todo
            lo que tu existir ocasiona en mí.
          </p>

          <p class="birthday-text-love">
            TE AMOO 3 MILLONES MI GUAPO!
          </p>

          <div class="birthday-text-question">
            <span aria-hidden="true">♥</span>

            <p>
              ¿Estás listo para continuar este viaje a mi lado?...
            </p>
          </div>

        </article>
      </div>

      <footer class="birthday-text-footer no-print">
        <span>
          Desliza dentro del mensaje para seguir leyendo ↓
        </span>

        <button
          type="button"
          class="btn btn-primary"
          data-continue-journey
        >
          Sí, sigamos juntos →
        </button>
      </footer>

    </div>
  `;

  return section;
}
/* =========================================
   PÁGINAS DE RECUERDOS
   ========================================= */

function createTextPage(data, index) {
  const section = document.createElement("section");

  section.className = "page text-only-page";

  const paragraphs = String(data.text || "")
    .split(/\n\s*\n/)
    .filter((paragraph) => paragraph.trim())
    .map(
      (paragraph) => `
        <p>${escapeHtml(paragraph.trim())}</p>
      `
    )
    .join("");

  section.innerHTML = `
    <div class="simple-text-layout">

      <header class="simple-text-header">
        <h2 class="simple-text-title">
          ${escapeHtml(data.title)}
        </h2>

        <div class="simple-text-divider" aria-hidden="true">
          <span></span>
          <i>♥</i>
          <span></span>
        </div>
      </header>

      <div class="simple-text-content">
        ${paragraphs}
      </div>

      <button
        type="button"
        class="delete-page no-print"
        data-delete="${index}"
      >
        Eliminar esta página
      </button>

    </div>
  `;

  return section;
}

function createStoryPage(data, index) {
  if (data.kind === "text") return createTextPage(data, index);
  const section = document.createElement("section");

  section.className = "page";

  const photos = normalizePhotos(data.photos);

  const photosHtml = photos
    .map(
      (photo) => `
        <figure class="polaroid">
          <div class="polaroid-photo">
            <img
              src="${escapeHtml(photo.src)}"
              alt="${escapeHtml(
        photo.caption || "Recuerdo del diario"
      )}"
            />
          </div>

          <figcaption class="polaroid-caption">
            ${escapeHtml(
        photo.caption || "Un momento especial"
      )}
          </figcaption>
        </figure>
      `
    )
    .join("");

  section.innerHTML = `
    <div class="page-inner">
      <header class="page-header">
        <div>
          <h2 class="page-title">
            ${escapeHtml(data.title)}
          </h2>

          ${data.date
      ? `
                <p class="page-date">
                  ${escapeHtml(data.date)}
                </p>
              `
      : ""
    }
        </div>

        <span class="page-type">
          ${escapeHtml(data.type || "Momento especial")}
        </span>
      </header>

      <div
        class="polaroid-grid"
        data-count="${photos.length}"
      >
        ${photosHtml}
      </div>

      ${data.text
      ? `
            <p class="page-text">${escapeHtml(data.text)}</p>
          `
      : ""
    }

      <button
        type="button"
        class="delete-page no-print"
        data-delete="${index}"
      >
        Eliminar esta página
      </button>
    </div>
  `;

  return section;
}

/* =========================================
   ORGANIZACIÓN DEL LIBRO
   ========================================= */

function getSheets() {
  return [...book.querySelectorAll(".page")];
}

function updateControls() {
  const totalSheets = getSheets().length;

  prevBtn.disabled =
    isTurning || currentIndex === 0;

  nextBtn.disabled =
    isTurning || currentIndex >= totalSheets - 1;

  addPageBtn.disabled = isTurning;
  printBtn.disabled = isTurning;

  if (currentIndex === 0) {
    pageCounter.textContent = "Portada";
  } else if (currentIndex === 1) {
    pageCounter.textContent = "Una carta para ti";
  } else {
    pageCounter.textContent =
      `Recuerdo ${currentIndex - 1} de ${pages.length}`;
  }
}

function showCurrentPage() {
  getSheets().forEach((sheet, index) => {
    const isCurrent = index === currentIndex;

    sheet.classList.remove(
      "is-current",
      "is-under",
      "is-turning"
    );

    if (isCurrent) {
      sheet.classList.add("is-current");
    }

    sheet.inert = !isCurrent;

    sheet.setAttribute(
      "aria-hidden",
      String(!isCurrent)
    );
  });

  updateControls();
}

function renderBook(targetIndex = currentIndex) {
  book.replaceChildren();

  // Primera tapa.
  book.appendChild(createCoverPage());

  // Dedicatoria.
  book.appendChild(createDedicationPage());

  // Recuerdos y páginas de texto.
  pages.forEach((data, index) => {
    book.appendChild(createStoryPage(data, index));
  });

  // Última tapa: solo aparece al imprimir.
  book.appendChild(createBackCover());

  // La contraportada no usa la clase "page",
  // por eso no entra en la navegación del libro.
  const lastIndex = getSheets().length - 1;

  currentIndex = Math.max(
    0,
    Math.min(targetIndex, lastIndex)
  );

  showCurrentPage();
}

/* =========================================
   EFECTO DE PASAR HOJA
   ========================================= */

async function turnPage(direction) {
  if (
    isTurning ||
    !pageModal.classList.contains("hidden")
  ) {
    return;
  }

  const sheets = getSheets();
  const targetIndex = currentIndex + direction;

  if (
    targetIndex < 0 ||
    targetIndex >= sheets.length
  ) {
    return;
  }

  const current = sheets[currentIndex];
  const target = sheets[targetIndex];

  isTurning = true;
  updateControls();

  let animation;

  try {
    current.classList.remove("is-current");

    current.inert = true;
    target.inert = true;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const options = {
      duration: reduceMotion ? 1 : 850,
      easing: "cubic-bezier(0.45, 0, 0.25, 1)",
      fill: "forwards",
    };

    if (direction > 0) {
      target.classList.add("is-under");
      current.classList.add("is-turning");

      animation = current.animate(
        [
          { transform: "rotateY(0deg)" },
          { transform: "rotateY(-180deg)" },
        ],
        options
      );
    } else {
      current.classList.add("is-under");
      target.classList.add("is-turning");

      animation = target.animate(
        [
          { transform: "rotateY(-180deg)" },
          { transform: "rotateY(0deg)" },
        ],
        options
      );
    }

    await animation.finished;

    currentIndex = targetIndex;
  } catch (error) {
    console.error(
      "No se pudo completar la animación:",
      error
    );

    currentIndex = targetIndex;
  } finally {
    if (animation) {
      animation.cancel();
    }

    isTurning = false;
    showCurrentPage();
  }
}

prevBtn.addEventListener("click", () => {
  turnPage(-1);
});

nextBtn.addEventListener("click", () => {
  turnPage(1);
});

document.addEventListener("keydown", (event) => {
  const isTyping = event.target.closest(
    "input, textarea, select, [contenteditable]"
  );

  if (isTyping) return;

  if (event.key === "Escape") {
    closeModal();
    return;
  }

  if (!pageModal.classList.contains("hidden")) {
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    turnPage(1);
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    turnPage(-1);
  }
});

/* =========================================
   MÚSICA DE FONDO
   ========================================= */

backgroundMusic.volume = 0.25;

let musicManuallyPaused = false;
let waitingForMusicInteraction = true;
let musicStarting = false;
let resumeMusicOnReturn = false;

function updateMusicButton() {
  const isPlaying =
    !backgroundMusic.paused &&
    !backgroundMusic.ended;

  musicBtn.textContent = isPlaying ? "🔊" : "🎵";

  musicBtn.title = isPlaying
    ? "Pausar música"
    : "Reproducir música";

  musicBtn.setAttribute(
    "aria-label",
    musicBtn.title
  );
}

async function playMusic() {
  if (
    document.hidden ||
    musicManuallyPaused ||
    musicStarting
  ) {
    return;
  }

  if (!backgroundMusic.paused) {
    waitingForMusicInteraction = false;
    updateMusicButton();
    return;
  }

  musicStarting = true;

  try {
    await backgroundMusic.play();

    waitingForMusicInteraction = false;

    // Evita que siga sonando si la pestaña se ocultó
    // mientras se estaba iniciando la reproducción.
    if (document.hidden || musicManuallyPaused) {
      if (
        document.hidden &&
        !musicManuallyPaused
      ) {
        resumeMusicOnReturn = true;
      }

      backgroundMusic.pause();
    }
  } catch (error) {
    waitingForMusicInteraction =
      error.name === "NotAllowedError";

    if (error.name !== "NotAllowedError") {
      console.info(
        "No se pudo reproducir la canción:",
        error
      );
    }
  } finally {
    musicStarting = false;
    updateMusicButton();
  }
}

musicBtn.addEventListener("click", () => {
  if (backgroundMusic.paused) {
    musicManuallyPaused = false;
    waitingForMusicInteraction = true;

    playMusic();
  } else {
    musicManuallyPaused = true;
    waitingForMusicInteraction = false;
    resumeMusicOnReturn = false;

    backgroundMusic.pause();
    updateMusicButton();
  }
});

function startMusicOnInteraction(event) {
  if (
    !waitingForMusicInteraction ||
    musicManuallyPaused ||
    event.target.closest("#musicBtn")
  ) {
    return;
  }

  playMusic();
}

document.addEventListener(
  "click",
  startMusicOnInteraction
);

document.addEventListener("keydown", (event) => {
  if (
    event.key === "Enter" ||
    event.key === " "
  ) {
    startMusicOnInteraction(event);
  }
});

backgroundMusic.addEventListener("play", () => {
  waitingForMusicInteraction = false;
  updateMusicButton();
});

backgroundMusic.addEventListener(
  "pause",
  updateMusicButton
);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    resumeMusicOnReturn =
      !musicManuallyPaused &&
      (!backgroundMusic.paused || musicStarting);

    backgroundMusic.pause();
    updateMusicButton();
  } else {
    const shouldResume = resumeMusicOnReturn;

    resumeMusicOnReturn = false;

    if (
      shouldResume &&
      !musicManuallyPaused
    ) {
      playMusic();
    }
  }
});

window.addEventListener("pagehide", () => {
  if (
    !backgroundMusic.paused &&
    !musicManuallyPaused
  ) {
    resumeMusicOnReturn = true;
  }

  backgroundMusic.pause();
  updateMusicButton();
});

window.addEventListener("pageshow", (event) => {
  if (
    event.persisted &&
    resumeMusicOnReturn &&
    !musicManuallyPaused
  ) {
    resumeMusicOnReturn = false;
    playMusic();
  }
});

/* =========================================
   BOTONES DENTRO DEL LIBRO
   ========================================= */

book.addEventListener("click", (event) => {
  const openButton = event.target.closest(
    "[data-open-book]"
  );

  if (openButton) {
    if (
      !musicManuallyPaused &&
      !document.hidden
    ) {
      playMusic();
    }

    turnPage(1);
    return;
  }

  const continueButton = event.target.closest(
    "[data-continue-journey]"
  );

  if (continueButton) {
    if (pages.length > 0) {
      turnPage(1);
    } else {
      openModal();
    }

    return;
  }

  const deleteButton = event.target.closest(
    "[data-delete]"
  );

  if (!deleteButton || isTurning) return;

  const index = Number(
    deleteButton.dataset.delete
  );

  if (
    !confirm(
      "¿Quieres eliminar esta página del diario?"
    )
  ) {
    return;
  }

  const nextPages = pages.filter(
    (_, itemIndex) => itemIndex !== index
  );

  if (persistPages(nextPages)) {
    renderBook(currentIndex);
  }
});

/* =========================================
   VENTANA DEL FORMULARIO
   ========================================= */

function openModal() {
  if (isTurning) return;

  pageModal.classList.remove("hidden");

  document.getElementById("pageTitle").focus();
}

function closeModal() {
  if (isSaving) return;

  pageModal.classList.add("hidden");
}

addPageBtn.addEventListener("click", openModal);
closeModalBtn.addEventListener("click", closeModal);
cancelModalBtn.addEventListener("click", closeModal);

pageModal.addEventListener("click", (event) => {
  if (event.target === pageModal) {
    closeModal();
  }
});

/* =========================================
   CAMPOS DE FOTOS Y DESCRIPCIONES
   ========================================= */

function renderPhotoInputs(count) {
  while (photoInputs.children.length > count) {
    photoInputs.lastElementChild.remove();
  }

  while (photoInputs.children.length < count) {
    const index = photoInputs.children.length;

    const group = document.createElement("div");
    group.className = "photo-input-group";

    group.innerHTML = `
      <div class="photo-input-header">
        <span class="photo-number">
          ${index + 1}
        </span>

        Foto ${index + 1}
      </div>

      <label>
        Selecciona la foto

        <input
          type="file"
          accept="image/*"
          class="photo-file"
          required
        />
      </label>

      <label>
        Descripción de la foto

        <input
          type="text"
          class="photo-caption"
          maxlength="90"
          placeholder="Un recuerdo de este momento..."
        />
      </label>
    `;

    photoInputs.appendChild(group);
  }
}

const pageKindLabel = document.createElement("label");
pageKindLabel.innerHTML = `Tipo de página
  <select id="pageKind">
    <option value="photos">Fotos y recuerdos</option>
    <option value="text">Solo texto</option>
  </select>`;
pageForm.prepend(pageKindLabel);
const pageKind = document.getElementById("pageKind");

function syncPageKind() {
  const isText = pageKind.value === "text";
  for (const id of ["pageType", "pageDate", "photoCount"]) {
    const field = document.getElementById(id);
    field.closest("label").classList.toggle("hidden", isText);
    field.disabled = isText;
  }
  photoInputs.classList.toggle("hidden", isText);
  photoInputs.querySelectorAll("input").forEach((input) => {
    input.disabled = isText;
  });
  const textField = document.getElementById("pageText");
  textField.required = isText;
  textField.maxLength = isText ? 700 : 450;
  textField.rows = isText ? 9 : 3;
  textField.placeholder = isText
    ? "Escribe tu mensaje. Separa los párrafos con una línea en blanco..."
    : "Escribe por qué este momento fue especial...";
}
pageKind.addEventListener("change", syncPageKind);

photoCount.min = "1";
photoCount.max = "6";

photoCount.addEventListener("change", () => {
  const count = Math.max(
    1,
    Math.min(
      6,
      Math.round(Number(photoCount.value) || 1)
    )
  );

  photoCount.value = String(count);

  renderPhotoInputs(count);
});

/* =========================================
   GUARDAR UNA NUEVA PÁGINA
   ========================================= */

document.getElementById("pageTitle").maxLength = 60;
document.getElementById("pageText").maxLength = 450;

pageForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (isSaving) return;

  const submitButton = pageForm.querySelector(
    '[type="submit"]'
  );

  isSaving = true;

  submitButton.disabled = true;
  submitButton.textContent = "Guardando...";

  let saved = false;

  try {
    const photos = [];

    for (const group of (pageKind.value === "text" ? [] : photoInputs.children)) {
      const file = group.querySelector(
        ".photo-file"
      ).files[0];

      const caption = group.querySelector(
        ".photo-caption"
      ).value.trim();

      if (!file) {
        throw new Error(
          "Selecciona una imagen para cada foto."
        );
      }

      if (!file.type.startsWith("image/")) {
        throw new Error(
          "Selecciona únicamente archivos de imagen."
        );
      }

      photos.push({
        src: await fileToDataUrl(file),
        caption,
      });
    }

    const newPage = {
      kind: pageKind.value,
      title: document.getElementById(
        "pageTitle"
      ).value.trim(),

      type: document.getElementById(
        "pageType"
      ).value,

      date: document.getElementById(
        "pageDate"
      ).value,

      text: document.getElementById(
        "pageText"
      ).value.trim(),

      photos,
    };

    if (!newPage.title) {
      throw new Error(
        "Escribe el título de la página."
      );
    }

    if (newPage.kind === "text" && !newPage.text) {
      throw new Error("Escribe el texto de la carta.");
    }

    saved = persistPages([
      ...pages,
      newPage,
    ]);

    if (saved) {
      // 0 = portada, 1 = dedicatoria.
      // Los recuerdos comienzan en el índice 2.
      renderBook(pages.length + 1);

      pageForm.reset();

      photoCount.value = "2";

      photoInputs.replaceChildren();
      renderPhotoInputs(2);
      syncPageKind();
    }
  } catch (error) {
    console.error(error);

    alert(
      error.message ||
      "No se pudo crear la página."
    );
  } finally {
    isSaving = false;

    submitButton.disabled = false;
    submitButton.textContent = "Guardar página";

    if (saved) {
      closeModal();
    }
  }
});

/* =========================================
   IMPRESIÓN
   ========================================= */
printBtn.addEventListener("click", async () => {
  if (isTurning) return;
  printBtn.disabled = true;
  try {
    await document.fonts.ready;
    const photo = book.querySelector(".back-cover-photo");
    if (photo) {
      try {
        await photo.decode();
      } catch (error) {
        alert("No se pudo cargar la foto de contraportada. Revisa que exista public/foto-contraportada.jpg y que la extensión coincida. No se abrió la impresión para evitar una tapa sin foto.");
        return;
      }
    }
    window.print();
  } finally {
    printBtn.disabled = false;
  }
});

/* =========================================
   CORAZONES DEL FONDO
   ========================================= */

function createHearts() {
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (reduceMotion) return;

  setInterval(() => {
    if (document.hidden) return;

    const heart = document.createElement("span");

    heart.className = "heart";
    heart.textContent = "♥";

    heart.style.left =
      `${Math.random() * 100}%`;

    heart.style.fontSize =
      `${12 + Math.random() * 15}px`;

    heart.style.animationDuration =
      `${8 + Math.random() * 4}s`;

    heartsContainer.appendChild(heart);

    setTimeout(() => {
      heart.remove();
    }, 12500);
  }, 1100);
}

/* =========================================
   INICIAR
   ========================================= */

photoCount.value = "2";

renderPhotoInputs(2);
syncPageKind();
renderBook(0);
createHearts();

updateMusicButton();
playMusic();