/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['mongodb'],
  },
  webpack: (config) => {
    // pdfjs-dist ships a node canvas dependency we don't need in the browser build
    config.resolve.alias.canvas = false;
    return config;
  },
};

module.exports = nextConfig;
