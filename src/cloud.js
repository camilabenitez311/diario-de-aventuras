import { createClient } from "@supabase/supabase-js";

const KEY = "diario_aventuras_pages";
const BUCKET = "diario-fotos";
const OWNER_ID = "38e4a689-7ce6-4eba-b546-c28f9cd58850";
const EDITOR_EMAIL = "mcb200602@gmail.com";
const url = import.meta.env.VITE_SUPABASE_URL;
const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloudEnabled = Boolean(url && publicKey);
const client = cloudEnabled ? createClient(url, publicKey) : null;
let user = null;
let loaded = false;
let running = false;
let hooks;
let signedAt = 0;
let sourceBackup = null;
let backupAcknowledged = false;
const el = (id) => document.getElementById(id);
function status(text) { el("cloudStatus").textContent = text; }
function fail(error) { console.error(error); status("Error: " + error.message); }
function check(error) { if (error) throw error; }
function localPages() {
    const value = JSON.parse(localStorage.getItem(KEY) || "[]");
    if (!Array.isArray(value)) throw new Error("El diario local no tiene un formato válido. No se ha modificado.");
    return value;
}
function requireUser() {
    if (!client || user?.id !== OWNER_ID) throw new Error("Desbloquea la edición con tu contraseña");
}
function syncUI() {
    const editor = Boolean(user?.id === OWNER_ID && loaded);
    document.body.classList.toggle("is-readonly", !editor);
    el("cloudLogin").hidden = editor;
    el("logoutCloud").hidden = !editor;
    el("migrateCloud").hidden = !editor;
    el("backupCloud").hidden = !editor;
    el("importBackup").closest("label").hidden = !editor;
    el("openCloudPanel").textContent = editor ? "Edición y respaldo" : "Desbloquear edición";
    hooks?.onAccess?.();
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
    if (!client) throw new Error("Falta configurar Supabase");
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
        const { data, error } = await client.storage.from(BUCKET).createSignedUrl(photo.path, 3600);
        check(error);
        photos.push({ ...photo, src: data.signedUrl });
    }
    return { ...row.content, photos, _cloudId: row.id, _position: row.position };
}
async function load() {
    const rows = await readRows();
    const result = [];
    for (const row of rows) result.push(await materialize(row));
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
};
async function refresh() {
    const list = await load();
    hooks.onLoaded(list);
    status(`${list.length} recuerdos en la nube. ${user?.id === OWNER_ID ? "Edición desbloqueada." : "Solo lectura: no necesitas contraseña para verlos."} La copia local permanece intacta.`);
}
async function run(task) {
    if (running || hooks.isBusy()) {
        status("Termina de guardar o cierra el formulario antes de continuar."); return;
    }
    running = true;
    for (const button of el("cloudPanel").querySelectorAll("button, input")) button.disabled = true;
    try { await task(); }
    catch (error) { fail(error); }
    finally {
        running = false;
        for (const button of el("cloudPanel").querySelectorAll("button, input")) button.disabled = false;
        syncUI();
    }
}
export async function initCloudPanel(callbacks) {
    hooks = callbacks;
    const panel = el("cloudPanel");
    el("openCloudPanel").onclick = () => { if (!panel.open) panel.showModal(); };
    el("closeCloudPanel").onclick = () => { if (!running) panel.close(); };
    panel.addEventListener("cancel", (event) => { if (running) event.preventDefault(); });
    panel.addEventListener("close", () => { el("cloudPassword").value = ""; });
    // Este dialog es independiente del visor; no pasa páginas con las flechas.
    panel.addEventListener("keydown", (event) => event.stopPropagation());
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
    el("cloudLogin").onsubmit = (event) => {
        event.preventDefault();
        run(async () => {
            if (!client) throw new Error("Faltan las variables de configuración de Supabase");
            status("Comprobando contraseña…");
            const { data, error } = await client.auth.signInWithPassword({
                email: EDITOR_EMAIL, password: el("cloudPassword").value,
            });
            if (error) throw new Error("No se pudo desbloquear. Comprueba la contraseña, la cuenta confirmada y la conexión.");
            if (data.user?.id !== OWNER_ID) {
                await client.auth.signOut();
                user = null;
                throw new Error("La cuenta no corresponde al propietario configurado.");
            }
            user = data.user;
            el("cloudPassword").value = "";
            await refresh();
        });
    };
    el("refreshCloud").onclick = () => run(refresh);
    el("logoutCloud").onclick = () => run(async () => {
        if (client) { const { error } = await client.auth.signOut(); check(error); }
        user = null;
        await refresh();
        status("Edición bloqueada. Los recuerdos de la nube siguen visibles sin contraseña.");
    });
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
    syncUI();
    if (!client) {
        status("Faltan VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY. No se puede cargar la nube. Puedes exportar el respaldo local; no se ha borrado.");
        return;
    }
    await run(async () => {
        const { data, error } = await client.auth.getSession(); check(error);
        user = data.session?.user?.id === OWNER_ID ? data.session.user : null;
        if (data.session && !user) await client.auth.signOut();
        await refresh();
    });
    client.auth.onAuthStateChange((_event, session) => {
        user = session?.user?.id === OWNER_ID ? session.user : null;
        syncUI();
    });
    setInterval(() => {
        if (client && !document.hidden && Date.now() - signedAt > 45 * 60 * 1000 && !hooks.isBusy() && !running && !el("photoViewer").open) {
            run(refresh);
        }
    }, 60000);
}