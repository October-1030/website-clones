"use client";

import Image from "next/image";
import { useId, useRef, useState, type KeyboardEvent } from "react";

import { DashIcon } from "@/components/dashboard-icons";
import { cn } from "@/lib/utils";

const platforms = [
  { name: "全部平台", source: "", icon: null },
  { name: "深度求索", source: "DeepSeek", icon: "/images/deepseek-color.png" },
  { name: "豆包", source: "豆包", icon: "/images/doubao-color.png" },
  { name: "元宝", source: "腾讯元宝", icon: "/images/yuanbao-color.png" },
  { name: "千问", source: "通义千问", icon: "/images/qwen-color.png" },
  { name: "文心", source: "文心一言", icon: "/images/wenxin-color.png" },
  { name: "Kimi", source: "Kimi", icon: "/images/kimi-color.png" },
  { name: "智谱清言", source: "智谱清言", icon: "/images/zhipu-color.png" },
] as const;

export function DashboardAnalytics({ platformCounts = {} }: { platformCounts?: Record<string, number> }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const componentId = useId();
  const headingId = `${componentId}-heading`;
  const panelId = `${componentId}-sources`;
  const total = Object.values(platformCounts).reduce((sum, value) => sum + value, 0);

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;

    switch (event.key) {
      case "ArrowRight":
        nextIndex = (index + 1) % platforms.length;
        break;
      case "ArrowLeft":
        nextIndex = (index - 1 + platforms.length) % platforms.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = platforms.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    setSelectedIndex(nextIndex);
    tabs.current[nextIndex]?.focus();
  }

  return (
    <section className="dashboard-card dashboard-reveal" aria-labelledby={headingId}>
      <header className="mb-7 pr-6 pb-1">
        <h2 className="dashboard-heading" id={headingId}>收录分析</h2>
        <p className="dashboard-subtitle">选一个 AI 平台，看它引用了哪些来源</p>
      </header>

      <div className="min-h-64">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="AI 平台">
          {platforms.map((platform, index) => {
            const selected = index === selectedIndex;
            const count = index === 0 ? total : platformCounts[platform.source] || 0;

            return (
              <button
                key={platform.name}
                ref={(element) => { tabs.current[index] = element; }}
                type="button"
                role="tab"
                id={`${componentId}-tab-${index}`}
                aria-controls={panelId}
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => setSelectedIndex(index)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-[13.6px] py-2 text-[14px] leading-[21px] transition-colors duration-160 hover:border-(--cv-line-strong) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--cv-signal)",
                  selected
                    ? "border-(--cv-signal) bg-(--cv-signal-soft) font-semibold text-(--cv-signal-ink)"
                    : "border-(--cv-line) bg-(--cv-surface) text-(--cv-text) opacity-50",
                )}
              >
                {platform.icon && (
                  <Image
                    src={platform.icon}
                    alt=""
                    width={18}
                    height={18}
                    unoptimized
                    className="size-[18px] shrink-0 rounded object-contain"
                  />
                )}
                <span>{platform.name}</span>
                <span className={cn(
                  "text-[13px] font-semibold [font-family:var(--cv-mono)]",
                  selected ? "text-(--cv-signal-ink)" : "text-(--cv-text-muted)",
                )}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={panelId}
          aria-labelledby={`${componentId}-tab-${selectedIndex}`}
          tabIndex={0}
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--cv-signal)"
        >
          <p className="mt-7 mb-[17.6px] text-[12px] font-medium tracking-[0.14em] text-(--cv-text-soft)">
            {platforms[selectedIndex].name}的引用来源 TOP10 · 共 {selectedIndex === 0 ? total : platformCounts[platforms[selectedIndex].source] || 0} 次
          </p>
          <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-(--cv-text-soft)">
            <DashIcon name="rank" className="text-[26px] opacity-75" />
            <p className="text-[14px] leading-[21px]">{(selectedIndex === 0 ? total : platformCounts[platforms[selectedIndex].source] || 0) ? "已记录本机收录或引用证据，来源明细请到收录记录查看" : "该平台暂无引用来源数据"}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
