/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Handle node.js modules that aren't needed in browser
    config.externals.push('pino-pretty', 'lokijs', 'encoding');

    // Handle optional dependencies from @metamask/sdk
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
    };

    return config;
  },
};

module.exports = nextConfig;
