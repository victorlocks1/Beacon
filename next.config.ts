import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.101.6"],
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
