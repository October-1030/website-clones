import "./CreatePage.css";

export type CreateTaskType = "image-task" | "html-video" | "music-mv";

interface CreatePageProps {
  onSelect: (type: CreateTaskType) => void;
}

interface CreateOption {
  type: CreateTaskType;
  title: string;
  eyebrow: string;
  description: string;
  tags: string[];
  hint: string;
  isNew?: boolean;
}

const createOptions: CreateOption[] = [
  {
    type: "image-task",
    title: "图文任务",
    eyebrow: "Image · Story",
    description:
      "经典图文成片：AI 分镜配图 + 文案朗读 + 字幕，最通用的口播 / 故事视频形态。",
    tags: ["人物故事", "健康图书", "带货口播"],
    hint: "支持双人播客 / 真图素材",
  },
  {
    type: "html-video",
    title: "HTML动画视频",
    eyebrow: "Motion · Code",
    description:
      "代码驱动的动效短片：知识卡片、金句排版、动态强调，精准可控的动画成片。",
    tags: ["知识科普", "财商写作", "命题创作"],
    hint: "16 种版式 / 全后期可改",
    isNew: true,
  },
  {
    type: "music-mv",
    title: "音乐MV",
    eyebrow: "Music · Video",
    description:
      "AI 写词作曲 + 歌词卡点画面成片：情绪向、氛围向内容，也支持本地音乐混剪。",
    tags: ["情感氛围", "歌词卡点", "节日祝福"],
    hint: "AI 作曲 / 本地音乐两种模式",
  },
];

function ImageTaskIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <rect x="5.5" y="5.5" width="21" height="21" rx="3" />
      <circle cx="11.5" cy="11.5" r="2" />
      <path d="m7.5 23 6.1-6.2 3.8 3.7 3.4-3.5 3.7 3.8" />
    </svg>
  );
}

function HtmlVideoIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="m12.5 7-5 5 5 5M19.5 7l5 5-5 5M18 5l-4 14" />
      <path d="M7 21.5h18v5H7z" />
    </svg>
  );
}

function MusicMvIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M13 23.5V9l12-2.5V21" />
      <ellipse cx="9.5" cy="24" rx="3.5" ry="2.8" />
      <ellipse cx="21.5" cy="21.5" rx="3.5" ry="2.8" />
    </svg>
  );
}

function OptionIcon({ type }: { type: CreateTaskType }) {
  if (type === "image-task") {
    return <ImageTaskIcon />;
  }

  if (type === "html-video") {
    return <HtmlVideoIcon />;
  }

  return <MusicMvIcon />;
}

export function CreatePage({ onSelect }: CreatePageProps) {
  return (
    <main className="create-page">
      <div className="create-page__wrapper">
        <header className="create-page__header">
          <p className="create-page__eyebrow">开始创作</p>
          <h1>想做点什么？</h1>
          <p className="create-page__intro">
            选择一种任务类型，一句话或一段文案，即可自动成片。
          </p>
        </header>

        <div className="create-page__grid">
          {createOptions.map((option) => (
            <button
              className={`create-card create-card--${option.type}`}
              key={option.type}
              type="button"
              onClick={() => onSelect(option.type)}
            >
              <span className="create-card__icon">
                <OptionIcon type={option.type} />
              </span>

              <span className="create-card__title-row">
                <span className="create-card__title">{option.title}</span>
                {option.isNew ? <span className="create-card__new">NEW</span> : null}
              </span>

              <span className="create-card__eyebrow">{option.eyebrow}</span>
              <span className="create-card__description">{option.description}</span>

              <span className="create-card__tags" aria-label="适用场景">
                {option.tags.map((tag) => (
                  <span className="create-card__tag" key={tag}>
                    {tag}
                  </span>
                ))}
              </span>

              <span className="create-card__footer">
                <span className="create-card__hint">{option.hint}</span>
                <span className="create-card__action">
                  开始创建
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path d="M4 10h11M11 6l4 4-4 4" />
                  </svg>
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
