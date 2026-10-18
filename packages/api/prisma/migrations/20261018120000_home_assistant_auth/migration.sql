-- Users are authenticated by Home Assistant; local passwords are no longer used.
ALTER TABLE `User` DROP COLUMN `passwordHash`,
    ADD COLUMN `haUserId` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `User_haUserId_key` ON `User`(`haUserId`);
