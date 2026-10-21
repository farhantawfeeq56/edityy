// The variation endpoint for this Next.js app: the page posts what the user
// asked for, and reads the agent's answer back. Development only.
import { variationsRoute } from "edityy";

export const { GET, POST, DELETE } = variationsRoute();
