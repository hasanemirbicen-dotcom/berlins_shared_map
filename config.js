// Haritanın ayarları. Supabase bilgilerini boş bırakırsan site "demo modunda"
// çalışır: pinler yalnızca o tarayıcıda saklanır (deneme için ideal).
window.MAP_CONFIG = {
  // Supabase → Project Settings → API (veya "Connect") ekranından:
  supabaseUrl: "",       // ör. "https://abcdxyz.supabase.co"
  supabaseAnonKey: "",   // "anon public" / "publishable" anahtar. ASLA service_role anahtarını koyma!

  // Ziyaretçinin tarayıcı dili tr/en/de değilse kullanılacak dil.
  defaultLang: "tr",

  // Başlığı değiştirmek istersen her dil için yaz. null bırakırsan i18n.js'deki metin kullanılır.
  // ör. title: { tr: "İstanbul'un Ortak Haritası", en: "Istanbul's Shared Map", de: "Istanbuls gemeinsame Karte" },
  title: null,
  subtitle: null,

  center: [52.52, 13.405],
  zoom: 12,

  // Pinler yalnızca bu kutunun içine bırakılabilir: [[güney, batı], [kuzey, doğu]]. Kapatmak için null.
  bounds: [[52.33, 13.08], [52.68, 13.77]],

  // Aynı tarayıcıdan iki pin arasında beklenecek süre (saniye).
  cooldownSeconds: 30,
};
