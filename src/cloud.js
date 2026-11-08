import { createClient } from "@supabase/supabase-js";

const KEY = "diario_aventuras_pages";
const BUCKET = "diario-fotos";
const OWNER_ID = "38e4a689-7ce6-4eba-b546-c28f9cd58850";
const EDITOR_EMAIL = "mcb200602@gmail.com";
const url = import.meta.env.VITE_SUPABASE_URL;
const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloudEnabled = Boolean(url && publicKey);
const client = cloudEnabled ? createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
}) : null;
let user = null;
let loaded = false;
let accessEpoch = 0;
let authAction = false;
let running = false;
let hooks;
let signedAt = 0;
let sourceBackup = null;
let backupAcknowledged = false;
const el = (id) => document.getElementById(id);
function status(text) {
    el("cloudStatus").textContent = text;
    if (el("passwordChangeStatus")) el("passwordChangeStatus").textContent = text;
    document.querySelectorAll("[data-book-status]").forEach((node) => { node.textContent = text; });
}
function fail(error) { console.error(error); status("Error: " + error.message); }
function check(error) { if (error) throw error; }
function localPages() {
    const value = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(value)) throw new Error("El diario local no tiene un formato válido. No se ha modificado.");
    return value;
}
function requireUser() {
    if (!client || user?.id !== OWNER_ID) throw new Error("Abre el libro con tu contraseña");
}
function syncUI() {
    const editor = Boolean(user?.id === OWNER_ID && loaded);
    document.body.classList.toggle("is-readonly", !editor);
    document.body.classList.toggle("book-locked", !editor);
    el("cloudLogin").hidden = editor;
    for (const id of ["logoutCloud", "migrateCloud", "backupCloud", "refreshCloud"]) el(id).hidden = !editor;
    el("importBackup").closest("label").hidden = !editor;
    el("openCloudPanel").textContent = editor ? "Edición y respaldo" : "Acceso y respaldo";
    hooks?.onAccess?.();
}
function clearBook() {
    accessEpoch++;
    user = null;
    loaded = false;
    sourceBackup = null;
    backupAcknowledged = false;
    hooks?.onLocked?.();
    syncUI();
}
function requestAccess() {
    hooks?.onAccessRequested?.();
    document.querySelector("[data-book-unlock] input")?.focus();
}
function clearPasswordFields() {
    for (const id of ["cloudPassword", "oldPassword", "newPassword", "repeatPassword"]) {
        if (el(id)) el(id).value = "";
    }
    document.querySelectorAll("[data-book-unlock] input").forEach((node) => { node.value = ""; });
}
function downloadJson(data, name) {
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const link = document.createElement("a");
    const href = URL.createObjectURL(blob);
    link.href = href; link.download = name;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(href), 60000);
}
function exportPages(list, name) {
    downloadJson({ format: "diario-aventuras-v1", exportedAt: new Date().toISOString(), pages: list }, name);
}
async function toDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("No se pudo preparar el respaldo"));
        reader.readAsDataURL(blob);
    });
}
function photoList(page) {
    return (page.photos || []).map((p) => typeof p === "string" ? { src: p, caption: "" } : p);
}
async function stableId(page, index) {
    const bytes = new TextEncoder().encode(JSON.stringify([user.id, index, page]));
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    const hex = [...new Uint8Array(hash)].map((n) => n.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
function validatePage(page) {
    if (!page || typeof page.title !== "string" || typeof page.text !== "string" || !Array.isArray(page.photos)) {
        throw new Error("Hay una página con formato no válido. Se conservó el original.");
    }
    for (const photo of photoList(page)) {
        if (typeof photo.src !== "string" || !/^data:image\/(jpeg|png|webp|gif|avif|bmp);base64,/i.test(photo.src)) {
            throw new Error("El respaldo debe contener fotos incrustadas JPG, PNG, WebP, GIF, AVIF o BMP; no enlaces externos.");
        }
    }
}
async function readRows() {
    requireUser();
    const rows = [];
    for (let start = 0; ; start += 500) {
        const { data, error } = await client.from("diary_pages").select("*")
            .eq("owner_id", OWNER_ID).order("position").order("id").range(start, start + 499);
        check(error); rows.push(...data);
        if (data.length < 500) break;
    }
    return rows;
}
async function materialize(row) {
    const photos = [];
    for (const photo of row.content.photos || []) {
        if (!photo.path?.startsWith(OWNER_ID + "/")) throw new Error("Ruta de foto no válida");
        const { data, error } = await client.storage.from(BUCKET).createSignedUrl(photo.path, 600);
        check(error);
        photos.push({ ...photo, src: data.signedUrl });
    }
    return { ...row.content, photos, _cloudId: row.id, _position: row.position };
}
async function load() {
    requireUser();
    const epoch = accessEpoch;
    const rows = await readRows();
    const result = [];
    for (const row of rows) result.push(await materialize(row));
    if (epoch !== accessEpoch || user?.id !== OWNER_ID) throw new Error("El libro se ha bloqueado");
    loaded = true; signedAt = Date.now();
    return result;
}
async function writePage(page, id, position) {
    requireUser();
    const photos = [];
    for (const [index, photo] of photoList(page).entries()) {
        if (photo.path?.startsWith(user.id + "/")) {
            photos.push({ path: photo.path, caption: photo.caption || "" });
            continue;
        }
        if (!photo.src?.startsWith("data:image/")) throw new Error("Foto no válida para subir");
        const response = await fetch(photo.src);
        const blob = await response.blob();
        const path = `${user.id}/${id}/${index}.image`;
        const { error } = await client.storage.from(BUCKET).upload(path, blob, {
            contentType: blob.type, upsert: true, cacheControl: "3600",
        });
        check(error);
        photos.push({ path, caption: photo.caption || "" });
    }
    const content = {
        kind: page.kind || "photos", title: page.title || "", type: page.type || "",
        date: page.date || "", text: page.text || "", photos,
    };
    const { data, error } = await client.from("diary_pages").upsert({
        id, owner_id: user.id, position, content,
    }, { onConflict: "id" }).select().single();
    check(error);
    if (!data?.content || data.content.photos.length !== photos.length) {
        throw new Error("No se pudo verificar la página guardada");
    }
    return data;
}
async function verifyRow(row) {
    for (const photo of row.content.photos || []) {
        const { data, error } = await client.storage.from(BUCKET).download(photo.path);
        check(error);
        if (!data?.size) throw new Error("Una foto no se pudo recuperar. Puedes reintentar la migración.");
    }
}
async function persist(previous, next) {
    requireUser();
    if (!loaded) throw new Error("Actualiza la nube antes de guardar");
    if (running) throw new Error("Espera a que termine la operación actual");
    running = true;
    try {
        const additions = next.filter((page) => !page._cloudId);
        if (additions.length > 1) throw new Error("Usa el botón Migrar para importar varias páginas");
        for (const page of additions) {
            await writePage(page, page._pendingId || crypto.randomUUID(), Date.now());
        }
        const retained = new Set(next.map((page) => page._cloudId).filter(Boolean));
        for (const page of previous) {
            if (!page._cloudId || retained.has(page._cloudId)) continue;
            const { error } = await client.from("diary_pages").delete()
                .eq("id", page._cloudId).eq("owner_id", user.id);
            check(error);
            // Las fotos sin referencia se conservan para evitar una pérdida irreversible.
        }
        status("Guardado en la nube. En otro dispositivo pulsa Actualizar nube o recarga.");
    } finally { running = false; }
}
export const cloud = {
    load, persist,
    get ready() { return Boolean(user?.id === OWNER_ID && loaded && !running); },
    get editor() { return Boolean(user?.id === OWNER_ID && loaded); },
    requestAccess,
};
async function refresh() {
    const list = await load();
    hooks.onLoaded(list);
    status(`Libro abierto: ${list.length} recuerdos en la nube. Puedes leer y administrar el diario.`);
}
async function run(task) {
    if (running || hooks.isBusy()) {
        status("Termina de guardar o cierra el formulario antes de continuar."); return;
    }
    running = true;
    for (const button of document.querySelectorAll("#cloudPanel button, #cloudPanel input, [data-book-unlock] button, [data-book-unlock] input")) button.disabled = true;
    try { await task(); }
    catch (error) { fail(error); }
    finally {
        running = false;
        for (const button of document.querySelectorAll("#cloudPanel button, #cloudPanel input, [data-book-unlock] button, [data-book-unlock] input")) button.disabled = false;
        syncUI();
    }
}

async function unlock(password) {
    if (!client) throw new Error("Faltan las variables de configuración de Supabase");
    status("Comprobando contraseña…");
    authAction = true;
    try {
        const { data, error } = await client.auth.signInWithPassword({ email: EDITOR_EMAIL, password });
        if (error) throw new Error("No se pudo abrir. Comprueba la contraseña, la cuenta confirmada y la conexión.");
        if (data.user?.id !== OWNER_ID) {
            await client.auth.signOut({ scope: "local" });
            throw new Error("La cuenta no corresponde al propietario configurado");
        }
        user = data.user;
        await refresh();
        clearPasswordFields();
        if (el("cloudPanel").open) el("cloudPanel").close();
        hooks.onOpened?.();
    } catch (error) {
        try { await client.auth.signOut({ scope: "local" }); } catch { }
        clearBook();
        throw error;
    } finally { authAction = false; }
}

async function changePassword(oldPassword, newPassword, confirmation) {
    if (!client) throw new Error("Faltan las variables de configuración de Supabase");
    if (newPassword !== confirmation) throw new Error("Las contraseñas nuevas no coinciden");
    if (newPassword.length < 8) throw new Error("La nueva contraseña debe tener al menos 8 caracteres");
    if (newPassword === oldPassword) throw new Error("La nueva contraseña debe ser distinta de la anterior");
    status("Verificando la contraseña anterior…");
    // Cliente aislado: comprobar la anterior no abre el libro ni altera su sesión.
    const verifier = createClient(url, publicKey, {
        auth: {
            persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
            storageKey: "diario-password-verifier"
        },
    });
    let changed = false;
    let globalSignOutError = null;
    try {
        const { data, error } = await verifier.auth.signInWithPassword({ email: EDITOR_EMAIL, password: oldPassword });
        if (error || data.user?.id !== OWNER_ID) throw new Error("No se pudo comprobar la contraseña anterior. Revisa también tu conexión.");
        const result = await verifier.auth.updateUser({ password: newPassword, current_password: oldPassword });
        if (result.error) throw new Error("Supabase no cambió la contraseña: " + result.error.message);
        changed = true;
        // Revoca sesiones renovables. Los JWT y enlaces ya emitidos pueden durar hasta caducar.
        authAction = true;
        const signedOut = await verifier.auth.signOut({ scope: "global" });
        globalSignOutError = signedOut.error;
    } finally {
        try { await verifier.auth.signOut({ scope: "local" }); } catch { }
        if (changed) {
            try { await client.auth.signOut({ scope: "local" }); } catch { }
            clearBook();
            clearPasswordFields();
            el("passwordChangeForm").reset();
            status(globalSignOutError
                ? "Contraseña actualizada. El libro se bloqueó aquí, pero no se pudo confirmar el cierre de las otras sesiones."
                : "Contraseña actualizada. El libro está bloqueado: ábrelo con la nueva contraseña.");
        }
        authAction = false;
    }
}

export async function initCloudPanel(callbacks) {
    hooks = callbacks;
    const panel = el("cloudPanel");
    el("openCloudPanel").onclick = () => { if (!panel.open) panel.showModal(); };
    el("closeCloudPanel").onclick = () => { if (!running) panel.close(); };
    panel.addEventListener("cancel", (event) => { if (running) event.preventDefault(); });
    panel.addEventListener("close", () => {
        for (const id of ["cloudPassword", "oldPassword", "newPassword", "repeatPassword"]) el(id).value = "";
    });
    panel.addEventListener("keydown", (event) => event.stopPropagation());
    bookEvents();
    function bookEvents() {
        document.getElementById("book").addEventListener("submit", (event) => {
            if (!event.target.matches("[data-book-unlock]")) return;
            event.preventDefault();
            const password = event.target.elements.password.value;
            run(() => unlock(password));
        });
        document.getElementById("book").addEventListener("click", (event) => {
            if (!event.target.closest("[data-change-password]")) return;
            if (!panel.open) panel.showModal();
            el("passwordChange").open = true;
            el("oldPassword").focus();
        });
    }
    el("cloudLogin").onsubmit = (event) => {
        event.preventDefault();
        const password = el("cloudPassword").value;
        run(() => unlock(password));
    };
    el("passwordChangeForm").onsubmit = (event) => {
        event.preventDefault();
        const oldPassword = el("oldPassword").value;
        const newPassword = el("newPassword").value;
        const confirmation = el("repeatPassword").value;
        run(() => changePassword(oldPassword, newPassword, confirmation));
    };
    el("refreshCloud").onclick = () => run(refresh);
    el("logoutCloud").onclick = () => run(async () => {
        authAction = true;
        try {
            if (client) { const { error } = await client.auth.signOut({ scope: "local" }); check(error); }
            clearBook();
            clearPasswordFields();
            panel.close();
            status("Libro bloqueado. Introduce la contraseña para volver a abrirlo.");
        } finally { authAction = false; }
    });
    el("backupLocal").onclick = () => {
        try {
            const list = sourceBackup || localPages();
            exportPages(list, `diario-local-${Date.now()}.json`);
            backupAcknowledged = false;
            status(`Respaldo solicitado: ${list.length} páginas. Comprueba que el archivo se descargó antes de migrar.`);
        } catch (error) { fail(error); }
    };
    el("importBackup").onchange = async (event) => {
        try {
            requireUser();
            const file = event.target.files[0]; if (!file) return;
            const value = JSON.parse(await file.text());
            const list = Array.isArray(value) ? value : value.pages;
            if (!Array.isArray(list)) throw new Error("Respaldo no válido");
            list.forEach(validatePage);
            sourceBackup = list; backupAcknowledged = false;
            status(`Respaldo abierto: ${list.length} páginas. No se ha borrado ni sobrescrito la copia local. Pulsa Migrar para añadirlas a la nube.`);
        } catch (error) { fail(error); }
        finally { event.target.value = ""; }
    };
    el("migrateCloud").onclick = () => run(async () => {
        requireUser();
        const list = sourceBackup || localPages();
        if (!list.length) throw new Error("Este navegador no tiene recuerdos locales. Migra desde el celular original o importa el respaldo.");
        list.forEach(validatePage);
        if (!backupAcknowledged) {
            if (!confirm("¿Ya descargaste y guardaste una copia JSON de estos recuerdos? Acepta solo si tienes el respaldo. No se borrarán los datos locales.")) return;
            backupAcknowledged = true;
        }
        const existing = new Map((await readRows()).map((row) => [row.id, row]));
        for (const [index, page] of list.entries()) {
            status(`Migrando ${index + 1} de ${list.length}. No cierres esta pestaña…`);
            const id = await stableId(page, index);
            let row = existing.get(id);
            if (!row) row = await writePage(page, id, index);
            await verifyRow(row);
        }
        await refresh();
        status(`Migración verificada: ${list.length} páginas procesadas y fotos recuperadas. Los originales locales NO se borraron. Comprueba ahora desde otro dispositivo.`);
    });
    el("backupCloud").onclick = () => run(async () => {
        requireUser();
        const rows = await readRows(); const list = [];
        for (const [index, row] of rows.entries()) {
            status(`Preparando respaldo ${index + 1} de ${rows.length}…`);
            const photos = [];
            for (const photo of row.content.photos || []) {
                const { data, error } = await client.storage.from(BUCKET).download(photo.path);
                check(error); photos.push({ src: await toDataUrl(data), caption: photo.caption || "" });
            }
            list.push({ ...row.content, photos });
        }
        exportPages(list, `diario-nube-${Date.now()}.json`);
        status("Respaldo de la nube solicitado. Comprueba la descarga y consérvalo en privado.");
    });

    clearBook();
    status(client ? "Introduce la contraseña para abrir el libro." : "Faltan las variables de configuración de Supabase. La copia local se conserva y se puede exportar.");
    if (!client) return;
    // La sesión vive en memoria: al recargar se vuelve a pedir la contraseña.
    client.auth.onAuthStateChange((_event, session) => {
        if (authAction) return;
        const nextUser = session?.user?.id === OWNER_ID ? session.user : null;
        if (!nextUser && user) {
            clearBook();
            status("La sesión terminó. Abre el libro con tu contraseña.");
        } else if (nextUser && user) {
            user = nextUser;
            syncUI();
        }
    });
    setInterval(() => {
        if (user && loaded && !document.hidden && Date.now() - signedAt > 5 * 60 * 1000 && !hooks.isBusy() && !running && !el("photoViewer").open) {
            run(refresh);
        }
    }, 60000);
}
