/**
 * Domain exemplar definitions for semantic domain classification
 * Auto-generated from Libraries.io data + LLM enrichment
 *
 * Generated: 2025-10-03T22:38:53.664Z
 * Source: data/technology-clusters.json
 * LLM Model: gpt-4-turbo-preview
 * Total Domains: 73
 *
 * ⚠️  DO NOT EDIT MANUALLY
 * This file is regenerated monthly via CI/CD
 * To update: Run the domain generation pipeline or trigger the GitHub Action
 */

export interface DomainExemplar {
  domain: string;
  description: string;
  keywords: string[];
  relatedDomains: string[];
  boostFactor: number;
  metadata?: {
    source: string;
    popularity: number;
    category: string;
    platform?: string;
  };
}

/**
 * Complete list of domain exemplars
 * Used for semantic domain classification during indexing and search
 */
export const DOMAIN_EXEMPLARS: DomainExemplar[] = [
  {
    domain: 'typescript',
    description:
      "TypeScript is a typed superset of JavaScript, adding static types to the language. Developers use it for catching errors early through a type system and to make JavaScript development more efficient. Key features include interfaces, enums, and generics, with common search terms like 'type assertion', 'decorators', and 'tsconfig.json'.",
    keywords: [
      'interfaces',
      'enums',
      'generics',
      'type assertion',
      'decorators',
      'tsconfig.json',
      'TypeScript compiler',
      'tsc',
      'ambient declarations',
    ],
    relatedDomains: ['javascript', 'webpack', 'babel', 'eslint'],
    boostFactor: 1.4,
    metadata: {
      source: 'libraries.io',
      popularity: 3472884,
      category: 'general',
      platform: 'NPM',
    },
  },
  {
    domain: 'go',
    description:
      "Go is a statically typed, compiled programming language designed at Google for simplicity and efficiency. Developers use Go for its concurrency support through goroutines and channels, and its simple, efficient syntax. Common search terms include 'goroutines', 'channels', 'go mod', and 'interfaces'.",
    keywords: ['goroutines', 'channels', 'go mod', 'interfaces', 'grpc', 'json', 'http', 'cli'],
    relatedDomains: ['grpc', 'docker', 'kubernetes', 'microservices'],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 2099041,
      category: 'backend',
      platform: 'Go',
    },
  },
  {
    domain: 'react',
    description:
      "React is a declarative, efficient, and flexible JavaScript library for building user interfaces. It lets developers compose complex UIs from small and isolated pieces of code called components. Commonly used APIs include 'useState', 'useEffect', and 'useContext', with search terms like 'JSX', 'props', 'state', and 'hooks'.",
    keywords: [
      'useState',
      'useEffect',
      'useContext',
      'JSX',
      'props',
      'state',
      'hooks',
      'functional components',
      'class components',
    ],
    relatedDomains: ['redux', 'webpack', 'babel', 'typescript'],
    boostFactor: 1.5,
    metadata: {
      source: 'libraries.io',
      popularity: 2041012,
      category: 'frontend',
      platform: 'NPM',
    },
  },
  {
    domain: 'eslint',
    description:
      "ESLint is a static code analysis tool for identifying problematic patterns found in JavaScript code. It's widely used for enforcing code style, with rules customizable via configuration files. Developers often search for 'eslint-config', 'eslint-plugin', 'rules', and 'eslint --init'.",
    keywords: [
      'eslint-config',
      'eslint-plugin',
      'rules',
      'eslint --init',
      'AST',
      'linting',
      'code quality',
      'javascript',
    ],
    relatedDomains: ['javascript', 'typescript', 'react', 'node.js'],
    boostFactor: 1.2,
    metadata: {
      source: 'libraries.io',
      popularity: 1912342,
      category: 'general',
      platform: 'NPM',
    },
  },
  {
    domain: 'testing',
    description:
      "Testing encompasses various tools and libraries for ensuring code quality and correctness in JavaScript and React. Key tools include Jest for unit tests, React Testing Library for React component tests, and Cypress for end-to-end testing. Developers search for terms like 'unit testing', 'mocks', 'assertions', and 'test coverage'.",
    keywords: [
      'Jest',
      'React Testing Library',
      'Cypress',
      'unit testing',
      'mocks',
      'assertions',
      'test coverage',
      'end-to-end testing',
    ],
    relatedDomains: ['javascript', 'react', 'eslint', 'babel'],
    boostFactor: 1.2,
    metadata: {
      source: 'libraries.io',
      popularity: 1902732,
      category: 'testing',
      platform: 'NPM',
    },
  },
  {
    domain: 'babel',
    description:
      "Babel is a JavaScript compiler that lets you use next generation JavaScript, today. It transforms ES6, ES7, and beyond syntax into backwards compatible JavaScript. Developers use it for plugins like 'babel-preset-env' and 'babel-loader' for webpack, with search terms including 'transpile', 'polyfill', and 'async/await'.",
    keywords: [
      'babel-preset-env',
      'babel-loader',
      'transpile',
      'polyfill',
      'async/await',
      'ES6',
      'webpack',
      'plugins',
    ],
    relatedDomains: ['webpack', 'eslint', 'typescript', 'react'],
    boostFactor: 1.2,
    metadata: {
      source: 'libraries.io',
      popularity: 1679247,
      category: 'general',
      platform: 'NPM',
    },
  },
  {
    domain: 'webpack',
    description:
      "Webpack is a tool for bundling modules and assets for browser use. It processes JavaScript, CSS, and images, and offers features like code splitting and lazy loading. Common search terms include 'loaders', 'plugins', 'webpack.config.js', and 'hot module replacement (HMR)'.",
    keywords: [
      'loaders',
      'plugins',
      'webpack.config.js',
      'hot module replacement',
      'code splitting',
      'lazy loading',
      'ES6',
      'minification',
    ],
    relatedDomains: ['babel', 'typescript', 'sass', 'react'],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 1171890,
      category: 'frontend',
      platform: 'NPM',
    },
  },
  {
    domain: 'go-networking',
    description:
      "Go Networking involves Go packages that facilitate networking operations, including HTTP server and client implementations, and low-level network communication. Developers frequently search for 'net/http', 'gorilla/mux', 'gRPC', and 'concurrency patterns'.",
    keywords: [
      'net/http',
      'gorilla/mux',
      'gRPC',
      'concurrency patterns',
      'TCP/IP',
      'UDP',
      'sockets',
      'network programming',
    ],
    relatedDomains: ['go', 'grpc', 'microservices', 'concurrency'],
    boostFactor: 1.2,
    metadata: {
      source: 'libraries.io',
      popularity: 909156,
      category: 'backend',
      platform: 'Go',
    },
  },
  {
    domain: 'prettier',
    description:
      "Prettier is an opinionated code formatter supporting many languages, including JavaScript, CSS, and Markdown. It enforces a consistent code style by parsing code and re-printing it with its own rules. Developers look for '.prettierrc', 'prettier-ignore', and integration with ESLint.",
    keywords: [
      '.prettierrc',
      'prettier-ignore',
      'ESLint integration',
      'code formatting',
      'javascript',
      'CSS',
      'Markdown',
      'CLI',
    ],
    relatedDomains: ['eslint', 'babel', 'webpack', 'typescript'],
    boostFactor: 1.1,
    metadata: {
      source: 'libraries.io',
      popularity: 793007,
      category: 'general',
      platform: 'NPM',
    },
  },
  {
    domain: 'rust',
    description:
      "Rust is a systems programming language focused on speed, memory safety, and parallelism. It is syntactically similar to C++, but aims to provide memory safety without using garbage collection. Developers use features like 'cargo', 'rustc', 'ownership', 'borrow checker', and 'async/await'.",
    keywords: [
      'cargo',
      'rustc',
      'ownership',
      'borrow checker',
      'async/await',
      'concurrency',
      'safe concurrency',
      'pattern matching',
    ],
    relatedDomains: ['wasm', 'systems programming', 'cargo', 'concurrency'],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 339755,
      category: 'general',
      platform: 'NPM',
    },
  },
  {
    domain: 'python',
    description:
      "Python is a high-level, interpreted programming language known for its readability and versatility. It's used in web development, data analysis, artificial intelligence, scientific computing, and more. Developers search for 'pip', 'PyPI', 'virtualenv', 'decorators', and 'list comprehensions'.",
    keywords: [
      'pip',
      'PyPI',
      'virtualenv',
      'decorators',
      'list comprehensions',
      'flask',
      'django',
      'numpy',
      'pandas',
    ],
    relatedDomains: ['flask', 'django', 'data-science', 'machine-learning'],
    boostFactor: 1.5,
    metadata: {
      source: 'libraries.io',
      popularity: 266186,
      category: 'machine-learning',
      platform: 'Pypi',
    },
  },
  {
    domain: 'node.js',
    description:
      "Node.js is a runtime environment that executes JavaScript code outside a web browser. It's used for building scalable network applications. Key features include the Event Loop, non-blocking I/O, and the npm package ecosystem. Developers often search for 'express', 'async/await', 'npm', and 'modules'.",
    keywords: [
      'express',
      'async/await',
      'npm',
      'modules',
      'Event Loop',
      'non-blocking I/O',
      'http',
      'middleware',
    ],
    relatedDomains: ['express', 'npm', 'javascript', 'typescript'],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 253729,
      category: 'backend',
      platform: 'NPM',
    },
  },
  {
    domain: 'command-line-tools',
    description:
      "Command Line Tools refer to libraries and frameworks for creating command-line applications. These tools often provide features for parsing command-line arguments, generating help text, and interactive prompts. Common tools include 'commander.js', 'inquirer.js', and 'chalk'.",
    keywords: [
      'commander.js',
      'inquirer.js',
      'chalk',
      'CLI',
      'command-line arguments',
      'help text',
      'interactive prompts',
      'node.js',
    ],
    relatedDomains: ['node.js', 'npm', 'javascript', 'typescript'],
    boostFactor: 1.1,
    metadata: {
      source: 'libraries.io',
      popularity: 233828,
      category: 'general',
      platform: 'NPM',
    },
  },
  {
    domain: 'protocol-buffers',
    description:
      "Protocol Buffers (Protobuf) is a language-neutral, platform-neutral, extensible mechanism for serializing structured data, similar to XML but smaller, faster, and simpler. Developers use it for defining data structures and interfaces in a '.proto' file. Common operations include 'protoc' for compiling protocol buffers.",
    keywords: [
      'protoc',
      '.proto',
      'serialization',
      'data structures',
      'interfaces',
      'gRPC',
      'language-neutral',
      'platform-neutral',
    ],
    relatedDomains: ['grpc', 'go', 'microservices', 'distributed systems'],
    boostFactor: 1.2,
    metadata: {
      source: 'libraries.io',
      popularity: 204567,
      category: 'backend',
      platform: 'Go',
    },
  },
  {
    domain: 'css-processing',
    description:
      "CSS Processing tools transform CSS code to optimize and enhance its capabilities. These tools include preprocessors like Sass, Less, and PostCSS plugins like Autoprefixer. Developers search for operations like 'minification', 'autoprefixing', and 'source maps'.",
    keywords: [
      'Sass',
      'Less',
      'PostCSS',
      'Autoprefixer',
      'minification',
      'autoprefixing',
      'source maps',
      'CSS variables',
    ],
    relatedDomains: ['webpack', 'gulp', 'frontend development', 'web design'],
    boostFactor: 1.2,
    metadata: {
      source: 'libraries.io',
      popularity: 193123,
      category: 'frontend',
      platform: 'NPM',
    },
  },
  {
    domain: 'python-general',
    description:
      "Python General encompasses a wide range of libraries and tools for various applications, from web development to automation. Commonly used libraries include 'requests' for HTTP requests, 'Pillow' for image processing, and 'Jinja2' for templating. Developers often search for 'pipenv', 'virtual environments', and 'asyncio'.",
    keywords: [
      'requests',
      'Pillow',
      'Jinja2',
      'pipenv',
      'virtual environments',
      'asyncio',
      'flask',
      'django',
    ],
    relatedDomains: ['flask', 'django', 'data-science', 'web development'],
    boostFactor: 1.2,
    metadata: {
      source: 'libraries.io',
      popularity: 189840,
      category: 'general',
      platform: 'Pypi',
    },
  },
  {
    domain: 'python-data-science',
    description:
      "Python Data Science involves libraries and tools for data analysis, machine learning, and scientific computing. Core libraries include 'numpy' for numerical computations, 'pandas' for data manipulation, and 'matplotlib' for plotting. Developers search for 'data frames', 'machine learning', and 'data visualization'.",
    keywords: [
      'numpy',
      'pandas',
      'matplotlib',
      'data frames',
      'machine learning',
      'data visualization',
      'scipy',
      'jupyter notebooks',
    ],
    relatedDomains: ['machine-learning', 'python', 'big-data', 'data-analysis'],
    boostFactor: 1.4,
    metadata: {
      source: 'libraries.io',
      popularity: 189108,
      category: 'machine-learning',
      platform: 'Pypi',
    },
  },
  {
    domain: '.net',
    description:
      ".NET is a developer platform for building various types of applications, from web to mobile to desktop. It includes support for C#, F#, and Visual Basic, with key features like ASP.NET for web applications, Entity Framework Core for data access, and Blazor for client-side web UI. Developers search for '.NET Core', 'MVC', 'dependency injection', and 'LINQ'.",
    keywords: [
      '.NET Core',
      'MVC',
      'dependency injection',
      'LINQ',
      'ASP.NET',
      'Entity Framework Core',
      'Blazor',
      'C#',
    ],
    relatedDomains: ['c-sharp', 'aspnet-core', 'entity-framework', 'blazor'],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 171817,
      category: 'backend',
      platform: 'NuGet',
    },
  },
  {
    domain: 'cargo',
    description:
      "Cargo is the Rust package manager and build system, handling dependency resolution, compilation, and package distribution. It's essential for Rust development, with common commands like 'cargo build', 'cargo run', and 'cargo test'. Developers search for 'crates', 'Cargo.toml', and 'dependency management'.",
    keywords: [
      'cargo build',
      'cargo run',
      'cargo test',
      'crates',
      'Cargo.toml',
      'dependency management',
      'rust',
      'package manager',
    ],
    relatedDomains: ['rust', 'crates.io', 'systems programming', 'cross-compilation'],
    boostFactor: 1.2,
    metadata: {
      source: 'libraries.io',
      popularity: 154319,
      category: 'backend',
      platform: 'NPM',
    },
  },
  {
    domain: 'vue',
    description:
      "Vue is a progressive framework for building user interfaces. Unlike other monolithic frameworks, Vue is designed from the ground up to be incrementally adoptable. The core library focuses on the view layer only, with facilities for 'v-bind', 'v-model', and 'Vue component'. Developers often search for 'Vue CLI', 'Vuex', and 'Single File Components'.",
    keywords: [
      'v-bind',
      'v-model',
      'Vue component',
      'Vue CLI',
      'Vuex',
      'Single File Components',
      'reactivity',
      'composition api',
    ],
    relatedDomains: ['javascript', 'webpack', 'vue-router', 'nuxt.js'],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 148840,
      category: 'frontend',
      platform: 'NPM',
    },
  },
  {
    domain: 'go-json-handling',
    description:
      "Go JSON Handling involves parsing and encoding JSON data using Go's standard library, primarily through the encoding/json package. Developers utilize structs with tags to marshal and unmarshal data, and common operations include json.Marshal, json.Unmarshal, and working with streams using json.Encoder and json.Decoder.",
    keywords: [
      'json.Marshal',
      'json.Unmarshal',
      'encoding/json',
      'json.Encoder',
      'json.Decoder',
      'struct tags',
      'Go',
      'parsing JSON',
      'encoding JSON',
      'data structures',
    ],
    relatedDomains: ['go-web-development', 'go-testing', 'go-yaml', 'backend'],
    boostFactor: 1.2,
    metadata: {
      source: 'libraries.io',
      popularity: 145392,
      category: 'backend',
      platform: 'Go',
    },
  },
  {
    domain: 'vue.js',
    description:
      'Vue.js is a progressive JavaScript framework used for building user interfaces and single-page applications. It features a reactive and composable data model, utilizing directives like v-bind and v-model for data binding, and components for encapsulating reusable code. Developers often search for Vue CLI commands, Vuex for state management, and Vue Router for SPA routing.',
    keywords: [
      'Vue CLI',
      'Vuex',
      'Vue Router',
      'v-bind',
      'v-model',
      'single-page application',
      'reactive data model',
      'components',
      'directives',
      'frontend',
    ],
    relatedDomains: ['javascript', 'frontend', 'web-development', 'npm'],
    boostFactor: 1.4,
    metadata: {
      source: 'libraries.io',
      popularity: 141550,
      category: 'frontend',
      platform: 'NPM',
    },
  },
  {
    domain: 'go-testing',
    description:
      'Go Testing encompasses writing and running tests in Go using the built-in testing package. It supports creating unit and benchmark tests, with common functions like testing.T for test cases and testing.B for benchmarks. Developers use go test CLI command for running tests and often look for mocking frameworks like testify for more complex test scenarios.',
    keywords: [
      'testing.T',
      'testing.B',
      'go test',
      'testify',
      'mocking',
      'benchmarking',
      'unit tests',
      'Go',
      'testing package',
      'CLI command',
    ],
    relatedDomains: ['go-json-handling', 'go-web-development', 'backend', 'testing'],
    boostFactor: 1.1,
    metadata: {
      source: 'libraries.io',
      popularity: 135700,
      category: 'testing',
      platform: 'Go',
    },
  },
  {
    domain: 'go-yaml',
    description:
      'Go YAML support is provided through external packages like go-yaml, enabling parsing and encoding of YAML, a human-friendly data serialization standard. Developers use yaml.Marshal and yaml.Unmarshal for converting between YAML documents and Go structs, often in configuration management and data representation tasks.',
    keywords: [
      'yaml.Marshal',
      'yaml.Unmarshal',
      'go-yaml',
      'YAML parsing',
      'YAML encoding',
      'configuration management',
      'Go',
      'data serialization',
      'external package',
    ],
    relatedDomains: ['go-json-handling', 'go-web-development', 'backend', 'devops'],
    boostFactor: 1.1,
    metadata: {
      source: 'libraries.io',
      popularity: 127888,
      category: 'general',
      platform: 'Go',
    },
  },
  {
    domain: 'packagist',
    description:
      'Packagist serves as the main repository for PHP packages, facilitating their discovery and installation via Composer. It supports a wide range of PHP libraries and frameworks, with common search terms including composer require, Laravel packages, Symfony components, and managing dependencies for PHP projects.',
    keywords: [
      'composer require',
      'Laravel',
      'Symfony',
      'PHP packages',
      'dependency management',
      'Composer',
      'Packagist',
      'PHP libraries',
      'frameworks',
    ],
    relatedDomains: ['php', 'symfony', 'laravel', 'backend'],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 115652,
      category: 'backend',
      platform: 'Packagist',
    },
  },
  {
    domain: 'version-control',
    description:
      'Version Control systems, such as Git, are tools for managing changes to source code over time, facilitating collaboration among developers. Common operations include git commit, git push, and git pull, with developers often searching for branching strategies, merge conflicts resolution, and git hooks for automating tasks.',
    keywords: [
      'git commit',
      'git push',
      'git pull',
      'branching strategies',
      'merge conflicts',
      'git hooks',
      'version control',
      'source code management',
      'collaboration',
    ],
    relatedDomains: ['devops', 'git', 'github', 'software-engineering'],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 115267,
      category: 'devops',
      platform: 'NPM',
    },
  },
  {
    domain: 'nuget',
    description:
      'NuGet is the package manager for .NET, streamlining the process of using third-party libraries in .NET projects. It offers a wide range of .NET libraries and tools, with developers frequently using commands like nuget install and exploring packages for ASP.NET Core, Entity Framework, and Azure SDKs.',
    keywords: [
      'nuget install',
      '.NET libraries',
      'ASP.NET Core',
      'Entity Framework',
      'Azure SDKs',
      'NuGet',
      'package manager',
      '.NET',
      'C#',
      'Microsoft',
    ],
    relatedDomains: ['dotnet', 'c-sharp', 'aspnetcore', 'backend', 'microsoft'],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 101999,
      category: 'general',
      platform: 'NuGet',
    },
  },
  {
    domain: 'go-web-development',
    description:
      "Go Web Development involves using Go's net/http package and other third-party libraries to build web servers and handle HTTP requests. Key features include the http.ServeMux router, middleware chaining, and the use of Goroutines for handling concurrent requests efficiently. Developers often search for REST API design, HTTP server optimization, and websockets.",
    keywords: [
      'http.ServeMux',
      'middleware',
      'Goroutines',
      'REST API',
      'HTTP server',
      'websockets',
      'Go',
      'net/http',
      'concurrency',
      'web development',
    ],
    relatedDomains: ['go-json-handling', 'go-testing', 'backend', 'http'],
    boostFactor: 1.2,
    metadata: {
      source: 'libraries.io',
      popularity: 94863,
      category: 'backend',
      platform: 'Go',
    },
  },
  {
    domain: 'python-typing-and-linting',
    description:
      'Python Typing and Linting involve using tools and libraries to enforce coding standards and type annotations in Python code. Key tools include flake8 for style checking, mypy for static type checking, and the typing module for defining type hints. Developers use these tools to improve code quality, readability, and maintainability.',
    keywords: [
      'flake8',
      'mypy',
      'typing module',
      'type hints',
      'static type checking',
      'linting',
      'Python',
      'code quality',
      'style checking',
      'annotations',
    ],
    relatedDomains: ['python', 'devops', 'python-data-analysis', 'python-web-frameworks'],
    boostFactor: 1.2,
    metadata: {
      source: 'libraries.io',
      popularity: 92053,
      category: 'devops',
      platform: 'Pypi',
    },
  },
  {
    domain: 'maven',
    description:
      'Maven is a build automation tool used primarily for Java projects, simplifying the process of building, testing, and deploying software. It utilizes a project object model (POM) for project configuration, with developers often searching for Maven plugins, dependencies management, and lifecycle phases like mvn compile and mvn test.',
    keywords: [
      'mvn compile',
      'mvn test',
      'Maven plugins',
      'POM',
      'Java',
      'build automation',
      'dependencies management',
      'lifecycle phases',
      'testing',
      'deployment',
    ],
    relatedDomains: ['java', 'java-testing', 'spring-framework', 'backend'],
    boostFactor: 1.2,
    metadata: {
      source: 'libraries.io',
      popularity: 91825,
      category: 'testing',
      platform: 'Maven',
    },
  },
  {
    domain: 'kubernetes-go-clients',
    description:
      'Kubernetes Go Clients enable interaction with Kubernetes API servers using Go. This includes the client-go library for creating and managing Kubernetes resources, and kubectl command-line tool for cluster management. Developers use these clients for automating deployment, scaling, and operations of application containers across clusters.',
    keywords: [
      'client-go',
      'kubectl',
      'Kubernetes API',
      'Go',
      'cluster management',
      'container deployment',
      'scaling',
      'k8s',
      'automation',
      'devops',
    ],
    relatedDomains: ['go-web-development', 'devops', 'docker', 'cloud-computing'],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 88437,
      category: 'devops',
      platform: 'Go',
    },
  },
  {
    domain: 'symfony',
    description:
      'Symfony is a set of reusable PHP components and a web application framework for building robust applications. It offers features like the Symfony Console for command-line utilities, Doctrine ORM for database abstraction, and Twig for templating. Developers leverage Symfony for its modularity, performance, and extensive community support.',
    keywords: [
      'Symfony Console',
      'Doctrine ORM',
      'Twig',
      'PHP components',
      'web application framework',
      'Symfony',
      'modularity',
      'performance',
      'PHP',
    ],
    relatedDomains: ['php', 'packagist', 'laravel', 'backend'],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 85696,
      category: 'backend',
      platform: 'Packagist',
    },
  },
  {
    domain: 'java',
    description:
      'Java is an object-oriented programming language used for building a wide range of applications, from mobile apps to large enterprise systems. It features a robust standard library, the Java Development Kit (JDK) for development, and frameworks like Spring for application development. Developers often search for Java Virtual Machine (JVM) optimizations, garbage collection, and concurrency models.',
    keywords: [
      'Java Development Kit',
      'Spring framework',
      'Java Virtual Machine',
      'garbage collection',
      'concurrency',
      'Java',
      'object-oriented programming',
      'JDK',
      'enterprise applications',
      'mobile apps',
    ],
    relatedDomains: ['maven', 'spring-framework', 'java-testing', 'backend'],
    boostFactor: 1.5,
    metadata: {
      source: 'libraries.io',
      popularity: 76201,
      category: 'backend',
      platform: 'Maven',
    },
  },
  {
    domain: 'rust-utilities',
    description:
      "Rust Utilities encompass common libraries and tools for error handling, logging, and generating random data in Rust. This includes the use of crates like serde for serialization, log for logging abstractions, and rand for random number generation. Developers rely on these utilities for robust application development, focusing on Rust's safety and concurrency features.",
    keywords: [
      'serde',
      'log crate',
      'rand',
      'error handling',
      'logging',
      'random data generation',
      'Rust',
      'crates',
      'application development',
      'safety',
    ],
    relatedDomains: ['rust-web-frameworks', 'cargo', 'backend', 'devops'],
    boostFactor: 1.2,
    metadata: {
      source: 'libraries.io',
      popularity: 73036,
      category: 'general',
      platform: 'Cargo',
    },
  },
  {
    domain: 'java-testing',
    description:
      'Java Testing involves frameworks and libraries for writing and executing tests in Java applications. JUnit is widely used for unit testing, with Mockito for mocking objects and Hamcrest for matchers. Developers use these tools to ensure code reliability and performance, with common operations including assertions, test runners, and test suites.',
    keywords: [
      'JUnit',
      'Mockito',
      'Hamcrest',
      'unit testing',
      'mocking',
      'matchers',
      'Java',
      'assertions',
      'test runners',
      'test suites',
    ],
    relatedDomains: ['java', 'maven', 'spring-framework', 'testing'],
    boostFactor: 1.2,
    metadata: {
      source: 'libraries.io',
      popularity: 71048,
      category: 'testing',
      platform: 'Maven',
    },
  },
  {
    domain: 'php',
    description:
      'PHP is a server-side scripting language designed for web development but also used as a general-purpose programming language. It features a rich ecosystem of frameworks like Laravel and Symfony, and tools for testing, debugging, and deployment. Developers frequently search for PHP 7 and 8 features, Composer for dependency management, and integration with web servers.',
    keywords: [
      'Laravel',
      'Symfony',
      'Composer',
      'PHP 7',
      'PHP 8',
      'server-side scripting',
      'web development',
      'dependency management',
      'testing',
      'debugging',
    ],
    relatedDomains: ['packagist', 'laravel', 'symfony', 'backend'],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 69359,
      category: 'backend',
      platform: 'Packagist',
    },
  },
  {
    domain: 'python-data-analysis',
    description:
      'Python Data Analysis involves using libraries like pandas and NumPy for manipulating and analyzing data sets. Pandas provide data structures like DataFrame for tabular data, and NumPy offers mathematical functions for numerical data. Common use cases include statistical analysis, data transformation, and integration with data visualization libraries.',
    keywords: [
      'pandas',
      'NumPy',
      'DataFrame',
      'data manipulation',
      'statistical analysis',
      'Python',
      'data sets',
      'data visualization',
      'analysis',
      'transformation',
    ],
    relatedDomains: ['python-data-processing', 'python', 'machine-learning', 'data-science'],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 64921,
      category: 'machine-learning',
      platform: 'Pypi',
    },
  },
  {
    domain: 'ruby-on-rails',
    description:
      'Ruby on Rails is a server-side web application framework written in Ruby. It follows the model-view-controller (MVC) pattern, simplifying the creation of database-backed web applications. Rails emphasizes convention over configuration, and features like Active Record for ORM, and Rails CLI for scaffolding. Developers use Rails for rapid application development and deployment.',
    keywords: [
      'MVC',
      'Active Record',
      'Rails CLI',
      'Ruby',
      'web application framework',
      'convention over configuration',
      'ORM',
      'scaffolding',
      'rapid development',
      'deployment',
    ],
    relatedDomains: ['ruby', 'web-development', 'backend', 'database'],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 63960,
      category: 'backend',
      platform: 'Rubygems',
    },
  },
  {
    domain: 'python-data-processing',
    description:
      'Python Data Processing involves libraries and tools for efficiently handling, transforming, and analyzing data. Libraries like Pandas for data manipulation, XML and JSON parsers for data interchange, and SQLAlchemy for database interactions are commonly used. Developers focus on data cleaning, transformation, and efficient data storage and retrieval.',
    keywords: [
      'Pandas',
      'XML',
      'JSON',
      'SQLAlchemy',
      'data manipulation',
      'data cleaning',
      'Python',
      'data storage',
      'data retrieval',
      'data transformation',
    ],
    relatedDomains: ['python-data-analysis', 'python', 'database', 'data-science'],
    boostFactor: 1.2,
    metadata: {
      source: 'libraries.io',
      popularity: 57090,
      category: 'general',
      platform: 'Pypi',
    },
  },
  {
    domain: 'python-web-frameworks',
    description:
      'Python Web Frameworks include Django, Flask, and FastAPI for developing web applications. Django offers a full-stack solution with ORM and admin panel, Flask provides a lightweight and flexible approach, and FastAPI focuses on speed and ease of use for APIs. Developers use these frameworks for routing, templating, and building RESTful services.',
    keywords: [
      'Django',
      'Flask',
      'FastAPI',
      'ORM',
      'admin panel',
      'routing',
      'templating',
      'RESTful services',
      'Python',
      'web applications',
    ],
    relatedDomains: ['python', 'web-development', 'python-data-processing', 'backend'],
    boostFactor: 1.2,
    metadata: {
      source: 'libraries.io',
      popularity: 56470,
      category: 'backend',
      platform: 'Pypi',
    },
  },
  {
    domain: 'flutter',
    description:
      "Flutter is a UI toolkit for crafting natively compiled applications for mobile, web, and desktop from a single codebase. It utilizes the Dart language and provides a reactive framework, rich widget sets, and development tools for building high-performance, visually attractive applications. Common search terms include 'StatefulWidget', 'MaterialApp', 'hot reload', and 'flutter run' for CLI commands.",
    keywords: [
      'StatefulWidget',
      'MaterialApp',
      'hot reload',
      'flutter run',
      'Dart',
      'widgets',
      'animations',
      'flutter plugin',
    ],
    relatedDomains: ['mobile-development', 'dart', 'ui-design', 'cross-platform'],
    boostFactor: 1.4,
    metadata: {
      source: 'libraries.io',
      popularity: 53125,
      category: 'frontend',
      platform: 'NPM',
    },
  },
  {
    domain: 'go-database-handling',
    description:
      "Go Database Handling involves using packages like 'database/sql' and third-party libraries such as 'gorm' for ORM to interact with databases. It supports operations like querying, transaction management, and connection pooling. Developers often search for 'sql.DB', 'Query()', and 'database/sql' alongside specific drivers like 'pq' for PostgreSQL.",
    keywords: [
      'database/sql',
      'gorm',
      'Query()',
      'sql.DB',
      'pq',
      'mysql',
      'postgres',
      'transaction management',
    ],
    relatedDomains: ['go', 'sql-databases', 'orm', 'backend-development'],
    boostFactor: 1.2,
    metadata: {
      source: 'libraries.io',
      popularity: 49224,
      category: 'database',
      platform: 'Go',
    },
  },
  {
    domain: 'php-code-quality',
    description:
      "PHP Code Quality tools, such as 'PHP_CodeSniffer' and 'PHPMD', help in analyzing and improving the quality of PHP code by adhering to coding standards and detecting potential issues. Developers frequently look up 'phpcs', 'phpmd', 'static analysis', and 'coding standards' for best practices and tool usage.",
    keywords: [
      'PHP_CodeSniffer',
      'PHPMD',
      'static analysis',
      'phpcs',
      'phpmd',
      'coding standards',
      'linting',
      'code quality',
    ],
    relatedDomains: ['php', 'static-analysis', 'code-quality', 'testing'],
    boostFactor: 1.1,
    metadata: {
      source: 'libraries.io',
      popularity: 46419,
      category: 'testing',
      platform: 'Packagist',
    },
  },
  {
    domain: 'python-web',
    description:
      "Python Web encompasses frameworks and libraries like 'Django' and 'Flask' for building web applications. It includes handling HTTP requests, creating RESTful services, and integrating web sockets. Developers often search for 'Flask route', 'Django models', 'REST API', and 'socketio' for real-time web applications.",
    keywords: [
      'Django',
      'Flask',
      'REST API',
      'HTTP requests',
      'Flask route',
      'Django models',
      'socketio',
      'web sockets',
    ],
    relatedDomains: ['backend-development', 'python', 'restful-services', 'web-development'],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 44217,
      category: 'backend',
      platform: 'Rubygems',
    },
  },
  {
    domain: 'php-testing-utilities',
    description:
      "PHP Testing Utilities include frameworks and libraries like 'PHPUnit' and 'Mockery' for unit testing and mocking in PHP projects. Developers use these tools to ensure code reliability and performance, often searching for 'PHPUnit', 'Mockery', 'phpunit.xml', and 'test doubles'.",
    keywords: [
      'PHPUnit',
      'Mockery',
      'unit testing',
      'mocking',
      'phpunit.xml',
      'test doubles',
      'code reliability',
      'performance testing',
    ],
    relatedDomains: ['php', 'unit-testing', 'mocking-frameworks', 'software-testing'],
    boostFactor: 1.1,
    metadata: {
      source: 'libraries.io',
      popularity: 44128,
      category: 'testing',
      platform: 'Packagist',
    },
  },
  {
    domain: 'spring',
    description:
      "Spring is a powerful, comprehensive framework for building Java-based enterprise applications. It offers a wide range of functionalities including dependency injection, aspect-oriented programming, and transaction management. Developers often search for 'Spring Boot', 'Autowired', 'Spring MVC', and 'application.properties' for configuration.",
    keywords: [
      'Spring Boot',
      'Autowired',
      'Spring MVC',
      'dependency injection',
      'aspect-oriented programming',
      'transaction management',
      'application.properties',
      'JPA',
    ],
    relatedDomains: ['java', 'enterprise-application', 'spring-boot', 'backend-development'],
    boostFactor: 1.5,
    metadata: {
      source: 'libraries.io',
      popularity: 43452,
      category: 'backend',
      platform: 'Maven',
    },
  },
  {
    domain: 'ruby',
    description:
      "Ruby is a dynamic, open-source programming language focused on simplicity and productivity. It has an elegant syntax that is natural to read and easy to write. Developers frequently search for 'Rails', 'RSpec', 'Sinatra', and 'RubyGems' along with 'bundle install' for managing dependencies.",
    keywords: [
      'Rails',
      'RSpec',
      'Sinatra',
      'RubyGems',
      'bundle install',
      'dynamic programming',
      'open-source',
      'gemfile',
    ],
    relatedDomains: [
      'web-development',
      'ruby-on-rails',
      'testing-frameworks',
      'package-management',
    ],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 41013,
      category: 'backend',
      platform: 'NPM',
    },
  },
  {
    domain: 'dotnet',
    description:
      "Dotnet is a free, cross-platform, open-source developer platform for building many different types of applications. It includes runtime, libraries, and compilers that support languages like C#, F#, and Visual Basic. Developers often search for '.NET Core', 'Entity Framework', 'ASP.NET Core', and 'dotnet run' for CLI commands.",
    keywords: [
      '.NET Core',
      'Entity Framework',
      'ASP.NET Core',
      'C#',
      'F#',
      'Visual Basic',
      'dotnet run',
      'cross-platform development',
    ],
    relatedDomains: ['csharp', 'aspnet-core', 'entity-framework', 'cross-platform'],
    boostFactor: 1.4,
    metadata: {
      source: 'libraries.io',
      popularity: 40379,
      category: 'general',
      platform: 'NuGet',
    },
  },
  {
    domain: 'python-data-handling',
    description:
      "Python Data Handling includes libraries like 'pandas', 'numpy', and 'matplotlib' for data manipulation, analysis, and visualization. It's essential for tasks such as statistical analysis, time series analysis, and creating plots or charts. Developers search for 'DataFrame', 'numpy array', 'matplotlib.pyplot', and 'pandas read_csv'.",
    keywords: [
      'pandas',
      'numpy',
      'matplotlib',
      'DataFrame',
      'numpy array',
      'matplotlib.pyplot',
      'data manipulation',
      'pandas read_csv',
    ],
    relatedDomains: ['data-science', 'python', 'data-analysis', 'data-visualization'],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 38010,
      category: 'general',
      platform: 'Pypi',
    },
  },
  {
    domain: 'machine-learning',
    description:
      "Machine Learning domain encompasses libraries and frameworks like 'TensorFlow', 'PyTorch', and 'scikit-learn' for building and deploying machine learning models. It covers applications in NLP, computer vision, and speech recognition. Developers often search for 'neural networks', 'deep learning', 'machine learning algorithms', and 'model training'.",
    keywords: [
      'TensorFlow',
      'PyTorch',
      'scikit-learn',
      'neural networks',
      'deep learning',
      'NLP',
      'computer vision',
      'model training',
    ],
    relatedDomains: ['data-science', 'python', 'neural-networks', 'artificial-intelligence'],
    boostFactor: 1.5,
    metadata: {
      source: 'libraries.io',
      popularity: 36725,
      category: 'machine-learning',
      platform: 'Pypi',
    },
  },
  {
    domain: 'web-development',
    description:
      "Web development encompasses the creation of websites and web applications, utilizing technologies such as HTML, CSS, and JavaScript. Developers often use frameworks like React or Angular for building interactive user interfaces and Node.js for server-side logic. Common search terms include 'responsive design', 'AJAX', and 'web APIs'.",
    keywords: [
      'HTML',
      'CSS',
      'JavaScript',
      'React',
      'Angular',
      'Node.js',
      'responsive design',
      'AJAX',
      'web APIs',
    ],
    relatedDomains: ['frontend', 'backend', 'javascript', 'css', 'html'],
    boostFactor: 1.5,
    metadata: {
      source: 'libraries.io',
      popularity: 19423,
      category: 'frontend',
      platform: 'Maven',
    },
  },
  {
    domain: 'mockito',
    description:
      "Mockito is a popular Java mocking framework used for isolating test units by mocking interfaces and classes. It offers features like argument matchers, verification timeouts, and annotations such as @Mock for creating mock objects. Developers search for operations like 'mock creation', 'stubbing methods', and 'verifying interactions'.",
    keywords: [
      'Java',
      'mock',
      '@Mock',
      'argument matchers',
      'verification timeouts',
      'stubbing methods',
      'verifying interactions',
    ],
    relatedDomains: ['testing', 'java', 'unit-testing'],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 19411,
      category: 'testing',
      platform: 'Maven',
    },
  },
  {
    domain: 'python-development',
    description:
      "Python development involves building software applications using the Python programming language. It includes managing package dependencies with pip, building projects with setuptools, and using virtual environments. Developers often search for 'PEP 8 compliance', 'virtualenv', and 'pip install'.",
    keywords: ['Python', 'pip', 'setuptools', 'virtualenv', 'PEP 8', 'pip install'],
    relatedDomains: ['devops', 'python-testing', 'machine-learning'],
    boostFactor: 1.4,
    metadata: {
      source: 'libraries.io',
      popularity: 15858,
      category: 'devops',
      platform: 'Pypi',
    },
  },
  {
    domain: 'php-static-analysis',
    description:
      "PHP Static Analysis tools, such as PHPStan and Psalm, help developers identify bugs and maintain code quality by analyzing code without executing it. Key features include type checking, detecting unused code, and enforcing coding standards. Developers search for 'type errors', 'code smells', and specific tool commands like 'phpstan analyse'.",
    keywords: [
      'PHPStan',
      'Psalm',
      'type checking',
      'unused code',
      'coding standards',
      'phpstan analyse',
    ],
    relatedDomains: ['devops', 'php', 'testing'],
    boostFactor: 1.2,
    metadata: {
      source: 'libraries.io',
      popularity: 15435,
      category: 'devops',
      platform: 'Packagist',
    },
  },
  {
    domain: 'python-testing',
    description:
      "Python testing frameworks, such as pytest and unittest, provide tools for writing and executing tests. Features include fixtures, assertions, and test runners. Common search terms include 'pytest fixtures', 'unittest mock objects', and 'test coverage'.",
    keywords: ['pytest', 'unittest', 'fixtures', 'assertions', 'mock objects', 'test coverage'],
    relatedDomains: ['testing', 'python-development', 'devops'],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 14375,
      category: 'testing',
      platform: 'Pypi',
    },
  },
  {
    domain: 'asp.net-core',
    description:
      "ASP.NET Core is a framework for building web and cloud applications in .NET. It includes features like MVC patterns, Razor pages for server-side HTML generation, and Entity Framework Core for data access. Developers often search for 'middleware', 'dependency injection', and 'ASP.NET Core Identity'.",
    keywords: [
      'MVC',
      'Razor pages',
      'Entity Framework Core',
      'middleware',
      'dependency injection',
      'ASP.NET Core Identity',
    ],
    relatedDomains: ['backend', '.net-configuration', 'entity-framework'],
    boostFactor: 1.4,
    metadata: {
      source: 'libraries.io',
      popularity: 14219,
      category: 'backend',
      platform: 'NuGet',
    },
  },
  {
    domain: 'security',
    description:
      "Security in software development encompasses practices and tools for protecting applications from vulnerabilities and attacks. This includes managing authentication with JWT, implementing encryption with OpenSSL, and using security advisories. Developers search for 'XSS prevention', 'SQL injection', and 'JWT tokens'.",
    keywords: [
      'JWT',
      'OpenSSL',
      'security advisories',
      'XSS prevention',
      'SQL injection',
      'authentication',
    ],
    relatedDomains: ['devops', 'php-static-analysis', 'logging'],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 13761,
      category: 'devops',
      platform: 'Packagist',
    },
  },
  {
    domain: '.net-configuration',
    description:
      ".NET Configuration involves managing application settings and preferences. It supports JSON, XML, and INI files for configuration, and offers APIs like IConfiguration for accessing settings. Developers search for 'appsettings.json', 'IConfiguration', and '.NET Core environment variables'.",
    keywords: [
      '.NET',
      'IConfiguration',
      'appsettings.json',
      'JSON',
      'XML',
      'INI',
      '.NET Core environment variables',
    ],
    relatedDomains: ['backend', 'asp.net-core', 'entity-framework'],
    boostFactor: 1.2,
    metadata: {
      source: 'libraries.io',
      popularity: 12784,
      category: 'backend',
      platform: 'NuGet',
    },
  },
  {
    domain: 'entity-framework',
    description:
      "Entity Framework (EF) is an ORM framework for .NET that enables developers to work with databases using .NET objects. It supports LINQ queries, code-first migrations, and lazy loading. Common search terms include 'DbContext', 'LINQ queries', and 'code-first migrations'.",
    keywords: ['ORM', 'DbContext', 'LINQ', 'code-first migrations', 'lazy loading'],
    relatedDomains: ['database', 'asp.net-core', '.net-configuration'],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 12405,
      category: 'database',
      platform: 'NuGet',
    },
  },
  {
    domain: 'logging',
    description:
      "Logging in software development involves recording application activities. It supports debugging, monitoring, and auditing. Popular frameworks include log4j for Java and Serilog for .NET. Developers search for 'log levels', 'log appenders', and 'structured logging'.",
    keywords: ['log4j', 'Serilog', 'log levels', 'log appenders', 'structured logging'],
    relatedDomains: ['devops', 'security', 'asp.net-core'],
    boostFactor: 1.1,
    metadata: {
      source: 'libraries.io',
      popularity: 11999,
      category: 'devops',
      platform: 'Maven',
    },
  },
  {
    domain: 'ruby-testing',
    description:
      "Ruby testing involves frameworks and libraries like RSpec and Cucumber for behavior-driven and test-driven development. Features include matchers, mocks, and test doubles. Developers search for 'RSpec examples', 'Cucumber scenarios', and 'test suites'.",
    keywords: ['RSpec', 'Cucumber', 'matchers', 'mocks', 'test doubles', 'RSpec examples'],
    relatedDomains: ['testing', 'ruby', 'web-development'],
    boostFactor: 1.2,
    metadata: {
      source: 'libraries.io',
      popularity: 11599,
      category: 'testing',
      platform: 'Rubygems',
    },
  },
  {
    domain: 'mongodb',
    description:
      "MongoDB is a NoSQL database that stores data in flexible, JSON-like documents. It supports features like ad-hoc queries, indexing, and aggregation. Developers often search for 'MongoDB Atlas', 'mongoose ODM', and 'aggregation pipeline'.",
    keywords: [
      'NoSQL',
      'MongoDB Atlas',
      'mongoose',
      'ad-hoc queries',
      'indexing',
      'aggregation pipeline',
    ],
    relatedDomains: ['database', 'node.js', 'web-development'],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 7501,
      category: 'database',
      platform: 'NuGet',
    },
  },
  {
    domain: 'flutter-development',
    description:
      "Flutter development involves building cross-platform mobile applications using the Flutter framework and Dart language. It includes widgets for UI, state management solutions like Provider, and features hot reload for iterative development. Developers search for 'Flutter widgets', 'Dart packages', and 'state management'.",
    keywords: ['Flutter', 'Dart', 'widgets', 'Provider', 'hot reload', 'state management'],
    relatedDomains: ['frontend', 'mobile-development', 'web-development'],
    boostFactor: 1.4,
    metadata: {
      source: 'libraries.io',
      popularity: 7283,
      category: 'frontend',
      platform: 'Pub',
    },
  },
  {
    domain: 'active-record',
    description:
      "Active Record is an ORM framework for Ruby, part of the Rails ecosystem, facilitating database interactions. It follows the convention over configuration principle and supports migrations, validations, and associations. Developers search for 'ActiveRecord migrations', 'validations', and 'associations'.",
    keywords: ['ORM', 'Rails', 'migrations', 'validations', 'associations', 'ActiveRecord'],
    relatedDomains: ['database', 'ruby-testing', 'web-development'],
    boostFactor: 1.2,
    metadata: {
      source: 'libraries.io',
      popularity: 6708,
      category: 'database',
      platform: 'Rubygems',
    },
  },
  {
    domain: 'linting',
    description:
      "Linting in Python involves analyzing code for potential errors, style issues, and anti-patterns using tools like flake8 and pylint. It helps enforce coding standards and improve code quality. Developers search for 'PEP 8 linting', 'flake8 configurations', and 'pylint errors'.",
    keywords: ['flake8', 'pylint', 'PEP 8', 'linting', 'coding standards'],
    relatedDomains: ['devops', 'python-development', 'python-testing'],
    boostFactor: 1.1,
    metadata: {
      source: 'libraries.io',
      popularity: 6554,
      category: 'devops',
      platform: 'Pypi',
    },
  },
  {
    domain: 'phpstan',
    description:
      "PHPStan is a PHP static analysis tool that focuses on discovering bugs in code without running it. It supports custom rule creation, framework-specific extensions, and integrates with CI/CD pipelines. Developers search for 'PHPStan levels', 'custom rules', and 'PHPStan extensions'.",
    keywords: ['PHPStan', 'static analysis', 'custom rules', 'PHPStan levels', 'extensions'],
    relatedDomains: ['testing', 'php-static-analysis', 'devops'],
    boostFactor: 1.2,
    metadata: {
      source: 'libraries.io',
      popularity: 6468,
      category: 'testing',
      platform: 'Packagist',
    },
  },
  {
    domain: 'python-data-visualization',
    description:
      "Python Data Visualization involves libraries like Matplotlib, Seaborn, and Plotly for creating static, interactive, and web-based visualizations. It's used in data analysis, scientific computing, and machine learning. Developers search for 'Matplotlib charts', 'Seaborn heatmaps', and 'Plotly dashboards'.",
    keywords: ['Matplotlib', 'Seaborn', 'Plotly', 'charts', 'heatmaps', 'dashboards'],
    relatedDomains: ['machine-learning', 'python-development', 'data-analysis'],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 6222,
      category: 'machine-learning',
      platform: 'Pypi',
    },
  },
  {
    domain: 'javascript',
    description:
      "JavaScript is a dynamic programming language used for creating interactive web pages. It supports event-driven, functional, and imperative programming styles. Developers use APIs like DOM manipulation, Fetch API for AJAX calls, and frameworks like React and Vue.js. Common searches include 'ES6 syntax', 'async/await', and 'JavaScript frameworks'.",
    keywords: ['DOM', 'Fetch API', 'React', 'Vue.js', 'ES6', 'async/await'],
    relatedDomains: ['web-development', 'frontend', 'node.js'],
    boostFactor: 1.5,
    metadata: {
      source: 'libraries.io',
      popularity: 4508,
      category: 'frontend',
      platform: 'Pypi',
    },
  },
  {
    domain: 'redis',
    description:
      "Redis is an in-memory data structure store, used as a database, cache, and message broker. It supports data structures such as strings, hashes, lists, and sets. Developers search for 'Redis caching', 'Pub/Sub messaging', and 'Redis commands'.",
    keywords: ['caching', 'Pub/Sub', 'Redis commands', 'data structures'],
    relatedDomains: ['database', 'devops', 'web-development'],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 3636,
      category: 'database',
      platform: 'NuGet',
    },
  },
  {
    domain: 'aws',
    description:
      "AWS SDK for Ruby provides APIs for accessing Amazon Web Services, such as S3 for storage, EC2 for compute, and DynamoDB for NoSQL databases. It enables building scalable cloud applications. Developers search for 'AWS S3 integration', 'EC2 instances', and 'DynamoDB operations'.",
    keywords: ['S3', 'EC2', 'DynamoDB', 'AWS SDK', 'cloud applications'],
    relatedDomains: ['devops', 'cloud-computing', 'database'],
    boostFactor: 1.2,
    metadata: {
      source: 'libraries.io',
      popularity: 1486,
      category: 'devops',
      platform: 'Rubygems',
    },
  },
  {
    domain: 'database',
    description:
      'A Ruby library that provides a simple and efficient way to interact with MySQL databases, leveraging the native libmysql library for high performance. Developers commonly use it to execute SQL queries, manage database connections, and handle transactions. It supports basic CRUD operations, connection pooling, and prepared statements.',
    keywords: [
      'libmysql',
      'CRUD',
      'SQL queries',
      'database connections',
      'connection pooling',
      'prepared statements',
      'transactions',
      'MySQL',
      'Ruby',
      'database management',
    ],
    relatedDomains: ['ruby', 'sql', 'database-design'],
    boostFactor: 1.2,
    metadata: {
      source: 'libraries.io',
      popularity: 1388,
      category: 'database',
      platform: 'Rubygems',
    },
  },
  {
    domain: 'deployment',
    description:
      'A Ruby-based tool for automating the deployment of web applications to remote servers via SSH. It simplifies tasks such as file transfer, execution of remote commands, and application restarts. Developers often use it for its capabilities in scripting deployment workflows, managing multiple environments, and integrating with version control systems.',
    keywords: [
      'SSH',
      'remote server',
      'deployment workflows',
      'file transfer',
      'remote commands',
      'version control integration',
      'Ruby',
      'web applications',
      'automation',
    ],
    relatedDomains: ['devops', 'ruby', 'web-development'],
    boostFactor: 1.3,
    metadata: {
      source: 'libraries.io',
      popularity: 1373,
      category: 'devops',
      platform: 'Rubygems',
    },
  },
  {
    domain: 'rust-webassembly',
    description:
      "A technology stack enabling developers to write high-performance web applications by compiling Rust code to WebAssembly (Wasm). It is known for its seamless integration with JavaScript, allowing for the creation of rich, client-side applications. Key features include the use of wasm-bindgen for JavaScript interoperability, wasm-pack for packaging, and the use of WebAssembly's linear memory for efficient data handling.",
    keywords: [
      'wasm-bindgen',
      'wasm-pack',
      'WebAssembly',
      'Rust',
      'JavaScript interoperability',
      'linear memory',
      'high-performance web applications',
      'client-side applications',
      'compiling Rust',
    ],
    relatedDomains: ['frontend', 'rust', 'javascript'],
    boostFactor: 1.4,
    metadata: {
      source: 'libraries.io',
      popularity: 1319,
      category: 'frontend',
      platform: 'Cargo',
    },
  },
];

