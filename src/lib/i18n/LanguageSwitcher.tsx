import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { LANG_FLAGS, LANG_LABELS, type Lang } from "./translations";
import { useLanguage } from "./context";

const LANGS: Lang[] = ["pt", "en", "es"];

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        className="flex items-center gap-1.5 rounded-full border border-border/50 bg-card/60 px-3 py-1.5 text-sm hover:bg-card transition-colors"
        aria-label="Selecionar idioma"
      >
        <span>{LANG_FLAGS[lang]}</span>
        <span className="hidden sm:inline">{LANG_LABELS[lang]}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-40 rounded-lg border border-border/50 bg-card shadow-lg z-50 overflow-hidden">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLang(l);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors ${l === lang ? "font-semibold text-gold" : ""}`}
            >
              <span>{LANG_FLAGS[l]}</span>
              <span>{LANG_LABELS[l]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
