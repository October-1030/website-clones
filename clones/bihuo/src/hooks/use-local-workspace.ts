"use client";

import { useEffect, useState } from "react";
import type { Company, CompanyInput, GeoProject, ProjectInput } from "@/lib/workspace-data";

const storageKey = "bihuo-local-workspace-v1";

function isProject(value: unknown): value is GeoProject {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && typeof item.name === "string" && (item.type === "product" || item.type === "ip") && Array.isArray(item.keywords) && item.keywords.every((keyword) => typeof keyword === "string") && Array.isArray(item.targetWords) && item.targetWords.every((word) => typeof word === "string") && typeof item.createdAt === "string" && typeof item.updatedAt === "string";
}

function isCompany(value: unknown): value is Company {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === "string" && typeof item.name === "string" && typeof item.description === "string" && Array.isArray(item.aliases) && item.aliases.every((alias) => typeof alias === "string") && Array.isArray(item.projects) && item.projects.every(isProject) && typeof item.createdAt === "string" && typeof item.updatedAt === "string";
}

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function useLocalWorkspace() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || "null");
        if (typeof saved === "object" && saved !== null && !Array.isArray(saved)) {
          const record = saved as Record<string, unknown>;
          const savedCompanies = Array.isArray(record.companies) ? record.companies.filter(isCompany) : [];
          const savedSelection = typeof record.selectedCompanyId === "string" ? record.selectedCompanyId : "";
          setCompanies(savedCompanies);
          setSelectedCompanyId(savedCompanies.some((company) => company.id === savedSelection) ? savedSelection : savedCompanies[0]?.id || "");
        }
      } catch { /* Ignore invalid local data and start with an empty workspace. */ }
      setLoaded(true);
    });
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(storageKey, JSON.stringify({ companies, selectedCompanyId }));
  }, [companies, selectedCompanyId, loaded]);

  function createCompany(input: CompanyInput) {
    const now = new Date().toISOString();
    const company: Company = { id: makeId("company"), ...input, projects: [], createdAt: now, updatedAt: now };
    setCompanies((items) => [company, ...items]);
    setSelectedCompanyId(company.id);
    return company;
  }

  function updateCompany(id: string, input: CompanyInput) {
    setCompanies((items) => items.map((company) => company.id === id ? { ...company, ...input, updatedAt: new Date().toISOString() } : company));
  }

  function deleteCompany(id: string) {
    const remaining = companies.filter((company) => company.id !== id);
    setCompanies(remaining);
    if (selectedCompanyId === id) setSelectedCompanyId(remaining[0]?.id || "");
  }

  function createProject(companyId: string, input: ProjectInput) {
    const now = new Date().toISOString();
    const project: GeoProject = { id: makeId("project"), ...input, createdAt: now, updatedAt: now };
    setCompanies((items) => items.map((company) => company.id === companyId ? { ...company, projects: [project, ...company.projects], updatedAt: now } : company));
    return project;
  }

  function updateProject(companyId: string, projectId: string, input: ProjectInput) {
    const now = new Date().toISOString();
    setCompanies((items) => items.map((company) => company.id === companyId ? { ...company, projects: company.projects.map((project) => project.id === projectId ? { ...project, ...input, updatedAt: now } : project), updatedAt: now } : company));
  }

  function deleteProject(companyId: string, projectId: string) {
    const now = new Date().toISOString();
    setCompanies((items) => items.map((company) => company.id === companyId ? { ...company, projects: company.projects.filter((project) => project.id !== projectId), updatedAt: now } : company));
  }

  return { companies, selectedCompanyId, setSelectedCompanyId, loaded, createCompany, updateCompany, deleteCompany, createProject, updateProject, deleteProject };
}
