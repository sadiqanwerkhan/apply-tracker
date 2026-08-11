// The "free layer": a curated list of known skills and the terms that signal
// them. If an analysis bullet contains one of these terms, we tag the skill
// WITHOUT an AI call. Add to this list over time — every term you add here is a
// skill that gets detected for free instead of costing a Haiku call.

export type SkillKeyword = { canonical: string; terms: string[] };

export const SKILL_KEYWORDS: SkillKeyword[] = [
  { canonical: "React", terms: ["react", "jsx", "usestate", "useeffect", "hooks"] },
  { canonical: "TypeScript", terms: ["typescript", " ts ", "type safety", "generics"] },
  { canonical: "JavaScript", terms: ["javascript", "es6", "closures", "promises", "async/await"] },
  { canonical: "Next.js", terms: ["next.js", "nextjs", "app router", "server components"] },
  { canonical: "Node.js", terms: ["node.js", "nodejs", "express", "event loop"] },
  { canonical: "CSS", terms: ["css", "flexbox", "grid layout", "tailwind", "styling"] },
  { canonical: "HTML", terms: ["html", "semantic markup", "accessibility", "aria"] },
  { canonical: "System Design", terms: ["system design", "scalability", "load balanc", "caching", "microservice"] },
  { canonical: "Data Structures & Algorithms", terms: ["algorithm", "data structure", "big o", "time complexity", "leetcode", "recursion"] },
  { canonical: "SQL / Databases", terms: ["sql", "database", "postgres", "indexing", "query optimization", "joins"] },
  { canonical: "Kubernetes", terms: ["kubernetes", "k8s", "pods", "helm"] },
  { canonical: "Docker", terms: ["docker", "container", "dockerfile"] },
  { canonical: "AWS / Cloud", terms: ["aws", "cloud", "s3", "lambda", "ec2"] },
  { canonical: "Testing", terms: ["unit test", "jest", "testing", "vitest", "cypress", "tdd"] },
  { canonical: "Git", terms: ["git", "version control", "merge conflict", "rebase"] },
  { canonical: "REST / APIs", terms: ["rest", "api design", "http", "endpoint", "graphql"] },
  { canonical: "State Management", terms: ["redux", "state management", "zustand", "context api"] },
  { canonical: "Performance", terms: ["performance optimization", "memoization", "lazy load", "bundle size", "web vitals"] },
  { canonical: "Behavioral / Communication", terms: ["communication", "behavioral", "culture fit", "teamwork", "conflict"] },
];

// Try to match a single analysis bullet to known skills by keyword.
// Returns the canonical skill names found (can be more than one per bullet).
export function keywordMatch(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `;
  const found = new Set<string>();
  for (const sk of SKILL_KEYWORDS) {
    if (sk.terms.some((t) => lower.includes(t))) found.add(sk.canonical);
  }
  return [...found];
}