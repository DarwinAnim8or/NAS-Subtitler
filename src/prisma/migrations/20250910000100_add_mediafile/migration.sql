-- CreateTable
CREATE TABLE "mediafile" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "dirRel" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "size" INTEGER,
  "mtime" DATETIME,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "mediafile_dirRel_name_key" ON "mediafile"("dirRel","name");