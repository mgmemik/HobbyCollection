-- Migration: AddMessagingSystem
-- Date: 2025-01-23
-- Description: Creates Conversations and Messages tables for messaging system

-- Conversations tablosunu oluştur
CREATE TABLE IF NOT EXISTS "Conversations" (
    "Id" uuid NOT NULL,
    "User1Id" TEXT NOT NULL,
    "User2Id" TEXT NOT NULL,
    "LastMessageText" TEXT NULL,
    "LastMessageAt" timestamp with time zone NULL,
    "LastMessageSenderId" TEXT NULL,
    "UnreadCountUser1" integer NOT NULL DEFAULT 0,
    "UnreadCountUser2" integer NOT NULL DEFAULT 0,
    "IsDeletedByUser1" boolean NOT NULL DEFAULT false,
    "IsDeletedByUser2" boolean NOT NULL DEFAULT false,
    "CreatedAt" timestamp with time zone NOT NULL,
    "UpdatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Conversations" PRIMARY KEY ("Id")
);

-- Conversations için indexler
CREATE UNIQUE INDEX IF NOT EXISTS "IX_Conversations_User1Id_User2Id" ON "Conversations" ("User1Id", "User2Id");
CREATE INDEX IF NOT EXISTS "IX_Conversations_User1Id" ON "Conversations" ("User1Id");
CREATE INDEX IF NOT EXISTS "IX_Conversations_User2Id" ON "Conversations" ("User2Id");
CREATE INDEX IF NOT EXISTS "IX_Conversations_LastMessageAt" ON "Conversations" ("LastMessageAt");
CREATE INDEX IF NOT EXISTS "IX_Conversations_User1Id_LastMessageAt" ON "Conversations" ("User1Id", "LastMessageAt");
CREATE INDEX IF NOT EXISTS "IX_Conversations_User2Id_LastMessageAt" ON "Conversations" ("User2Id", "LastMessageAt");

-- Messages tablosunu oluştur
CREATE TABLE IF NOT EXISTS "Messages" (
    "Id" uuid NOT NULL,
    "ConversationId" uuid NOT NULL,
    "SenderId" TEXT NOT NULL,
    "ReceiverId" TEXT NOT NULL,
    "Type" integer NOT NULL DEFAULT 0,
    "Content" TEXT NOT NULL,
    "IsRead" boolean NOT NULL DEFAULT false,
    "ReadAt" timestamp with time zone NULL,
    "CreatedAt" timestamp with time zone NOT NULL,
    CONSTRAINT "PK_Messages" PRIMARY KEY ("Id"),
    CONSTRAINT "FK_Messages_Conversations_ConversationId" FOREIGN KEY ("ConversationId") REFERENCES "Conversations" ("Id") ON DELETE CASCADE
);

-- Messages için indexler
CREATE INDEX IF NOT EXISTS "IX_Messages_ConversationId" ON "Messages" ("ConversationId");
CREATE INDEX IF NOT EXISTS "IX_Messages_SenderId" ON "Messages" ("SenderId");
CREATE INDEX IF NOT EXISTS "IX_Messages_ReceiverId" ON "Messages" ("ReceiverId");
CREATE INDEX IF NOT EXISTS "IX_Messages_CreatedAt" ON "Messages" ("CreatedAt");
CREATE INDEX IF NOT EXISTS "IX_Messages_ConversationId_CreatedAt" ON "Messages" ("ConversationId", "CreatedAt");
CREATE INDEX IF NOT EXISTS "IX_Messages_ReceiverId_IsRead" ON "Messages" ("ReceiverId", "IsRead");

-- Migration history'ye ekle
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20250123000000_AddMessagingSystem', '8.0.0')
ON CONFLICT ("MigrationId") DO NOTHING;

SELECT 'Migration completed successfully!' AS result;

