import type { ReactNode } from "react";

export function AuthShell({ children, showFooter }: { children: ReactNode; showFooter: boolean }) {
  return (
    <main className="auth-background fixed inset-0 isolate flex h-dvh w-full items-center justify-center overflow-hidden">
      <div className="relative z-[1] flex h-full w-full justify-end overflow-y-auto">
        <section className="flex h-full w-full items-center justify-center px-5 min-[769px]:w-[36%] min-[769px]:justify-start min-[769px]:pr-0 min-[769px]:pl-10">
          <div className="auth-panel relative flex w-full max-w-[400px] items-center justify-center rounded-[25px] border-2 border-white px-5 py-[30px] shadow-[inset_0_0_20px_#fff] backdrop-blur-[10px] min-[481px]:px-[30px] min-[481px]:py-10 min-[769px]:w-[420px] min-[769px]:max-w-full min-[769px]:px-[50px] min-[769px]:py-[45px]">
            {children}
          </div>
        </section>
      </div>
      {showFooter && (
        <footer className="pointer-events-none fixed bottom-5 left-0 z-10 flex w-full justify-center">
          <p className="m-0 text-center text-[13px] leading-[1.5] text-white/70 [text-shadow:0_1px_2px_#0003]">必火AI · GEO智能营销平台</p>
        </footer>
      )}
    </main>
  );
}
