-- CreateEnum
CREATE TYPE "WhatsAppConnectionStatus" AS ENUM ('PENDING', 'CONNECTED', 'ERROR', 'DISABLED');

-- AlterTable
ALTER TABLE "WhatsAppConnection" ADD COLUMN     "connectedAt" TIMESTAMP(3),
ADD COLUMN     "connectionStatus" "WhatsAppConnectionStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "embeddedSignupVersion" TEXT NOT NULL DEFAULT 'v4',
ADD COLUMN     "encryptedAccessToken" TEXT,
ADD COLUMN     "encryptedPin" TEXT,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "tokenLastFour" TEXT,
ADD COLUMN     "verifiedBusinessName" TEXT;
