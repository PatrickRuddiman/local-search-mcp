# Local Search MCP Server Documentation

This documentation provides comprehensive technical documentation for the Local Search MCP Server.

## 📚 Documentation Structure

- **[API Reference](./api/)** - Complete MCP tool specifications and TypeScript interfaces
- **[Architecture](./architecture/)** - System design, component interactions, and data flow
- **[Usage](./usage/)** - Tutorials, examples, and integration guides
- **[Performance](./performance/)** - Optimization, profiling, and scaling guides

## 🚀 Quick Links

- [Installation](../../README.md#-installation)
- [Configuration](../../README.md#%EF%B8%8F-configuration)
- [MCP Tools](../../README.md#-mcp-tools)
- [Troubleshooting](../../README.md#-troubleshooting)

## 🏗️ System Overview

The Local Search MCP Server provides semantic document search capabilities through:

- **Vector Embeddings**: Using @xenova/transformers for document understanding
- **Automatic Indexing**: Real-time file watching and background processing
- **Repository Processing**: GitHub repository fetching via repomix
- **Parallel Processing**: Multi-core optimization with p-limit
- **Persistent Storage**: SQLite vector database with optimized queries

## 📖 Getting Started

1. **Read the main README** for installation and basic usage
2. **Check the API Reference** for detailed tool specifications
3. **Review Architecture** for system understanding
4. **Follow Usage examples** for integration guides

## 🤝 Contributing to Documentation

Documentation follows the main project structure under `/documentation/`. When contributing:

1. Use clear, concise language
2. Include code examples where helpful
3. Update table of contents when adding new sections
4. Reference the main README for configuration details
5. Test examples on multiple platforms

## 📄 License

This documentation is part of the Local Search MCP Server project, licensed under MIT.
