-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('UNPAID', 'PAID', 'WAIVED');

-- CreateEnum
CREATE TYPE "ListingFeeStatus" AS ENUM ('CREATED', 'PAID', 'FAILED', 'REFUNDED');

-- AlterTable
ALTER TABLE "Organisation" ADD COLUMN     "about" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "payoutAccount" TEXT,
ADD COLUMN     "payoutUpi" TEXT;

-- AlterTable
ALTER TABLE "Participant" ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "phone" DROP NOT NULL,
ALTER COLUMN "dateOfBirth" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Sport" ADD COLUMN     "listingFee" INTEGER NOT NULL DEFAULT 49900,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "listingPaidAt" TIMESTAMP(3),
ADD COLUMN     "listingStatus" "ListingStatus" NOT NULL DEFAULT 'UNPAID';

-- AlterTable
ALTER TABLE "TournamentCategory" ADD COLUMN     "minTeamSize" INTEGER;

-- CreateTable
CREATE TABLE "ListingFee" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "organisationId" TEXT,
    "sportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" "ListingFeeStatus" NOT NULL DEFAULT 'CREATED',
    "providerOrderId" TEXT NOT NULL,
    "providerPaymentId" TEXT,
    "method" TEXT,
    "fee" INTEGER,
    "tax" INTEGER,
    "paidAt" TIMESTAMP(3),
    "verifiedVia" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingFee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "tournamentId" TEXT,
    "amount" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "note" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListingFee_providerOrderId_key" ON "ListingFee"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ListingFee_providerPaymentId_key" ON "ListingFee"("providerPaymentId");

-- CreateIndex
CREATE INDEX "ListingFee_tournamentId_status_idx" ON "ListingFee"("tournamentId", "status");

-- CreateIndex
CREATE INDEX "ListingFee_status_createdAt_idx" ON "ListingFee"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Payout_organisationId_idx" ON "Payout"("organisationId");

-- AddForeignKey
ALTER TABLE "ListingFee" ADD CONSTRAINT "ListingFee_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingFee" ADD CONSTRAINT "ListingFee_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingFee" ADD CONSTRAINT "ListingFee_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
