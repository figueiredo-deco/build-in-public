import { AI_CLICHES, computeCut } from "./linkedin";
import type { CriterionKey, CriterionResult, PostDraft, Rule, RuleViolation } from "./types";

const PT_WORDS = /\b(que|não|uma|um|para|com|você|nós|eu|é|foi|mais|isso|como|mas|do|da|dos|das|no|na|os|as|ao|em|por|se|já|muito|quando|também|tem|são|ele|ela|meu|minha|seu|sua)\b/giu;
const EN_WORDS = /\b(the|and|you|we|i|is|was|that|with|for|this|it|of|to|in|on|are|be|have|has|our|my|your|but|not|what|when|how|they|from|at|so)\b/giu;

function languageScore(text: string) {
  const t = text.toLowerCase();
  return { pt: (t.match(PT_WORDS) || []).length, en: (t.match(EN_WORDS) || []).length };
}

export function detectLanguage(text: string): "pt" | "en" {
  const { pt, en } = languageScore(text);
  return en > pt ? "en" : "pt";
}

/**
 * Trechos escritos no outro idioma. Olha frase por frase e só conta frases com
 * palavras funcionais suficientes, para não acusar termos soltos como "build in public".
 */
export function mixedLanguageSentences(text: string): { main: "pt" | "en"; foreign: string[] } {
  const main = detectLanguage(text);
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const foreign: string[] = [];
  for (const s of sentences) {
    const { pt, en } = languageScore(s);
    if (pt + en < 3) continue;
    const other = main === "pt" ? en : pt;
    const same = main === "pt" ? pt : en;
    if (other >= 3 && other > same * 2) foreign.push(s);
  }
  return { main, foreign };
}

