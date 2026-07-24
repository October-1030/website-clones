"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Check, HelpCircle, Save, Sparkles, X } from "lucide-react";
import {
  defaultAccountSettings,
  loadAccountSettings,
  saveAccountSettings,
  type LocalAccountSettings,
} from "@/lib/account/settings";

type DialogKind = "account" | "personalization" | "help" | "updates";

export default function AccountSettingsDialog({
  kind,
  onClose,
  onSaved,
}: {
  kind: DialogKind;
  onClose: () => void;
  onSaved: (settings: LocalAccountSettings) => void;
}) {
  const [settings, setSettings] = useState<LocalAccountSettings>(defaultAccountSettings);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSettings(loadAccountSettings(window.localStorage)), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = { ...settings, username: settings.username.trim().slice(0, 40) || "Student", updatedAt: new Date().toISOString() };
    saveAccountSettings(window.localStorage, next);
    onSaved(next);
    onClose();
  }

  function toggleStyle(style: LocalAccountSettings["learningStyles"][number]) {
    const has = settings.learningStyles.includes(style);
    const next = has ? settings.learningStyles.filter((item) => item !== style) : [...settings.learningStyles, style].slice(-2);
    setSettings({ ...settings, learningStyles: next });
  }

  return <div className="dialog-backdrop" role="presentation"><section className="account-settings-dialog" role="dialog" aria-modal="true" aria-label={kind === "account" ? "Account settings" : kind === "personalization" ? "Personalization" : kind === "updates" ? "Update log" : "Help center"}>
    <button type="button" className="dialog-close" aria-label="Close dialog" onClick={onClose}><X size={16} /></button>
    {kind === "account" && <form onSubmit={submit}><div className="settings-dialog-heading"><Sparkles size={18} /><div><h2>Local account settings</h2><p>This profile exists only on this computer. No email, password, or payment data is stored here.</p></div></div><label>Display name<input value={settings.username} onChange={(event) => setSettings({ ...settings, username: event.target.value })} maxLength={40} /></label><button type="submit" className="settings-save"><Save size={14} />Save settings</button></form>}
    {kind === "personalization" && <form onSubmit={submit}><div className="settings-dialog-heading"><Sparkles size={18} /><div><h2>Personalization</h2><p>Choose how local StudyPal screens should present learning support.</p></div></div><label>Preferred language<select value={settings.preferredLanguage} onChange={(event) => setSettings({ ...settings, preferredLanguage: event.target.value as LocalAccountSettings["preferredLanguage"] })}><option value="auto">Auto-detect</option><option value="en">English</option><option value="zh-CN">简体中文</option></select></label><label>Preferred tone<select value={settings.tone} onChange={(event) => setSettings({ ...settings, tone: event.target.value as LocalAccountSettings["tone"] })}><option value="clear">Clear</option><option value="concise">Concise</option><option value="encouraging">Encouraging</option></select></label><fieldset><legend>Learning style · choose up to 2</legend><div className="settings-options">{(["examples", "step-by-step", "visual", "practice"] as const).map((style) => <button type="button" className={settings.learningStyles.includes(style) ? "settings-option-active" : ""} key={style} onClick={() => toggleStyle(style)}>{settings.learningStyles.includes(style) && <Check size={12} />}{style}</button>)}</div></fieldset><label className="memory-toggle"><input type="checkbox" checked={settings.memoryEnabled} onChange={(event) => setSettings({ ...settings, memoryEnabled: event.target.checked })} /><span><strong>Remember local preferences</strong><small>Allows this browser to restore these choices. It does not send them to another account or device.</small></span></label><button type="submit" className="settings-save"><Save size={14} />Save personalization</button></form>}
    {kind === "help" && <div><div className="settings-dialog-heading"><HelpCircle size={18} /><div><h2>Help center</h2><p>Quick guidance for the working local features.</p></div></div><div className="help-list"><article><strong>Study a file</strong><span>Open File summary and upload a PDF or TXT. Ask follow-up questions using cited source sections.</span></article><article><strong>Create study tools</strong><span>Quiz, Study guide, and Flashcards use your latest saved file session.</span></article><article><strong>Transcribe audio</strong><span>Choose Microphone or Browser Tab. Final text is generated locally after Stop; audio is deleted.</span></article><article><strong>Find saved work</strong><span>Open Library and search across local file, homework, video, and transcription sessions.</span></article></div></div>}
    {kind === "updates" && <div><div className="settings-dialog-heading"><Sparkles size={18} /><div><h2>Update log</h2><p>Implemented local milestones.</p></div></div><ol className="update-list"><li><b>P7</b><span>Responsible Essay and writing-signal review</span></li><li><b>P6</b><span>Source-backed Quiz, Study guide, and Flashcards</span></li><li><b>P5</b><span>Local Faster-Whisper transcription</span></li><li><b>P4</b><span>Public-caption Video Link Summary</span></li><li><b>P1–P3</b><span>File study flow and Homework Solver</span></li></ol></div>}
  </section></div>;
}
