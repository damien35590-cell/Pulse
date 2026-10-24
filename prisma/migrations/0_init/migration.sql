-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('RUN', 'RIDE', 'EBIKE', 'SWIM', 'HIKE', 'WALK', 'WORKOUT', 'OTHER');

-- CreateEnum
CREATE TYPE "Feeling" AS ENUM ('GREAT', 'GOOD', 'OK', 'TIRED', 'HARD');

-- CreateEnum
CREATE TYPE "GoalMetric" AS ENUM ('DISTANCE', 'TIME', 'ELEVATION', 'ACTIVITIES');

-- CreateEnum
CREATE TYPE "GoalPeriod" AS ENUM ('WEEK', 'MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "RecordKind" AS ENUM ('LONGEST_DISTANCE', 'LONGEST_TIME', 'BEST_5K', 'BEST_10K', 'BEST_HALF', 'BEST_ELEVATION');

-- CreateEnum
CREATE TYPE "GearKind" AS ENUM ('BIKE', 'EBIKE', 'TRAINER', 'SHOES', 'CHAIN', 'CASSETTE', 'TIRE', 'OTHER');

-- CreateEnum
CREATE TYPE "RacePlatform" AS ENUM ('NEXTRUN', 'KLIKEGO', 'OTHER');

-- CreateEnum
CREATE TYPE "RaceStatus" AS ENUM ('REGISTERED', 'COMPLETED', 'DNS', 'DNF');

-- CreateEnum
CREATE TYPE "WorkoutKind" AS ENUM ('HAUT', 'BAS', 'LIBRE');

-- CreateEnum
CREATE TYPE "GoalType" AS ENUM ('RUN_TARGET_TIME', 'RUN_FINISH', 'RUN_VMA', 'RUN_BASE', 'STRENGTH_HYPERTROPHY', 'STRENGTH_FORCE', 'STRENGTH_MAINTENANCE', 'STRENGTH_LIFT_TARGET');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'ACHIEVED', 'MISSED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "Feasibility" AS ENUM ('REALISTIC', 'AMBITIOUS', 'VERY_AMBITIOUS', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "TargetUnit" AS ENUM ('KG', 'REPS', 'SECONDS', 'KMH');

-- CreateEnum
CREATE TYPE "ProgramStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "SchedulingMode" AS ENUM ('FIXED_DAYS', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "PhaseType" AS ENUM ('BASE', 'BUILD', 'SPECIFIC', 'TAPER', 'POST_RACE', 'ACCUMULATION', 'INTENSIFICATION', 'DELOAD', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "SessionKind" AS ENUM ('EASY', 'RECOVERY', 'LONG_RUN', 'THRESHOLD', 'INTERVALS_SHORT', 'INTERVALS_LONG', 'RACE_PACE', 'FARTLEK', 'HILLS', 'PROGRESSIVE', 'VMA_TEST', 'RACE', 'CROSS_TRAINING', 'STRENGTH_WORKOUT', 'MOBILITY');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('PLANNED', 'COMPLETED', 'PARTIAL', 'SKIPPED', 'MOVED');

-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('VMA_KMH', 'HR_MAX', 'HR_REST', 'HR_THRESHOLD', 'THRESHOLD_PACE_S_KM', 'FTP_W', 'BODYWEIGHT_KG');

-- CreateEnum
CREATE TYPE "MetricSource" AS ENUM ('TEST', 'RACE', 'ESTIMATED', 'MANUAL', 'INTERVALS');

-- CreateEnum
CREATE TYPE "Equipment" AS ENUM ('BARBELL', 'DUMBBELL', 'KETTLEBELL', 'MACHINE', 'CABLE', 'BAND', 'BODYWEIGHT', 'PULLUP_BAR', 'RINGS', 'BENCH', 'ROMAN_CHAIR', 'OTHER');

-- CreateEnum
CREATE TYPE "LoadType" AS ENUM ('EXTERNAL', 'BODYWEIGHT', 'WEIGHTED_BODYWEIGHT', 'ASSISTED', 'TIMED');

-- CreateEnum
CREATE TYPE "Mechanic" AS ENUM ('COMPOUND', 'ISOLATION');

-- CreateEnum
CREATE TYPE "MuscleGroup" AS ENUM ('CHEST', 'BACK', 'LATS', 'TRAPS', 'SHOULDERS', 'BICEPS', 'TRICEPS', 'FOREARMS', 'ABS', 'OBLIQUES', 'LOWER_BACK', 'GLUTES', 'QUADS', 'HAMSTRINGS', 'CALVES', 'ADDUCTORS', 'FULL_BODY');

-- CreateEnum
CREATE TYPE "SetType" AS ENUM ('STRAIGHT', 'TOP_SET_BACKOFF', 'PYRAMID', 'DROP_SET', 'REST_PAUSE', 'MYO_REPS', 'AMRAP', 'TIMED');

-- CreateEnum
CREATE TYPE "ProgressionRule" AS ENUM ('DOUBLE_PROGRESSION', 'LINEAR_LOAD', 'REPS_THEN_VARIANT', 'RIR_AUTOREGULATED', 'MAINTAIN', 'NONE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "username" TEXT,
    "bio" TEXT,
    "weightKg" DOUBLE PRECISION,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris',
    "ageBand" TEXT,
    "sex" TEXT,
    "homeLat" DOUBLE PRECISION,
    "homeLng" DOUBLE PRECISION,
    "homeEquipment" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "refresh_token_expires_in" INTEGER,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "feeling" "Feeling",
    "startedAt" TIMESTAMP(3) NOT NULL,
    "distanceM" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "movingTimeS" INTEGER NOT NULL DEFAULT 0,
    "elapsedTimeS" INTEGER,
    "elevationGainM" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calories" INTEGER,
    "avgHr" INTEGER,
    "maxHr" INTEGER,
    "avgPower" INTEGER,
    "maxPower" INTEGER,
    "polyline" TEXT,
    "trackPoints" JSONB,
    "startLat" DOUBLE PRECISION,
    "startLng" DOUBLE PRECISION,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "externalId" TEXT,
    "weather" JSONB,
    "story" TEXT,
    "dedupeKey" TEXT,
    "rpe" INTEGER,
    "load" DOUBLE PRECISION,
    "loadSource" TEXT,
    "kind" "WorkoutKind",
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityPhoto" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "key" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ActivityPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "metric" "GoalMetric" NOT NULL,
    "period" "GoalPeriod" NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "type" "ActivityType",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "RecordKind" NOT NULL,
    "type" "ActivityType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "activityId" TEXT,
    "achievedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("userId","badgeId")
);

-- CreateTable
CREATE TABLE "TrainingPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sport" "ActivityType" NOT NULL,
    "goalLabel" TEXT NOT NULL,
    "weeks" INTEGER NOT NULL,
    "days" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "done" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutExercise" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "loadKg" DOUBLE PRECISION,
    "restS" INTEGER,
    "comment" TEXT,
    "setsDetail" JSONB,
    "exerciseId" TEXT,
    "slotId" TEXT,

    CONSTRAINT "WorkoutExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "WorkoutKind" NOT NULL DEFAULT 'LIBRE',
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutTemplateExercise" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "exerciseCode" TEXT NOT NULL,
    "variant" TEXT,
    "sets" INTEGER NOT NULL,
    "targetReps" INTEGER NOT NULL,
    "restSec" INTEGER NOT NULL,
    "restAfterSec" INTEGER NOT NULL,
    "loadKg" DOUBLE PRECISION,
    "note" TEXT,

    CONSTRAINT "WorkoutTemplateExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityStream" (
    "activityId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "curve" JSONB,
    "avgCad" INTEGER,

    CONSTRAINT "ActivityStream_pkey" PRIMARY KEY ("activityId")
);

-- CreateTable
CREATE TABLE "SuggestedRoute" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sport" "ActivityType" NOT NULL,
    "variant" TEXT,
    "minutes" INTEGER NOT NULL,
    "startLat" DOUBLE PRECISION NOT NULL,
    "startLng" DOUBLE PRECISION NOT NULL,
    "polyline" TEXT NOT NULL,
    "elevation" JSONB NOT NULL,
    "distanceM" DOUBLE PRECISION NOT NULL,
    "ascentM" DOUBLE PRECISION NOT NULL,
    "estMinutes" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "why" TEXT NOT NULL,
    "scores" JSONB NOT NULL,
    "pois" JSONB NOT NULL,
    "weather" JSONB,
    "saved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuggestedRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HabitMap" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sport" "ActivityType" NOT NULL,
    "lat0" DOUBLE PRECISION NOT NULL,
    "cellM" INTEGER NOT NULL,
    "cells" JSONB NOT NULL,
    "classics" JSONB NOT NULL,
    "junctions" JSONB NOT NULL,
    "traces" INTEGER NOT NULL,
    "builtAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HabitMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OverpassCache" (
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OverpassCache_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "WeatherCache" (
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeatherCache_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "UserZones" (
    "userId" TEXT NOT NULL,
    "ftp" INTEGER,
    "hrMax" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserZones_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "RaceEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "sport" "ActivityType" NOT NULL,
    "targetDistance" DOUBLE PRECISION,
    "targetElevation" DOUBLE PRECISION,
    "startTime" TEXT,
    "eventName" TEXT,
    "platform" "RacePlatform" NOT NULL DEFAULT 'OTHER',
    "url" TEXT,
    "location" TEXT,
    "priceCents" INTEGER,
    "requiredDocument" TEXT,
    "bibNumber" TEXT,
    "goalTimeS" INTEGER,
    "status" "RaceStatus" NOT NULL DEFAULT 'REGISTERED',
    "activityId" TEXT,
    "resultTimeS" INTEGER,
    "rankOverall" INTEGER,
    "rankCategory" INTEGER,
    "participants" INTEGER,
    "notes" TEXT,

    CONSTRAINT "RaceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gear" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "kind" "GearKind" NOT NULL,
    "name" TEXT NOT NULL,
    "sports" "ActivityType"[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "startKm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "limitKm" DOUBLE PRECISION,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Gear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AthleteMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "MetricType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "source" "MetricSource" NOT NULL,
    "activityId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AthleteMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sport" "ActivityType" NOT NULL,
    "type" "GoalType" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "targetDate" DATE,
    "distanceM" INTEGER,
    "targetTimeS" INTEGER,
    "raceEventId" TEXT,
    "exerciseId" TEXT,
    "targetValue" DOUBLE PRECISION,
    "targetUnit" "TargetUnit",
    "baselineValue" DOUBLE PRECISION,
    "predictedTimeS" INTEGER,
    "requiredVmaKmh" DOUBLE PRECISION,
    "feasibility" "Feasibility" NOT NULL DEFAULT 'UNKNOWN',
    "predictionUpdatedAt" TIMESTAMP(3),
    "achievedAt" TIMESTAMP(3),
    "achievedValue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Program" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sport" "ActivityType" NOT NULL,
    "goalId" TEXT,
    "name" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "status" "ProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "schedulingMode" "SchedulingMode" NOT NULL DEFAULT 'FIXED_DAYS',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "totalWeeks" INTEGER NOT NULL,
    "sessionsPerWeek" INTEGER NOT NULL,
    "preferredDays" INTEGER[],
    "keySessionDay" INTEGER,
    "longRunDay" INTEGER,
    "level" "ExperienceLevel" NOT NULL DEFAULT 'INTERMEDIATE',
    "generatorInput" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "lastRecalibratedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramPhase" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "PhaseType" NOT NULL,
    "name" TEXT NOT NULL,
    "focus" TEXT,

    CONSTRAINT "ProgramPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramWeek" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "isRecovery" BOOLEAN NOT NULL DEFAULT false,
    "targetDistanceM" INTEGER,
    "targetLoad" INTEGER,
    "volumeFactor" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "intensityFactor" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "note" TEXT,

    CONSTRAINT "ProgramWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedSession" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sport" "ActivityType" NOT NULL,
    "kind" "SessionKind" NOT NULL,
    "date" DATE NOT NULL,
    "orderInWeek" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isKeySession" BOOLEAN NOT NULL DEFAULT false,
    "structure" JSONB,
    "plannedDurationS" INTEGER,
    "plannedDistanceM" INTEGER,
    "plannedLoad" INTEGER,
    "workoutId" TEXT,
    "raceEventId" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'PLANNED',
    "originalDate" DATE,
    "completedActivityId" TEXT,
    "complianceScore" INTEGER,
    "skipReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "intervalsEventId" TEXT,
    "intervalsSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannedSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "equipment" "Equipment" NOT NULL,
    "loadType" "LoadType" NOT NULL,
    "mechanic" "Mechanic",
    "primaryMuscles" "MuscleGroup"[],
    "secondaryMuscles" "MuscleGroup"[],
    "difficulty" INTEGER,
    "harderVariantId" TEXT,
    "instructions" TEXT,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramWorkout" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "estimatedDurationMin" INTEGER,

    CONSTRAINT "ProgramWorkout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramExerciseSlot" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "supersetGroup" TEXT,
    "setType" "SetType" NOT NULL DEFAULT 'STRAIGHT',
    "sets" INTEGER NOT NULL,
    "repMin" INTEGER,
    "repMax" INTEGER,
    "durationS" INTEGER,
    "targetRir" INTEGER,
    "tempo" TEXT,
    "restS" INTEGER,
    "warmupSets" INTEGER NOT NULL DEFAULT 0,
    "progressionRule" "ProgressionRule" NOT NULL,
    "loadIncrementKg" DOUBLE PRECISION,
    "repIncrement" INTEGER,
    "deloadAfterStalls" INTEGER,
    "deloadPct" DOUBLE PRECISION,
    "currentLoadKg" DOUBLE PRECISION,
    "currentRepTarget" INTEGER,
    "stallCount" INTEGER NOT NULL DEFAULT 0,
    "lastProgressedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "ProgramExerciseSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSecret" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppSecret_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOkAt" TIMESTAMP(3),

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPrefs" (
    "userId" TEXT NOT NULL,
    "morning" BOOLEAN NOT NULL DEFAULT true,
    "reminder" BOOLEAN NOT NULL DEFAULT true,
    "weekly" BOOLEAN NOT NULL DEFAULT true,
    "morningCoachTime" TEXT NOT NULL DEFAULT '06:00',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPrefs_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachDebrief" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "factsHash" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachDebrief_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachChat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachChat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachMessage" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoachMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ActivityToGear" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Activity_userId_startedAt_idx" ON "Activity"("userId", "startedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Activity_userId_dedupeKey_key" ON "Activity"("userId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_userId_source_externalId_key" ON "Activity"("userId", "source", "externalId");

-- CreateIndex
CREATE INDEX "ActivityPhoto_activityId_idx" ON "ActivityPhoto"("activityId");

-- CreateIndex
CREATE INDEX "Goal_userId_active_idx" ON "Goal"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalRecord_userId_kind_type_key" ON "PersonalRecord"("userId", "kind", "type");

-- CreateIndex
CREATE INDEX "UserBadge_userId_acknowledgedAt_idx" ON "UserBadge"("userId", "acknowledgedAt");

-- CreateIndex
CREATE INDEX "TrainingPlan_userId_createdAt_idx" ON "TrainingPlan"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WorkoutExercise_activityId_position_idx" ON "WorkoutExercise"("activityId", "position");

-- CreateIndex
CREATE INDEX "WorkoutExercise_exerciseId_idx" ON "WorkoutExercise"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutTemplate_userId_name_key" ON "WorkoutTemplate"("userId", "name");

-- CreateIndex
CREATE INDEX "WorkoutTemplateExercise_templateId_order_idx" ON "WorkoutTemplateExercise"("templateId", "order");

-- CreateIndex
CREATE INDEX "SuggestedRoute_userId_saved_createdAt_idx" ON "SuggestedRoute"("userId", "saved", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "HabitMap_userId_sport_key" ON "HabitMap"("userId", "sport");

-- CreateIndex
CREATE UNIQUE INDEX "RaceEvent_activityId_key" ON "RaceEvent"("activityId");

-- CreateIndex
CREATE INDEX "RaceEvent_userId_date_idx" ON "RaceEvent"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RaceEvent_userId_url_key" ON "RaceEvent"("userId", "url");

-- CreateIndex
CREATE INDEX "Gear_userId_retiredAt_idx" ON "Gear"("userId", "retiredAt");

-- CreateIndex
CREATE INDEX "AthleteMetric_userId_type_measuredAt_idx" ON "AthleteMetric"("userId", "type", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "TrainingGoal_userId_status_idx" ON "TrainingGoal"("userId", "status");

-- CreateIndex
CREATE INDEX "Program_userId_sport_status_idx" ON "Program"("userId", "sport", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramPhase_programId_order_key" ON "ProgramPhase"("programId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramWeek_programId_number_key" ON "ProgramWeek"("programId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedSession_completedActivityId_key" ON "PlannedSession"("completedActivityId");

-- CreateIndex
CREATE INDEX "PlannedSession_userId_date_idx" ON "PlannedSession"("userId", "date");

-- CreateIndex
CREATE INDEX "PlannedSession_programId_status_date_idx" ON "PlannedSession"("programId", "status", "date");

-- CreateIndex
CREATE INDEX "PlannedSession_weekId_idx" ON "PlannedSession"("weekId");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_slug_key" ON "Exercise"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramWorkout_programId_key_key" ON "ProgramWorkout"("programId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramExerciseSlot_workoutId_order_key" ON "ProgramExerciseSlot"("workoutId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_userId_kind_day_key" ON "NotificationLog"("userId", "kind", "day");

-- CreateIndex
CREATE INDEX "CoachDebrief_userId_updatedAt_idx" ON "CoachDebrief"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CoachDebrief_userId_scope_periodKey_key" ON "CoachDebrief"("userId", "scope", "periodKey");

-- CreateIndex
CREATE INDEX "CoachChat_userId_updatedAt_idx" ON "CoachChat"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "CoachMessage_chatId_createdAt_idx" ON "CoachMessage"("chatId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "_ActivityToGear_AB_unique" ON "_ActivityToGear"("A", "B");

-- CreateIndex
CREATE INDEX "_ActivityToGear_B_index" ON "_ActivityToGear"("B");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkoutTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityPhoto" ADD CONSTRAINT "ActivityPhoto_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalRecord" ADD CONSTRAINT "PersonalRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "Badge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "ProgramExerciseSlot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTemplate" ADD CONSTRAINT "WorkoutTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTemplateExercise" ADD CONSTRAINT "WorkoutTemplateExercise_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WorkoutTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityStream" ADD CONSTRAINT "ActivityStream_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestedRoute" ADD CONSTRAINT "SuggestedRoute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitMap" ADD CONSTRAINT "HabitMap_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserZones" ADD CONSTRAINT "UserZones_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceEvent" ADD CONSTRAINT "RaceEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaceEvent" ADD CONSTRAINT "RaceEvent_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gear" ADD CONSTRAINT "Gear_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gear" ADD CONSTRAINT "Gear_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Gear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteMetric" ADD CONSTRAINT "AthleteMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AthleteMetric" ADD CONSTRAINT "AthleteMetric_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingGoal" ADD CONSTRAINT "TrainingGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingGoal" ADD CONSTRAINT "TrainingGoal_raceEventId_fkey" FOREIGN KEY ("raceEventId") REFERENCES "RaceEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingGoal" ADD CONSTRAINT "TrainingGoal_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Program" ADD CONSTRAINT "Program_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "TrainingGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramPhase" ADD CONSTRAINT "ProgramPhase_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramWeek" ADD CONSTRAINT "ProgramWeek_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramWeek" ADD CONSTRAINT "ProgramWeek_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProgramPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedSession" ADD CONSTRAINT "PlannedSession_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedSession" ADD CONSTRAINT "PlannedSession_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "ProgramWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedSession" ADD CONSTRAINT "PlannedSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedSession" ADD CONSTRAINT "PlannedSession_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "ProgramWorkout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedSession" ADD CONSTRAINT "PlannedSession_raceEventId_fkey" FOREIGN KEY ("raceEventId") REFERENCES "RaceEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedSession" ADD CONSTRAINT "PlannedSession_completedActivityId_fkey" FOREIGN KEY ("completedActivityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_harderVariantId_fkey" FOREIGN KEY ("harderVariantId") REFERENCES "Exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramWorkout" ADD CONSTRAINT "ProgramWorkout_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramExerciseSlot" ADD CONSTRAINT "ProgramExerciseSlot_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "ProgramWorkout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramExerciseSlot" ADD CONSTRAINT "ProgramExerciseSlot_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPrefs" ADD CONSTRAINT "NotificationPrefs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachDebrief" ADD CONSTRAINT "CoachDebrief_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachChat" ADD CONSTRAINT "CoachChat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachMessage" ADD CONSTRAINT "CoachMessage_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "CoachChat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ActivityToGear" ADD CONSTRAINT "_ActivityToGear_A_fkey" FOREIGN KEY ("A") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ActivityToGear" ADD CONSTRAINT "_ActivityToGear_B_fkey" FOREIGN KEY ("B") REFERENCES "Gear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

