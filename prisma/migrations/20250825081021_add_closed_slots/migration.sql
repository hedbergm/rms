-- CreateTable
CREATE TABLE "public"."ClosedSlot" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL,
    "rampNumber" INTEGER,
    "startMinute" INTEGER,
    "durationMinutes" INTEGER,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClosedSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClosedSlot_date_type_idx" ON "public"."ClosedSlot"("date", "type");

-- CreateIndex
CREATE INDEX "ClosedSlot_date_rampNumber_idx" ON "public"."ClosedSlot"("date", "rampNumber");
