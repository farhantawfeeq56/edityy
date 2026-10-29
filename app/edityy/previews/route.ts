// The previews endpoint for this Next.js app: the page polls the
// agent-placed preview, and posts Keep or Discard. Development only.
import { previewsRoute } from "edityy";

export const { GET, POST, DELETE } = previewsRoute();
