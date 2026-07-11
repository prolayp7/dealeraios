/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    "recaptcha-solver",
    "vosk-koffi",
    "koffi",
    "playwright",
    "playwright-core",
    "playwright-extra",
    "puppeteer-extra-plugin-stealth",
  ],
};

export default nextConfig;
