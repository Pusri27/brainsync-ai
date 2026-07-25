/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // Exclude native Node.js modules from webpack bundling to prevent
  // "bufferUtil.mask is not a function" and similar errors with `ws`, `pg-native`, etc.
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        'bufferutil': 'commonjs bufferutil',
        'utf-8-validate': 'commonjs utf-8-validate',
      });
    }
    return config;
  },
};

module.exports = nextConfig;
