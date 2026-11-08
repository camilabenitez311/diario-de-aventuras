import { cloud, initCloudPanel, cloudEnabled } from "./cloud.js";
import "./detalles-galeria.js";
import "./acceso-libro.css";
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
let draftCloudId = crypto.randomUUID();

/* =========================================
   LEER RECUERDOS GUARDADOS
   ========================================= */

// La copia local se conserva para exportar y migrar, pero la vista usa la nube.
pages = [];

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
        ...photo,
        src: photo?.src || "",
        caption: photo?.caption || "",
      };
    })
    .filter((photo) => photo.src);
}

async function persistPages(nextPages) {
  try {
    if (!cloudEnabled) throw new Error("Falta configurar Supabase");
    await cloud.persist(pages, nextPages);
    pages = await cloud.load();
    return true;
  } catch (error) {
    console.error(error);
    alert("No se pudo guardar: " + error.message + ". El formulario se conserva.");
    return false;
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      try {
        const maxSide = 1400;
        const scale = Math.min(
          1,
          maxSide / Math.max(image.naturalWidth, image.naturalHeight)
        );

        const canvas = document.createElement("canvas");

        canvas.width = Math.max(
          1,
          Math.round(image.naturalWidth * scale)
        );

        canvas.height = Math.max(
          1,
          Math.round(image.naturalHeight * scale)
        );

        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("No se pudo preparar la imagen.");
        }

        // Fondo blanco para imágenes con transparencia.
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);

        context.drawImage(
          image,
          0,
          0,
          canvas.width,
          canvas.height
        );

        const compressedImage = canvas.toDataURL(
          "image/jpeg",
          0.8
        );

        if (!compressedImage.startsWith("data:image/jpeg")) {
          throw new Error("No se pudo comprimir la imagen.");
        }

        resolve(compressedImage);
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);

      reject(
        new Error(
          "No se pudo abrir la foto. Prueba con una imagen JPG o PNG."
        )
      );
    };

    image.src = objectUrl;
  });
}
function createBackCover() {
  const section = document.createElement("section");

  section.className = "book-back-cover";

  section.innerHTML = `
    <img class="back-cover-photo" src="${import.meta.env.BASE_URL}foto-contraportada.jpg" alt="Foto de la contraportada" loading="eager" />
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

      ${cloud.editor ? `
        <button type="button" class="btn btn-primary cover-open no-print" data-open-book>
          Abrir nuestro libro
        </button>
      ` : `
        <form class="book-access no-print" data-book-unlock>
          <label class="book-access-label">
            Contraseña del libro
            <input type="password" name="password" autocomplete="current-password"
              placeholder="Escribe la contraseña" required aria-label="Contraseña del libro" />
          </label>
          <button type="submit" class="btn btn-primary cover-open">Abrir nuestro libro</button>
          <button type="button" class="book-change-link" data-change-password>Cambiar contraseña</button>
          <p class="book-access-status" data-book-status role="status" aria-live="polite"></p>
        </form>
      `}
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

  section.className = "page story-page";
  section.dataset.photos = String(normalizePhotos(data.photos).length);

  const photos = normalizePhotos(data.photos);

  const photosHtml = photos
    .map(
      (photo) => `
        <figure class="polaroid">
          <button type="button" class="polaroid-photo" aria-label="Ampliar foto">
            <img
              src="${escapeHtml(photo.src)}"
              alt="${escapeHtml(
        photo.caption || "Recuerdo del diario"
      )}"
            />
          </button>

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
   <div
  class="page-inner"
  tabindex="0"
  role="region"
  aria-label="Contenido del recuerdo. Desplázate para ver las fotos y la descripción."
>
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

      <div class="story-description ${String(data.text || "").trim() ? "" : "is-empty"}" tabindex="0" role="region" aria-label="Descripción del recuerdo">
        ${data.text ? `<p class="page-text">${escapeHtml(data.text)}</p>` : ""}
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

  addPageBtn.disabled = isTurning || !cloud.editor;
  printBtn.disabled = isTurning || !cloud.editor;

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

  if (cloud.editor) {
    book.appendChild(createDedicationPage());
    pages.forEach((data, index) => {
      book.appendChild(createStoryPage(data, index));
    });
    book.appendChild(createBackCover());
  }

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
  if (!cloud.editor) { cloud.requestAccess(); return; }
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
    if (!cloud.editor) currentIndex = 0;
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
  if (!cloud.editor) return;
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

book.addEventListener("click", async (event) => {
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
  if (!cloud.ready) { alert("Desbloquea la edición antes de borrar."); return; }

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

  if (await persistPages(nextPages)) {
    renderBook(currentIndex);
  }
});

