import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { dictionaries, type Lang, type StringKey } from "@/lib/i18n";
import { db, initSettings } from "@/lib/db";

export type ShopMode = "simple" | "pro" | "advanced";

interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: StringKey) => string;
  isUrdu: boolean;
  shopType: ShopMode;
  setShopType: (s: ShopMode) => void;
  printerWidth: "58mm" | "80mm";
  setPrinterWidth: (w: "58mm" | "80mm") => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/** Migrate legacy "kiryana" value → "simple" */
function normaliseShopType(raw: string | undefined): ShopMode | null {
  if (raw === "kiryana" || raw === "simple") return "simple";
  if (raw === "pro") return "pro";
  if (raw === "advanced") return "advanced";
  return null; // empty / unknown → trigger FirstRun
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [shopType, setShopTypeState] = useState<ShopMode>("simple");
  const [printerWidth, setPrinterWidthState] = useState<"58mm" | "80mm">(
    "58mm",
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initSettings().then((s) => {
      const l = s.language === "ur" ? "ur" : "en";
      setLangState(l);
      applyLangToDocument(l);

      const mode = normaliseShopType(s.shopType);
      if (mode) setShopTypeState(mode);
      // if null → App.tsx will show FirstRun, so default "simple" is fine

      setPrinterWidthState(s.printerWidth === "80mm" ? "80mm" : "58mm");
      setReady(true);
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    applyLangToDocument(l);
    db.settings.update("default", { language: l });
  }, []);

  const setShopType = useCallback((s: ShopMode) => {
    setShopTypeState(s);
    db.settings.update("default", { shopType: s });
  }, []);

  const setPrinterWidth = useCallback((w: "58mm" | "80mm") => {
    setPrinterWidthState(w);
    document.documentElement.dataset.printerWidth = w;
    db.settings.update("default", { printerWidth: w });
  }, []);

  useEffect(() => {
    document.documentElement.dataset.printerWidth = printerWidth;
  }, [printerWidth]);

  const t = useCallback(
    (key: StringKey) => {
      return dictionaries[lang][key] ?? dictionaries.en[key] ?? key;
    },
    [lang],
  );

  if (!ready) return null;

  return (
    <LanguageContext.Provider
      value={{
        lang,
        setLang,
        t,
        isUrdu: lang === "ur",
        shopType,
        setShopType,
        printerWidth,
        setPrinterWidth,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

function applyLangToDocument(l: Lang) {
  const html = document.documentElement;
  if (l === "ur") {
    html.setAttribute("dir", "rtl");
    html.setAttribute("lang", "ur");
    html.classList.add("lang-ur");
  } else {
    html.setAttribute("dir", "ltr");
    html.setAttribute("lang", "en");
    html.classList.remove("lang-ur");
  }
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

export function useT() {
  return useLanguage().t;
}
