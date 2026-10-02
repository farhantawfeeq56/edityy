# Edityy

**A visual editing layer for code-based websites.**

Edityy lets developers work with their existing website visually through the running application, while the actual codebase stays the source of truth.

It is not a traditional CMS, page builder, or replacement for the codebase.

## The Core Idea

A developer already has a website built in their codebase. Instead of rebuilding that website inside another visual editor, Edityy works on top of the running application.

```
Codebase
   ↓
Running website
   ↓
Edityy
   ↓
Visual changes
   ↓
Reviewable change set
   ↓
AI coding agent
   ↓
Actual code changes
```

Edityy provides the visual layer between the developer and their codebase. You make and preview changes visually, without Edityy becoming the owner of the website.

## Codebase as the Source of Truth

The application and its source code remain authoritative. Edityy does not create a competing representation of your site or require it to be rebuilt inside Edityy.

Visual changes made through Edityy are **proposed changes** until they are implemented in the actual codebase.

## Spaces

Edityy is organized around **Spaces**.

- Each Space represents an individual project and has its own unique ID.
- A codebase connects to a specific Space, so Edityy knows which project it is working with.
- Each Space has its own component ecosystem; components belonging to one Space stay isolated from others.

## Components

A Space can have custom components that come from the connected codebase and are made available to Edityy. Edityy understands and works with these components without taking ownership of their implementation — the component code continues to live in your repository.

## MCP

MCP is part of the connection between Edityy and a project's component ecosystem. It lets Edityy work with the resources and context associated with a particular Space, rather than treating every project as a generic website.

## AI Coding Agents

Edityy does not need to modify your source code directly. Changes made during a visual editing session are represented as a clear, human-readable change set, which you hand off to an AI coding agent to implement in your codebase.

This keeps a clean separation:

| Concern | Owner |
| --- | --- |
| Visual intent | Edityy |
| Implementation | AI coding agent |
| Source of truth | Codebase |

## Product Philosophy

Edityy is built around one fundamental idea:

> The website should remain a real codebase, while visual editing becomes a better interface for expressing changes to that codebase.

Edityy makes working with existing code-based websites feel more visual, without turning itself into another website-building environment.

---

## Getting Started

This repository is a fresh implementation of that idea.

```bash
npm install
npm run migrate   # apply db/schema.sql to DATABASE_URL
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

```bash
npm run dev      # start the dev server
npm run build    # production build
npm run start    # serve the production build
npm run lint     # run ESLint
npm run test     # run the node:test checks
npm run migrate  # apply db/schema.sql to DATABASE_URL
```

### Stack

- [Next.js](https://nextjs.org) 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS 4

## Try it — V1 local launcher

Add one script tag to any site you are already running and Edityy places its own floating launcher in the bottom-right
corner of it. No npm package, no build step. See [docs/local-launcher.md](docs/local-launcher.md).

## Status

V1 (local connection + floating launcher) is built. The editor itself is not — this README describes the product
direction; implementation is being built incrementally.
