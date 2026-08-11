import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  /**
   * Image optimisation.
   *
   * The AI Designs screen shows dozens of generated cakes at a time. Those files are full-resolution
   * originals in S3 — a megabyte or more each — and were being served straight to the browser at
   * thumbnail size, so a single page load pulled tens of megabytes to render images displayed a few
   * hundred pixels wide. Next resizes and re-encodes them here instead, which needs `sharp`
   * installed (it is, as a real dependency, so the standalone build carries it).
   *
   * remotePatterns rather than the older `domains`: it pins the protocol and path prefix as well as
   * the host, so this cannot be turned into an open image proxy for anything else on those hosts.
   */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pranajiva-innovations.s3.eu-north-1.amazonaws.com",
        pathname: "/ai-studio/**",
      },
      {
        // Provider-hosted originals. Replicate expires these after a while, which is why designs are
        // copied to our own bucket — but older rows still point here, and a moderation screen must
        // render what exists rather than what should have existed.
        protocol: "https",
        hostname: "replicate.delivery",
        pathname: "/**",
      },
    ],
    // The grid renders at four columns on a wide screen; nothing here is ever shown large, so the
    // biggest size generated is capped well below the source resolution.
    imageSizes: [64, 128, 256, 384],
    deviceSizes: [640, 828, 1080, 1200],
    // Generated designs never change once written — the URL is content-addressed by design id.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};

export default nextConfig;
