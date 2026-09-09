"use client";

import { CheckCircle2, Monitor, Moon, Sun } from "lucide-react";

export const skins = ["默认", "星月鎏金", "雾灰", "青竹", "雅绿", "暖杏", "麦芽", "水雾", "青瓷", "海雾", "暮紫", "珊瑚", "樱粉", "黛粉", "素纸"];
export function AppearancePanel({ skin, mode, eyeCare, onSkin, onMode, onEyeCare }: { skin: number; mode: string; eyeCare: boolean; onSkin: (value: number) => void; onMode: (value: string) => void; onEyeCare: () => void }) {
  return <section className="appearance-panel" aria-label="外观设置">
    <h2 className="font-bold">外观</h2><p className="mb-2 text-xs text-muted">主题与皮肤</p>
    <p className="mb-2 text-xs">◐ 主题</p>
    <div role="group" aria-label="主题模式" className="flex rounded-xl bg-[var(--soft)] p-1">{[{ name: "跟随", Icon: Monitor }, { name: "白天", Icon: Sun }, { name: "黑夜", Icon: Moon }].map(({ name, Icon }) => <button key={name} onClick={() => onMode(name)} aria-pressed={mode === name} className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-xs ${mode === name ? "bg-surface shadow-sm" : ""}`}><Icon size={14} />{name}</button>)}</div>
    <div className="my-3 flex items-center justify-between border-y border-border/50 py-3 text-xs"><span>☼ 护眼模式</span><button role="switch" aria-label="开启护眼模式" aria-checked={eyeCare} onClick={onEyeCare} className={`theme-switch ${eyeCare ? "enabled" : ""}`}><span /></button></div>
    <p className="mb-2 text-xs">▣ 皮肤</p>
    <div role="group" aria-label="皮肤选择" className="grid grid-cols-3 gap-x-2 gap-y-2">{skins.map((name, index) => <button key={name} onClick={() => onSkin(index)} aria-pressed={skin === index} className="text-center text-[11px]"><span className={`skin-swatch skin-${index} ${skin === index ? "selected" : ""}`}>{index === 1 && <span className="absolute right-3 top-2 text-xl">🌙</span>}{skin === index && <CheckCircle2 size={17} className="absolute bottom-1 right-1 fill-primary text-white" />}</span>{name}</button>)}</div>
  </section>;
}
