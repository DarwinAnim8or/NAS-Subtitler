-- CreateTable
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL DEFAULT 'singleton',
    "svc" TEXT NOT NULL DEFAULT 'openai',
    "openaiKey" TEXT,
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "skipIfHasSubtitle" BOOLEAN NOT NULL DEFAULT false,
    "srcLang" TEXT,
    "tgtLang" TEXT,
    "model" TEXT,
    "profile" TEXT,
    "prompt" TEXT,
    "polish" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");
