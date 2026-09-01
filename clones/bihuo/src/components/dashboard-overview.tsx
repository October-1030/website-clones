"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { DashIcon } from "@/components/dashboard-icons";
import "./dashboard-overview.css";

const allCompanies = "全部公司 · 汇总";

const metricHelp = {
  搜索问题: "问题库里的搜索问题总数。文章围绕问题生成，收录检查也按问题逐个到各 AI 平台去查，所以它是整条链路的起点。",
  文章: "已创建的文章总数，包含由搜索问题生成的和手动创建的。",
  发布成功: "发布成功的次数。同一篇文章发到多个平台会分别计一次，所以次数通常多于文章篇数。",
  "AI 收录检查": "在各 AI 平台执行的收录检查次数（一个问题在一个平台查一次记一次），不等于「有多少内容被收录」。下方一行是其中真正查到收录的问题数及其占问题总数的比例。",
  自有文章被引用: "收录检查结果中引用到你自己文章的次数。下方一行是这些引用来自多少篇不重复的文章——同样是 22 次，来自 6 篇和来自 22 篇含义完全不同。",
};

function OverviewHelp({ label, description }: { label: string; description: string }) {
  const tooltipId = useId();
  const [alignRight, setAlignRight] = useState(false);

  function positionTooltip(element: HTMLElement) {
    const tooltipWidth = Math.min(352, window.innerWidth * 0.7);
    setAlignRight(element.getBoundingClientRect().left + tooltipWidth > window.innerWidth - 20);
  }

  return (
    <span
      className="overview-help group relative inline-flex shrink-0 tracking-normal"
      onMouseEnter={(event) => positionTooltip(event.currentTarget)}
      onFocus={(event) => positionTooltip(event.currentTarget)}
    >
      <button
        type="button"
        aria-label={`${label}说明`}
        aria-describedby={tooltipId}
        className="inline-flex cursor-help text-[14px] leading-none text-[var(--cv-text-soft)] transition-colors hover:text-[var(--cv-signal)] focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--cv-signal)]"
        onKeyDown={(event) => {
          if (event.key === "Escape") event.currentTarget.blur();
        }}
      >
        <DashIcon name="info" />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className={`overview-help-tooltip invisible absolute bottom-[calc(100%+10px)] z-30 w-[min(352px,70vw)] rounded-[4px] bg-[#303133] px-[12px] py-[8px] text-left text-[12px] leading-[1.6] font-normal whitespace-normal text-white opacity-0 shadow-md transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ${alignRight ? "right-0 after:right-[3px]" : "left-0 after:left-[3px]"}`}
      >
        {description}
      </span>
    </span>
  );
}

