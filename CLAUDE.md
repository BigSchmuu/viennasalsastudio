# AI Coding Starter Kit

> A Next.js template with an AI-powered development workflow using specialized skills for Requirements, Architecture, Frontend, Backend, QA, and Deployment.

## Tech Stack

- **Framework:** Next.js 16 (App Router), TypeScript
- **Styling:** Tailwind CSS + shadcn/ui (copy-paste components)
- **Backend:** Supabase (PostgreSQL + Auth + Storage) - optional
- **Deployment:** Vercel
- **Validation:** Zod + react-hook-form
- **State:** React useState / Context API

## Project Structure

```
src/
  app/              Pages (Next.js App Router)
  components/
    ui/             shadcn/ui components (NEVER recreate these)
  hooks/            Custom React hooks
  lib/              Utilities (supabase.ts, utils.ts)
features/           Feature specifications (PROJ-X-name.md)
  INDEX.md          Feature status overview
docs/
  PRD.md            Product Requirements Document
  production/       Production guides (Sentry, security, performance)
```

## Development Workflow

1. `/init` - Initialize the project: PRD + feature map (run once at the start)
2. `/write-spec` - Create a full feature spec for one feature
3. `/architecture` - Design tech architecture (PM-friendly, no code)
4. `/frontend` - Build UI components (shadcn/ui first!)
5. `/backend` - Build APIs, database, RLS policies
6. `/qa` - Test against acceptance criteria + security audit
7. `/deploy` - Deploy to Vercel + production-ready checks

Use `/refine PROJ-X` at any point to revisit and improve an existing feature spec.

## Feature Tracking

All features tracked in `features/INDEX.md`. Every skill reads it at start and updates it when done. Feature specs live in `features/PROJ-X-name.md`.

## Key Conventions

- **Feature IDs:** PROJ-1, PROJ-2, etc. (sequential)
- **Commits:** `feat(PROJ-X): description`, `fix(PROJ-X): description`
- **Single Responsibility:** One feature per spec file
- **shadcn/ui first:** NEVER create custom versions of installed shadcn components
- **Human-in-the-loop:** All workflows have user approval checkpoints
- **Tests:** Unit tests co-located next to source files (`useHook.test.ts` next to `useHook.ts`). E2E tests in `tests/`.

## Datenschutz & Produktionsdaten (MANDATORY)

Alles, was ein Tool zurückgibt, wird Teil der Konversation und damit an Anthropic
übertragen. Bei Kundendaten ist das eine Auftragsverarbeitung nach Art. 28 DSGVO.
Deshalb gilt für Claude:

- **Zwei getrennte Supabase-Projekte:** Produktion und Test. Der MCP-Zugang ist per
  `project_ref` auf das **Testprojekt** begrenzt — die Produktion ist über MCP nicht
  erreichbar und darf auch nicht über Umwege angesprochen werden.
- **Keine personenbezogenen Daten in die Konversation holen.** Keine Abfragen, die
  Klarnamen, E-Mail-Adressen, Telefonnummern, Geburtsdaten oder IBANs zurückgeben.
  Stattdessen `count(*)`, IDs, Aggregate. Wird ein Einzelfall gebraucht, fragt Claude
  nach der ID; der Betreiber führt die Abfrage selbst aus und liefert das Ergebnis
  anonymisiert.
- **Produktionsmigrationen laufen über den Betreiber.** Claude schreibt die
  Migrationsdatei nach `supabase/migrations/` und übergibt das SQL; eingespielt wird
  es im Supabase-SQL-Editor. Eine Schemaänderung in Produktion verdient einen
  Menschen davor.
- **Keine echten Kundendaten in die Testdatenbank** kopieren — die Testfixtures sind
  erfunden (E2E…-Namen) und bleiben es.
- **Keine Produktionsabzüge im Projektordner.** `produktion-sicherung-*.json` ist zwar
  gitignored, liegt aber unverschlüsselt auf der Platte.

## Build & Test Commands

```bash
npm run dev          # Development server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm run start        # Production server
npm test             # Vitest unit/integration tests
npm run test:e2e     # Playwright E2E tests
npm run test:all     # Both test suites
```

## Product Context

@docs/PRD.md

## Feature Overview

@features/INDEX.md
