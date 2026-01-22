CREATE TABLE IF NOT EXISTS `phone_contacts` (
  `_id` VARCHAR(64) NOT NULL,
  `ownerId` VARCHAR(64) DEFAULT NULL,
  `personalNumber` VARCHAR(20) DEFAULT NULL,
  `contactNumber` VARCHAR(20) DEFAULT NULL,
  `firstName` VARCHAR(50) DEFAULT NULL,
  `lastName` VARCHAR(50) DEFAULT NULL,
  `image` LONGTEXT DEFAULT NULL,
  `notes` LONGTEXT DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `isFav` TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`_id`),
  KEY `ownerId` (`ownerId`),
  KEY `personalNumber` (`personalNumber`),
  KEY `contactNumber` (`contactNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `phone_business` (
  `_id` VARCHAR(64) NOT NULL DEFAULT (UUID()),
  `ownerCitizenId` VARCHAR(64) DEFAULT NULL,
  `businessName` VARCHAR(100) DEFAULT NULL,
  `businessDescription` LONGTEXT DEFAULT NULL,
  `businessType` VARCHAR(50) DEFAULT NULL,
  `businessLogo` LONGTEXT DEFAULT NULL,
  `businessPhoneNumber` VARCHAR(20) DEFAULT NULL,
  `businessAddress` LONGTEXT DEFAULT NULL,
  `generateBusinessEmail` TINYINT(1) DEFAULT 0,
  `businessEmail` VARCHAR(100) DEFAULT NULL,
  `coords` LONGTEXT DEFAULT NULL,
  `job` VARCHAR(50) DEFAULT NULL,
  PRIMARY KEY (`businessName`), -- Code does findOne by businessName frequently
  KEY `ownerCitizenId` (`ownerCitizenId`),
  KEY `job` (`job`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `phone_mail` (
  `_id` VARCHAR(100) NOT NULL, -- This seems to be email sometimes, or uuid
  `activeMaidId` VARCHAR(100) DEFAULT NULL,
  `activeMailPassword` VARCHAR(100) DEFAULT NULL,
  `username` VARCHAR(100) DEFAULT NULL,
  `avatar` LONGTEXT DEFAULT NULL,
  `messages` LONGTEXT DEFAULT NULL, -- Array of messages
  PRIMARY KEY (`_id`),
  KEY `activeMaidId` (`activeMaidId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `phone_business_users` (
  `citizenid` VARCHAR(64) NOT NULL,
  `jobCalls` TINYINT(1) DEFAULT 1,
  PRIMARY KEY (`citizenid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `phone_multijobs` (
  `_id` VARCHAR(64) NOT NULL,
  `citizenId` VARCHAR(64) DEFAULT NULL,
  `jobName` VARCHAR(50) DEFAULT NULL,
  `gradeLevel` INT DEFAULT 0,
  `gradeLabel` VARCHAR(50) DEFAULT NULL,
  `jobLabel` VARCHAR(50) DEFAULT NULL,
  PRIMARY KEY (`_id`),
  KEY `citizenId` (`citizenId`),
  KEY `jobName` (`jobName`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `summit_jobs` (
  `_id` VARCHAR(64) NOT NULL,
  `jobName` VARCHAR(50) DEFAULT NULL,
  `data` LONGTEXT DEFAULT NULL, -- Stores the rest of the job object
  PRIMARY KEY (`_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `call_history` (
  `id` INT AUTO_INCREMENT,
  `callId` BIGINT DEFAULT NULL, -- Changed to BIGINT for large numbers
  `role` VARCHAR(20) DEFAULT NULL,
  `myPhoneNumber` VARCHAR(20) DEFAULT NULL,
  `otherPartyPhoneNumber` VARCHAR(20) DEFAULT NULL,
  `status` VARCHAR(20) DEFAULT NULL,
  `callTime` INT DEFAULT 0,
  `callTimestamp` VARCHAR(64) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `myPhoneNumber` (`myPhoneNumber`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `phone_bluepages` (
  `_id` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) DEFAULT NULL,
  `content` LONGTEXT DEFAULT NULL,
  `imageAttachment` LONGTEXT DEFAULT NULL,
  `phoneNumber` VARCHAR(20) DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `createdAt` VARCHAR(64) DEFAULT NULL,
  PRIMARY KEY (`_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `phone_darkchat_mail` (
  `_id` VARCHAR(100) NOT NULL, -- email
  `email` VARCHAR(100) DEFAULT NULL,
  `password` VARCHAR(100) DEFAULT NULL,
  `avatar` LONGTEXT DEFAULT NULL,
  PRIMARY KEY (`_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `phone_darkchat_channels` (
  `_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(100) DEFAULT NULL,
  `members` LONGTEXT DEFAULT NULL,
  `creator` VARCHAR(100) DEFAULT NULL,
  `createdAt` VARCHAR(64) DEFAULT NULL,
  `messages` LONGTEXT DEFAULT NULL,
  PRIMARY KEY (`_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `phone_settings` (
  `_id` VARCHAR(64) NOT NULL, -- citizenId
  `background` LONGTEXT DEFAULT NULL,
  `lockscreen` LONGTEXT DEFAULT NULL,
  `ringtone` LONGTEXT DEFAULT NULL,
  `showStartupScreen` TINYINT(1) DEFAULT 1,
  `showNotifications` TINYINT(1) DEFAULT 1,
  `isLock` TINYINT(1) DEFAULT 1,
  `lockPin` VARCHAR(10) DEFAULT NULL,
  `usePin` TINYINT(1) DEFAULT 0,
  `useFaceId` TINYINT(1) DEFAULT 0,
  `faceIdIdentifier` VARCHAR(64) DEFAULT NULL,
  `darkMailIdAttached` VARCHAR(100) DEFAULT NULL,
  `smrtId` VARCHAR(100) DEFAULT NULL,
  `smrtPassword` VARCHAR(100) DEFAULT NULL,
  `isFlightMode` TINYINT(1) DEFAULT 0,
  `phoneNumber` VARCHAR(20) DEFAULT NULL,
  `pigeonIdAttached` VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (`_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `phone_pigeon_users` (
  `_id` VARCHAR(64) NOT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `password` VARCHAR(100) DEFAULT NULL,
  `username` VARCHAR(100) DEFAULT NULL,
  `displayName` VARCHAR(100) DEFAULT NULL,
  `avatar` LONGTEXT DEFAULT NULL,
  `banner` LONGTEXT DEFAULT NULL,
  `bio` LONGTEXT DEFAULT NULL,
  `verified` TINYINT(1) DEFAULT 0,
  `notificationsEnabled` TINYINT(1) DEFAULT 1,
  `followers` LONGTEXT DEFAULT NULL,
  `following` LONGTEXT DEFAULT NULL,
  `createdAt` VARCHAR(64) DEFAULT NULL,
  PRIMARY KEY (`_id`),
  KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `phone_pigeon_tweets` (
  `_id` VARCHAR(64) NOT NULL,
  `username` VARCHAR(100) DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `avatar` LONGTEXT DEFAULT NULL,
  `verified` TINYINT(1) DEFAULT 0,
  `content` LONGTEXT DEFAULT NULL,
  `attachments` LONGTEXT DEFAULT NULL,
  `createdAt` VARCHAR(64) DEFAULT NULL,
  `likeCount` LONGTEXT DEFAULT NULL,
  `repliesCount` LONGTEXT DEFAULT NULL,
  `retweetCount` LONGTEXT DEFAULT NULL,
  `isRetweet` TINYINT(1) DEFAULT 0,
  `originalTweetId` VARCHAR(64) DEFAULT NULL,
  `hashtags` LONGTEXT DEFAULT NULL,
  `parentTweetId` VARCHAR(64) DEFAULT NULL,
  PRIMARY KEY (`_id`),
  KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `phone_pigeon_tweets_replies` (
  `_id` VARCHAR(64) NOT NULL,
  `username` VARCHAR(100) DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `avatar` LONGTEXT DEFAULT NULL,
  `verified` TINYINT(1) DEFAULT 0,
  `content` LONGTEXT DEFAULT NULL,
  `attachments` LONGTEXT DEFAULT NULL,
  `createdAt` VARCHAR(64) DEFAULT NULL,
  `likeCount` LONGTEXT DEFAULT NULL,
  `repliesCount` LONGTEXT DEFAULT NULL,
  `retweetCount` LONGTEXT DEFAULT NULL,
  `isRetweet` TINYINT(1) DEFAULT 0,
  `originalTweetId` VARCHAR(64) DEFAULT NULL,
  `hashtags` LONGTEXT DEFAULT NULL,
  `parentTweetId` VARCHAR(64) DEFAULT NULL,
  PRIMARY KEY (`_id`),
  KEY `originalTweetId` (`originalTweetId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `phone_pigeon_notifications` (
  `_id` VARCHAR(64) NOT NULL,
  `content` LONGTEXT DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `type` VARCHAR(50) DEFAULT NULL,
  `createdAt` VARCHAR(64) DEFAULT NULL,
  PRIMARY KEY (`_id`),
  KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `phone_pigeon_private_messages` (
  `_id` VARCHAR(64) NOT NULL,
  `senderEmail` VARCHAR(100) DEFAULT NULL,
  `recipientEmail` VARCHAR(100) DEFAULT NULL,
  `content` LONGTEXT DEFAULT NULL,
  `attachments` LONGTEXT DEFAULT NULL,
  `createdAt` VARCHAR(64) DEFAULT NULL,
  `read` TINYINT(1) DEFAULT 0,
  `deletedBySender` TINYINT(1) DEFAULT 0,
  `deletedByRecipient` TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`_id`),
  KEY `senderEmail` (`senderEmail`),
  KEY `recipientEmail` (`recipientEmail`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `phone_bank_user` (
  `_id` VARCHAR(64) NOT NULL,
  `citizenId` VARCHAR(64) DEFAULT NULL,
  `name` VARCHAR(100) DEFAULT NULL,
  `cardNumber` VARCHAR(30) DEFAULT NULL,
  `cardPin` VARCHAR(10) DEFAULT NULL,
  `bankAccount` VARCHAR(30) DEFAULT NULL,
  `balance` INT DEFAULT 0,
  PRIMARY KEY (`_id`),
  KEY `citizenId` (`citizenId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `phone_bank_transactions` (
  `_id` VARCHAR(64) NOT NULL,
  `from` VARCHAR(64) DEFAULT NULL,
  `to` VARCHAR(64) DEFAULT NULL,
  `amount` INT DEFAULT 0,
  `type` VARCHAR(20) DEFAULT NULL,
  `date` VARCHAR(64) DEFAULT NULL,
  PRIMARY KEY (`_id`),
  KEY `from` (`from`),
  KEY `to` (`to`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `phone_bank_invoices` (
  `_id` VARCHAR(64) NOT NULL,
  `from` VARCHAR(64) DEFAULT NULL,
  `to` VARCHAR(64) DEFAULT NULL,
  `amount` INT DEFAULT 0,
  `status` VARCHAR(20) DEFAULT NULL,
  `isBusiness` VARCHAR(10) DEFAULT NULL,
  `sourceName` VARCHAR(100) DEFAULT NULL,
  `targetName` VARCHAR(100) DEFAULT NULL,
  `description` LONGTEXT DEFAULT NULL,
  `paymentTime` VARCHAR(20) DEFAULT NULL,
  `numberOfPayments` VARCHAR(20) DEFAULT NULL,
  `date` VARCHAR(64) DEFAULT NULL,
  `remainingPayments` INT DEFAULT 0,
  `nextPaymentDate` VARCHAR(64) DEFAULT NULL,
  `lastAttemptAt` VARCHAR(64) DEFAULT NULL,
  `failedAttempts` INT DEFAULT 0,
  `createdAt` VARCHAR(64) DEFAULT NULL,
  PRIMARY KEY (`_id`),
  KEY `from` (`from`),
  KEY `to` (`to`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `heartsync_profiles` (
  `_id` VARCHAR(64) NOT NULL,
  `citizenId` VARCHAR(64) DEFAULT NULL,
  `name` VARCHAR(100) DEFAULT NULL,
  `age` INT DEFAULT 18,
  `gender` VARCHAR(20) DEFAULT NULL,
  `bio` LONGTEXT DEFAULT NULL,
  `photos` LONGTEXT DEFAULT NULL,
  `interests` LONGTEXT DEFAULT NULL,
  `lookingFor` VARCHAR(50) DEFAULT NULL,
  `interestedInGenders` LONGTEXT DEFAULT NULL,
  `ageRangeMin` INT DEFAULT 18,
  `ageRangeMax` INT DEFAULT 99,
  `maxDistance` INT DEFAULT 50,
  `showOnline` TINYINT(1) DEFAULT 1,
  `work` VARCHAR(100) DEFAULT NULL,
  `school` VARCHAR(100) DEFAULT NULL,
  `height` INT DEFAULT 0,
  `zodiacSign` VARCHAR(50) DEFAULT NULL,
  `lifestyle` LONGTEXT DEFAULT NULL,
  `prompts` LONGTEXT DEFAULT NULL,
  `verified` TINYINT(1) DEFAULT 0,
  `premium` TINYINT(1) DEFAULT 0,
  `superLikesRemaining` INT DEFAULT 0,
  `likesRemaining` INT DEFAULT 0,
  `dailySwipes` INT DEFAULT 0,
  `lastSwipeReset` VARCHAR(64) DEFAULT NULL,
  `createdAt` VARCHAR(64) DEFAULT NULL,
  `lastActive` VARCHAR(64) DEFAULT NULL,
  `isActive` TINYINT(1) DEFAULT 1,
  PRIMARY KEY (`_id`),
  KEY `citizenId` (`citizenId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `heartsync_swipes` (
  `_id` VARCHAR(64) NOT NULL,
  `fromUserId` VARCHAR(64) DEFAULT NULL,
  `toUserId` VARCHAR(64) DEFAULT NULL,
  `isLike` TINYINT(1) DEFAULT 0,
  `isSuperLike` TINYINT(1) DEFAULT 0,
  `timestamp` VARCHAR(64) DEFAULT NULL,
  PRIMARY KEY (`_id`),
  KEY `fromUserId` (`fromUserId`),
  KEY `toUserId` (`toUserId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `heartsync_matches` (
  `_id` VARCHAR(64) NOT NULL,
  `user1Id` VARCHAR(64) DEFAULT NULL,
  `user2Id` VARCHAR(64) DEFAULT NULL,
  `matchedAt` VARCHAR(64) DEFAULT NULL,
  `isActive` TINYINT(1) DEFAULT 1,
  `isSuperLike` TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `heartsync_messages` (
  `_id` VARCHAR(64) NOT NULL,
  `senderId` VARCHAR(64) DEFAULT NULL,
  `receiverId` VARCHAR(64) DEFAULT NULL,
  `matchId` VARCHAR(64) DEFAULT NULL,
  `content` LONGTEXT DEFAULT NULL,
  `timestamp` VARCHAR(64) DEFAULT NULL,
  `read` TINYINT(1) DEFAULT 0,
  PRIMARY KEY (`_id`),
  KEY `matchId` (`matchId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `phone_messages` (
  `_id` VARCHAR(64) NOT NULL,
  `citizenId` VARCHAR(64) DEFAULT NULL,
  `blockedNumbers` LONGTEXT DEFAULT NULL,
  `deletedMessages` LONGTEXT DEFAULT NULL,
  `messages` LONGTEXT DEFAULT NULL,
  PRIMARY KEY (`_id`),
  KEY `citizenId` (`citizenId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `phone_numbers` (
  `_id` VARCHAR(64) NOT NULL,
  `owner` VARCHAR(64) DEFAULT NULL,
  `number` VARCHAR(20) DEFAULT NULL,
  PRIMARY KEY (`_id`),
  KEY `owner` (`owner`),
  KEY `number` (`number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `phone_player_card` (
  `_id` VARCHAR(64) NOT NULL,
  `firstName` VARCHAR(50) DEFAULT NULL,
  `lastName` VARCHAR(50) DEFAULT NULL,
  `phoneNumber` VARCHAR(20) DEFAULT NULL,
  `email` VARCHAR(100) DEFAULT NULL,
  `notes` LONGTEXT DEFAULT NULL,
  `avatar` LONGTEXT DEFAULT NULL,
  PRIMARY KEY (`_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `phone_photos` (
  `_id` VARCHAR(64) NOT NULL,
  `citizenId` VARCHAR(64) DEFAULT NULL,
  `link` LONGTEXT DEFAULT NULL,
  `date` VARCHAR(64) DEFAULT NULL,
  PRIMARY KEY (`_id`),
  KEY `citizenId` (`citizenId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `phone_blocked_numbers` (
  `_id` VARCHAR(64) NOT NULL,
  `citizenId` VARCHAR(64) DEFAULT NULL,
  `targetCitizenId` VARCHAR(64) DEFAULT NULL,
  PRIMARY KEY (`_id`),
  KEY `citizenId` (`citizenId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
