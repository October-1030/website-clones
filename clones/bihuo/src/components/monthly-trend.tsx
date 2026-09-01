import { DashIcon } from "@/components/dashboard-icons";

export function MonthlyTrend() {
  return (
    <section className="dashboard-card dashboard-reveal" aria-labelledby="monthly-trend-heading">
      <header className="mb-6 pr-6 pb-1">
        <h2 className="dashboard-heading" id="monthly-trend-heading">月度趋势</h2>
        <p className="dashboard-subtitle">
          近 6 个月每月新增。色深表示该指标自身的相对高低，行与行独立标定
        </p>
      </header>
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-(--cv-text-soft)">
        <DashIcon name="matrix" className="text-[26px] opacity-75" />
        <p className="text-[14px] leading-[21px]">暂无月度数据</p>
      </div>
    </section>
  );
}
