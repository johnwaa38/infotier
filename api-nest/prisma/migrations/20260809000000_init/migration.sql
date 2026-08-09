CREATE TABLE "Verification" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "userReference" TEXT NOT NULL,
  "idType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "score" DOUBLE PRECISION,
  "decisionReason" TEXT,
  "ocrData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Evidence" (
  "id" TEXT NOT NULL,
  "verificationId" TEXT NOT NULL,
  "s3Path" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "verificationId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerConfig" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "webhookUrl" TEXT,
  "approveThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
  "rejectThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.35,
  "retentionDays" INTEGER NOT NULL DEFAULT 30,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerConfig_customerId_key" ON "CustomerConfig"("customerId");
CREATE INDEX "Evidence_verificationId_idx" ON "Evidence"("verificationId");
CREATE INDEX "AuditLog_verificationId_idx" ON "AuditLog"("verificationId");

ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_verificationId_fkey"
  FOREIGN KEY ("verificationId") REFERENCES "Verification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_verificationId_fkey"
  FOREIGN KEY ("verificationId") REFERENCES "Verification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
