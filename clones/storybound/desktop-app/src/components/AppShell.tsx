import { useEffect, useState, type ReactNode } from "react";

import { navGroups } from "../data/app-data";
import type { AppPage } from "../types/app";
import "./AppShell.css";

interface AppShellProps {
  currentPage: AppPage;
  onNavigate: (page: AppPage) => void;
  children: ReactNode;
}

function StoryboundMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? "app-shell-mark app-shell-mark--compact" : "app-shell-mark"} aria-hidden="true">
      S
    </span>
  );
}

function FeedbackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5.6 4.75h12.8A2.6 2.6 0 0 1 21 7.35v7.3a2.6 2.6 0 0 1-2.6 2.6h-6.14l-4.5 3.15v-3.15H5.6A2.6 2.6 0 0 1 3 14.65v-7.3a2.6 2.6 0 0 1 2.6-2.6Z" />
      <path d="M7.4 9h9.2M7.4 12.75h6.4" />
    </svg>
  );
}

function ThemeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19.6 15.6A8.2 8.2 0 0 1 8.4 4.4 8.2 8.2 0 1 0 19.6 15.6Z" />
    </svg>
  );
}

export function AppShell({ currentPage, onNavigate, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [highContrast, setHighContrast] = useState(() => window.localStorage.getItem("storybound-high-contrast") === "1");
  const [windowMessage, setWindowMessage] = useState("");

  useEffect(() => {
    const handleNewTaskShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        onNavigate("create");
      }
    };

    window.addEventListener("keydown", handleNewTaskShortcut);
    return () => window.removeEventListener("keydown", handleNewTaskShortcut);
  }, [onNavigate]);

  useEffect(() => {
    window.localStorage.setItem("storybound-high-contrast", highContrast ? "1" : "0");
  }, [highContrast]);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setWindowMessage("当前浏览器未授予全屏权限");
    }
  }

  function closeWindow() {
    window.close();
    window.setTimeout(() => setWindowMessage("浏览器模式请直接关闭当前标签页"), 120);
  }

  return (
    <div className={`app-shell${collapsed ? " is-collapsed" : ""}${highContrast ? " is-high-contrast" : ""}`}>
      <header className="app-shell-titlebar">
        <div className="app-shell-titlebar-brand">
          <StoryboundMark compact />
          <span className="app-shell-titlebar-name">Storybound</span>
        </div>

        <div className="app-shell-window-controls" aria-label="窗口控制">
          <button className="app-shell-window-button" type="button" aria-label={collapsed ? "展开工作台" : "收起工作台"} onClick={() => setCollapsed((value) => !value)}>
            <span className="app-shell-minimize" aria-hidden="true" />
          </button>
          <button className="app-shell-window-button app-shell-maximize-button" type="button" aria-label="切换全屏" onClick={() => void toggleFullscreen()}>
            <span className="app-shell-maximize" aria-hidden="true" />
          </button>
          <button className="app-shell-window-button app-shell-window-button--close" type="button" aria-label="关闭" onClick={closeWindow}>
            <span className="app-shell-close" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="app-shell-license" role="status">
        <span className="app-shell-license-badge">独立版</span>
        <span><strong>本地工作台</strong></span>
        <span className="app-shell-license-detail">{windowMessage || "自有 API · 不连接原版试用、积分和授权后台"}</span>
        <button type="button" className="app-shell-license-link" onClick={() => onNavigate("activation")}>
          查看边界 <span aria-hidden="true">›</span>
        </button>
      </div>

      <div className="app-shell-body">
        <aside className="app-shell-sidebar">
          <div className="app-shell-sidebar-brand">
            <StoryboundMark />
            <div className="app-shell-sidebar-brand-copy">
              <span>Storybound</span>
              <small>v1.16.1 · beta</small>
            </div>
          </div>

          <button
            type="button"
            className={`app-shell-new-task${currentPage === "create" ? " is-active" : ""}`}
            onClick={() => onNavigate("create")}
            title="新建任务 (Ctrl+N)"
          >
            <span className="app-shell-new-task-plus" aria-hidden="true">+</span>
            <span className="app-shell-new-task-label">新建任务</span>
            <kbd>Ctrl+N</kbd>
          </button>

          <nav className="app-shell-nav" aria-label="主导航">
            {navGroups.map((group, groupIndex) => (
              <div className="app-shell-nav-group" key={groupIndex}>
                {group.map((item) => (
                  <button
                    type="button"
                    className={`app-shell-nav-item${currentPage === item.page ? " is-active" : ""}`}
                    key={item.page}
                    onClick={() => onNavigate(item.page)}
                    aria-current={currentPage === item.page ? "page" : undefined}
                    title={item.label}
                  >
                    <span className="app-shell-nav-icon" aria-hidden="true">{item.icon}</span>
                    <span className="app-shell-nav-label">{item.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="app-shell-sidebar-footer">
            <div className="app-shell-points-card" title="本地模式：不连接原版积分系统">
              <div className="app-shell-points-icon" aria-hidden="true">◆</div>
              <div className="app-shell-points-copy">
                <span>本地模式</span>
                <strong>自有 API</strong>
              </div>
              <span className="app-shell-points-arrow" aria-hidden="true">›</span>
            </div>

            <div className="app-shell-footer-actions">
              <a className="app-shell-footer-button" title="意见反馈" href="https://github.com/October-1030/website-clones/issues" target="_blank" rel="noreferrer">
                <FeedbackIcon />
                <span>意见反馈</span>
              </a>
              <button type="button" className="app-shell-footer-button" title="切换高对比主题" aria-pressed={highContrast} onClick={() => setHighContrast((value) => !value)}>
                <ThemeIcon />
                <span>主题</span>
              </button>
            </div>
          </div>
        </aside>

        <main className="app-shell-main">{children}</main>
      </div>
    </div>
  );
}
