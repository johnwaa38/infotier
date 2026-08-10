ALTER TABLE "Verification" ADD COLUMN "provider" TEXT;
ALTER TABLE "Verification" ADD COLUMN "providerSessionId" TEXT;
CREATE UNIQUE INDEX "Verification_providerSessionId_key" ON "Verification"("providerSessionId");
