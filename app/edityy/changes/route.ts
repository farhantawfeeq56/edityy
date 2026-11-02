// The save endpoint for this Next.js app: the page posts its edits here, and
// the file lands in .edityy/changes.json for a coding agent to read.
// Development only.
import { changesRoute } from "edityy";

export const POST = changesRoute();
