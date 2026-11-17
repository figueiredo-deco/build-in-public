// Onde o LinkedIn corta o post com "...ver mais".
// Valores APROXIMADOS, a validar na Fase 0 com prints atuais (PRD: "Corte do ver mais").
// O feed corta pelo que vier primeiro: número de linhas visíveis ou número de caracteres.
export const CUT_CONFIG = {
  desktop: { maxChars: 210, maxLines: 3, charsPerLine: 72 },
  mobile: { maxChars: 140, maxLines: 3, charsPerLine: 42 },
} as const;

export type Device = keyof typeof CUT_CONFIG;

export interface CutResult {
  index: number; // posição no texto onde entra o "...ver mais"
  truncated: boolean;
  visible: string;
  hidden: string;
  reason: "linhas" | "caracteres" | "nenhum";
}

export function computeCut(text: string, device: Device): CutResult {
  const cfg = CUT_CONFIG[device];
  const clean = text.replace(/\r\n/g, "\n");
  let lines = 0;
  let col = 0;
  let i = 0;
  for (; i < clean.length; i++) {
    if (i >= cfg.maxChars) {
      return finish(clean, cutAtWord(clean, i), "caracteres");
    }
    const ch = clean[i];
    if (ch === "\n") {
      lines += 1;
      col = 0;
      if (lines >= cfg.maxLines) return finish(clean, i, "linhas");
      continue;
    }
    col += 1;
    if (col > cfg.charsPerLine) {
      lines += 1;
      col = 1;
      if (lines >= cfg.maxLines) return finish(clean, cutAtWord(clean, i), "linhas");
    }
  }
  return { index: clean.length, truncated: false, visible: clean, hidden: "", reason: "nenhum" };
}

function cutAtWord(text: string, i: number) {
  const space = text.lastIndexOf(" ", i);
  return space > i - 20 && space > 0 ? space : i;
}

function finish(text: string, index: number, reason: CutResult["reason"]): CutResult {
  const visible = text.slice(0, index).replace(/\s+$/, "");
  return { index, truncated: true, visible, hidden: text.slice(index), reason };
}

export const AI_CLICHES = [
  "no mundo de hoje",
  "no mundo acelerado",
  "em um mundo cada vez mais",
  "não é apenas",
  "a chave para o sucesso",
  "vamos mergulhar",
  "mergulhe",
  "jornada transformadora",
  "desbloquear todo o potencial",
  "no cenário atual",
  "em constante evolução",
  "é importante ressaltar",
  "game changer",
  "sinergia",
  "alavancar",
  "in today's fast-paced world",
  "let's dive in",
  "unlock the full potential",
  "game-changer",
  "in the ever-evolving",
  "it's not just about",
  "delve",
];
