import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: mounts the Edityy launcher (edityy/client) before hydration.
  // Next renders its own HTML, so the package's dev-server middleware cannot
  // patch it — the client bootstrap is the supported path. Never ship this to
  // production, so it is keyed off NODE_ENV rather than left on.
  ...(process.env.NODE_ENV === "development" && {
    instrumentationClientInject: ["edityy/client"],
  }),
  // The package's endpoints answer under /__edityy. Next reads a folder that
  // starts with "_" as a private folder and never routes it, so the route
  // lives in a folder with an ordinary name and this rewrite maps the
  // reserved path onto it.
  async rewrites() {
    return [{ source: "/__edityy/variations", destination: "/edityy/variations" }];
  },
};

export default nextConfig;