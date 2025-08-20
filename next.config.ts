// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "20mb", // or higher if needed
    },
  },
};

module.exports = nextConfig;