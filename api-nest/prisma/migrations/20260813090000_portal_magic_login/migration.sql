CREATE TABLE "PortalLoginToken" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalLoginToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PortalLoginToken_tokenHash_key" ON "PortalLoginToken"("tokenHash");
CREATE INDEX "PortalLoginToken_customerId_idx" ON "PortalLoginToken"("customerId");
CREATE INDEX "PortalLoginToken_expiresAt_idx" ON "PortalLoginToken"("expiresAt");
ALTER TABLE "PortalLoginToken" ADD CONSTRAINT "PortalLoginToken_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