/* =========================================
   VENTANA DEL FORMULARIO
   ========================================= */

function openModal() {
  if (isTurning) return;
  if (!cloud.ready) {
    alert("Abre el libro con tu contraseña. Si hubo un error de conexión, inténtalo de nuevo.");
    return;
  }

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
      _pendingId: draftCloudId,
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

    saved = await persistPages([
      ...pages,
      newPage,
    ]);

    if (saved) {
      alert("Página guardada en la nube. En otro dispositivo recarga para verla.");
      // 0 = portada, 1 = dedicatoria.
      // Los recuerdos comienzan en el índice 2.
      renderBook(pages.length + 1);

      draftCloudId = crypto.randomUUID();
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
  if (isTurning || isSaving || !cloud.editor) return;
  printBtn.disabled = true;
  try {
    await document.fonts.ready;
    const printableImages = [...book.querySelectorAll("img")];
    const imageResults = await Promise.allSettled(printableImages.map((image) => image.decode()));
    if (imageResults.some((result) => result.status === "rejected")) {
      if (!confirm("Alguna imagen no pudo cargarse. ¿Quieres imprimir de todas formas?")) return;
    }
    preparePrintBook();
    window.print();
  } catch (error) {
    console.error(error);
    alert("No se pudo preparar la impresión: " + error.message);
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
// VISOR DE FOTOS

const photoViewer = document.getElementById("photoViewer");
const photoViewerImage = document.getElementById("photoViewerImage");
const photoViewerCaption = document.getElementById("photoViewerCaption");
const closePhotoViewer = document.getElementById("closePhotoViewer");

function openPhotoViewer(image) {
  const figure = image.closest("figure");
  const caption =
    figure?.querySelector("figcaption")?.textContent.trim() || "";

  photoViewerImage.src = image.currentSrc || image.src;
  photoViewerImage.alt = image.alt || caption || "Foto del diario";
  photoViewerCaption.textContent = caption;

  if (!photoViewer.open) {
    photoViewer.showModal();
  }
}

function hidePhotoViewer() {
  photoViewer.close();
}

// También funciona con las páginas que se añadan después.
document.getElementById("book").addEventListener("click", (event) => {
  const image = event.target.closest(".polaroid-photo")?.querySelector("img");

  if (!image || isTurning) return;

  openPhotoViewer(image);
});

closePhotoViewer.addEventListener("click", hidePhotoViewer);

// El dialog ocupa la pantalla; la tarjeta conserva la foto enmarcada.
photoViewer.addEventListener("click", (event) => {
  if (event.target !== photoViewerImage && !event.target.closest("#closePhotoViewer")) hidePhotoViewer();
});

// Evita que las flechas pasen páginas mientras se mira una foto.
// Escape sigue funcionando mediante el comportamiento del dialog.
window.addEventListener(
  "keydown",
  (event) => {
    if (!photoViewer.open) return;

    if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowRight" ||
      event.key === "Escape"
    ) {
      event.stopImmediatePropagation();
    }
  },
  true
);

// Libera la imagen al cerrar el visor.
photoViewer.addEventListener("close", () => {
  photoViewerImage.removeAttribute("src");
  photoViewerImage.alt = "";
  photoViewerCaption.textContent = "";
});
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
initCloudPanel({
  onLoaded(loaded) { pages = loaded; renderBook(currentIndex); },
  onAccess() { updateControls(); },
  onOpened() { renderBook(1); playMusic(); },
  onLocked() {
    pages = [];
    currentIndex = 0;
    if (photoViewer.open) photoViewer.close();
    photoViewerImage.removeAttribute("src");
    pageModal.classList.add("hidden");
    backgroundMusic.pause();
    removePrintBook();
    renderBook(0);
  },
  onAccessRequested() {
    currentIndex = 0;
    renderBook(0);
  },
  isBusy: () => isSaving || isTurning || !pageModal.classList.contains("hidden"),
});

/* Impresión independiente: medir antes de separar la descripción. */
function removePrintBook() {
  document.getElementById("printBook")?.remove();
}

function preparePrintBook() {
  removePrintBook();
  if (!cloud.editor) return;
  const root = document.createElement("div");
  root.id = "printBook";
  root.setAttribute("aria-hidden", "true");
  document.body.appendChild(root);

  function sheet(className = "") {
    const outer = document.createElement("section");
    outer.className = `print-sheet ${className}`;
    const inner = document.createElement("div");
    inner.className = "print-sheet-inner";
    outer.appendChild(inner);
    root.appendChild(outer);
    return { outer, inner };
  }

  function fits(inner) {
    return inner.scrollHeight <= inner.clientHeight + 1;
  }

  function titleNode(title) {
    const node = document.createElement("h2");
    node.className = "print-title";
    node.textContent = title;
    return node;
  }

  function textSheets(title, text) {
    const words = String(text).match(/\S+\s*/g) || [];
    let offset = 0;
    while (offset < words.length) {
      const { inner } = sheet("print-centered");
      inner.appendChild(titleNode(title));
      const paragraph = document.createElement("p");
      paragraph.className = "print-long-text";
      inner.appendChild(paragraph);
      let low = 1;
      let high = words.length - offset;
      let best = 0;
      while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        paragraph.textContent = words.slice(offset, offset + middle).join("");
        if (fits(inner)) { best = middle; low = middle + 1; }
        else { high = middle - 1; }
      }
      if (best === 0) {
        throw new Error("Un título o una palabra no cabe en la hoja de impresión. Acórtalo antes de imprimir.");
      }
      paragraph.textContent = words.slice(offset, offset + best).join("").trim();
      offset += best;
    }
  }

  const cover = sheet("print-cover");
  cover.outer.style.backgroundImage = `linear-gradient(#0003, #0009), url("${import.meta.env.BASE_URL}foto-portada.jpg")`;
  cover.inner.appendChild(book.querySelector(".cover-content").cloneNode(true));

  const heading = book.querySelector(".birthday-text-heading");
  const originalLetter = book.querySelector(".birthday-text-letter");
  let dedication = sheet();
  dedication.inner.appendChild(heading.cloneNode(true));
  let letter = document.createElement("div");
  letter.className = "print-dedication-letter";
  dedication.inner.appendChild(letter);
  for (const child of originalLetter.children) {
    const clone = child.cloneNode(true);
    letter.appendChild(clone);
    if (!fits(dedication.inner)) {
      clone.remove();
      dedication = sheet();
      dedication.inner.appendChild(titleNode("Una carta para ti"));
      letter = document.createElement("div");
      letter.className = "print-dedication-letter";
      dedication.inner.appendChild(letter);
      letter.appendChild(clone);
      if (!fits(dedication.inner)) {
        clone.remove();
        dedication.outer.remove();
        textSheets("Una carta para ti", child.textContent.trim());
        dedication = sheet();
        dedication.inner.appendChild(titleNode("Una carta para ti"));
        letter = document.createElement("div");
        letter.className = "print-dedication-letter";
        dedication.inner.appendChild(letter);
      }
    }
  }
  if (!letter.children.length) dedication.outer.remove();

  const memoryPages = [...book.querySelectorAll(".story-page, .text-only-page")];
  for (const [index, data] of pages.entries()) {
    if (data.kind === "text") {
      textSheets(data.title || "Una carta", data.text || "");
      continue;
    }
    const original = memoryPages[index];
    const { inner } = sheet();
    inner.appendChild(original.querySelector(".page-header").cloneNode(true));
    const grid = original.querySelector(".polaroid-grid").cloneNode(true);
    grid.className = "print-photo-grid";
    const count = grid.children.length;
    const columns = count === 1 ? 1 : count >= 5 ? 3 : 2;
    grid.style.setProperty("--columns", columns);
    grid.style.setProperty("--rows", Math.max(1, Math.ceil(count / columns)));
    grid.style.setProperty("--photo-height", count <= 2 ? "95mm" : count <= 4 ? "142mm" : "128mm");
    inner.appendChild(grid);
    // Respeta títulos largos sin empujar la cuadrícula fuera del papel.
    let photoHeight = count <= 2 ? 95 : count <= 4 ? 142 : 128;
    while (!fits(inner) && photoHeight > 50) {
      photoHeight -= 5;
      grid.style.setProperty("--photo-height", `${photoHeight}mm`);
    }
    if (!fits(inner)) throw new Error("El título o las leyendas son demasiado extensos para la hoja de fotos.");
    const description = String(data.text || "").trim();
    if (description) {
      const paragraph = document.createElement("p");
      paragraph.className = "print-inline-description";
      paragraph.textContent = description;
      inner.appendChild(paragraph);
      if (!fits(inner)) {
        paragraph.remove();
        textSheets(data.title || "Un recuerdo especial", description);
      }
    }
  }

  const back = sheet("print-back");
  const originalBack = book.querySelector(".book-back-cover");
  for (const child of originalBack.children) back.inner.appendChild(child.cloneNode(true));
}

window.addEventListener("beforeprint", () => {
  if (!document.getElementById("printBook")) preparePrintBook();
});
window.addEventListener("afterprint", removePrintBook);
