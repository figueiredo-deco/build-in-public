# Build in Public · deco

Ferramenta interna para o time fazer build in public no LinkedIn. Três frentes:

1. **Avaliador** — cole o post (escrito no Claude, ChatGPT ou à mão), veja o preview fiel do LinkedIn com o corte do "ver mais" em mobile e desktop, e receba nota de 0 a 100 por critério, trechos fracos marcados no texto, hooks alternativos e sugestões pontuais que você aplica com um clique.
2. **Biblioteca** — rascunhos, posts em aprovação, agendados e publicados; calendário; lembrete "hora de publicar" com copiar texto; link e métricas do post publicado; banco de ideias.
3. **Playbook** — guia de escrita, regras do time (editáveis pelo curador e usadas na nota), posts de referência e prompts prontos para colar no Claude/ChatGPT.

A interface usa o design system da deco, [`@decocms/ui`](https://designsystem.decocms.com/) (componentes React + tokens Tailwind v4), com ícones `@untitledui/icons`, seguindo as regras de layout do Studio: barra lateral, breadcrumb no cabeçalho, ações à direita e larguras reading/standard/wide.

## Rodando localmente

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abra http://localhost:3000.

### De onde vem a IA (escolha uma)

- **Sua assinatura Claude (uso pessoal, local):** rode `claude setup-token`, faça o login e cole o token em `CLAUDE_CODE_OAUTH_TOKEN` no `.env.local`. O Avaliador chama o Claude pelo Claude Agent SDK e consome o limite do seu plano. Cada pessoa usa a própria assinatura.
- **Chave de API (para hospedar para o time):** crie em platform.claude.com e coloque em `ANTHROPIC_API_KEY`.

Se as duas estiverem preenchidas, a assinatura tem prioridade. Sem nenhuma, o Avaliador funciona em modo "regras": calcula a nota com checagens em código (corte, tamanho, hashtags, links, clichês de IA) e não gera hooks nem sugestões.

## Como a nota funciona

| Critério | Peso |
| --- | --- |
| Hook (antes do corte) | 30% |
| Clareza e estrutura | 15% |
| Valor | 20% |
| Autenticidade | 15% |
| Fechamento e CTA | 10% |
| Regras do time | 10% |

Faixas: 0–49 reescrever · 50–69 ajustar · 70–84 bom · 85+ pronto.
A avaliação usa `claude-opus-5-5` com saída estruturada, as regras ativas do Playbook e os 3 posts de referência mais parecidos. Posts que citam cliente ou números internos vão para "Em aprovação" ao serem agendados.

## Estrutura

- `src/lib/evaluate.ts` — chamada ao Claude e fallback por regras
- `src/lib/checks.ts` — regras checadas por código e nota heurística
- `src/lib/linkedin.ts` — cálculo do corte do "ver mais" (limites aproximados, validar com prints)
- `src/lib/seed.ts` — regras e referências iniciais (as referências são exemplos ilustrativos: troque por posts reais)
- `src/lib/db.ts` — armazenamento em `data/db.json` (MVP; trocar por Postgres ao hospedar)

## Próximos passos (do PRD)

- Validar os limites do corte com prints atuais (Fase 0)
- Login com Google Workspace e posts privados por pessoa
- Lembrete por Slack/e-mail no horário agendado
- Publicação direta via API do LinkedIn (Fase 4, após spike técnico)
