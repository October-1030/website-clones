"use client";

import { useState } from "react";
import type { Book } from "@/types/workspace";
import { AIToolDialog } from "./AIToolDialog";
import { ImageDialog } from "./ImageDialog";
import { Modal } from "./Modal";
import { PromptPicker } from "./PromptPicker";

export function TitleTestDialog({ books, onClose, onCover }: { books: Book[]; onClose: () => void; onCover: (id: string, cover: string) => void }) {
  const [step, setStep] = useState<"setup" | "generate" | "cover">("setup");
  const [author, setAuthor] = useState("");
  const [reference, setReference] = useState("");
  const [synopsis, setSynopsis] = useState("");
  const [subtitle, setSubtitle] = useState(true);
  const [titles, setTitles] = useState("");
  const [coverPrompt, setCoverPrompt] = useState("");
  const [titlePrompt, setTitlePrompt] = useState("");
  if (step === "generate") return <AIToolDialog name="书名生成器" books={books} initialInput={`${titlePrompt ? titlePrompt + "\n\n" : ""}请生成9个候选小说书名，每行一个，仅输出书名。${subtitle ? "可包含副标题。" : "不要副标题。"}\n笔名：${author}\n参考书名：${reference}\n作品核心简介：${synopsis}`} onClose={() => setStep("setup")} onUseResult={text => { setTitles(text.split("\n").map(line => line.replace(/^\s*(?:\d+[.、)]\s*|[-*]\s*)/, "").trim()).filter(Boolean).slice(0,9).join("\n")); setStep("setup"); }} />;
  if (step === "cover") return <ImageDialog name="书名测试 · 2 封面生成" initialInput={coverPrompt || `小说封面插画，无文字，预留上方书名空间。故事：${synopsis}`.slice(0,1500)} initialTitles={titles} initialAuthor={author} books={books} onCover={onCover} onClose={() => setStep("setup")} />;
  return <Modal title="书名测试实验室" onClose={onClose} wide><div className="grid gap-4">
    <p>1 书名生成 → 2 封面生成</p>
    <PromptPicker toolName="书名生成器" onApply={content => setTitlePrompt(content)} />
    {titlePrompt && <label>书名提示词<textarea className="form-input" maxLength={30000} value={titlePrompt} onChange={event => setTitlePrompt(event.target.value)} /></label>}
    <label>您的笔名<input className="form-input" maxLength={30} value={author} onChange={event => setAuthor(event.target.value)} /></label>
    <label>参考书名<input className="form-input" maxLength={200} value={reference} onChange={event => setReference(event.target.value)} placeholder="没有可留空" /></label>
    <label><input type="checkbox" checked={subtitle} onChange={event => setSubtitle(event.target.checked)} /> 生成副标题</label>
    <label>作品核心简介<textarea className="form-input min-h-32" maxLength={12000} value={synopsis} onChange={event => setSynopsis(event.target.value)} /></label>
    <button type="button" className="primary-button" disabled={!author.trim() || !synopsis.trim()} onClick={() => setStep("generate")}>开始生成书名</button>
    <label>候选书名（可直接填写或修改，每行一个，最多9个）<textarea className="form-input min-h-32" value={titles} onChange={event => setTitles(event.target.value)} /></label>
    <label>封面画面描述<textarea className="form-input" maxLength={1500} value={coverPrompt} onChange={event => setCoverPrompt(event.target.value)} placeholder="留空时使用作品简介；生成不带文字的底图，再精确排版书名。" /></label>
    <button type="button" className="primary-button" disabled={!titles.trim()} onClick={() => setStep("cover")}>下一步：生成封面并批量试装</button>
  </div></Modal>;
}
