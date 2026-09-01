import type { InputHTMLAttributes, ReactNode } from "react";

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & { error?: string; suffix?: ReactNode };

export function AuthField({ error, suffix, id, className = "", ...props }: AuthFieldProps) {
  return (
    <div className={`relative mb-[18px] ${className}`}>
      <div className={`flex h-[46px] items-center rounded-[23px] border bg-white px-[18px] transition-all duration-300 hover:bg-[#f3f4f6] ${error ? "border-[#ff4d4f]" : "border-[#0f172a26] hover:border-[#d1d5db] focus-within:border-primary"}`}>
        <input
          {...props}
          id={id}
          aria-label={props.placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-[34px] min-w-0 flex-1 border-0 bg-transparent p-0 text-[14px] leading-[34px] font-normal text-foreground outline-none placeholder:text-[#9ca3af]"
        />
        {suffix}
      </div>
      {error && <div id={`${id}-error`} role="alert" className="absolute top-full left-0 pt-[2px] text-[12px] leading-[1] text-[#ff4d4f]">{error}</div>}
    </div>
  );
}
