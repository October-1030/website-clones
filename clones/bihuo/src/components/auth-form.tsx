"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { authCopy } from "@/lib/auth-copy";
import type { AuthField as FieldName, AuthMode, FormErrors, Locale } from "@/types/auth";
import { AuthField } from "@/components/auth-field";
import { LanguageSwitch } from "@/components/language-switch";
import { PasswordVisibilityIcon } from "@/components/icons";

export function AuthForm({ mode, locale, onLocaleChange }: { mode: AuthMode; locale: Locale; onLocaleChange: (locale: Locale) => void }) {
  const text = authCopy[locale];
  const register = mode === "register";
  const [values, setValues] = useState({ account: "", password: "", phone: "", code: "" });
  const [errors, setErrors] = useState<FormErrors>({});
  const [visiblePassword, setVisiblePassword] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [notice, setNotice] = useState("");
  const noticeDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  function updateField(field: FieldName, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
  }

  function showNotice(message: string) {
    setNotice(message);
    noticeDialog.current?.showModal();
  }

  function validateField(field: FieldName): string | undefined {
    const value = values[field].trim();
    if (field === "account" && !value) return text.account;
    if (field === "phone") return !value ? text.phone : /^1[3-9]\d{9}$/.test(value) ? undefined : text.phoneInvalid;
    if (field === "code") return !value ? text.code : /^\d{6}$/.test(value) ? undefined : text.codeInvalid;
    if (field === "password") {
      if (!value) return text.passwordRequired;
      if (register && !/^(?=.*[A-Za-z])(?=.*\d).{6,20}$/.test(values.password)) return text.passwordInvalid;
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields: FieldName[] = register ? ["phone", "code", "password"] : ["account", "password"];
    const nextErrors: FormErrors = {};
    for (const field of fields) {
      const error = validateField(field);
      if (error) nextErrors[field] = error;
    }
    if (register && !nextErrors.code && values.code !== "123456") nextErrors.code = text.wrongCode;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    showNotice(register ? text.registerMessage : text.demoMessage);
  }

  function blurField(field: FieldName) {
    setErrors((previous) => ({ ...previous, [field]: validateField(field) }));
  }

  return (
    <div className="flex w-full flex-col">
      <h1 className="mb-[35px] text-left text-[30px] leading-[45px] font-medium text-black">{register ? text.registerTitle : text.title}</h1>
      <form onSubmit={submit} noValidate autoComplete="off">
        {register ? (
          <>
            <AuthField id="phone" placeholder={text.phone} inputMode="tel" maxLength={11} value={values.phone} onChange={(event) => updateField("phone", event.target.value.replace(/\D/g, ""))} onBlur={() => blurField("phone")} error={errors.phone} />
            <div className="mb-[18px] flex w-full max-w-[299px] items-start gap-[10px]">
              <AuthField id="code" placeholder={text.code} inputMode="numeric" maxLength={6} value={values.code} onChange={(event) => updateField("code", event.target.value.replace(/\D/g, ""))} onBlur={() => blurField("code")} error={errors.code} className="!mb-0 min-w-0 flex-1" />
              <button type="button" disabled={!/^1[3-9]\d{9}$/.test(values.phone) || countdown > 0} onClick={() => { setCountdown(60); showNotice(text.codeMessage); }} className="h-[46px] shrink-0 rounded-[23px] border border-[#0f172a26] bg-white px-[14px] text-[13px] leading-[13px] text-[#606266] shadow-[0_2px_6px_#0000000d,inset_0_1px_#ffffff40] transition-colors hover:text-primary disabled:text-[#a8abb2]">{countdown > 0 ? `${countdown}${text.seconds}` : text.getCode}</button>
            </div>
          </>
        ) : (
          <AuthField id="account" placeholder={text.account} value={values.account} onChange={(event) => updateField("account", event.target.value)} onBlur={() => blurField("account")} error={errors.account} />
        )}
        <AuthField
          id="password" type={visiblePassword ? "text" : "password"} placeholder={register ? text.registerPassword : text.password}
          value={values.password} onChange={(event) => updateField("password", event.target.value)} onBlur={() => blurField("password")} error={errors.password}
          suffix={values.password && <button type="button" aria-label={visiblePassword ? text.hidePassword : text.showPassword} aria-pressed={visiblePassword} onClick={() => setVisiblePassword((value) => !value)} className="ml-2 flex h-full items-center text-[#a8abb2] hover:text-[#606266]"><PasswordVisibilityIcon visible={visiblePassword} /></button>}
        />
        {!register && <LanguageSwitch locale={locale} onChange={(nextLocale) => { setErrors({}); onLocaleChange(nextLocale); }} />}
        <div className="mt-6">
          <button type="submit" className="auth-submit relative flex h-[46px] w-full items-center justify-center overflow-hidden rounded-[23px] border border-primary bg-primary px-[15px] py-2 text-[15px] leading-[15px] font-medium text-white transition-all duration-300 hover:-translate-y-px hover:border-[#d0625e] hover:bg-[#d0625e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{register ? text.register : text.login}</button>
        </div>
        <div className="mt-5 text-center text-[14px] leading-5 text-muted">
          <span>{register ? text.hasAccount : text.noAccount}</span><a href={register ? "#/auth/login" : "#/auth/register"} className="text-primary">{register ? text.toLogin : text.register}</a>
        </div>
      </form>
      <dialog ref={noticeDialog} aria-labelledby="notice-title" aria-describedby="notice-description" className="demo-dialog fixed inset-0 m-auto w-[calc(100%-40px)] max-w-[420px] rounded-2xl border-0 bg-white p-6 shadow-2xl">
        <h2 id="notice-title" className="mb-3 text-lg font-semibold text-foreground">{text.demoTitle}</h2>
        <p id="notice-description" className="text-sm leading-6 text-[#606266]">{notice}</p>
        <button type="button" onClick={() => noticeDialog.current?.close()} className="mt-5 w-full rounded-full bg-primary py-2.5 text-sm text-white hover:bg-[#a71b17]">{text.confirm}</button>
      </dialog>
    </div>
  );
}
