CREATE TABLE "SignupRequest" (
  "id" TEXT NOT NULL,
  "businessName" TEXT NOT NULL,
  "contactName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "customerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "SignupRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SignupRequest_email_key" ON "SignupRequest"("email");
CREATE INDEX "SignupRequest_status_createdAt_idx" ON "SignupRequest"("status", "createdAt");
