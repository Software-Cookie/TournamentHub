-- CreateEnum
CREATE TYPE "PremiumPlan" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('CREATED', 'PAID', 'FAILED', 'REFUNDED');

-- AlterTable
ALTER TABLE "ListingFee" ADD COLUMN     "baseAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gstAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "platformFee" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "premiumUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PremiumMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "PremiumPlan" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "MembershipStatus" NOT NULL DEFAULT 'CREATED',
    "providerOrderId" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "method" TEXT,
    "fee" INTEGER,
    "tax" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "verifiedVia" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PremiumMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PremiumMembership_providerOrderId_key" ON "PremiumMembership"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "PremiumMembership_providerPaymentId_key" ON "PremiumMembership"("providerPaymentId");

-- CreateIndex
CREATE INDEX "PremiumMembership_userId_status_idx" ON "PremiumMembership"("userId", "status");

-- CreateIndex
CREATE INDEX "PremiumMembership_status_createdAt_idx" ON "PremiumMembership"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "PremiumMembership" ADD CONSTRAINT "PremiumMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