/** Regras do Playbook que dá para checar com código, sem IA. */
export function runCodeRules(draft: PostDraft, rules: Rule[]): RuleViolation[] {
  const out: RuleViolation[] = [];
  const text = draft.text;
  const lower = text.toLowerCase();
  for (const rule of rules) {
    if (!rule.active || rule.check !== "codigo") continue;
    const v = (message: string) => out.push({ ruleId: rule.id, ruleName: rule.name, severity: rule.severity, message });
    switch (rule.id) {
      case "r-um-idioma": {
        const { main, foreign } = mixedLanguageSentences(text);
        if (foreign.length)
          v(`O post está em ${main === "pt" ? "português" : "inglês"}, mas tem ${foreign.length} trecho(s) em ${main === "pt" ? "inglês" : "português"}: “${foreign[0].slice(0, 80)}”.`);
        break;
      }
      case "r-empresa-ingles": {
        if (draft.channel === "empresa" && detectLanguage(text) !== "en")
          v("Este post é para a página da empresa e precisa sair em inglês.");
        break;
      }
      case "r-hashtags": {
        const n = (text.match(/(^|\s)#[\p{L}\d_]+/gu) || []).length;
        if (n > 3) v(`O post tem ${n} hashtags. Deixe no máximo 3.`);
        break;
      }
      case "r-link": {
        if (/https?:\/\/|www\./i.test(text)) v("Há um link no corpo do post. Mova para o primeiro comentário.");
        break;
      }
      case "r-cliches": {
        const found = AI_CLICHES.filter((c) => lower.includes(c));
        if (found.length) v(`Expressões com cara de IA: ${found.map((f) => `"${f}"`).join(", ")}.`);
        break;
      }
      case "r-tamanho": {
        if (draft.format === "artigo" || draft.format === "enquete") break;
        if (text.length < 400) v(`O post tem ${text.length} caracteres. Abaixo de 400 costuma entregar pouco valor.`);
        if (text.length > 2200) v(`O post tem ${text.length} caracteres. Acima de 2.200 a leitura cai.`);
        break;
      }
      case "r-hook": {
        if (draft.format === "artigo") break;
        const cut = computeCut(text, "mobile");
        const firstBlock = text.split(/\n\s*\n/)[0] ?? "";
        if (cut.truncated && firstBlock.length > cut.visible.length)
          v("O primeiro bloco do hook passa do corte do \"ver mais\" no mobile. Encurte as primeiras linhas.");
        break;
      }
    }
  }
  return out;
}

/** Avaliação sem IA, usada quando não há credencial da Anthropic configurada. */
export function heuristicCriteria(draft: PostDraft, violations: RuleViolation[]): CriterionResult[] {
  const text = draft.text.trim();
  const lines = text.split("\n").filter((l) => l.trim());
  const first = lines[0] ?? "";
  const cut = computeCut(text, "mobile");
  const hasNumber = /\d/.test(text);
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim());
  const avgSentence = text.split(/[.!?\n]/).filter((s) => s.trim()).reduce((a, s, _, arr) => a + s.trim().length / arr.length, 0);
  const endsWithQuestion = /\?\s*(\S+\s*){0,8}$/.test(text);
  const clicheCount = AI_CLICHES.filter((c) => text.toLowerCase().includes(c)).length;
  const emojiBullets = (text.match(/^\s*[\p{Extended_Pictographic}]/gmu) || []).length;

  const clamp = (n: number) => Math.max(5, Math.min(98, Math.round(n)));
  const c = (key: CriterionKey, score: number, reason: string, quote?: string, issue?: string): CriterionResult => ({
    key,
    score: clamp(score),
    reason,
    highlights: quote && issue ? [{ quote, issue }] : [],
  });

  let hook = 55;
  if (first.length <= 70) hook += 12;
  if (/\d/.test(first)) hook += 10;
  if (/[?!]$/.test(first) || /^(eu |nós |ontem|hoje|perdi|errei|deletamos|demiti|i |we )/i.test(first)) hook += 8;
  if (!cut.truncated || first.length <= cut.visible.length) hook += 5;
  else hook -= 15;
  if (first.length > 140) hook -= 15;

  let clareza = 60;
  if (paragraphs.length >= 3) clareza += 12;
  if (avgSentence < 90) clareza += 10;
  if (avgSentence > 140) clareza -= 15;
  if (emojiBullets > 4) clareza -= 8;

  let valor = 50 + (hasNumber ? 18 : 0) + (text.length > 600 ? 10 : 0) + (/aprend|lição|resultado|erro|decid|learn|lesson/i.test(text) ? 10 : 0);
  let autenticidade = 78 - clicheCount * 12 - (emojiBullets > 4 ? 10 : 0) + (/\b(eu|nós|a gente|i|we)\b/i.test(text) ? 6 : -6);
  let fechamento = endsWithQuestion ? 82 : /comenta|me conta|o que você|qual |what do you|tell me/i.test(text.slice(-200)) ? 75 : 50;
  const regras = 92 - violations.reduce((a, v) => a + (v.severity === "bloqueante" ? 40 : v.severity === "forte" ? 15 : 6), 0);

  return [
    c("hook", hook, first.length > 140 ? "A primeira linha é longa demais para prender no feed." : "Avaliação automática pelo tamanho, números e tom da primeira linha.", first.slice(0, 120), first.length > 70 ? "Primeira linha longa: tente até 70 caracteres." : undefined),
    c("clareza", clareza, paragraphs.length < 3 ? "Pouco respiro entre blocos. Quebre em parágrafos curtos." : "Boa divisão em blocos."),
    c("valor", valor, hasNumber ? "Tem número concreto, o que ajuda." : "Falta um número, um resultado ou um bastidor concreto."),
    c("autenticidade", autenticidade, clicheCount ? "Há expressões com cara de texto gerado por IA." : "Sem clichês óbvios de IA."),
    c("fechamento", fechamento, endsWithQuestion ? "Termina com pergunta, o que puxa comentários." : "O final não convida a conversa. Feche com uma pergunta ou chamada."),
    c("regras", regras, violations.length ? `${violations.length} regra(s) do Playbook não atendida(s).` : "Cumpre as regras checadas."),
  ];
}
