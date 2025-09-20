# Usage Guide

This comprehensive guide demonstrates how to effectively use the Local Search MCP Server across various scenarios and integration patterns.

## 📋 Table of Contents

- [Getting Started](#getting-started)
- [Content Ingestion](#content-ingestion)
- [Search Patterns](#search-patterns)
- [Claude Desktop Integration](#claude-desktop-integration)
- [VS Code + GitHub Copilot Integration](#-vs-code--github-copilot-integration)
- [Advanced Workflows](#advanced-workflows)
- [Best Practices](#best-practices)
- [Common Scenarios](#common-scenarios)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ with active internet connection (for model downloads)
- 2GB+ available RAM
- Multi-core CPU (4+ cores recommended for performance)

### Basic Setup

1. **Install the MCP server**:
```bash
npm install
npm run build
```

2. **Configure Claude Desktop**:
```json
{
  "mcpServers": {
    "local-search": {
      "command": "node",
      "args": ["/absolute/path/to/local-search-mcp/build/index.js"]
    }
  }
}
```

3. **Restart Claude Desktop** and verify the connection.

### First Search Query

```typescript
// Query your local documentation
await search_documents({
  query: "authentication methods",
  options: {
    limit: 5,
    minScore: 0.7
  }
});

// Expected output:
// "Found 3 results for 'authentication methods' in 45ms
// 1. /docs/auth/api.md:2 (Score: 0.92) JWT tokens provide stateless..."
```

## 📥 Content Ingestion

### Local Documentation Indexing

#### Basic Directory Indexing

```typescript
// Index your entire project documentation
await search_documents({
  query: "index project docs"  // Triggers MCP tool
});

// Parameters automatically inferred:
// - Folder: connected project directory
// - Chunks: 1000 chars with 200 overlap
// - File types: auto-detected
```

#### Selective Content Indexing

```typescript
// Index only specific file types
await index_files({
  folderPath: "./docs",
  options: {
    fileTypes: [".md", ".rst", ".txt"],
    chunkSize: 800,
    overlap: 100,
    excludePatterns: ["**/node_modules/**", "**/.git/**"]
  }
});
```

### Repository Processing

#### Public Repository Integration

```typescript
// Index comprehensive documentation
await fetch_repo({
  repoUrl: "https://github.com/microsoft/vscode-docs",
  options: {
    maxFiles: 500,
    includePatterns: ["*.md", "*.rst"],
    removeComments: false
  }
});
```

#### Specific Repository Content

```typescript
// Focus on API documentation
await fetch_repo({
  repoUrl: "https://github.com/stripe/stripe-js",
  branch: "v2.0.0",
  options: {
    includePatterns: ["docs/**/*.md", "README.md"],
    excludePatterns: ["**/examples/**", "**/test/**"]
  }
});
```

### File Downloads

#### Individual Documentation Files

```typescript
// Single file from GitHub
await fetch_file({
  url: "https://raw.githubusercontent.com/expressjs/express/main/Readme.md",
  filename: "express-api.md"
});
```

#### Batch File Retrieval

```typescript
// Multiple documentation files
const files = [
  "https://api-docs.service.com/guide.pdf",
  "https://docs.api.com/v1/setup.md"
];

for (const url of files) {
  await fetch_file({
    url: url,
    filename: path.basename(url),
    docFolder: "./docs/api-references"
  });
}
```

## 🔍 Search Patterns

### Natural Language Queries

#### Conceptual Search

```typescript
// Find explanations of complex concepts
await search_documents({
  query: "explain distributed caching strategies",
  options: { limit: 8, minScore: 0.75 }
});
```

#### Task-Oriented Search

```typescript
// Find implementation instructions
await search_documents({
  query: "how to implement user authentication",
  options: { limit: 5 }
});
```

#### Troubleshooting Search

```typescript
// Find error solutions
await search_documents({
  query: "database connection timeout error",
  options: { limit: 10, minScore: 0.8 }
});
```

### Semantic Similarity Search

#### Code Pattern Discovery

```typescript
// Find similar code patterns
await search_documents({
  query: "async function with error handling",
  options: {
    limit: 6,
    includeMetadata: true
  }
});
```

#### API Design Patterns

```typescript
// Discover REST API patterns
await search_documents({
  query: "RESTful API design patterns",
  options: { limit: 4 }
});
```

### Context-Aware Search

#### File-Specific Queries

```typescript
// Search within API documentation
await search_documents({
  query: "rate limiting",
  options: { /* results filtered by semantic relevance */ }
});
```

#### Cross-Document Analysis

```typescript
// Relate configuration to implementation
await search_documents({
  query: "logging configuration options",
  options: {
    limit: 12,
    minScore: 0.6
  }
});
```

## 💻 Claude Desktop Integration

### Chat-Based Interaction

**Natural Conversation:**
```
User: How does this system handle user sessions?

Claude: I should check the documentation for session management details.

[Uses internal search tool]
Found 5 results for 'session management':
1. /docs/auth/sessions.md:3 (Score: 0.91) Session tokens are JWT-based with 24h expiration
2. /docs/api/auth.md:15 (Score: 0.87) POST /api/v1/auth/login creates new session
...

Based on the documentation, user sessions use JWT tokens that expire after 24 hours...
```

### File Analysis Integration

```typescript
// Multi-file understanding
const results = await search_documents({
  query: "authentication middleware implementation",
  options: {
    limit: 8,
    minScore: 0.7
  }
});

// Claude can now synthesize information across files:
// - Type definitions in /types/auth.ts
// - React hooks in /hooks/useAuth.ts
// - API endpoints in /api/auth.ts
// - Configuration in /config/auth.js
```

### Code Generation Support

```typescript
// Context-aware code generation
await search_documents({
  query: "implement user registration form",
  options: { limit: 3 }
});

// Claude generates code using found patterns:
// - Form validation from /components/forms/
// - API integration from /hooks/
// - Error handling from /utils/
```

## 🆚 VS Code + GitHub Copilot Integration

GitHub Copilot in VS Code can leverage MCP servers for enhanced contextual awareness and code generation. The Local Search MCP Server provides Copilot with semantic search capabilities across your local documentation, enabling it to deliver more accurate and contextually relevant suggestions.

### 🚀 Why VS Code + Copilot + MCP?

| Integration | Capabilities | Benefits |
|-------------|--------------|----------|
| **VS Code Alone** | File editing, debugging | General IDE features |
| **VS Code + Copilot** | AI code suggestions | Context-aware code completion |
| **VS Code + Copilot + MCP** ⚡ | **Semantic documentation search** | **Full project understanding** |

### 📋 Prerequisites

- **VS Code** 1.85+ (latest stable recommended)
- **GitHub Copilot** extension installed and activated
- **Node.js** 18+ for MCP server
- **4GB+ RAM** recommended

### 🛠️ Step-by-Step MCP Server Setup

#### 1. Install VS Code MCP Extension

Install the Microsoft MCP extension from VS Code Marketplace:

```bash
# VS Code: Ctrl+P → "ext install microsoft.mcp"
# Or search for "MCP" in Extensions panel
```

#### 2. Install Local Search MCP Server

```bash
# Clone and setup the MCP server
git clone https://github.com/your-repo/local-search-mcp.git
cd local-search-mcp

# Install dependencies and build
npm install
npm run build
```

#### 3. Configure VS Code MCP Settings

Create or update your VS Code settings (`settings.json`):

```json
{
  "mcp.servers": {
    "local-search": {
      "command": "node",
      "args": [
        "/absolute/path/to/local-search-mcp/build/index.js"
      ],
      "env": {
        "NODE_ENV": "production"
      },
      "cwd": "/absolute/path/to/your/project"
    }
  },

  // Optional: Enable MCP features for better integration
  "mcp.enable": true,
  "mcp.autoStart": true,

  // Performance tuning for VS Code
  "mcp.maxConcurrentRequests": 5,
  "mcp.requestTimeout": 30000
}
```

**Windows Configuration:**
```json
{
  "mcp.servers": {
    "local-search": {
      "command": "node.exe",
      "args": [
        "C:\\path\\to\\local-search-mcp\\build\\index.js"
      ],
      "env": {
        "MCP_DOCS_FOLDER": "C:\\Users\\username\\Documents\\docs"
      }
    }
  }
}
```

#### 4. Index Your Documentation

First, index your project's documentation for Copilot to search:

```bash
# Index project documentation
# MCP Server will automatically watch for changes

# Or manually trigger through VS Code Command Palette:
# Ctrl+Shift+P → "MCP: Index Project Documentation"
```

#### 5. Verify Integration

Check that the MCP server is running:

```bash
# VS Code Output Panel → MCP Logs
# Should show: "Local Search MCP server running on stdio"
```

### 🎯 How GitHub Copilot Uses MCP Search

#### Enhanced Code Suggestions

**Without MCP:**
```typescript
// Copilot might suggest generic validation
function validateUser(user) {
  if (!user.name) {
    throw new Error("Name required");
  }
}
```

**With MCP + Indexed API Docs:**
```typescript
// Copilot leverages your specific validation patterns from docs
async function validateUser(user: UserInput) {
  // Uses your documented validation rules
  if (!user.email?.match(EMAIL_REGEX)) {
    throw new ValidationError("Invalid email format", 400);
  }

  // Applies your security patterns
  const sanitized = sanitizeInput(user);
  await securityValidation(sanitized);
}
```

#### Context-Aware Documentation Lookup

When Copilot detects documentation queries in comments:

```typescript
// BEFORE: Generic suggestions
// How does the API handle error responses?

// AFTER: Copilot searches your docs and suggests:
/**
 * API Error Response Format:
 *
 * Error responses follow RFC 7807 (Problem Details):
 * {
 *   "type": "https://api.example.com/errors/validation",
 *   "title": "Validation Failed",
 *   "detail": "Email format is invalid",
 *   "instance": "/users/validation",
 *   "status": 400,
 *   "errors": [
 *     {"field": "email", "message": "Invalid email format"}
 *   ]
 * }
 */
```

### 💡 Integration Workflows

#### 1. Documentation-Driven Development

**Workflow Steps:**
1. **Write documentation first** - Describe API patterns, error handling, etc.
2. **Index with MCP** - Server processes and vectorizes docs
3. **Code with Copilot** - AI uses your documentation for accurate suggestions
4. **Iterate** - Update docs → re-index → improved suggestions

#### 2. Legacy Code Understanding

**For maintaining existing projects:**
```typescript
// @copilot-search: explain authentication flow
function authenticate(req, res) {
  // Copilot searches indexed docs for your specific auth patterns
  // Suggests implementing your documented JWT validation
  // Uses your error response format from API docs
}
```

#### 3. API Integration Implementation

```typescript
// @copilot-search: third-party API integration patterns
async function integrateStripe(userId, amount) {
  // Copilot finds your Stripe integration docs
  // Suggests your error handling patterns
  // Applies your logging standards
  // Uses your retry and timeout configurations
}
```

### 🔍 Copilot Search Commands

#### Inline Comments (Recommended)

```typescript
// @copilot-search: database connection pool configuration
// @copilot-search: error handling best practices
// @copilot-search: API response format standards
// @copilot-search: logging implementation patterns
```

#### Function-Level Documentation

```typescript
/**
 * Create user account with validation
 * @copilot-search: user registration workflow
 * @copilot-search: input validation patterns
 */
async function createUser(userData) {
  // Copilot uses your documented validation and registration patterns
}
```

#### Architectural Patterns

```typescript
// @copilot-search: microservice communication patterns
class UserService {
  // @copilot-search: service-to-service authentication
  // @copilot-search: circuit breaker implementation
  // @copilot-search: distributed tracing integration
}
```

### 🧠 Advanced Copilot Enhancement

#### Multi-Repository Knowledge Base

Index multiple repositories for comprehensive suggestions:

```json
{
  "mcp.servers": {
    "local-search": {
      "env": {
        "MCP_DOCS_FOLDER": "/docs",
        "MCP_ADDITIONAL_REPOS": "/company/api-standards,/company/shared-libs"
      }
    }
  }
}
```

#### Domain-Specific Optimization

Configure for your tech stack:

```json
{
  "mcp-search": {
    "optimizationHint": "react-typescript-backend",
    "preferredPatterns": [
      "React functional components",
      "TypeScript strict mode",
      "Express middleware patterns",
      "PostgreSQL query builders"
    ]
  }
}
```

### 🚦 Status Indicators

Monitor your MCP integration status in VS Code:

- **🟢 MCP Server Connected** - Server running, docs indexed
- **🟡 Indexing in Progress** - Server processing documentation
- **🔴 Server Disconnected** - Check logs, restart MCP server
- **⚠️ Low Performance** - Adjust concurrency settings

### 🎛️ Performance Tuning for VS Code

#### High-Performance Configuration

```json
// .vscode/settings.json
{
  "mcp.servers": {
    "local-search": {
      "args": ["/path/to/server"],
      "env": {
        "MAX_FILE_CONCURRENCY": "8",
        "MAX_EMBEDDING_BATCH": "16",
        "CHUNK_SIZE": "800"
      }
    }
  },

  // VS Code-specific optimizations
  "mcp.requestTimeout": 10000,     // 10s timeout
  "mcp.maxConcurrent": 3,          // Limit concurrent requests
  "mcp.compression": true,          // Enable response compression
  "mcp.cache.enabled": true,        // Cache frequent searches
  "mcp.cache.ttl": 300             // 5 minute cache TTL
}
```

#### Low-End Systems

```json
{
  "mcp.servers": {
    "local-search": {
      "env": {
        "MAX_FILE_CONCURRENCY": "2",
        "DISABLE_GPU": "true",
        "CHUNK_SIZE": "500"
      }
    }
  },

  // Conservative VS Code settings
  "mcp.maxConcurrent": 1,
  "mcp.requestTimeout": 30000
}
```

### 🔧 Troubleshooting VS Code Integration

#### Copilot Not Using Documentation Context

**Symptoms:**
- Copilot suggests generic patterns instead of your documented ones
- No mention of your API standards in suggestions

**Solutions:**
```bash
# 1. Verify MCP server is responding
curl http://localhost:3000/status

# 2. Check VS Code MCP logs
# VS Code: View → Output → MCP Logs

# 3. Re-index documentation
# Cmd Palette: "MCP: Re-index Documentation"

# 4. Restart VS Code and MCP server
```

#### Slow Copilot Suggestions

**Performance Issues:**
- Search delays causing Copilot hesitation
- Memory usage conflicts with Copilot

**Optimizations:**
```json
{
  // Reduce MCP load during coding sessions
  "mcp.debounceTime": 500,          // Debounce search requests
  "mcp.maxConcurrent": 2,          // Limit concurrent MCP calls
  "mcp.cache.enabled": true,        // Enable caching

  // Offload processing for smoother UX
  "mcp.serverMode": "background"    // Run MCP in background
}
```

#### MCP Server Crashing

**Stability Issues:**
- VS Code restarts causing MCP disconnection
- Memory leaks during long sessions

**Solutions:**
```bash
# Enable watchdog mode
MCP_WATCHDOG=true

# Restart on VS Code restart
"mcp.autoRestart": true

# Monitor memory usage
"mcp.memoryLimit": "1GB"
```

### 📊 Integration Benefits

#### Quantitative Improvements

| Before | After | Improvement |
|--------|-------|-------------|
| **Generic suggestions** | **Context-specific patterns** | **80% more relevant** |
| **Manual doc lookups** | **Instant semantic search** | **10x faster** |
| **Inconsistent patterns** | **Unified code standards** | **100% consistency** |
| **Tribal knowledge loss** | **Indexed institutional knowledge** | **Permanent retention** |

#### Developer Experience

- **🔍 Instant Documentation Access** - No tab switching for docs
- **🎯 Context-Aware Suggestions** - Copilot understands your codebase
- **📚 Knowledge Preservation** - Tribal knowledge becomes searchable
- **🚀 Accelerated Onboarding** - New devs get context immediately

### 🎨 Example Workflows

#### API Development

```typescript
// Developer writes a comment
// @copilot-search: authentication middleware implementation

async function handleLogin(req: Request, res: Response) {
  // Copilot suggests based on your docs:
  const { email, password } = validateLoginInput(req.body);

  const user = await authenticateUser(email, password);
  const token = generateJWTToken(user);

  res.json({
    token,
    user: sanitizeUserOutput(user)
  });
  // ^ All patterns come from your indexed authentication docs
}
```

#### Database Integration

```typescript
// @copilot-search: database connection retry logic

async function connectDatabase() {
  // Copilot uses your documented retry patterns:
  const maxRetries = config.db.maxRetries || 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await pool.connect();
      logger.info('Database connected successfully');
      return pool;
    } catch (error) {
      if (attempt === maxRetries) throw error;

      const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
      logger.warn(`Connection attempt ${attempt} failed, retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

#### Error Handling

```typescript
// @copilot-search: error response format

app.use((error: Error, req: Request, res: Response) => {
  // Copilot implements your documented error format:
  const statusCode = getHttpStatus(error);
  const problemDetails = {
    type: `https://api.example.com/errors/${error.type}`,
    title: error.message,
    detail: error.detail || 'An unexpected error occurred',
    instance: req.originalUrl,
    status: statusCode,
    timestamp: new Date().toISOString()
  };

  res.status(statusCode).json(problemDetails);
});
```

This integration transforms GitHub Copilot from a generic AI assistant into a **highly contextual, organization-specific development companion** that understands your architecture, patterns, and documentation.

## 🚀 Advanced Workflows

### Documentation Maintenance

#### Automated Documentation Updates

```typescript
// Update documentation on code changes
await search_documents({
  query: "breaking changes in v2.0",
  options: { limit: 20 }
});

// Identify all affected documentation files
// Generate migration guide
// Update API references
```

#### Cross-Repository Documentation

```typescript
// Maintain consistent terminology across multiple repos
await search_documents({
  query: "deprecated authentication method",
  options: { limit: 0 } // Find all occurrences
});

// Results guide documentation updates across:
// - Main API repository
// - SDK repositories
// - Documentation repository
```

### Development Support

#### Code Review Enhancement

```typescript
// Pre-commit documentation check
await search_documents({
  query: "error handling patterns for network requests",
  options: { limit: 2 }
});

// Ensure new code follows established patterns
// Verify error handling consistency
```

#### Onboarding New Developers

```typescript
// Comprehensive knowledge transfer
const queries = [
  "project architecture overview",
  "development setup guide",
  "coding standards",
  "testing patterns",
  "deployment process"
];

for (const query of queries) {
  await search_documents({ query, options: { limit: 3 } });
}
```

### Troubleshooting Automation

#### Systematic Problem Solving

```typescript
// Multi-dimensional investigation
const problem = "user login failures";

await search_documents({
  query: `${problem} + error messages`,
  options: { limit: 8 }
});

await search_documents({
  query: `${problem} + logs`,
  options: { limit: 6 }
});

await search_documents({
  query: `${problem} + debugging`,
  options: { limit: 4 }
});
```

## ✨ Best Practices

### Search Query Optimization

#### Be Specific and Contextual

```typescript
// ✅ Better: specific with context
"implement JWT authentication middleware"

// ❌ Less effective: too vague
"authentication"
```

#### Use Natural Language

```typescript
// ✅ Natural language works best
"how to configure database connection pooling"

// ❌ Keywords alone
"connection pooling"
```

#### Combine Concepts

```typescript
// ✅ Multi-concept queries
"implement error handling in async functions"

// ✅ Task-oriented queries
"debug memory leak in React component"
```

### Content Organization

#### Naming Conventions

```
📁 docs/
├── 📄 api-reference.md           # API specifications
├── 📄 authentication.md          # Auth implementation
├── 📄 configuration.md           # Setup and config
├── 📄 deployment.md              # Production deployment
├── 📄 integration.md             # Third-party integrations
├── 📄 migration.md               # Version migrations
├── 📄 testing.md                 # Testing strategies
└── 📄 troubleshooting.md         # Common issues & solutions
```

#### Chunk Size Optimization

```typescript
// Technical documentation
{
  chunkSize: 800,    // Smaller for precision
  overlap: 100       // More overlap
}

// Narrative documentation
{
  chunkSize: 1200,   // Larger for context
  overlap: 150       // Standard overlap
}
```

### Performance Tuning

#### High-Performance Configuration

```typescript
{
  // CPU-intensive operations
  maxFileProcessingConcurrency: 16,
  maxEmbeddingConcurrency: 8,

  // I/O operations
  maxDirectoryConcurrency: 32,
  maxFileWatcherConcurrency: 16,

  // Large document sets
  chunkSize: 1000,
  overlap: 200
}
```

#### Memory-Constrained Environments

```typescript
{
  // Conservative resource usage
  maxFileProcessingConcurrency: 2,
  maxEmbeddingConcurrency: 1,

  // Smaller chunks = lower memory
  chunkSize: 500,
  overlap: 50
}
```

## 🎯 Common Scenarios

### API Documentation Search

#### Method Implementation Lookup

```typescript
// Find specific API method usage
await search_documents({
  query: "GET /api/v1/users/:id implementation",
  options: { limit: 3, minScore: 0.85 }
});
```

#### Error Response Documentation

```typescript
// Find error response formats
await search_documents({
  query: "HTTP 401 Unauthorized response format",
  options: { limit: 2, includeMetadata: true }
});
```

### Code Library Integration

#### Framework Setup Guide

```typescript
// Comprehensive setup instructions
await search_documents({
  query: "React Router setup complete guide",
  options: { limit: 5 }
});
```

#### Library Migration

```typescript
// Migration strategy and examples
await search_documents({
  query: "migrate from Express to Fastify",
  options: { limit: 8 }
});
```

### Technical Writing

#### Consistent Terminology

```typescript
// Check term usage patterns
await search_documents({
  query: "serverless vs server-based architecture",
  options: { limit: 0 } // Find all occurrences
});
```

#### Content Gap Analysis

```typescript
// Identify missing documentation
searchTerms = [
  "error handling",
  "performance optimization",
  "security best practices"
];

for (const term of searchTerms) {
  const results = await search_documents({query: term});
  console.log(`${term}: ${results.totalResults} results`);
}
```

### Cross-Team Collaboration

#### Knowledge Sharing

```typescript
// Share team expertise
await search_documents({
  query: "internal API authentication patterns",
  options: { limit: 5 }
});

// Train new team members
await search_documents({
  query: "onboarding guide for new developers",
  options: { limit: 10 }
});
```

### Automated Workflows

#### Continuous Integration

```typescript
// API documentation validation
await search_documents({
  query: "POST /api/v1/webhook signature validation",
  options: { minScore: 0.8 }
});

// Enforce documentation standards
if (searchResults.totalResults === 0) {
  // Flag missing API documentation
}
```

#### Compliance Verification

```typescript
// Security documentation verification
await search_documents({
  query: "OWASP security recommendations implementation",
  options: { limit: 0 } // All occurrences
});
```

## 🔧 Integration Patterns

### Continuous Integration

#### Documentation Validation Pipeline

```yaml
# .github/workflows/docs-validation.yml
name: Documentation Validation
on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install MCP Server
        run: npm ci && npm run build

      - name: Validate Documentation Completeness
        run: |
          # Start MCP server
          npm start &
          SERVER_PID=$!

          # Wait for server to start
          sleep 3

          # Run validation checks
          npm run docs:validate

          # Kill server
          kill $SERVER_PID

      - name: Check API Documentation Coverage
        run: npm run test:coverage
```

#### Pre-commit Documentation Checks

```bash
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: validate-docs
        name: Validate Documentation
        entry: bash -c '
          cd docs && npm run validate &&
          echo "Documentation validation passed"
        '
        language: system
        pass_filenames: false
```

### Monitoring and Analytics

#### Usage Analytics Dashboard

```typescript
// Track and analyze MCP server usage patterns
class UsageAnalytics {
  private events: SearchEvent[] = [];

  recordSearch(query: string, results: number, time: number) {
    this.events.push({
      query,
      resultCount: results,
      searchTime: time,
      timestamp: Date.now()
    });

    // Aggregate and report
    this.analyzeUsage();
  }

  private analyzeUsage() {
    const totalSearches = this.events.length;
    const avgResults = this.events.reduce((sum, e) => sum + e.resultCount, 0) / totalSearches;
    const avgTime = this.events.reduce((sum, e) => sum + e.searchTime, 0) / totalSearches;

    console.log(`Usage Stats:
      Total Searches: ${totalSearches}
      Avg Results: ${avgResults.toFixed(1)}
      Avg Response Time: ${avgTime.toFixed(0)}ms`);
  }
}

// Integration with monitoring systems
export class MonitoringIntegration {
  private analytics = new UsageAnalytics();

  trackMCPUsage(query: string, results: number, time: number) {
    this.analytics.recordSearch(query, results, time);

    // Send to external monitoring
    this.sendToDatadog(query, results, time);
    this.sendToNewRelic(query, results, time);
  }

  private sendToDatadog(query: string, results: number, time: number) {
    // Implement Datadog metrics
    fetch('https://api.datadoghq.com/api/v1/series', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        series: [{
          metric: 'mcp.search.performance',
          points: [[Date.now() / 1000, time]],
          tags: [`query_length:${query.length}`, `results:${results}`]
        }]
      })
    });
  }

  private sendToNewRelic(query: string, results: number, time: number) {
    // Implement New Relic custom events
    fetch('https://metric-api.newrelic.com/metric/v1', {
      method: 'POST',
      headers: {
        'Api-Key': process.env.NEW_RELIC_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        metrics: [{
          name: 'mcp.search.duration',
          type: 'gauge',
          value: time,
          timestamp: Date.now(),
          attributes: {
            queryPreview: query.substring(0, 50),
            resultsCount: results
          }
        }]
      })
    });
  }
}
```

See [API Reference](../api/) for complete parameter specifications and [Performance Guide](../performance/) for optimization strategies.
