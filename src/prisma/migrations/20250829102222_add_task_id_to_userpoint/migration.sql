-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_userpoint" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "task_id" INTEGER,
    CONSTRAINT "userpoint_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "userpoint_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_userpoint" ("created_at", "id", "points", "reason", "user_id") SELECT "created_at", "id", "points", "reason", "user_id" FROM "userpoint";
DROP TABLE "userpoint";
ALTER TABLE "new_userpoint" RENAME TO "userpoint";
CREATE INDEX "userpoint_user_id_idx" ON "userpoint"("user_id");
CREATE INDEX "userpoint_task_id_idx" ON "userpoint"("task_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
