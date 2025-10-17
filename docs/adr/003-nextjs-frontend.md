# ADR-003: Next.js for Frontend

## Status

Accepted

Date: 2025-01-14

## Context

We need to choose a frontend framework for the Shomer triage console. Requirements:

- Modern React-based framework
- Server-side rendering (SSR) for performance and SEO
- Strong TypeScript support
- Good developer experience
- Production-ready with best practices
- Easy integration with tailwind CSS and shadcn/ui
- API client generation support

## Decision

We will use **Next.js 15** with the App Router as the frontend framework.

Stack:
- Next.js 15 (App Router)
- React 18
- TypeScript
- Tailwind CSS for styling
- shadcn/ui for UI components
- pnpm for package management

## Consequences

### Positive

- **Performance**: SSR and automatic code splitting
- **SEO**: Server-side rendering improves SEO
- **Developer Experience**: Hot reload, TypeScript support, file-based routing
- **Production Ready**: Built-in optimizations (image optimization, font optimization)
- **Ecosystem**: Large ecosystem of Next.js plugins and integrations
- **Type Safety**: Excellent TypeScript support
- **Styling**: Tailwind CSS provides utility-first styling
- **Components**: shadcn/ui provides accessible, customizable components

### Negative

- **Complexity**: Next.js has many features that can be overwhelming
- **Build Time**: Larger apps can have slow build times
- **Learning Curve**: App Router is relatively new, less documentation
- **Vendor Lock-in**: Some features are Next.js specific

### Neutral

- **Vercel**: Next.js is built by Vercel, but works on any hosting platform
- **Updates**: Next.js releases frequently, need to stay up-to-date

## Alternatives Considered

### Alternative 1: Create React App (CRA)

**Pros**: Simple, minimal configuration, pure React

**Cons**: No SSR, slower performance, no longer actively maintained

**Why not chosen**: Lack of SSR and performance optimizations makes it unsuitable for production.

### Alternative 2: Vite + React

**Pros**: Extremely fast development, simple configuration, active development

**Cons**: No built-in SSR, need to add routing and other features manually

**Why not chosen**: Next.js provides more out-of-the-box features needed for production.

### Alternative 3: Remix

**Pros**: Modern, excellent data loading patterns, nested routing

**Cons**: Smaller ecosystem, less mature than Next.js, fewer resources

**Why not chosen**: Next.js has larger ecosystem and more mature tooling.

### Alternative 4: Vue.js (Nuxt)

**Pros**: Simpler than React, good performance, nice developer experience

**Cons**: Smaller ecosystem than React, team has React expertise

**Why not chosen**: Team's React expertise made Next.js a better choice.

## References

- [Next.js documentation](https://nextjs.org/docs)
- [shadcn/ui documentation](https://ui.shadcn.com/)
- [Tailwind CSS documentation](https://tailwindcss.com/)

