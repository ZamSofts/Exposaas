-- 1. Create JobStatus enum type
CREATE TYPE "JobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'empty', 'needs_classification');

-- 2. Convert InvoiceJobs.status from TEXT to JobStatus enum (preserving data)
--    Must drop default first (TEXT default can't auto-cast to enum), then convert, then re-add default
ALTER TABLE "InvoiceJobs" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "InvoiceJobs" ALTER COLUMN "status" TYPE "JobStatus" USING "status"::"JobStatus";
ALTER TABLE "InvoiceJobs" ALTER COLUMN "status" SET DEFAULT 'pending'::"JobStatus";

-- 3. Convert Vehicle.createdById from TEXT to INTEGER (preserving data)
ALTER TABLE "Vehicle"
  ALTER COLUMN "createdById" TYPE INTEGER USING "createdById"::INTEGER;

-- 4. Convert Vehicle.updatedById from TEXT to INTEGER (preserving data)
ALTER TABLE "Vehicle"
  ALTER COLUMN "updatedById" TYPE INTEGER USING "updatedById"::INTEGER;

-- 5. Convert PaymentConfirmation.reviewedById from TEXT to INTEGER (preserving data)
ALTER TABLE "PaymentConfirmation"
  ALTER COLUMN "reviewedById" TYPE INTEGER USING "reviewedById"::INTEGER;

-- 6. Convert ExportTemplate.createdById from TEXT to INTEGER (preserving data)
ALTER TABLE "ExportTemplate"
  ALTER COLUMN "createdById" TYPE INTEGER USING "createdById"::INTEGER;
