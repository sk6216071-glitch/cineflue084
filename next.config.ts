import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.7', 'localhost', '127.0.0.1'],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "m.media-amazon.com",
      },
      {
        protocol: "https",
        hostname: "walter.trakt.tv",
      },
      {
        protocol: "https",
        hostname: "assets.fanart.tv",
      },
      {
        protocol: "https",
        hostname: "simkl.in",
      },
    ],
  },
};

export default nextConfig;
