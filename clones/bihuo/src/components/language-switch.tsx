import type { Locale } from "@/types/auth";

const languages: { locale: Locale; label: string }[] = [
  { locale: "zh-CN", label: "简体中文" },
  { locale: "en", label: "English" },
  { locale: "zh-TW", label: "繁體中文" },
];

export function LanguageSwitch({ locale, onChange }: { locale: Locale; onChange: (locale: Locale) => void }) {
  return (
    <div className="mt-1 flex items-center justify-end gap-[6px]" aria-label="Language">
      {languages.map((language) => (
        <button
          key={language.locale}
          type="button"
          onClick={() => onChange(language.locale)}
          aria-pressed={locale === language.locale}
          className={`rounded-[6px] border-0 px-[6px] py-[2px] text-[12px] leading-[1.4] transition-colors duration-200 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${locale === language.locale ? "bg-[#f8e8e8] font-semibold text-primary" : "bg-transparent text-[#606266]"}`}
        >{language.label}</button>
      ))}
    </div>
  );
}
