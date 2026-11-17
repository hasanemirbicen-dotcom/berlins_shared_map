(function () {
  "use strict";

  const cfg = window.MAP_CONFIG || {};
  const I18N = window.I18N || {};
  const DEMO = !cfg.supabaseUrl || !cfg.supabaseAnonKey;
  const DEMO_KEY = "ortak-harita:demo-pins";
  const NICK_KEY = "ortak-harita:nick";
  const LAST_KEY = "ortak-harita:last-submit";
  const LANG_KEY = "ortak-harita:lang";

  // Kategori anahtarları ve renkleri — değiştirirsen schema.sql'deki check listesini
  // ve i18n.js'deki "cat" metinlerini de güncelle.
  const CATEGORIES = {
    favori:  "#e4572e",
    gizli:   "#7b5ea7",
    yemek:   "#e0a100",
    manzara: "#1f9e89",
    ani:     "#3a6ea5",
  };
  const CAT_KEYS = Object.keys(CATEGORIES);

  const $ = (id) => document.getElementById(id);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* yok say */ } },
  };

  // ---------- Dil ----------
  function pickLang() {
    const fromUrl = new URLSearchParams(location.search).get("lang");
    if (fromUrl && I18N[fromUrl]) return fromUrl;
    const saved = store.get(LANG_KEY);
    if (saved && I18N[saved]) return saved;
    const langs = navigator.languages || [navigator.language || ""];
    for (const l of langs) {
      const code = String(l).slice(0, 2).toLowerCase();
      if (I18N[code]) return code;
    }
    return I18N[cfg.defaultLang] ? cfg.defaultLang : "tr";
  }

  let lang = pickLang();
  const T = () => I18N[lang] || I18N.tr;
  const catLabel = (key) => (T().cat && T().cat[key]) || key;
  const colorOf = (key) => CATEGORIES[key] || CATEGORIES.favori;

  function configText(field) {
    const v = cfg[field];
    if (v && typeof v === "object") return v[lang] || v.tr || v.en || null;
    return typeof v === "string" && v ? v : null;
  }

  function applyLang() {
    const t = T();
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const v = t[el.dataset.i18n];
      if (typeof v === "string") el.textContent = v;
    });
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => { el.placeholder = t[el.dataset.i18nPh] || ""; });
    document.querySelectorAll("[data-i18n-aria]").forEach((el) => { el.setAttribute("aria-label", t[el.dataset.i18nAria] || ""); });
    document.querySelectorAll("[data-cat-label]").forEach((el) => { el.textContent = catLabel(el.dataset.catLabel); });

    const title = configText("title") || t.title;
    $("title").textContent = title;
    document.title = title;
    $("subtitle").textContent = configText("subtitle") || t.subtitle;

    if (replaying) $("btn-replay").textContent = t.stop;
    const submit = $("f-submit");
    if (submit.disabled) submit.textContent = t.sending;

    document.querySelectorAll("#lang button").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
    });
    map.closePopup();
  }

  // ---------- Harita ----------
  const map = L.map("map", { zoomControl: false, preferCanvas: true })
    .setView(cfg.center || [52.52, 13.405], cfg.zoom || 12);
  L.control.zoom({ position: "bottomright" }).addTo(map);

  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  let tiles = null;
  let useFallback = false;
  function setTiles() {
    if (tiles) map.removeLayer(tiles);
    if (useFallback) {
      // CARTO erişilemezse standart OSM altlığı.
      tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: OSM_ATTR, maxZoom: 19 }).addTo(map);
      return;
    }
    const style = darkQuery.matches ? "dark_all" : "light_all";
    tiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/" + style + "/{z}/{x}/{y}{r}.png", {
      attribution: OSM_ATTR + ' &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);
    let loaded = 0, failed = 0;
    tiles.on("tileload", () => { loaded++; });
    tiles.on("tileerror", () => {
      failed++;
      if (!useFallback && loaded === 0 && failed >= 4) { useFallback = true; setTiles(); }
    });
  }
  setTiles();
  if (darkQuery.addEventListener) darkQuery.addEventListener("change", setTiles);

  const bounds = cfg.bounds ? L.latLngBounds(cfg.bounds) : null;
  if (bounds) {
    map.setMaxBounds(bounds.pad(0.4));
    map.setMinZoom(Math.max(map.getBoundsZoom(bounds.pad(0.4)) - 1, 3));
  }

  // ---------- Pin durumu ----------
  const pins = new Map();       // id -> { data, marker }
  const hidden = new Set();     // gizlenen kategoriler
  let lastOwnSubmit = 0;
  let replaying = false;

  function timeAgo(iso) {
    const rtf = typeof Intl !== "undefined" && Intl.RelativeTimeFormat
      ? new Intl.RelativeTimeFormat(T().locale, { numeric: "auto" }) : null;
    const diff = (new Date(iso).getTime() - Date.now()) / 1000;
    const steps = [[60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.35, "week"], [12, "month"], [Infinity, "year"]];
    let value = diff;
    for (const [size, unit] of steps) {
      if (Math.abs(value) < size) return rtf ? rtf.format(Math.round(value), unit) : new Date(iso).toLocaleString(T().locale);
      value /= size;
    }
    return "";
  }

  // Kullanıcı metni her zaman textContent ile yazılır (HTML enjeksiyonu yok).
  function popupNode(p) {
    const el = document.createElement("div");
    el.className = "popup";
    const tag = document.createElement("div");
    tag.className = "tag";
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = colorOf(p.category);
    tag.append(dot, document.createTextNode(catLabel(p.category)));
    const msg = document.createElement("p");
    msg.className = "msg";
    msg.textContent = p.message;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = (p.nickname ? p.nickname : T().anonymous) + " · " + timeAgo(p.created_at);
    el.append(tag, msg, meta);
    return el;
  }

  function makeMarker(p) {
    const m = L.circleMarker([p.lat, p.lng], {
      radius: 7, color: "#ffffff", weight: 2, fillColor: colorOf(p.category), fillOpacity: 0.95,
    });
    m.bindPopup(() => popupNode(p), { maxWidth: 280 });
    return m;
  }

  function pulse(marker) {
    const start = performance.now();
    const dur = 700;
    function frame(t) {
      const k = Math.min((t - start) / dur, 1);
      marker.setRadius(7 + 14 * (1 - k) * (1 - k));
      if (k < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function addPin(p, opts) {
    opts = opts || {};
    if (!p || p.id == null || pins.has(p.id)) return;
    const marker = makeMarker(p);
    pins.set(p.id, { data: p, marker: marker });
    if (!replaying && !hidden.has(p.category)) {
      marker.addTo(map);
      if (opts.animate) pulse(marker);
    }
    if (opts.notify && Date.now() - lastOwnSubmit > 4000) {
      toast(T().newPin + ": " + catLabel(p.category) + (p.nickname ? " · " + p.nickname : ""));
    }
    updateStats();
  }

  function removePin(id) {
    const entry = pins.get(id);
    if (!entry) return;
    map.removeLayer(entry.marker);
    pins.delete(id);
    updateStats();
  }

  // ---------- Lejant ve istatistik ----------
  const legend = $("legend");
  const legendCounts = {};
  CAT_KEYS.forEach((key) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-pressed", "true");
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = CATEGORIES[key];
    const label = document.createElement("span");
    label.dataset.catLabel = key;
    const n = document.createElement("span");
    n.className = "n";
    n.textContent = "0";
    btn.append(dot, label, n);
    btn.addEventListener("click", () => {
      if (hidden.has(key)) hidden.delete(key); else hidden.add(key);
      btn.setAttribute("aria-pressed", String(!hidden.has(key)));
      applyFilter();
    });
    li.append(btn);
    legend.append(li);
    legendCounts[key] = n;
  });

  function applyFilter() {
    if (replaying) return;
    pins.forEach(({ data, marker }) => {
      const show = !hidden.has(data.category);
      if (show && !map.hasLayer(marker)) marker.addTo(map);
      if (!show && map.hasLayer(marker)) map.removeLayer(marker);
    });
  }

  function updateStats() {
    const counts = {};
    const people = new Set();
    pins.forEach(({ data }) => {
      counts[data.category] = (counts[data.category] || 0) + 1;
      if (data.nickname) people.add(data.nickname.trim().toLowerCase());
    });
    $("stat-pins").textContent = pins.size;
    $("stat-people").textContent = people.size;
    CAT_KEYS.forEach((k) => { legendCounts[k].textContent = counts[k] || 0; });
  }

  // ---------- Veri katmanı ----------
  let db = null;
  if (!DEMO) {
    if (!window.supabase || !window.supabase.createClient) {
      setTimeout(() => toast(T().libFail), 0);
    } else {
      db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    }
  }

  function demoLoad() {
    try { return JSON.parse(store.get(DEMO_KEY) || "[]"); } catch (e) { return []; }
  }
  function demoSave(list) { store.set(DEMO_KEY, JSON.stringify(list)); }

  async function load() {
    if (DEMO) { demoLoad().forEach((p) => addPin(p)); return; }
    if (!db) return;
    const { data, error } = await db.from("pins").select("*").order("created_at", { ascending: true }).limit(5000);
    if (error) { toast(T().loadFail + ": " + error.message); return; }
    data.forEach((p) => addPin(p));

    db.channel("pins-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "pins" },
        (payload) => addPin(payload.new, { animate: true, notify: true }))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "pins" },
        (payload) => payload.old && removePin(payload.old.id))
      .subscribe();
  }

  async function savePin(row) {
    if (DEMO) {
      const p = Object.assign({
        id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2),
        created_at: new Date().toISOString(),
      }, row);
      const list = demoLoad(); list.push(p); demoSave(list);
      return p;
    }
    const { data, error } = await db.from("pins").insert(row).select().single();
    if (error) throw error;
    return data;
  }

  // ---------- Pin ekleme akışı ----------
  const sheet = $("sheet");
  const msgInput = $("f-message");
  const nickInput = $("f-nick");
  const chips = $("chips");
  let picking = false;
  let draft = null;

  CAT_KEYS.forEach((key, i) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "radio"; input.name = "category"; input.value = key;
    if (i === 0) input.checked = true;
    const dot = document.createElement("span");
    dot.className = "dot"; dot.style.background = CATEGORIES[key];
    const text = document.createElement("span");
    text.dataset.catLabel = key;
    label.append(input, dot, text);
    chips.append(label);
  });

  nickInput.value = store.get(NICK_KEY) || "";
  msgInput.addEventListener("input", () => { $("f-count").textContent = msgInput.value.length + "/280"; });

  function setPicking(on) {
    picking = on;
    $("hint").hidden = !on;
    $("map").classList.toggle("picking", on);
    if (on) { map.closePopup(); $("banner").hidden = true; }
  }

  function closeSheet() {
    sheet.hidden = true;
    if (draft) { map.removeLayer(draft); draft = null; }
  }

  function openSheet(latlng) {
    if (draft) map.removeLayer(draft);
    draft = L.marker(latlng, {
      draggable: true,
      icon: L.divIcon({ className: "", html: '<div class="draft-pin"></div>', iconSize: [0, 0] }),
      keyboard: false,
    }).addTo(map);
    sheet.hidden = false;
    // Pin formun altında kalıyorsa haritayı kaydır.
    requestAnimationFrame(() => {
      const r = sheet.getBoundingClientRect();
      const pt = map.latLngToContainerPoint(latlng);
      const m = 40;
      if (pt.x > r.left - m && pt.x < r.right + m && pt.y > r.top - m && pt.y < r.bottom + m) {
        const dy = pt.y - (r.top - 60);
        const dx = window.innerWidth > 640 ? pt.x - (r.left - 80) : 0;
        map.panBy([dx > 0 ? dx : 0, dy > 0 ? dy : 0]);
      }
    });
    setTimeout(() => msgInput.focus(), 50);
  }

  $("btn-add").addEventListener("click", () => {
    if (replaying) return;
    closeSheet();
    setPicking(true);
  });
  $("btn-cancel-pick").addEventListener("click", () => setPicking(false));
  $("f-cancel").addEventListener("click", closeSheet);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { setPicking(false); closeSheet(); }
  });

  map.on("click", (e) => {
    if (!picking) return;
    if (bounds && !bounds.contains(e.latlng)) { toast(T().outside); return; }
    setPicking(false);
    openSheet(e.latlng);
  });

  sheet.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!draft) return;
    const ll = draft.getLatLng();
    if (bounds && !bounds.contains(ll)) { toast(T().dragged); return; }

    const message = msgInput.value.trim();
    if (!message) { msgInput.focus(); return; }

    const cooldown = (cfg.cooldownSeconds || 0) * 1000;
    const last = Number(store.get(LAST_KEY) || 0);
    if (cooldown && Date.now() - last < cooldown) {
      toast(T().wait(Math.ceil((cooldown - (Date.now() - last)) / 1000)));
      return;
    }

    const category = (sheet.querySelector('input[name="category"]:checked') || {}).value || "favori";
    const nickname = nickInput.value.trim();
    const row = {
      lat: Math.round(ll.lat * 1e5) / 1e5,
      lng: Math.round(ll.lng * 1e5) / 1e5,
      category: category,
      message: message.slice(0, 280),
      nickname: nickname ? nickname.slice(0, 40) : null,
    };

    const submit = $("f-submit");
    submit.disabled = true; submit.textContent = T().sending;
    lastOwnSubmit = Date.now();
    try {
      const saved = await savePin(row);
      store.set(NICK_KEY, nickname);
      store.set(LAST_KEY, String(Date.now()));
      closeSheet();
      msgInput.value = ""; $("f-count").textContent = "0/280";
      addPin(saved, { animate: true });
      toast(T().thanks);
    } catch (err) {
      toast(T().sendFail + ": " + (err && err.message ? err.message : T().unknown));
    } finally {
      submit.disabled = false; submit.textContent = T().submit;
    }
  });

  // ---------- Tekrar oynat (challenge videosu için) ----------
  const replayBtn = $("btn-replay");
  const replayLabel = $("replay-label");
  let replayTimer = null;

  function stopReplay() {
    clearTimeout(replayTimer);
    replaying = false;
    replayLabel.hidden = true;
    replayBtn.textContent = T().replay;
    pins.forEach(({ marker }) => { if (map.hasLayer(marker)) map.removeLayer(marker); });
    applyFilter();
  }

  function startReplay() {
    const list = Array.from(pins.values())
      .filter(({ data }) => !hidden.has(data.category))
      .sort((a, b) => new Date(a.data.created_at) - new Date(b.data.created_at));
    if (!list.length) { toast(T().noReplay); return; }
    setPicking(false); closeSheet(); map.closePopup();
    replaying = true;
    replayBtn.textContent = T().stop;
    pins.forEach(({ marker }) => { if (map.hasLayer(marker)) map.removeLayer(marker); });
    replayLabel.hidden = false;

    const step = Math.max(40, Math.min(400, 10000 / list.length));
    let i = 0;
    (function next() {
      if (!replaying) return;
      if (i >= list.length) {
        replayLabel.textContent = T().done(list.length);
        replayTimer = setTimeout(stopReplay, 2500);
        return;
      }
      const { data, marker } = list[i++];
      marker.addTo(map);
      pulse(marker);
      const fmt = new Intl.DateTimeFormat(T().locale, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
      replayLabel.textContent = fmt.format(new Date(data.created_at)) + " · " + i;
      replayTimer = setTimeout(next, step);
    })();
  }

  replayBtn.addEventListener("click", () => (replaying ? stopReplay() : startReplay()));

  // ---------- Paylaş & dışa aktar ----------
  $("btn-share").addEventListener("click", async () => {
    // Paylaşılan link, paylaşan kişinin seçtiği dili taşır.
    const u = new URL(location.href);
    u.hash = "";
    u.searchParams.set("lang", lang);
    const url = u.toString();
    try {
      if (navigator.share && window.innerWidth <= 640) { await navigator.share({ title: document.title, url: url }); return; }
      await navigator.clipboard.writeText(url);
      toast(T().copied);
    } catch (e) {
      toast(url);
    }
  });

  $("btn-export").addEventListener("click", () => {
    const fc = {
      type: "FeatureCollection",
      features: Array.from(pins.values()).map(({ data }) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [data.lng, data.lat] },
        properties: {
          id: data.id,
          category: data.category,
          category_tr: I18N.tr ? I18N.tr.cat[data.category] : null,
          category_en: I18N.en ? I18N.en.cat[data.category] : null,
          category_de: I18N.de ? I18N.de.cat[data.category] : null,
          message: data.message,
          nickname: data.nickname,
          created_at: data.created_at,
        },
      })),
    };
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: "application/geo+json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ortak-harita.geojson";
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  // ---------- Dil düğmeleri ----------
  document.querySelectorAll("#lang button").forEach((b) => {
    b.addEventListener("click", () => {
      if (!I18N[b.dataset.lang] || b.dataset.lang === lang) return;
      lang = b.dataset.lang;
      store.set(LANG_KEY, lang);
      // Adres çubuğundaki ?lang= değerini de güncelle (sayfa yenilenmeden).
      try {
        const u = new URL(location.href);
        if (u.searchParams.has("lang")) { u.searchParams.set("lang", lang); history.replaceState(null, "", u); }
      } catch (e) { /* yok say */ }
      applyLang();
    });
  });

  // ---------- Mobil panel ----------
  $("btn-collapse").addEventListener("click", () => {
    const p = $("panel");
    p.classList.toggle("collapsed");
    $("btn-collapse").textContent = p.classList.contains("collapsed") ? "+" : "–";
  });
  if (window.innerWidth <= 640) { $("panel").classList.add("collapsed"); $("btn-collapse").textContent = "+"; }

  // ---------- Bildirim ----------
  let toastTimer = null;
  function toast(text) {
    const t = $("toast");
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
  }

  applyLang();
  if (DEMO) $("banner").hidden = false;
  load();
})();
