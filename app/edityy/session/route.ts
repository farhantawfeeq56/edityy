// The canvas session endpoint for this Next.js app: the page keeps its
// temporary edits, comments and regions here, and reads them back on reload.
// Development only.
import { sessionRoute } from "edityy";

export const { GET, POST, DELETE } = sessionRoute();
