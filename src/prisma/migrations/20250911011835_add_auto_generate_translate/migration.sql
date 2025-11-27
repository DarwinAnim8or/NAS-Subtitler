-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_mediafile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "dirRel" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "size" INTEGER,
    "mtime" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_mediafile" ("created_at", "dirRel", "id", "mtime", "name", "sequence", "size", "updated_at") SELECT "created_at", "dirRel", "id", "mtime", "name", "sequence", "size", "updated_at" FROM "mediafile";
DROP TABLE "mediafile";
ALTER TABLE "new_mediafile" RENAME TO "mediafile";
CREATE UNIQUE INDEX "mediafile_dirRel_name_key" ON "mediafile"("dirRel", "name");
CREATE TABLE "new_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL DEFAULT 'singleton',
    "svc" TEXT NOT NULL DEFAULT 'openai',
    "openaiKey" TEXT,
    "auto" BOOLEAN NOT NULL DEFAULT false,
    "autoGenerate" BOOLEAN NOT NULL DEFAULT false,
    "autoTranslate" BOOLEAN NOT NULL DEFAULT false,
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
INSERT INTO "new_settings" ("auto", "created_at", "id", "key", "model", "openaiKey", "polish", "profile", "prompt", "skipIfHasSubtitle", "srcLang", "svc", "tgtLang", "updated_at") SELECT "auto", "created_at", "id", "key", "model", "openaiKey", "polish", "profile", "prompt", "skipIfHasSubtitle", "srcLang", "svc", "tgtLang", "updated_at" FROM "settings";
DROP TABLE "settings";
ALTER TABLE "new_settings" RENAME TO "settings";
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