/**
 * Get a specific domain exemplar by name
 */
export function getDomainExemplar(domain: string): DomainExemplar | undefined {
  return DOMAIN_EXEMPLARS.find((e) => e.domain === domain);
}

/**
 * Get all domain names
 */
export function getAllDomainNames(): string[] {
  return DOMAIN_EXEMPLARS.map((e) => e.domain);
}

/**
 * Get related domains for a given domain
 */
export function getRelatedDomains(domain: string): string[] {
  const exemplar = getDomainExemplar(domain);
  return exemplar?.relatedDomains || [];
}

/**
 * Get boost factor for a domain (for search relevance tuning)
 */
export function getBoostFactor(domain: string): number {
  const exemplar = getDomainExemplar(domain);
  return exemplar?.boostFactor || 1.0;
}

/**
 * Get domains by category
 */
export function getDomainsByCategory(category: string): DomainExemplar[] {
  return DOMAIN_EXEMPLARS.filter((e) => e.metadata?.category === category);
}

/**
 * Get all categories
 */
export function getAllCategories(): string[] {
  const categories = new Set<string>();
  for (const exemplar of DOMAIN_EXEMPLARS) {
    if (exemplar.metadata?.category) {
      categories.add(exemplar.metadata.category);
    }
  }
  return Array.from(categories).sort();
}

/**
 * Search domains by keyword
 */
export function searchDomainsByKeyword(keyword: string): DomainExemplar[] {
  const lowerKeyword = keyword.toLowerCase();
  return DOMAIN_EXEMPLARS.filter(
    (e) =>
      e.keywords.some((k) => k.toLowerCase().includes(lowerKeyword)) ||
      e.domain.toLowerCase().includes(lowerKeyword) ||
      e.description.toLowerCase().includes(lowerKeyword)
  );
}

/**
 * Get top N domains by popularity
 */
export function getTopDomainsByPopularity(limit: number = 10): DomainExemplar[] {
  return DOMAIN_EXEMPLARS.filter((e) => e.metadata?.popularity)
    .sort((a, b) => (b.metadata!.popularity || 0) - (a.metadata!.popularity || 0))
    .slice(0, limit);
}

/**
 * Statistics about the domain collection
 */
export const DOMAIN_STATS = {
  total: 73,
  generatedAt: '2025-10-03T22:38:34.063Z',
  categories: getAllCategories(),
  avgKeywordsPerDomain: 8.0,
  avgBoostFactor: 1.28,
};
