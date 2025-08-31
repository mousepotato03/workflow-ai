# Canvas AI Integration Test Plan

## Overview
This document outlines the testing procedure for the newly integrated AI-powered canvas functionality, which connects real API endpoints to the canvas nodes.

## New Features Implemented

### 1. Real API Integration
- ✅ **Tool Recommendation**: Now uses `/api/tools/smart-recommend` with RAG-enhanced search
- ✅ **Guide Generation**: Now uses `/api/tools/[tool_id]/guide/stream` with real-time streaming
- ✅ **Tool Details**: Fetches actual tool information including logos and URLs

### 2. Enhanced UI Components
- ✅ **SubtaskNode**: Displays real tool logos, clickable URLs, and live progress
- ✅ **Progress Tracking**: Real-time streaming shows actual generation stages
- ✅ **Error Handling**: Comprehensive error messages and retry capabilities

### 3. Streaming Support  
- ✅ **Server-Sent Events**: Handles streaming progress from guide generation
- ✅ **Progress Stages**: Shows detailed status for each generation step
- ✅ **Fallback Mechanism**: Falls back to non-streaming API if needed

## Manual Testing Steps

### Test 1: Basic Workflow
1. Navigate to `/canvas` page
2. Click "Add Subtask" from toolbar
3. Double-click the new subtask node to edit
4. Enter a task like: "Create a React component for user authentication"
5. Click "Save"
6. Click "Generate Recommendations" button
7. **Verify**: Node shows "Analyzing" state with spinner and progress
8. **Verify**: Node updates to "Recommended" with actual tool name and logo
9. Click "Generate Guide" button  
10. **Verify**: Node shows "Generating Guide" with streaming progress updates
11. **Verify**: Guide card appears connected to subtask with markdown content

### Test 2: Tool Information Display
1. After successful recommendation (Test 1, steps 1-8)
2. Click the tool section to expand details
3. **Verify**: Tool logo displays (if available) or fallback icon shows
4. **Verify**: Tool URL is clickable and opens in new tab
5. **Verify**: Recommendation reason is displayed
6. **Verify**: Confidence bar shows percentage

### Test 3: Error Handling
1. Create a subtask with vague text like "do something"
2. Try generating recommendations
3. **Verify**: Either gets valid recommendation or shows helpful error
4. Try generating guide without tool recommendation
5. **Verify**: Auto-generates recommendation first, then guide
6. Test with network disconnected to verify error states

### Test 4: Streaming Progress
1. Create subtask: "Build a machine learning model for image classification"
2. Generate tool recommendation
3. Generate implementation guide
4. **Verify**: Progress shows these stages:
   - Tool lookup (15%)
   - Tool found (25%) 
   - Cache check (35%)
   - Web search (45%)
   - Search complete (60%)
   - Guide generation (75%)
   - Guide ready (90%)
   - Complete (100%)

### Test 5: Guide Content Quality
1. Test with various task types:
   - "Create a REST API with Node.js"
   - "Design a mobile app UI"
   - "Set up CI/CD pipeline"
   - "Implement data visualization dashboard"
2. **Verify**: Each generates relevant tool recommendations
3. **Verify**: Implementation guides are comprehensive and well-formatted
4. **Verify**: Markdown rendering works correctly in guide cards

## API Integration Verification

### Smart Recommendation API
- **Endpoint**: `POST /api/tools/smart-recommend`
- **Features Used**: 
  - RAG-enhanced search (`enableRAG: true`)
  - Adaptive query processing (`enableAdaptive: true`)
  - Fallback mechanism (`fallbackToLegacy: true`)
- **Expected Response**: Tool ID, name, confidence score, reasoning

### Streaming Guide API  
- **Endpoint**: `POST /api/tools/[tool_id]/guide/stream`
- **Features Used**:
  - Server-Sent Events for real-time progress
  - Structured guide content with sections
  - Source URLs and confidence scoring
- **Expected Response**: Streamed progress events + final guide data

### Tool Details API
- **Endpoint**: `GET /api/tools/[tool_id]`
- **Features Used**: Logo URLs, website links, tool metadata
- **Expected Response**: Tool name, description, logo_url, url

## Success Criteria

✅ **Functional Requirements**:
- [ ] Tool recommendations work for various task types
- [ ] Guide generation completes successfully with streaming progress
- [ ] Tool logos and URLs display correctly
- [ ] Error states are handled gracefully
- [ ] Generated guides are relevant and well-formatted

✅ **Performance Requirements**:
- [ ] Recommendation generation completes within 10 seconds
- [ ] Guide generation shows progress updates every few seconds
- [ ] UI remains responsive during API calls
- [ ] Streaming doesn't cause memory leaks

✅ **User Experience**:
- [ ] Clear visual feedback for all states (idle, loading, success, error)
- [ ] Progress indicators provide meaningful information
- [ ] Error messages are actionable
- [ ] Generated content is immediately usable

## Known Limitations
1. Tool logo fallback to generic icon when image fails to load
2. Guide generation may timeout for very complex tasks
3. Streaming progress depends on network conditions
4. Some tools may not have complete metadata

## Future Enhancements
1. Tool selection modal for manual override
2. Guide editing with live preview
3. Export guides to external formats
4. Collaborative editing features
5. Guide templates and customization options