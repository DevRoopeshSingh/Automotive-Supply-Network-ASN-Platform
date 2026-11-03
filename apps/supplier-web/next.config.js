/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@asn/ui", "@asn/types", "@asn/utils", "@asn/validators"],
  reactStrictMode: true,
};

module.exports = nextConfig;
