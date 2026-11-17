export type PostFormat = "texto" | "imagem" | "carrossel" | "video" | "enquete" | "artigo";

export const FORMAT_LABEL: Record<PostFormat, string> = {
  texto: "Texto",
  imagem: "Imagem",
  carrossel: "Carrossel",
  video: "Vídeo",
  enquete: "Enquete",
  artigo: "Artigo",
};

export type PostStatus = "rascunho" | "em_aprovacao" | "pronto" | "agendado" | "publicado" | "arquivado";

export const STATUS_LABEL: Record<PostStatus, string> = {
  rascunho: "Rascunho",
  em_aprovacao: "Em aprovação",
  pronto: "Pronto",
  agendado: "Agendado",
  publicado: "Publicado",
  arquivado: "Arquivado",
};

export type Goal = "alcance" | "autoridade" | "leads" | "recrutar";

export interface PostDraft {
  text: string;
  format: PostFormat;
  images: string[]; // data URLs
  firstComment?: string;
  goal?: Goal;
  audience?: string;
  pollQuestion?: string;
  pollOptions?: string[];
  articleTitle?: string;
}

export type CriterionKey = "hook" | "clareza" | "valor" | "autenticidade" | "fechamento" | "regras";

export interface Highlight {
  quote: string;
  issue: string;
}

export interface CriterionResult {
  key: CriterionKey;
  score: number;
  reason: string;
  highlights: Highlight[];
}

export interface Suggestion {
  before: string;
  after: string;
  why: string;
}

export interface RuleViolation {
  ruleId: string;
  ruleName: string;
  severity: RuleSeverity;
  message: string;
}

export interface Evaluation {
  id: string;
  createdAt: string;
  language: "pt" | "en";
  overall: number;
  band: "reescrever" | "ajustar" | "bom" | "pronto";
  verdict: string;
  criteria: CriterionResult[];
  hooks: string[];
  suggestions: Suggestion[];
  violations: RuleViolation[];
  sensitive: { flag: boolean; reason: string };
  referenceIds: string[];
  model: string; // "claude-opus-5-5" ou "heuristica"
  playbookVersion: number;
}

export interface PostVersion {
  id: string;
  createdAt: string;
  draft: PostDraft;
  evaluation?: Evaluation;
}

export interface PostMetrics {
  impressions?: number;
  reactions?: number;
  comments?: number;
  collectedAt?: string;
}

export interface Post {
  id: string;
  title: string;
  status: PostStatus;
  theme?: string;
  versions: PostVersion[];
  scheduledAt?: string;
  publishedUrl?: string;
  metrics?: PostMetrics;
  sensitive?: boolean;
  approvedBy?: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  externalId?: string; // futuro: id do post no LinkedIn
}

export type RuleSeverity = "bloqueante" | "forte" | "recomendacao";
export type RuleCheck = "codigo" | "ia";

export interface Rule {
  id: string;
  name: string;
  description: string;
  severity: RuleSeverity;
  check: RuleCheck;
  goodExample?: string;
  badExample?: string;
  active: boolean;
}

export interface ReferencePost {
  id: string;
  author: string;
  text: string;
  url?: string;
  format: PostFormat;
  tags: string[];
  impressions?: number;
  comments?: number;
  why: string;
  approved: boolean;
}

export interface Idea {
  id: string;
  text: string;
  createdAt: string;
}

export interface DB {
  playbookVersion: number;
  rules: Rule[];
  references: ReferencePost[];
  posts: Post[];
  ideas: Idea[];
}

export const CRITERIA: { key: CriterionKey; label: string; weight: number; help: string }[] = [
  { key: "hook", label: "Hook", weight: 0.3, help: "As linhas antes do corte geram curiosidade, tensão ou uma promessa clara?" },
  { key: "clareza", label: "Clareza e estrutura", weight: 0.15, help: "Uma ideia central, frases curtas, respiro entre blocos, leitura no celular." },
  { key: "valor", label: "Valor", weight: 0.2, help: "Aprendizado concreto, números, bastidores reais, não só opinião genérica." },
  { key: "autenticidade", label: "Autenticidade", weight: 0.15, help: "Soa como a pessoa, não como IA." },
  { key: "fechamento", label: "Fechamento e CTA", weight: 0.1, help: "Termina com pergunta, convite ou conclusão forte." },
  { key: "regras", label: "Regras do time", weight: 0.1, help: "Cumpre o Playbook." },
];

export function bandFor(score: number): Evaluation["band"] {
  if (score >= 85) return "pronto";
  if (score >= 70) return "bom";
  if (score >= 50) return "ajustar";
  return "reescrever";
}

export const BAND_LABEL: Record<Evaluation["band"], string> = {
  reescrever: "Reescrever",
  ajustar: "Ajustar",
  bom: "Bom",
  pronto: "Pronto para publicar",
};
