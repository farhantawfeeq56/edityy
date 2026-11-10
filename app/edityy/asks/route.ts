// The asks queue for this Next.js app: the page polls every wait at once,
// and the MCP getter reads the same files. Development only.
import { asksRoute } from "edityy";

export const GET = asksRoute();