function CompanyScopeSelect({ companies }: { companies: string[] }) {
  const [selectedScope, setSelectedScope] = useState(allCompanies);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const options = [allCompanies, ...new Set(companies.filter((company) => company && company !== allCompanies))];
  const selected = options.includes(selectedScope) ? selectedScope : allCompanies;

  useEffect(() => {
    if (!isOpen) return;

    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !selectRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [isOpen]);

  function selectOption(option: string) {
    setSelectedScope(option);
    setIsOpen(false);
    buttonRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => isOpen
        ? (index + direction + options.length) % options.length
        : options.indexOf(selected));
      setIsOpen(true);
      return;
    }

    if (isOpen && (event.key === "Home" || event.key === "End")) {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : options.length - 1);
    }

    if (isOpen && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      selectOption(options[activeIndex] ?? allCompanies);
    }
  }

  return (
    <div
      ref={selectRef}
      className="relative w-[200px]"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-label="数据总览公司范围"
        aria-controls={listId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-activedescendant={isOpen ? `${listId}-${activeIndex}` : undefined}
        className="flex h-[36px] w-full items-center gap-[6px] rounded-full border border-[rgba(15,23,42,.15)] bg-[var(--cv-surface)] px-[12px] text-left text-[13px] leading-[24px] text-[var(--cv-text)] shadow-[inset_0_0_0_1px_var(--cv-line-strong)] transition-shadow hover:shadow-[inset_0_0_0_1px_var(--cv-signal)] focus-visible:shadow-[inset_0_0_0_1px_var(--cv-signal)] focus-visible:outline-none"
        onClick={() => {
          setActiveIndex(options.indexOf(selected));
          setIsOpen(!isOpen);
        }}
        onKeyDown={handleKeyDown}
      >
        <span className={`block size-[6.4px] shrink-0 rounded-full ${selected === allCompanies ? "overview-scope-dot bg-[var(--cv-up)]" : "bg-[var(--cv-text-soft)]"}`} />
        <span className="min-w-0 flex-1 truncate">{selected}</span>
        <DashIcon name="chevronDown" className={`text-[14px] text-[var(--cv-text-soft)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <ul
          id={listId}
          role="listbox"
          aria-label="公司范围"
          className="absolute top-[calc(100%+8px)] right-0 z-20 max-h-[240px] w-full overflow-y-auto rounded-[4px] border border-[var(--cv-line)] bg-[var(--cv-surface)] py-[6px] shadow-[0_2px_12px_0_#0000001a]"
        >
          {options.map((option, index) => (
            <li
              id={`${listId}-${index}`}
              key={option}
              role="option"
              aria-selected={option === selected}
              className={`cursor-pointer px-[20px] py-[7px] text-[13px] leading-[20px] ${index === activeIndex ? "bg-[var(--cv-surface-muted)]" : ""} ${option === selected ? "font-semibold text-[var(--cv-signal)]" : "text-[var(--cv-text)]"}`}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectOption(option)}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MetricNode({ label, value = 0, isRoot = false, note }: { label: keyof typeof metricHelp; value?: number; isRoot?: boolean; note?: string }) {
  return (
    <div className={`flex flex-col gap-[4.8px] ${isRoot ? "min-w-0" : "min-w-[152px]"}`}>
      <span className={`flex items-center gap-[4.8px] text-[var(--cv-text-muted)] ${isRoot ? "text-[14px] leading-[21px]" : "text-[13px] leading-[19.5px]"}`}>
        {label}
        <OverviewHelp label={label} description={metricHelp[label]} />
      </span>
      <span className="flex items-baseline gap-[4.8px]">
        <span className={`font-[family-name:var(--cv-mono)] leading-[1.02] font-bold tracking-[-0.035em] text-[var(--cv-ink)] tabular-nums ${isRoot ? "text-[64px] max-[900px]:text-[48px]" : "text-[36px] max-[900px]:text-[30px]"}`}>{value}</span>
        {!isRoot && label !== "文章" && <span className="text-[14px] text-[var(--cv-text-soft)]">次</span>}
      </span>
      <span className="font-[family-name:var(--cv-mono)] text-[12px] leading-[18px] font-semibold text-[var(--cv-text-soft)]">0% 较上周</span>
      {note && <span className="mt-[2.4px] text-[12px] leading-[18px] text-[var(--cv-text-soft)]">{note}</span>}
    </div>
  );
}

function BranchLink({ children }: { children: string }) {
  return (
    <div className="flex min-w-[144px] flex-col items-center gap-[4.8px] px-[20px] max-[900px]:min-w-[112px] max-[900px]:px-0">
      <span aria-hidden="true" className="overview-branch-arrow relative h-px w-full" />
      <span className="text-[11px] leading-[16.5px] whitespace-nowrap text-[var(--cv-text-soft)]">{children}</span>
    </div>
  );
}

function BranchTag({ children }: { children: string }) {
  return (
    <span className="ml-auto rounded-full border border-[var(--cv-line)] bg-[var(--cv-surface-muted)] px-[11.2px] py-[4.8px] text-[12px] leading-[18px] whitespace-nowrap text-[var(--cv-text-muted)] max-[900px]:ml-0">
      {children}
    </span>
  );
}

interface OverviewMetrics { questions: number; articles: number; published: number; indexChecks: number; citations: number }

export function DashboardOverview({ companies = [], metrics = { questions: 0, articles: 0, published: 0, indexChecks: 0, citations: 0 } }: { companies?: string[]; metrics?: OverviewMetrics }) {
  return (
    <section aria-label="数据总览" className="relative w-full border border-[var(--cv-line)] bg-[var(--cv-surface)] text-[var(--cv-text)]">
      <header className="flex flex-wrap items-end justify-between gap-x-[24px] gap-y-[16px] px-[28px] pt-[28px] pb-[24px]">
        <div>
          <p className="mb-[8px] text-[12px] leading-[18px] font-medium tracking-[0.16em] text-[var(--cv-text-soft)]">数据总览</p>
          <h1 className="text-[clamp(29.6px,2.6vw,38px)] leading-[1.15] font-semibold tracking-[-0.03em]">工作台</h1>
          <p className="mt-[8px] text-[15px] leading-[22.5px] text-[var(--cv-text-muted)]">围绕搜索问题，一边产内容，一边查收录</p>
        </div>
        <div className="flex flex-wrap items-center gap-[9.6px]">
          <CompanyScopeSelect companies={companies} />
          <time dateTime="2026-08-31" className="rounded-full border border-[var(--cv-line-strong)] bg-[var(--cv-surface)] px-[14.4px] py-[7.2px] font-[family-name:var(--cv-mono)] text-[13px] leading-[19.5px] text-[var(--cv-text-muted)]">截至 2026-08-31</time>
        </div>
      </header>

      <div className="grid grid-cols-[auto_88px_minmax(0,1fr)] items-center px-[28px] pb-[28px] max-[1100px]:grid-cols-[minmax(0,1fr)] max-[1100px]:gap-[20px]">
        <div className="pr-[20px] max-[1100px]:pr-0">
          <MetricNode label="搜索问题" value={metrics.questions} isRoot />
          <p className="mt-[14.4px] max-w-[176px] text-[12px] leading-[18px] text-[var(--cv-text-soft)] max-[1100px]:max-w-none">问题是起点：内容围着它写，收录也围着它查</p>
        </div>
        <div aria-hidden="true" className="min-h-[208px] self-stretch max-[1100px]:hidden">
          <svg viewBox="0 0 88 240" preserveAspectRatio="none" fill="none" className="h-full w-full">
            <path d="M4,120 H26 C46,120 46,52 66,52 H88" stroke="var(--cv-line-strong)" strokeWidth="1.5" />
            <path d="M4,120 H26 C46,120 46,188 66,188 H88" stroke="var(--cv-line-strong)" strokeWidth="1.5" />
            <circle cx="4" cy="120" r="4" fill="var(--cv-signal)" />
          </svg>
        </div>
        <div className="flex flex-col gap-px rounded-[8px] border border-[var(--cv-line)] bg-[var(--cv-line)]">
          <div className="flex items-center rounded-t-[8px] bg-[var(--cv-surface)] px-[22.4px] py-[20px] max-[900px]:flex-wrap max-[900px]:gap-[16px]">
            <MetricNode label="文章" value={metrics.articles} note={metrics.questions ? `来自 ${metrics.questions} 个本机搜索问题` : "暂无问题"} />
            <BranchLink>发布到各平台</BranchLink>
            <MetricNode label="发布成功" value={metrics.published} />
            <BranchTag>内容生产</BranchTag>
          </div>
          <div className="flex items-center rounded-b-[8px] bg-[var(--cv-surface)] px-[22.4px] py-[20px] max-[900px]:flex-wrap max-[900px]:gap-[16px]">
            <MetricNode label="AI 收录检查" value={metrics.indexChecks} />
            <BranchLink>命中自有文章</BranchLink>
            <MetricNode label="自有文章被引用" value={metrics.citations} />
            <BranchTag>可见性监测</BranchTag>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--cv-line)] px-[28px] pt-[24px] pb-[28px]">
        <div className="mb-[14.4px] flex flex-wrap items-baseline justify-between gap-[12px]">
          <span className="inline-flex items-center gap-[4.8px] text-[13px] leading-[19.5px] font-medium tracking-[0.12em] text-[var(--cv-text-muted)]">
            各 AI 平台收录占比
            <OverviewHelp label="各 AI 平台收录占比" description="各 AI 平台查到的收录记录占全部平台收录记录的比例。" />
          </span>
        </div>
        <p className="text-[14px] leading-[21px] text-[var(--cv-text-soft)]">{metrics.citations ? `本机已记录 ${metrics.citations} 条自有文章收录或引用证据` : "还没有平台收录记录，发布内容后这里会亮起"}</p>
      </div>
    </section>
  );
}
