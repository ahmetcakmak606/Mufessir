# Mufessir – AI-powered Tafsir Platform

## Project Overview (English Translation)

I wanted to share the first draft of the structure I have built so far. The code is not yet in a state that can run and answer, but I believe I can make it functional—with a basic web interface—in a short time.

The project is composed of three components:

1. **Database** – Stores all tafsirs and scholars, plus auxiliary data that can help us evaluate the quality and reputation of each tafsir (e.g.
   total word count, originality compared with earlier works, possible plagiarism). I have built a system similar to the one our teacher Cüneyt previously created and will soon migrate the data into my own environment.
2. **API (middle layer)** – Acts as the brain of the entire project: fetches data from the database, interacts with the AI, and serves the result to the website (front-end). Guided by your feedback, I expect the most valuable contributions to happen here.
3. **Website** – The user-facing side. Visitors will be able to access both traditional tafsirs & scholars and our AI-powered tafsir.
   I envisage two modes:
   * **Basic** – Returns an answer based only on the verse and fixed criteria chosen by our team; no customisation; aimed at everyday use.
   * **Advanced** – Designed for academia: extensive filtering options, sentiment analysis, and an indication of which existing tafsir the AI output most resembles.

Initially the site will support Turkish and English. An Arabic version (right-to-left layout) is more challenging but can come later.

### Current Repository Snapshot

* **Monorepo**: Turborepo workspace with `apps/frontend` (Next.js 14) and several `packages/*` (database, shared-types, config).
* **Database**: Prisma schema already models `User`, `Verse`, `Scholar`, `Tafsir`, interaction tables (`Search`, `SearchResult`, `Favorite`). No migrations run yet; no seed data; no vector-column for embeddings.
* **Frontend**: Still the Create-Next-App placeholder; no pages, API calls or auth.
* **Backend**: None yet. No API routes, server functions, or LLM calls.
* **Types & Tooling**: Basic `shared-types` stub; ESLint/TS configs in place.
* **DevOps / Deployment**: Vercel selected for FE; nothing configured for BE/DB.
* **AI Pipeline**: Not implemented; no embeddings, prompts, similarity search, or OpenAI integration.

### Roadmap (Initial Milestones)

18. Configure Vercel project for `apps/frontend`; set all required environment variables. [Done]
19. Configure Vercel functions for `apps/backend` (or deploy to Railway/Fly if long-running workers are needed). [Done]
20. Add GitHub Actions workflow: lint → test → type-check → Prisma migrate deploy → Vercel deployment. [Pending]

**Phase 6 – Observability & Polish**
21. Add structured logging (Pino) and request tracing.
22. Add basic unit/integration tests (Jest + Supertest).
23. Monitor costs & rate-limit API usage.

> Guiding Principle: **The AI must rely solely on controlled data from our DB.** No internet search; the backend assembles complete, verifiable context before each OpenAI call.

### High-Level User Flow

1. The user visits the site and is redirected to a login screen. Because AI operations are costly, users will log in with their own AI account so that their own balance is used.
2. After login, credentials are stored only in the browser; nothing persists on our servers. Later we may add a full account system with favourites, saved searches, etc.
3. The user selects a verse; the Arabic text and the Diyanet translation are shown.
4. The user chooses the tafsir mode. If **Advanced** is selected, extra filters appear:

   * Include / exclude specific scholars by name.
   * Filter scholars by other criteria—period, geography, century, vocabulary size, plagiarism ratio, ruling-state religion, etc.—as either *must* or *must-not*.
   * Emotional vs. rational tone (1-10).
   * Intellectual level / vocabulary richness (1-10).
   * Comparative analysis (e.g. "Compare the AI tafsir with al-Māturīdī").
   * Preferred output language. We have tafsirs in multiple languages and translations as well. The AI can read Arabic and Turkish tafsirs and output in any requested language, but that entails internal translation. Should we keep languages separate or merge them? Your advice is welcome.

5. The user clicks *Analyse*; the selected filters are sent to the backend.
6. The backend authenticates and begins processing: fetches verse details, crafts the prompt, and sends it to the AI.
7. The AI is primed with the tafsir and filter information we provide (including scholar metadata). This prevents it from browsing the internet and returning unverifiable information.
8. We calculate how similar the AI’s answer is to existing tafsirs. With one thousand scholars this may be heavy, so we might pre-compute similarities or maintain a scholar-to-scholar similarity table.
9. The result—complete with visuals and requested filters—is displayed to the user. A *Download* button can allow saving the answer.

### Immediate Next Steps

1. Publish the first version of the site.
2. Spin up a small database with mock data and run sample queries.
3. Implement the AI integration.

Please review this project as if you were the client and don’t hesitate to guide me—the academic value depends on your input.

---

# Turborepo starter

This Turborepo starter is maintained by the Turborepo core team.

## Using this example

Run the following command:

```sh
npx create-turbo@latest
```

## What's inside?

This Turborepo includes the following packages/apps:

### Apps and Packages

* `docs`: a [Next.js](https://nextjs.org/) app
* `web`: another [Next.js](https://nextjs.org/) app
* `@repo/ui`: a stub React component library shared by both `web` and `docs` applications
* `@repo/eslint-config`: `eslint` configurations (includes `eslint-config-next` and `eslint-config-prettier`)
* `@repo/typescript-config`: `tsconfig.json`s used throughout the monorepo

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Utilities

This Turborepo has some additional tools already setup for you:

* [TypeScript](https://www.typescriptlang.org/) for static type checking
* [ESLint](https://eslint.org/) for code linting
* [Prettier](https://prettier.io) for code formatting

### Build

To build all apps and packages, run the following command:

```
cd my-turborepo
pnpm build
```

### Develop

To develop all apps and packages, run the following command:

```
cd my-turborepo
pnpm dev
```

### Remote Caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started today at [vercel.com](https://vercel.com/signup?/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turborepo can use a technique known as [Remote Caching](https://turbo.build/repo/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=turborepo-examples), then enter the following commands:

```
cd my-turborepo
npx turbo login
```

This will authenticate the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, you can link your Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

```
npx turbo link
```

## Useful Links

Learn more about the power of Turborepo:

* [Tasks](https://turbo.build/repo/docs/core-concepts/monorepos/running-tasks)
* [Caching](https://turbo.build/repo/docs/core-concepts/caching)
* [Remote Caching](https://turbo.build/repo/docs/core-concepts/remote-caching)
* [Filtering](https://turbo.build/repo/docs/core-concepts/monorepos/filtering)
* [Configuration Options](https://turbo.build/repo/docs/reference/configuration)
* [CLI Usage](https://turbo.build/repo/docs/reference/command-line-reference)
