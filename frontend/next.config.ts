import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow external hosts for development
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    // Fix for pdfjs-dist in Next.js
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        util: false,
      };
    }
    
    // Ignore pdfjs-dist worker files during server-side bundling
    config.resolve.alias = {
      ...config.resolve.alias,
      'canvas': false,
    };
    
    return config;
  },
};

export default nextConfig;
