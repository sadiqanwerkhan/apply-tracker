// The fixed skill knowledge base: maps common tools/technologies to a category
// and a one-line plain-English explanation. This does the categorization for free
// and instantly — no AI needed for anything listed here. Anything NOT here falls
// through to the AI step. Keys are matched case-insensitively; add aliases freely.

export type SkillCategory =
  | "Languages"
  | "Frontend"
  | "Backend"
  | "Databases"
  | "ORMs & Query"
  | "Cloud & Infra"
  | "DevOps & CI/CD"
  | "Observability"
  | "AI & ML"
  | "Testing"
  | "Security"
  | "Mobile"
  | "Tools";

export const CATEGORY_ORDER: SkillCategory[] = [
  "Languages", "Frontend", "Backend", "Databases", "ORMs & Query",
  "AI & ML", "Cloud & Infra", "DevOps & CI/CD", "Observability",
  "Testing", "Security", "Mobile", "Tools",
];

// What each category means (shown as a section subtitle so users learn the buckets).
export const CATEGORY_MEANING: Record<SkillCategory, string> = {
  "Languages": "Programming languages you write code in.",
  "Frontend": "What runs in the browser — the user interface.",
  "Backend": "Server-side code, APIs, and business logic.",
  "Databases": "Where data is stored and queried.",
  "ORMs & Query": "Tools that talk to databases from your code.",
  "Cloud & Infra": "Where your app runs and how it's hosted.",
  "DevOps & CI/CD": "Automating builds, tests, and deployments.",
  "Observability": "Seeing what your app is doing in production — logs, metrics, traces.",
  "AI & ML": "Machine learning, LLMs, and AI tooling.",
  "Testing": "Verifying your code works.",
  "Security": "Protecting apps and data.",
  "Mobile": "Building apps for phones.",
  "Tools": "Everyday developer tools.",
};

type Entry = { category: SkillCategory; what: string; aliases?: string[] };

