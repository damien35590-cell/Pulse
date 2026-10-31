-- CreateTable
CREATE TABLE "LafayTest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "durationS" INTEGER NOT NULL,
    "repsA" INTEGER NOT NULL,
    "repsB" INTEGER NOT NULL,
    "repsC" INTEGER NOT NULL,
    "repsA1" INTEGER NOT NULL,
    "hrSeries" JSONB,
    "warmup" JSONB,
    "appliedAt" TIMESTAMP(3),
    "applied" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LafayTest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LafayTest_userId_takenAt_idx" ON "LafayTest"("userId", "takenAt" DESC);

-- AddForeignKey
ALTER TABLE "LafayTest" ADD CONSTRAINT "LafayTest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
