-- Enable pgvector extension for embedding search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create workflows table
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    goal TEXT NOT NULL CHECK (length(goal) >= 10 AND length(goal) <= 200),
    language TEXT NOT NULL DEFAULT 'ko',
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    metadata JSONB DEFAULT '{}'
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    order_index INTEGER NOT NULL CHECK (order_index >= 1 AND order_index <= 5),
    name TEXT NOT NULL,
    description TEXT,
    
    UNIQUE(workflow_id, order_index)
);

-- Create tools table
CREATE TABLE IF NOT EXISTS tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    url TEXT,
    logo_url TEXT,
    categories TEXT[] DEFAULT '{}',
    pros TEXT[] DEFAULT '{}',
    cons TEXT[] DEFAULT '{}',
    embedding_text TEXT,
    recommendation_tip TEXT,
    embedding VECTOR(768),
    is_active BOOLEAN DEFAULT true
);

-- Create recommendations table
CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    tool_id UUID REFERENCES tools(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    reason TEXT NOT NULL,
    confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
    alternatives JSONB DEFAULT '[]',
    
    UNIQUE(task_id)
);

-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    metadata JSONB DEFAULT '{}',
    
    UNIQUE(workflow_id)
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflows_language ON workflows(language);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);

CREATE INDEX IF NOT EXISTS idx_tasks_workflow_id ON tasks(workflow_id);
CREATE INDEX IF NOT EXISTS idx_tasks_order ON tasks(workflow_id, order_index);

CREATE INDEX IF NOT EXISTS idx_tools_name ON tools(name);
CREATE INDEX IF NOT EXISTS idx_tools_categories ON tools USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_tools_active ON tools(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tools_embedding ON tools USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_recommendations_task_id ON recommendations(task_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_tool_id ON recommendations(tool_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_confidence ON recommendations(confidence_score DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_workflow_id ON feedback(workflow_id);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(rating);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- Create function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for tools table updated_at
DROP TRIGGER IF EXISTS update_tools_updated_at ON tools;
CREATE TRIGGER update_tools_updated_at 
    BEFORE UPDATE ON tools
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to update workflow status
CREATE OR REPLACE FUNCTION update_workflow_status()
RETURNS TRIGGER AS $$
DECLARE
    total_tasks INTEGER;
    completed_recommendations INTEGER;
    target_workflow_id UUID;
BEGIN
    -- Get workflow_id from task
    IF TG_OP = 'DELETE' THEN
        SELECT workflow_id INTO target_workflow_id FROM tasks WHERE id = OLD.task_id;
    ELSE
        SELECT workflow_id INTO target_workflow_id FROM tasks WHERE id = NEW.task_id;
    END IF;
    
    -- Count total tasks for the workflow
    SELECT COUNT(*) INTO total_tasks 
    FROM tasks 
    WHERE workflow_id = target_workflow_id;
    
    -- Count completed recommendations
    SELECT COUNT(*) INTO completed_recommendations
    FROM recommendations r
    JOIN tasks t ON r.task_id = t.id
    WHERE t.workflow_id = target_workflow_id;
    
    -- Update workflow status if all tasks have recommendations
    IF total_tasks = completed_recommendations THEN
        UPDATE workflows 
        SET status = 'completed' 
        WHERE id = target_workflow_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for workflow status updates
DROP TRIGGER IF EXISTS trigger_update_workflow_status ON recommendations;
CREATE TRIGGER trigger_update_workflow_status
    AFTER INSERT OR DELETE ON recommendations
    FOR EACH ROW
    EXECUTE FUNCTION update_workflow_status();

-- Enable Row Level Security (RLS)
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for MVP (public read access)
DROP POLICY IF EXISTS "Public read access" ON workflows;
CREATE POLICY "Public read access" ON workflows FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access" ON tasks;
CREATE POLICY "Public read access" ON tasks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access" ON tools;
CREATE POLICY "Public read access" ON tools FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access" ON recommendations;
CREATE POLICY "Public read access" ON recommendations FOR SELECT USING (true);

-- Service role policies for data modification
DROP POLICY IF EXISTS "Service role insert" ON workflows;
CREATE POLICY "Service role insert" ON workflows FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role insert" ON tasks;
CREATE POLICY "Service role insert" ON tasks FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role insert" ON recommendations;
CREATE POLICY "Service role insert" ON recommendations FOR INSERT WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role insert" ON feedback;
CREATE POLICY "Service role insert" ON feedback FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Admin only policy for tools management
DROP POLICY IF EXISTS "Admin only modify" ON tools;
CREATE POLICY "Admin only modify" ON tools FOR ALL USING (auth.role() = 'service_role'); 