# Sistema de Agendamento Ortopédico por Cotas (Especialidade em Joelho)

Sistema completo de agendamento por **ordem de chegada / cotas diárias ou por turno** (sem horário marcado), com **Portal Público Mobile-First**, **banco de dados PostgreSQL 100% local**, **Painel Administrativo**, **Relatórios Impressos A4 (`@media print`) + CSV**, **API REST v1**, **Webhooks HMAC-SHA256** e **templates prontos de fluxos n8n (`.json`)**.

---

## Stack & Arquitetura
- **Frontend & Backend:** Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **Banco de Dados:** PostgreSQL 16 local + Prisma ORM
- **Validação:** Zod em todas as rotas de API e formulários
- **Autenticação:** Cookie HTTP-only JWT (`jose` + `bcryptjs`) no Painel Admin e `x-api-key` / `Bearer` (hash SHA-256) na API v1
- **Documentação OpenAPI:** `/api/docs`

---

## Como Rodar Localmente (Desenvolvimento)

### 1. Com Docker (recomendado em Linux/VPS/Windows com Docker Desktop)
```bash
# Subir PostgreSQL 16 local + aplicação (aplica migrations e seed automaticamente)
docker compose up -d --build
```

### 2. Sem Docker (Desenvolvimento local no Windows/macOS/Linux)
O projeto inclui suporte a PostgreSQL 16 local nativo com armazenamento persistente em `.pgdata/`:

```bash
npm install

# Terminal 1: manter o PostgreSQL 16 local rodando na porta 5432
npm run db:local

# Terminal 2: aplicar migrations, executar seed inicial e subir a aplicação
npm run db:migrate:deploy
npm run db:seed
npm run dev
```

---

## Acessos Padrão
- **Portal Público (Mobile-First):** http://localhost:3000
- **Painel Administrativo:** http://localhost:3000/admin/login
  - **E-mail:** `admin@clinica.com.br`
  - **Senha:** `admin123`
- **OpenAPI 3.0 Spec:** http://localhost:3000/api/docs

---

## Scripts Disponíveis (`package.json`)
- `npm run db:up` — Sobe o PostgreSQL via Docker (ou inicia modo local)
- `npm run db:local` — Executa o PostgreSQL 16 local em primeiro plano (`.pgdata/`)
- `npm run db:setup` — Sobe o banco, cria `agendamento_db` se não existir, aplica migrations e roda o seed
- `npm run db:reset` — Reseta o banco e reaplica migrations + seed
- `npm run db:backup` — Gera dump SQL em `./backups/`
- `node scripts/e2e-verify.mjs` — Executa a bateria completa de 11 testes E2E (concorrência, prioridade silenciosa Particular, reserva oculta, duplicidade, API v1, webhooks HMAC, relatórios e templates n8n)

---

## Integração n8n & WhatsApp
Os fluxos prontos estão na pasta `/n8n-templates/` e também podem ser baixados diretamente pelo painel em **Integrações & API**:
1. `n8n-templates/fluxo-lembrete-cron.json` — Disparo diário (Cron) buscando agendamentos `PENDING` do dia seguinte e enviando lembrete no WhatsApp.
2. `n8n-templates/fluxo-resposta-whatsapp.json` — Recebe a resposta do paciente (`1` confirma, `2` cancela e devolve a vaga automaticamente).

### Endpoints REST v1 (`x-api-key` ou `Authorization: Bearer`)
- `GET /api/v1/appointments` (filtros: `date`, `shift`, `status`, `whatsapp`, `patientName`)
- `POST /api/v1/appointments`
- `GET /api/v1/appointments/by-phone/:whatsapp`
- `PATCH /api/v1/appointments/:id/confirm`
- `PATCH /api/v1/appointments/:id/cancel`
- `GET /api/v1/availability?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
- `GET /api/v1/form-options`
