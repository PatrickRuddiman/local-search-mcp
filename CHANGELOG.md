## [2.0.1](https://github.com/PatrickRuddiman/local-search-mcp/compare/v2.0.0...v2.0.1) (2025-09-28)


### Bug Fixes

* add workflow to lint commits (and also publish 2.0.1) ([#26](https://github.com/PatrickRuddiman/local-search-mcp/issues/26)) ([4fdc3a1](https://github.com/PatrickRuddiman/local-search-mcp/commit/4fdc3a146916231a0f1ae687b81dfd8d1439a7ba))

# [2.0.0](https://github.com/PatrickRuddiman/local-search-mcp/compare/v1.0.0...v2.0.0) (2025-09-28)


* feat(Search) Add domain-aware search, content classification, and recommendations ([#24](https://github.com/PatrickRuddiman/local-search-mcp/issues/24)) ([2a298c2](https://github.com/PatrickRuddiman/local-search-mcp/commit/2a298c2e35ccd8990da40a9330f51ee07e4731ea))


### BREAKING CHANGES

* VectorIndex constructor signature and responsibilities
change — it now accepts a DatabaseSchema and uses a VectorRepository;
optionally accepts a RecommendationRepository. Update any direct
instantiations of VectorIndex to pass a DatabaseSchema and adjust to the
repository-backed API and updated types.

* ﻿feat(search): add domain-aware search and metadata

- Implement domain detection and intent analysis, integrate DomainExtractor
- Add ContentClassifier/ContentEnhancer pipeline and processFileWithMetadata
- Store and retrieve per-file ContentMetadata in VectorRepository; join on search
- Add searchDocumentsEnhanced with domain boosting and enhanced filters:
  domainFilter, contentTypeFilter, languageFilter,
  minQualityScore, minAuthorityScore
- Update index/tool schema and CLI handler to call enhanced search and show
  content metadata (type, language, domains, quality, authority)
- Extend docs and types with new search options and remove deprecated
  interfaces (ConcurrencyConfig, IndexOptions, RepoOptions, IndexingResult)
- Remove ProgressSubscription interface and refine recommendation formatting

* Update src/core/VectorRepository.ts

Co-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>

* ﻿refactor(core): centralize services and tighten configs

- Add ServiceLocator singleton to manage shared core instances
- Provide lazy getters, dispose/reset, and instance stats
- Replace per-operation VectorIndex creation with shared instance
- Avoid closing shared VectorIndex to allow reuse
- Rename VectorRepository metadata key from file_path to chunk_id
- Update SQL queries, API params, and logs to use chunk_id
- Replace Math.random()-based IDs with crypto.randomUUID() variants
- Make RecommendationEngine configurable (maxQueryTerms=8, maxAnalysisDocs=5)
- Validate config ranges and log tokenization/debug info
- Introduce LearningAlgorithm constants for adjustments and weights
- Expand README Tools section with detailed API parameters/examples
* Rename content metadata key file_path to chunk_id.
Update external callers and run DB migrations to rename column and params.

* Update src/types/index.ts

Co-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>

* ﻿refactor(content): standardize annotation format

- Replace Unicode angle-bracket annotations (⟨...⟩) with square-bracket
  style ([...: ...]) across ContentEnhancer
- Use explicit labels for code symbols: IDENTIFIER, MODULE, FUNCTION,
  CLASS
- Update markdown normalization and extracted metadata tokens
  (HEADER, BOLD, ITALIC, CODE, CODEBLOCK, KEY, CONFIG_KEYS, YAML_KEYS,
  XML_TAGS, CONFIG_TERMS)
- Preserve existing extraction and normalization logic; change only
  annotation output formatting

* Update src/core/SearchService.ts

Co-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>

* ﻿fix(ids): import randomUUID from node:crypto

- Replace crypto.randomUUID() calls with imported randomUUID()
  in src/core/JobManager.ts, src/core/RecommendationRepository.ts,
  and src/index.ts
- Ensure consistent ID generation and avoid relying on a global
  crypto object

* ﻿style: use template literals in error messages

Replace single-quoted strings with template literals in Error and
reject calls to normalize string quoting across core modules.

Affected files:
- src/core/BackgroundProcessor.ts
- src/core/EmbeddingService.ts
- src/core/PathUtils.ts
- src/core/VectorIndex.ts

* ﻿refactor(vector): make searchSimilar async

- Change searchSimilar signature to async and return Promise<DocumentChunk[]>.
- Wrap sqlite-vec query in a Promise and run work inside setImmediate to
  avoid blocking the event loop.
- Keep embedding conversion, stmt execution, filtering and result mapping
  but resolve mapped results instead of returning synchronously.
- Reject with StorageError on internal failures and simplify outer error
  handling. Do not return embeddings to save memory.
* callers must await searchSimilar(...) as it now returns a Promise.

* Update src/core/RecommendationEngine.ts

Co-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>

* Update src/core/ContentClassifier.ts

Co-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>

* ﻿refactor(recommendation): extract expiry constant

- Add RECOMMENDATION_EXPIRY_MS (30 days in ms) to centralize expiry value
- Replace hard-coded 30-day millisecond expressions with the constant
- Use the constant for all recommendation expiresAt assignments

* Apply suggestions from code review

Co-authored-by: Copilot <175728472+Copilot@users.noreply.github.com>

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
