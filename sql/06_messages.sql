-- Messages system for direct messaging between users
-- Run this AFTER 01_base_tables.sql, 02_functions.sql, and 03_additional_tables.sql

-- Conversation table: Stores 1-on-1 conversations between users
CREATE TABLE IF NOT EXISTS conversation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure user1_id < user2_id to prevent duplicate conversations
  CONSTRAINT conversation_users_order CHECK (user1_id < user2_id),
  -- Ensure users can't have a conversation with themselves
  CONSTRAINT conversation_no_self CHECK (user1_id != user2_id),
  -- Unique constraint: one conversation per pair of users
  UNIQUE(user1_id, user2_id)
);

-- Message table: Stores individual messages in conversations
CREATE TABLE IF NOT EXISTS message (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversation(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversation_user1_id ON conversation(user1_id);
CREATE INDEX IF NOT EXISTS idx_conversation_user2_id ON conversation(user2_id);
CREATE INDEX IF NOT EXISTS idx_conversation_updated_at ON conversation(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_conversation_id ON message(conversation_id);
CREATE INDEX IF NOT EXISTS idx_message_sender_id ON message(sender_id);
CREATE INDEX IF NOT EXISTS idx_message_created_at ON message(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_read_at ON message(read_at) WHERE read_at IS NULL;

-- Enable RLS
ALTER TABLE conversation ENABLE ROW LEVEL SECURITY;
ALTER TABLE message ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversation table
-- Users can read conversations they're part of
CREATE POLICY "Users can read own conversations" ON conversation
  FOR SELECT USING (
    auth.uid() = user1_id OR auth.uid() = user2_id
  );

-- Users can create conversations (as user1_id or user2_id)
CREATE POLICY "Users can create conversations" ON conversation
  FOR INSERT WITH CHECK (
    auth.uid() = user1_id OR auth.uid() = user2_id
  );

-- Users can update conversations they're part of (for updated_at)
CREATE POLICY "Users can update own conversations" ON conversation
  FOR UPDATE USING (
    auth.uid() = user1_id OR auth.uid() = user2_id
  );

-- RLS Policies for message table
-- Users can read messages from conversations they're part of
CREATE POLICY "Users can read messages from own conversations" ON message
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation c
      WHERE c.id = message.conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

-- Users can create messages in conversations they're part of
CREATE POLICY "Users can create messages in own conversations" ON message
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM conversation c
      WHERE c.id = message.conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );

-- Users can update their own messages (for editing)
CREATE POLICY "Users can update own messages" ON message
  FOR UPDATE USING (auth.uid() = sender_id);

-- Users can mark messages as read (update read_at)
CREATE POLICY "Users can mark messages as read" ON message
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversation c
      WHERE c.id = message.conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND auth.uid() != message.sender_id
    )
  );

-- Trigger to update conversation.updated_at when a message is created
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversation
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversation_updated_on_message
  AFTER INSERT ON message
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_on_message();

-- Trigger to update updated_at timestamp for conversation
CREATE OR REPLACE FUNCTION update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversation_updated_at
  BEFORE UPDATE ON conversation
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_updated_at();

-- Trigger to update updated_at timestamp for message
CREATE OR REPLACE FUNCTION update_message_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER message_updated_at
  BEFORE UPDATE ON message
  FOR EACH ROW
  EXECUTE FUNCTION update_message_updated_at();
