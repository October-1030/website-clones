"use client";

import Image from "next/image";
import { useState } from "react";
import { DashboardDialog } from "@/components/dashboard-dialog";
import { DashIcon } from "@/components/dashboard-icons";
import { workflow } from "@/lib/dashboard-data";

export function DashboardTutorial({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const current = workflow[Math.min(step, 3)];
  return (
    <DashboardDialog label="GEO 新手教程" onClose={onClose} className="tutorial-dialog">
      <div className="tutorial-atmosphere" aria-hidden="true"><i /><i /><i /></div>
      <div className="tutorial-stage">
        <div className="tutorial-character"><Image src="/images/geo-agent-CtRbLfrG.png" alt="GEO 助手" width={506} height={691} loading="eager" unoptimized /></div>
        <div className="tutorial-main">
          <button className="tutorial-skip" onClick={onClose}>跳过引导</button>
          <p className="mb-[22px] text-[13.5px] leading-[1.6] text-white/70">{step < 4 ? `第 ${step + 1} 步 · 共 4 步` : "现在，开始你的 GEO 之旅"}</p>
          <div className="tutorial-stepper">
            {workflow.map((item, index) => <button key={item.title} onClick={() => setStep(index)} aria-current={step === index ? "step" : undefined} className={step === index ? "is-current" : ""}><span><DashIcon name={item.icon} /></span><span>{item.title}</span></button>)}
          </div>
          <div className="tutorial-detail">
            {step < 4 ? <>
              <div className="mb-[18px] flex items-center gap-[14px]"><span className="tutorial-number">{step + 1}</span><div><h2 className="text-[17px] font-semibold">{current.title}</h2><p className="mt-0.5 text-[13px] text-white/62">{current.summary}</p></div></div>
              <div className="tutorial-steps">{current.steps.map((item) => <div className="tutorial-item" key={item.name}><span className="tutorial-item-icon"><DashIcon name={item.icon} /></span><div><h3>{item.name}</h3><p>{item.description}</p></div></div>)}</div>
            </> : <div className="space-y-4"><h2 className="text-[20px] font-semibold">从准备资料到验证收录</h2><p className="text-[14px] leading-7 text-white/70">准备公司与知识库 → 创作内容 → 发布分发 → 验证收录。你可以随时在「流程步骤」中找到对应入口，也可以再次查看这份教程。</p></div>}
          </div>
          <footer className="tutorial-footer"><div className="tutorial-dots">{Array.from({ length: 5 }, (_, index) => <button key={index} aria-label={index < 4 ? `第 ${index + 1} 步` : "教程总结"} className={index === step ? "is-current" : ""} onClick={() => setStep(index)} />)}</div><div className="flex gap-2.5"><button className="tutorial-back" disabled={step === 0} onClick={() => setStep(step - 1)}>上一步</button><button className="tutorial-next" onClick={() => step === 4 ? onClose() : setStep(step + 1)}>{step === 4 ? "开始使用" : step === 3 ? "看总结" : "下一步"}<DashIcon name="arrowRight" /></button></div></footer>
        </div>
      </div>
    </DashboardDialog>
  );
}
