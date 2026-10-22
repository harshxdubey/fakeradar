/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prompts in /prompts are read at runtime by the API routes.
  outputFileTracingIncludes: { "/api/**/*": ["./prompts/**/*"] },
};
export default nextConfig;
