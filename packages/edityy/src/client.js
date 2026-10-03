/*
 * Client bootstrap: mounts the launcher into the running page.
 *
 * This is the Next.js path. Next renders its own HTML, so the dev-server
 * middleware cannot patch it — but `next.config.js` can hand a module to
 * `instrumentationClientInject`, which the client bundle runs before hydration.
 * Adding the launcher there needs no route handler and no <script> tag.
 *
 * Importing the payload for its side effects is enough: it is an IIFE that
 * mounts on evaluation and sets `window.__edityy`, so it stays idempotent when a
 * project also injects ASSET_PATH the old way.
 *
 * Browser-only by contract — instrumentation-client modules run on the client.
 */
import "./edityy.js";