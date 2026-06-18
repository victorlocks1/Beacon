-- Personal Access Token do Figma, criptografado em repouso (por usuário).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "figmaAccessToken" TEXT;
