"use client";

import { useEffect, useState } from "react";
import { emptyGeoWorkflow, type GeneratedArticle, type GeoReport, type GeoWorkflowData, type IndexRecord, type KnowledgeDocument, type PublicationTask, type SearchQuestion, type WritingPrompt } from "@/lib/geo-workflow";

const storageKey = "bihuo-geo-workflow-v1";

function isString(value: unknown): value is string { return typeof value === "string"; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function hasBase(item: Record<string, unknown>) { return isString(item.id) && isString(item.createdAt); }
function isKnowledge(value: unknown): value is KnowledgeDocument { if (!isRecord(value)) return false; return hasBase(value) && [value.title, value.content, value.sourceName, value.companyId, value.projectId].every(isString); }
function isQuestion(value: unknown): value is SearchQuestion { if (!isRecord(value)) return false; return hasBase(value) && isString(value.text) && (value.source === "ai" || value.source === "manual") && isString(value.companyId) && isString(value.projectId); }
function isPrompt(value: unknown): value is WritingPrompt { if (!isRecord(value)) return false; return hasBase(value) && isString(value.name) && isString(value.content); }
function isArticle(value: unknown): value is GeneratedArticle { if (!isRecord(value)) return false; return hasBase(value) && [value.title, value.content, value.questionId, value.promptId, value.companyId, value.projectId].every(isString); }
function isPublication(value: unknown): value is PublicationTask { if (!isRecord(value)) return false; return hasBase(value) && [value.articleId, value.platform, value.scheduledAt].every(isString) && (value.status === "draft" || value.status === "queued"); }
function isIndexRecord(value: unknown): value is IndexRecord { if (!isRecord(value)) return false; return hasBase(value) && [value.articleId, value.platform, value.query, value.url].every(isString) && (value.status === "included" || value.status === "not-found" || value.status === "pending"); }
function isReport(value: unknown): value is GeoReport { if (!isRecord(value)) return false; return hasBase(value) && isString(value.title) && isString(value.content) && (value.type === "diagnosis" || value.type === "monitor"); }

function loadData(value: unknown): GeoWorkflowData {
  if (!isRecord(value)) return emptyGeoWorkflow;
  return {
    knowledge: Array.isArray(value.knowledge) ? value.knowledge.filter(isKnowledge) : [],
    questions: Array.isArray(value.questions) ? value.questions.filter(isQuestion) : [],
    prompts: Array.isArray(value.prompts) ? value.prompts.filter(isPrompt) : [],
    articles: Array.isArray(value.articles) ? value.articles.filter(isArticle) : [],
    publications: Array.isArray(value.publications) ? value.publications.filter(isPublication) : [],
    indexing: Array.isArray(value.indexing) ? value.indexing.filter(isIndexRecord) : [],
    reports: Array.isArray(value.reports) ? value.reports.filter(isReport) : [],
  };
}

function makeId(prefix: string) { return `${prefix}-${crypto.randomUUID()}`; }
function now() { return new Date().toISOString(); }

export function useGeoWorkflow() {
  const [data, setData] = useState<GeoWorkflowData>(emptyGeoWorkflow);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setData(loadData(JSON.parse(localStorage.getItem(storageKey) || "null"))); }
      catch { setData(emptyGeoWorkflow); }
      setLoaded(true);
    });
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => { if (loaded) localStorage.setItem(storageKey, JSON.stringify(data)); }, [data, loaded]);

  function addKnowledge(input: Omit<KnowledgeDocument, "id" | "createdAt">) { setData((current) => ({ ...current, knowledge: [{ ...input, id: makeId("knowledge"), createdAt: now() }, ...current.knowledge] })); }
  function addQuestions(items: Omit<SearchQuestion, "id" | "createdAt">[]) { setData((current) => ({ ...current, questions: [...items.map((item) => ({ ...item, id: makeId("question"), createdAt: now() })), ...current.questions] })); }
  function addPrompt(input: Omit<WritingPrompt, "id" | "createdAt">) { setData((current) => ({ ...current, prompts: [{ ...input, id: makeId("prompt"), createdAt: now() }, ...current.prompts] })); }
  function addArticle(input: Omit<GeneratedArticle, "id" | "createdAt">) { setData((current) => ({ ...current, articles: [{ ...input, id: makeId("article"), createdAt: now() }, ...current.articles] })); }
  function addPublication(input: Omit<PublicationTask, "id" | "createdAt">) { setData((current) => ({ ...current, publications: [{ ...input, id: makeId("publish"), createdAt: now() }, ...current.publications] })); }
  function addIndexRecord(input: Omit<IndexRecord, "id" | "createdAt">) { setData((current) => ({ ...current, indexing: [{ ...input, id: makeId("index"), createdAt: now() }, ...current.indexing] })); }
  function addReport(input: Omit<GeoReport, "id" | "createdAt">) { setData((current) => ({ ...current, reports: [{ ...input, id: makeId("report"), createdAt: now() }, ...current.reports] })); }
  function remove(collection: keyof GeoWorkflowData, id: string) { setData((current) => ({ ...current, [collection]: current[collection].filter((item) => item.id !== id) })); }

  return { data, loaded, addKnowledge, addQuestions, addPrompt, addArticle, addPublication, addIndexRecord, addReport, remove };
}

export type GeoWorkflowStore = ReturnType<typeof useGeoWorkflow>;
