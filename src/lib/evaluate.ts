import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { detectLanguage, heuristicCriteria, runCodeRules } from "./checks";
import { readDB, newId } from "./db";
import { CUT_CONFIG, computeCut } from "./linkedin";
import {
  CRITERIA,
  FORMAT_LABEL,
  bandFor,
  type CriterionResult,
  type Evaluation,
  type PostDraft,
  type ReferencePost,
  type Rule,
  type RuleViolation,
} from "./types";

const MODEL = "claude-opus-5-5";

const OutputSchema = z.object({
  verdict: z.string().describe("Uma frase direta com o diagnóstico principal do post."),
  criteria: z.array(
    z.object({
      key: z.enum(["hook", "clareza", "valor", "autenticidade", "fechamento", "regras"]),
      score: z.number().describe("0 a 100"),
      reason: z.string().describe("Uma frase explicando a nota."),
      highlights: z.array(
        z.object({
          quote: z.string().describe("Trecho EXATO copiado do post, sem alterar nada."),
          issue: z.string().describe("O que está fraco nesse trecho."),
        }),
      ),
    }),
  ),
  hooks: z.array(z.string()).describe("3 hooks alternativos, na voz do autor, que caibam antes do corte no mobile."),
  suggestions: z.array(
    z.object({
      before: z.string().describe("Trecho EXATO do post a trocar."),
      after: z.string().describe("Nova versão do trecho, mantendo a voz do autor."),
      why: z.string(),
    }),
  ),
  ai_rule_violations: z.array(
    z.object({ rule_id: z.string(), message: z.string() }),
  ).describe("Só regras com checagem 'ia' que o post viola."),
  sensitive: z.object({
    flag: z.boolean().describe("true se cita cliente, marca de terceiro ou número financeiro interno."),
    reason: z.string(),
  }),
});

