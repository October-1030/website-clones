export const HOMEWORK_SESSION_STORAGE_KEY = "studypal.homework-session.v1";
export const MAX_HOMEWORK_PROBLEM_CHARS = 4_000;

export interface HomeworkSolutionStep {
  title: string;
  explanation: string;
  expression: string;
}

export interface HomeworkSolution {
  subject: string;
  problemRestatement: string;
  knowns: string[];
  method: string;
  steps: HomeworkSolutionStep[];
  finalAnswer: string;
  verification: string;
  assumptions: string[];
}

export interface HomeworkSession {
  version: 1;
  id: string;
  problem: string;
  solution: HomeworkSolution;
  provider: {
    id: string;
    mode: "demo" | "live";
    label: string;
  };
  createdAt: string;
  updatedAt: string;
}
