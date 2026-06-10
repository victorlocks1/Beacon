import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.101.6"],
  experimental: {
    // Telas coladas/anexadas (PNG do Figma, prints retina) passam fácil de
    // 1 MB (limite padrão das Server Actions). Sem isso, o upload falha
    // silenciosamente e o loader fica eterno.
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "nzhqqttjzdkjkcwzkfnw.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
}

export default nextConfig
