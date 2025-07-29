-- Create inquiry_type ENUM
CREATE TYPE inquiry_type AS ENUM ('general', 'partnership', 'support', 'feedback');

-- Create inquiries table for all contact/inquiry submissions
CREATE TABLE IF NOT EXISTS inquiries (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    inquiry_type inquiry_type NOT NULL DEFAULT 'general',
    email TEXT NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    message TEXT NOT NULL CHECK (char_length(message) >= 10 AND char_length(message) <= 2000),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Optional: logged-in users
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inquiries_type ON inquiries(inquiry_type);
CREATE INDEX IF NOT EXISTS idx_inquiries_user_id ON inquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries(created_at DESC);

-- Create updated_at trigger
CREATE TRIGGER update_inquiries_updated_at 
    BEFORE UPDATE ON inquiries
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Anyone can create inquiries" ON inquiries;
CREATE POLICY "Anyone can create inquiries" 
    ON inquiries FOR INSERT 
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own inquiries" ON inquiries;
CREATE POLICY "Users can view their own inquiries" 
    ON inquiries FOR SELECT 
    USING (auth.uid() = user_id OR user_id IS NULL);

-- Admin policy for managing all inquiries (commented for now)
-- DROP POLICY IF EXISTS "Admins can manage all inquiries" ON inquiries;
-- CREATE POLICY "Admins can manage all inquiries" 
--     ON inquiries FOR ALL 
--     USING (auth.jwt()->>'role' = 'admin'); 