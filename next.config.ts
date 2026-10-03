import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: mounts the Edityy launcher (edityy/client) before hydration.
  // Next renders its own HTML, so the package's dev-server middleware cannot
  // patch it — the client bootstrap is the supported path. Never ship this to
  // production, so it is keyed off NODE_ENV rather than left on.
  ...(process.env.NODE_ENV === "development" && {
    instrumentationClientInject: ["edityy/client"],
  }),
};

export default nextConfig;