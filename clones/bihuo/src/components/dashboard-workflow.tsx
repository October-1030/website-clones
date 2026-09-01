import { DashIcon } from "@/components/dashboard-icons";
import { downloadTools, workflow } from "@/lib/dashboard-data";

export function DashboardWorkflow({ onTutorial, onAction }: { onTutorial: () => void; onAction: (name: string) => void }) {
  return (
    <section className="dashboard-card dashboard-reveal">
      <header className="mb-7 flex items-center justify-between pr-6 pb-1">
        <h2 className="dashboard-heading">流程步骤</h2>
        <button className="flex items-center gap-1 text-[14px] text-(--cv-text-soft) hover:text-(--accent)" onClick={onTutorial}>查看教程<DashIcon name="chevronRight" /></button>
      </header>
      <div className="flow-track">
        {workflow.map((phase, phaseIndex) => (
          <div className={`flow-phase ${phase.steps.length === 1 ? "flow-phase-single" : ""}`} key={phase.phase}>
            <p className="text-[12px] tracking-[.16em] text-(--cv-text-soft) [font-family:var(--cv-mono)]">{phase.phase}</p>
            <div className="flow-nodes">
              {phase.steps.map((step, index) => (
                <button type="button" className="flow-node group" onClick={() => onAction(step.name)} key={step.name}>
                  <span className="text-[12px] leading-[18px] font-bold text-(--cv-text-soft) [font-family:var(--cv-mono)]">{String(phaseIndex * 3 + index + 1).padStart(2, "0")}</span>
                  <span className="flow-icon"><DashIcon name={step.icon} /></span>
                  <span className="max-w-full truncate text-[14px] leading-[21px] font-medium group-hover:text-(--accent)">{step.name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function DashboardFooter({ onAction, onTutorial }: { onAction: (name: string) => void; onTutorial: () => void }) {
  return (
    <footer className="dashboard-card dashboard-footer">
      <div>
        <p className="footer-label">工具下载</p>
        <div className="download-grid">
          {downloadTools.map((tool) => (
            <button key={tool.title} className="download-button" onClick={() => onAction(tool.title)}>
              <span className="download-icon"><DashIcon name={tool.icon} /></span>
              <span className="flex min-w-0 flex-1 flex-col items-start gap-1"><span className="text-[15px] font-medium">{tool.title}</span><span className="text-[12px] font-semibold text-(--cv-text-soft) [font-family:var(--cv-mono)]">{tool.version}</span></span>
              <DashIcon name="download" className="text-[16px] text-(--cv-text-soft)" />
            </button>
          ))}
        </div>
      </div>
      <div className="footer-help">
        <p className="footer-label">帮助与支持</p>
        <button className="download-button" onClick={onTutorial}>
          <span className="flex flex-1 flex-col items-start gap-1"><span className="text-[15px] font-medium">帮助文档</span><span className="text-[12px] text-(--cv-text-soft)">查看文档如何使用</span></span>
          <DashIcon name="arrowRight" className="text-[18px] text-(--cv-text-soft)" />
        </button>
      </div>
    </footer>
  );
}
