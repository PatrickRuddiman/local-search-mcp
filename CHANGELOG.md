# 1.0.0 (2025-09-27)


### Bug Fixes

* configure elevated GitHub token for semantic-release ([#18](https://github.com/PatrickRuddiman/local-search-mcp/issues/18)) ([8d0d3ad](https://github.com/PatrickRuddiman/local-search-mcp/commit/8d0d3ad29912c7963162e802564aa0bde84c78e0))
* **core:** remove 'Authentication failed' access check ([490af08](https://github.com/PatrickRuddiman/local-search-mcp/commit/490af081a4ce5ceb94e6cfd2cfe9c48c7b3a8d8f))
* Correct temporary directory usage in repository processing ([05ca53d](https://github.com/PatrickRuddiman/local-search-mcp/commit/05ca53dcfe3b8041b502be11116857fc7c02305e))
* Update log file and database paths to use MCP_DATA_FOLDER environment variable ([3136998](https://github.com/PatrickRuddiman/local-search-mcp/commit/3136998f0d3c54922b8660e088b881cf85ccd6e2))


### Code Refactoring

* **api:** remove maxFiles option ([b2eac33](https://github.com/PatrickRuddiman/local-search-mcp/commit/b2eac33ba1cce8ac37d18d6276795da7515f9aa5))


### Documentation

* consolidate and simplify documentation ([4fe5f4c](https://github.com/PatrickRuddiman/local-search-mcp/commit/4fe5f4cb9ace108da91c72378474d742b2115730))


### Features

* Add MCP_DATA_FOLDER environment variable to configuration ([5ee88a8](https://github.com/PatrickRuddiman/local-search-mcp/commit/5ee88a8760981b4578e249bbbdfcd9e44bc39d3e))
* **core:** add async jobs, progress & sqlite-vec ([3e3437c](https://github.com/PatrickRuddiman/local-search-mcp/commit/3e3437c2c3145a85d12b45df7f31cdb896cabe88))
* **embeddings:** dynamic TensorFlow backend init ([99c7fce](https://github.com/PatrickRuddiman/local-search-mcp/commit/99c7fcefc754ff709dc908a74aa736ff158b6324))
* Implement asynchronous job management for file downloads and repository fetches, including job tracking and status retrieval ([5a82a1c](https://github.com/PatrickRuddiman/local-search-mcp/commit/5a82a1ce54578690085c25e49926bc5dcc437742))
* Implement MCP directory structure initialization and path utilities ([710f58a](https://github.com/PatrickRuddiman/local-search-mcp/commit/710f58ac81857d75f6880a61f1ddff9127dc79bb))
* Implement text chunking and vector indexing functionality ([20a3585](https://github.com/PatrickRuddiman/local-search-mcp/commit/20a3585f942a9c7408e7bfe2a244cd626b1fa309))
* **logging:** Implement centralized logging system across core modules ([fe0ba45](https://github.com/PatrickRuddiman/local-search-mcp/commit/fe0ba45dcbdf88b67d7a6e20d9d72132b2e8ea73))
* **repo:** add git clone fallback for repomix ([5f7a9cb](https://github.com/PatrickRuddiman/local-search-mcp/commit/5f7a9cba015cbbaf1de16fe361ffb08b9d5080b0))
* **search:** warn when indexing jobs active ([78bff85](https://github.com/PatrickRuddiman/local-search-mcp/commit/78bff85a1e08e2883dfd39a3593f706e0627b7ca))


### BREAKING CHANGES

* **api:** Remove options.maxFiles from the repo fetch/search
API. Clients must stop sending maxFiles; file processing now relies on
include/exclude patterns and internal defaults rather than an external
maxFiles limit.
* rename API parameter contextLines -> contextSize.
Clients must update calls and examples to use contextSize and new
semantics (number of surrounding chunks).
* **core:** fetch_repo and fetch_file now start background jobs and
return a jobId instead of performing synchronous indexing. The previous
index_files tool and several legacy synchronous services (RepoService,
FileDownloadService, FileWatcher) are removed. Vector DB schema now uses
sqlite-vec (vec_chunks) and is not compatible with prior DB files. Update
clients to poll get_job_status and list_active_jobs and to handle job-level
errors/progress.