// The mapping. `what` is a short, plain explanation a beginner would understand.
export const SKILL_DB: Record<string, Entry> = {
  // Languages
  "javascript": { category: "Languages", what: "The language of the web; runs in browsers and on servers.", aliases: ["js"] },
  "typescript": { category: "Languages", what: "JavaScript with type-checking that catches errors before you run code.", aliases: ["ts"] },
  "python": { category: "Languages", what: "A readable, general-purpose language popular for AI, data, and backends." },
  "java": { category: "Languages", what: "A widely-used language for large enterprise backends." },
  "c#": { category: "Languages", what: "Microsoft's language, common in enterprise and game dev.", aliases: ["csharp"] },
  "go": { category: "Languages", what: "A fast, simple language built by Google for backend services.", aliases: ["golang"] },
  "rust": { category: "Languages", what: "A systems language focused on speed and memory safety." },
  "php": { category: "Languages", what: "A long-standing language for web backends." },
  "ruby": { category: "Languages", what: "A developer-friendly language, known for Rails." },
  "sql": { category: "Databases", what: "The language for querying relational databases." },

  // Frontend
  "react": { category: "Frontend", what: "The most popular library for building user interfaces." },
  "vue": { category: "Frontend", what: "A friendly framework for building user interfaces.", aliases: ["vue.js", "vuejs"] },
  "angular": { category: "Frontend", what: "A full framework by Google for building web apps." },
  "svelte": { category: "Frontend", what: "A modern UI framework that compiles to fast, small code." },
  "next.js": { category: "Frontend", what: "A React framework for production apps (routing, server rendering).", aliases: ["nextjs", "next"] },
  "redux": { category: "Frontend", what: "A tool for managing app state in React apps." },
  "tailwind": { category: "Frontend", what: "A utility-first CSS framework for styling.", aliases: ["tailwindcss"] },
  "html": { category: "Frontend", what: "The markup that structures web pages." },
  "css": { category: "Frontend", what: "The styling language for web pages." },

  // Backend
  "node.js": { category: "Backend", what: "Runs JavaScript on the server.", aliases: ["node", "nodejs"] },
  "express": { category: "Backend", what: "A minimal framework for building APIs in Node.js.", aliases: ["express.js"] },
  "nestjs": { category: "Backend", what: "A structured Node.js framework for scalable backends.", aliases: ["nest.js", "nest"] },
  "django": { category: "Backend", what: "A batteries-included Python web framework." },
  "flask": { category: "Backend", what: "A lightweight Python web framework." },
  "fastapi": { category: "Backend", what: "A fast, modern Python framework for building APIs." },
  "spring": { category: "Backend", what: "A major Java framework for enterprise backends.", aliases: ["spring boot"] },
  "graphql": { category: "Backend", what: "A query language for APIs — clients ask for exactly the data they need." },
  "rest": { category: "Backend", what: "The standard style for building web APIs.", aliases: ["rest api", "rest apis"] },

  // Databases
  "postgresql": { category: "Databases", what: "A powerful open-source relational database.", aliases: ["postgres"] },
  "mysql": { category: "Databases", what: "A widely-used open-source relational database." },
  "mongodb": { category: "Databases", what: "A popular document (NoSQL) database.", aliases: ["mongo"] },
  "redis": { category: "Databases", what: "An in-memory store used for caching and speed." },
  "sqlite": { category: "Databases", what: "A lightweight file-based database." },
  "milvus": { category: "Databases", what: "A vector database for storing AI embeddings and similarity search." },
  "pinecone": { category: "Databases", what: "A managed vector database for AI search." },
  "elasticsearch": { category: "Databases", what: "A search engine and analytics database." },

  // ORMs & Query
  "prisma": { category: "ORMs & Query", what: "A modern ORM — lets you query your database with type-safe code.", aliases: ["prisma orm"] },
  "typeorm": { category: "ORMs & Query", what: "An ORM for TypeScript/JavaScript to talk to databases." },
  "sequelize": { category: "ORMs & Query", what: "A JavaScript ORM for relational databases." },
  "drizzle": { category: "ORMs & Query", what: "A lightweight, type-safe TypeScript ORM." },
  "sqlalchemy": { category: "ORMs & Query", what: "The main ORM for Python." },

  // AI & ML
  "openai": { category: "AI & ML", what: "APIs for GPT models and other AI." },
  "langchain": { category: "AI & ML", what: "A framework for building apps powered by language models." },
  "langfuse": { category: "AI & ML", what: "Observability and tracing specifically for LLM apps." },
  "vercel ai sdk": { category: "AI & ML", what: "A toolkit for adding AI/streaming to web apps.", aliases: ["ai sdk"] },
  "tensorflow": { category: "AI & ML", what: "A library for building and training machine-learning models." },
  "pytorch": { category: "AI & ML", what: "A popular library for deep learning research and models." },
  "hugging face": { category: "AI & ML", what: "A hub and library for open ML models.", aliases: ["huggingface"] },
  "pandas": { category: "AI & ML", what: "A Python library for working with data tables." },

  // Cloud & Infra
  "aws": { category: "Cloud & Infra", what: "Amazon's cloud platform for hosting and services." },
  "azure": { category: "Cloud & Infra", what: "Microsoft's cloud platform." },
  "gcp": { category: "Cloud & Infra", what: "Google's cloud platform.", aliases: ["google cloud"] },
  "vercel": { category: "Cloud & Infra", what: "A platform for deploying frontend and full-stack apps." },
  "netlify": { category: "Cloud & Infra", what: "A platform for deploying web apps." },
  "cloudflare": { category: "Cloud & Infra", what: "CDN, security, and edge hosting." },

  // DevOps & CI/CD
  "docker": { category: "DevOps & CI/CD", what: "Packages apps into containers that run anywhere." },
  "kubernetes": { category: "DevOps & CI/CD", what: "Orchestrates and scales containers in production.", aliases: ["k8s"] },
  "github actions": { category: "DevOps & CI/CD", what: "Automates builds, tests, and deploys from GitHub." },
  "jenkins": { category: "DevOps & CI/CD", what: "An automation server for CI/CD pipelines." },
  "terraform": { category: "DevOps & CI/CD", what: "Defines cloud infrastructure as code." },

  // Observability
  "datadog": { category: "Observability", what: "Monitors apps in production — metrics, logs, and traces." },
  "sentry": { category: "Observability", what: "Tracks errors and crashes in production apps." },
  "grafana": { category: "Observability", what: "Dashboards for visualizing metrics." },
  "prometheus": { category: "Observability", what: "Collects metrics from apps and systems." },
  "opentelemetry": { category: "Observability", what: "A standard for collecting traces and metrics.", aliases: ["otel"] },

  // Testing
  "jest": { category: "Testing", what: "A popular JavaScript testing framework." },
  "vitest": { category: "Testing", what: "A fast testing framework for modern JS/TS projects." },
  "cypress": { category: "Testing", what: "Tests web apps by driving a real browser." },
  "playwright": { category: "Testing", what: "Automates browsers for end-to-end testing." },
  "pytest": { category: "Testing", what: "The main testing framework for Python." },

  // Security
  "oauth": { category: "Security", what: "A standard for secure login and authorization." },
  "jwt": { category: "Security", what: "Signed tokens used to keep users logged in." },
  "auth0": { category: "Security", what: "A managed service for authentication." },

  // Mobile
  "react native": { category: "Mobile", what: "Build mobile apps with React." },
  "flutter": { category: "Mobile", what: "Google's toolkit for building mobile apps." },
  "swift": { category: "Mobile", what: "Apple's language for iOS apps." },
  "kotlin": { category: "Mobile", what: "The modern language for Android apps." },

  // Tools
  "git": { category: "Tools", what: "Version control — tracks changes to your code." },
  "figma": { category: "Tools", what: "A design tool for UI and prototypes." },
  "jira": { category: "Tools", what: "Project and issue tracking." },
};

// Look up a skill (case-insensitive, alias-aware). Returns null if unknown.
export function lookupSkill(raw: string): { name: string; category: SkillCategory; what: string } | null {
  const key = raw.trim().toLowerCase();
  if (!key) return null;
  if (SKILL_DB[key]) return { name: raw.trim(), category: SKILL_DB[key].category, what: SKILL_DB[key].what };
  for (const entry of Object.values(SKILL_DB)) {
    if (entry.aliases?.some((a) => a.toLowerCase() === key)) {
      return { name: raw.trim(), category: entry.category, what: entry.what };
    }
  }
  return null;
}