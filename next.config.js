/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimize for Windows development
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
    }
    return config
  }
}

module.exports = nextConfig