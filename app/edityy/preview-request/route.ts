// The comment-box preview request endpoint for this Next.js app: the page
// writes what the user asked for, the agent paints it, the page reads it back.
// Development only.
import { previewRequestRoute } from "edityy";

export const { GET, POST, DELETE } = previewRequestRoute();