function pickReferences(draft: PostDraft, refs: ReferencePost[]): ReferencePost[] {
  const words = new Set(draft.text.toLowerCase().split(/\W+/).filter((w) => w.length > 4));
  return refs
    .filter((r) => r.approved)
    .map((r) => {
      let score = r.format === draft.format ? 3 : 0;
      for (const t of r.tags) if (draft.text.toLowerCase().includes(t.toLowerCase())) score += 2;
      for (const w of r.text.toLowerCase().split(/\W+/)) if (words.has(w)) score += 0.2;
      score += Math.log10((r.comments ?? 0) + 1);
      return { r, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.r);
}

function weighted(criteria: CriterionResult[]) {
  let total = 0;
  for (const c of CRITERIA) {
    const found = criteria.find((x) => x.key === c.key);
    total += (found?.score ?? 50) * c.weight;
  }
  return Math.round(total);
}

function describeDraft(draft: PostDraft) {
  const parts = [`Formato: ${FORMAT_LABEL[draft.format]}`, `Canal: ${draft.channel === "empresa" ? "página da empresa (company page)" : "perfil pessoal"}`];
  if (draft.goal) parts.push(`Objetivo: ${draft.goal}`);
  if (draft.audience) parts.push(`Público: ${draft.audience}`);
  if (draft.articleTitle) parts.push(`Título do artigo: ${draft.articleTitle}`);
  if (draft.pollQuestion) parts.push(`Enquete: ${draft.pollQuestion} | Opções: ${(draft.pollOptions ?? []).join(" / ")}`);
  if (draft.firstComment) parts.push(`Primeiro comentário: ${draft.firstComment}`);
  return parts.join("\n");
}

function systemPrompt(rules: Rule[], refs: ReferencePost[], lang: "pt" | "en") {
  const ruleText = rules
    .filter((r) => r.active)
    .map((r) => `- [${r.id}] (${r.severity}, checagem ${r.check}) ${r.name}: ${r.description}`)
    .join("\n");
  const refText = refs
    .map((r, i) => `<referencia n="${i + 1}" formato="${r.format}" comentarios="${r.comments ?? "?"}" impressoes="${r.impressions ?? "?"}">\n${r.text}\n<por_que_funciona>${r.why}</por_que_funciona>\n</referencia>`)
    .join("\n\n");
  const crit = CRITERIA.map((c) => `- ${c.key} (peso ${Math.round(c.weight * 100)}%): ${c.help}`).join("\n");
  return `Você é o editor de LinkedIn de um time que faz build in public. Você avalia posts que as pessoas escreveram (muitas vezes com ajuda de IA) e devolve um feedback honesto, específico e acionável.

Como avaliar:
- Dê nota de 0 a 100 para cada critério abaixo. Seja calibrado: 85+ só para posts que você publicaria sem mudar nada; um rascunho mediano de IA fica entre 45 e 65.
${crit}
- O LinkedIn corta o post com "...ver mais" depois de ~${CUT_CONFIG.mobile.maxChars} caracteres ou ${CUT_CONFIG.mobile.maxLines} linhas no mobile. O hook é só o que aparece antes do corte; ele está marcado na mensagem do usuário.
- Em "highlights" e em "suggestions.before", copie trechos EXATOS do post (o app localiza o texto por busca literal). Aponte no máximo 2 trechos por critério.
- Sugestões são pontuais (antes/depois), no máximo 5, e preservam a voz do autor. Nunca reescreva o post inteiro.
- Os 3 hooks alternativos precisam caber antes do corte no mobile e soar como o autor, não como IA.
- Escreva todo o feedback em português do Brasil. Hooks e sugestões ficam no idioma do post (${lang === "en" ? "inglês" : "português"}), exceto quando o canal for a página da empresa: aí hooks e sugestões são sempre em inglês.
- Um post usa um idioma só. Página da empresa: sempre inglês.

Regras do Playbook do time:
${ruleText}

Posts de referência que performaram bem (use como parâmetro de qualidade, não para copiar):
${refText || "(nenhum cadastrado)"}`;
}

function imageBlocks(images: string[]): Anthropic.Beta.BetaImageBlockParam[] {
  const out: Anthropic.Beta.BetaImageBlockParam[] = [];
  for (const url of images.slice(0, 4)) {
    const m = /^data:(image\/(png|jpeg|gif|webp));base64,(.+)$/.exec(url);
    if (!m) continue;
    out.push({
      type: "image",
      source: { type: "base64", media_type: m[1] as "image/png" | "image/jpeg" | "image/gif" | "image/webp", data: m[3] },
    });
  }
  return out;
}

type Output = z.infer<typeof OutputSchema>;

/** JSON Schema sem o campo $schema (o Claude Code não resolve a URL do draft 2020-12). */
function jsonSchema(): Record<string, unknown> {
  const { $schema: _ignored, ...schema } = z.toJSONSchema(OutputSchema) as Record<string, unknown>;
  return schema;
}

/** Modo API: chave da Anthropic (ANTHROPIC_API_KEY). */
async function runWithApiKey(system: string, content: Anthropic.Beta.BetaContentBlockParam[]): Promise<{ out: Output; model: string }> {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(OutputSchema) },
    system,
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal") throw new Error("O modelo recusou avaliar este post.");
  if (!response.parsed_output) throw new Error("Resposta da IA veio sem o formato esperado.");
  return { out: response.parsed_output, model: response.model ?? MODEL };
}

/**
 * Modo assinatura: usa o limite do seu plano Claude via Claude Agent SDK.
 * Gere o token com `claude setup-token` e coloque em CLAUDE_CODE_OAUTH_TOKEN.
 * Uso pessoal/local: cada pessoa roda com a própria assinatura.
 */
async function runWithSubscription(system: string, content: Anthropic.Beta.BetaContentBlockParam[]): Promise<{ out: Output; model: string }> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  // Garante que o Claude Code use o token da assinatura, não uma chave de API vazia.
  const env: Record<string, string | undefined> = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  async function* prompt() {
    yield {
      type: "user" as const,
      message: { role: "user" as const, content: content as Anthropic.ContentBlockParam[] },
      parent_tool_use_id: null,
    };
  }
  let model = MODEL;
  for await (const msg of query({
    prompt: prompt(),
    options: {
      model: MODEL,
      systemPrompt: system,
      tools: [],
      maxTurns: 4,
      effort: "medium",
      settingSources: [],
      persistSession: false,
      env,
      outputFormat: { type: "json_schema", schema: jsonSchema() },
    },
  })) {
    if (msg.type === "system" && msg.subtype === "init") model = msg.model ?? MODEL;
    if (msg.type === "result") {
      if (msg.subtype !== "success") throw new Error(`O Claude não concluiu a avaliação (${msg.subtype}).`);
      const parsed = OutputSchema.safeParse(msg.structured_output);
      if (!parsed.success) throw new Error("Resposta da IA veio sem o formato esperado.");
      return { out: parsed.data, model: `${model} · assinatura` };
    }
  }
  throw new Error("O Claude Code encerrou sem resposta.");
}

