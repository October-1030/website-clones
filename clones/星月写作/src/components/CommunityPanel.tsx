"use client";

import { ArrowRight, CalendarCheck, ChevronRight, Pin, X } from "lucide-react";

type CommunityPanelProps = {
  onArticle: (title: string) => void;
  onShare: () => void;
  onMore: () => void;
  onCheckIn: () => void;
  onClose: () => void;
};

const articles = [
  "【故事】8.20日更新【全模型测评】总结，选取建议，新人入门，老手进阶，不再选择困难",
  "版规-使用论坛之前必看，否则可能会永久封号",
  "现在开新书，各位大佬的数据怎么样啊？",
  "侧边栏显示不全，提个小建议",
  "前文关联建议！！！",
  "写作关联",
  "【最新优化审稿4.0】效果爆炸，准确识别内容的每一个设定、伏笔、逻辑关系，完美查缺补漏，不崩人设！",
  "【月澜天歌】新更新的封面提示词，效果爆炸级提升，简单明了上手快，只需简单限制一下便可得到满意的封面",
  "【月澜天歌】一本书如何用最简单的方法写出爆款开头和真人味十足的内容？邪修方案告诉你",
  "【月澜天歌】更新提示词炸出来了忠实粉丝，智慧5.6模型直出两万字0AI率，月入15000续写提示词",
  "咱星月能不能也把备忘录，生成的大纲做成这样的主题？",
  "【自用长篇全流程公开！简单实用！】",
  "我收到了共用账号的警告",
  "能不能出一个作品当日已打卡或者已更新的选项",
  "【米丢】❤️分享两个用来做自媒体之类的提示词、公众号、xhs、今日头条；另一个是用来写宣传片剧本的❤",
  "求求了！工作流能不能增加提示词的字数上限？",
  "【青蛙】朱雀人工率100%的续写提示词，免审稿免去痕，不好用回来打我",
  "【AI去痕】朱雀100%人工率的AI去痕提示词",
  "桀桀桀桀，道爷俺成了！",
  "反映个拆书字数的问题",
] as const;

export function CommunityPanel({
  onArticle,
  onShare,
  onMore,
  onCheckIn,
  onClose,
}: CommunityPanelProps) {
  return (
    <aside
      aria-label="网文社区"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border-[0.8px] border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--panel-shadow)]"
    >
      <header className="flex h-[42.8px] shrink-0 items-center justify-between border-b border-[var(--border)] px-3 py-1.5">
        <h2 className="shrink-0 text-base font-bold leading-6">网文社区</h2>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onShare}
            className="flex cursor-pointer items-center gap-1 whitespace-nowrap rounded text-sm leading-5 transition-colors duration-200 hover:text-[#7366df] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7366df]"
          >
            <ChevronRight aria-hidden="true" className="size-3.5" />
            我要分享
          </button>
          <button
            type="button"
            onClick={onMore}
            className="flex cursor-pointer items-center gap-1 whitespace-nowrap rounded text-sm leading-5 transition-colors duration-200 hover:text-[#7366df] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7366df]"
          >
            <ChevronRight aria-hidden="true" className="size-3.5" />
            更多
          </button>
          <button type="button" aria-label="关闭网文社区" onClick={onClose} className="rounded p-1 text-[var(--muted)] hover:text-[#7366df]"><X size={15} /></button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5 [scrollbar-width:thin]">
        <button
          type="button"
          onClick={onCheckIn}
          className="flex h-16 w-full cursor-pointer items-center gap-2 rounded-2xl border border-[#ded9ec] bg-[#eee9fb] px-3 text-left transition-colors duration-200 hover:bg-[#e6def9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7366df]"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#8961ec] text-white shadow-[0_3px_6px_rgba(137,97,236,0.2)]">
            <CalendarCheck aria-hidden="true" className="size-5" strokeWidth={2} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block whitespace-nowrap text-sm font-bold leading-5">每日签到领福利</span>
            <span className="block whitespace-nowrap text-[11px] leading-4 text-[var(--muted)]">签到可领取更多奖励</span>
          </span>
          <span className="flex shrink-0 items-center gap-0.5 whitespace-nowrap text-xs leading-4 text-[#7366df]">
            去签到
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </span>
        </button>

        <ul className="mt-3">
          {articles.map((title, index) => (
            <li key={title} className="mb-2">
              <button
                type="button"
                onClick={() => onArticle(title)}
                title={title}
                className={`flex w-full cursor-pointer items-start gap-1 border-b border-[#f0f1f5] px-1.5 py-1 text-left text-sm leading-[21.8px] transition-colors duration-200 hover:text-[#7366df] focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7366df] ${index < 2 ? "text-[#7366df]" : "text-[var(--foreground)]"}`}
              >
                {index < 2 ? (
                  <Pin aria-hidden="true" className="mt-1 size-3 shrink-0 text-[#7366df]" fill="currentColor" strokeWidth={1.5} />
                ) : (
                  <span aria-hidden="true" className="mx-1 mt-[9px] size-1 shrink-0 rounded-full bg-[#7366df]" />
                )}
                <span className="line-clamp-2 min-h-[25px] min-w-0 pt-px">{title}</span>
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onMore}
          className="mt-1 flex w-full cursor-pointer items-center justify-center gap-1 rounded py-2.5 text-sm text-[var(--muted)] transition-colors duration-200 hover:text-[#7366df] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7366df]"
        >
          查看更多
          <ChevronRight aria-hidden="true" className="size-3.5" />
        </button>
      </div>
    </aside>
  );
}