export interface EvaluateResult {
  evaluation: Evaluation;
  notice?: string;
}

export async function evaluateDraft(draft: PostDraft): Promise<EvaluateResult> {
  const db = await readDB();
  const lang = detectLanguage(draft.text);
  const codeViolations = runCodeRules(draft, db.rules);
  const refs = pickReferences(draft, db.references);
  const cut = computeCut(draft.text, "mobile");

  const base = {
    id: newId("ev"),
    createdAt: new Date().toISOString(),
    language: lang,
    referenceIds: refs.map((r) => r.id),
    playbookVersion: db.playbookVersion,
  };

  const system = systemPrompt(db.rules, refs, lang);
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...imageBlocks(draft.images),
    {
      type: "text",
      text: `${describeDraft(draft)}\n\n<hook_antes_do_corte_mobile>\n${cut.visible}\n</hook_antes_do_corte_mobile>\n\n<post>\n${draft.text}\n</post>\n\nProblemas já detectados por código (considere na nota de "regras"):\n${codeViolations.map((v) => `- ${v.ruleName}: ${v.message}`).join("\n") || "(nenhum)"}`,
    },
  ];

  try {
    const { out, model } = process.env.CLAUDE_CODE_OAUTH_TOKEN
      ? await runWithSubscription(system, content)
      : await runWithApiKey(system, content);

    const criteria: CriterionResult[] = CRITERIA.map((c) => {
      const found = out.criteria.find((x) => x.key === c.key);
      return {
        key: c.key,
        score: Math.max(0, Math.min(100, Math.round(found?.score ?? 50))),
        reason: found?.reason ?? "",
        highlights: (found?.highlights ?? []).filter((h) => draft.text.includes(h.quote)),
      };
    });
    const aiViolations: RuleViolation[] = out.ai_rule_violations
      .map((v) => {
        const rule = db.rules.find((r) => r.id === v.rule_id);
        return rule ? { ruleId: rule.id, ruleName: rule.name, severity: rule.severity, message: v.message } : null;
      })
      .filter((v): v is RuleViolation => v !== null);
    const overall = weighted(criteria);
    return {
      evaluation: {
        ...base,
        overall,
        band: bandFor(overall),
        verdict: out.verdict,
        criteria,
        hooks: out.hooks.slice(0, 3),
        suggestions: out.suggestions.filter((s) => draft.text.includes(s.before)).slice(0, 5),
        violations: [...codeViolations, ...aiViolations],
        sensitive: out.sensitive,
        model,
      },
    };
  } catch (error) {
    let notice = "Avaliação automática por regras (sem IA).";
    if (error instanceof Anthropic.AuthenticationError) notice += " A credencial da Anthropic é inválida.";
    else if (error instanceof Anthropic.RateLimitError) notice += " A API da Anthropic limitou as chamadas; tente de novo em instantes.";
    else if (error instanceof Anthropic.APIError) notice += ` Erro da API (${error.status ?? "rede"}).`;
    else if (error instanceof Error && /api key|apiKey|credentials|authentication/i.test(error.message))
      notice += " Configure CLAUDE_CODE_OAUTH_TOKEN (sua assinatura, via `claude setup-token`) ou ANTHROPIC_API_KEY no .env.local para usar o Claude.";
    else if (error instanceof Error) notice += ` ${error.message}`;
    console.error("[avaliador]", error);

    const criteria = heuristicCriteria(draft, codeViolations);
    const overall = weighted(criteria);
    const sensitiveHit = /cliente|faturamento|receita|margem|runway|R\$\s?\d|revenue|client/i.test(draft.text);
    return {
      notice,
      evaluation: {
        ...base,
        overall,
        band: bandFor(overall),
        verdict: "Nota estimada por regras simples. Com o Claude configurado, você recebe trechos, hooks e sugestões.",
        criteria,
        hooks: [],
        suggestions: [],
        violations: codeViolations,
        sensitive: {
          flag: sensitiveHit,
          reason: sensitiveHit ? "O texto menciona cliente ou números financeiros. Confirme se pode ser publicado." : "",
        },
        model: "heuristica",
      },
    };
  }
}
