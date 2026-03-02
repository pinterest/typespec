# Planning Guide

Detailed interactive planning methodology for TypeSpec emitters.

## Table of Contents

- [Planning methodology](#planning-methodology)
- [Questions by emitter type](#questions-by-emitter-type)
- [Type mapping table template](#type-mapping-table-template)
- [Output file structure planning](#output-file-structure-planning)
- [Design doc template](#design-doc-template)
- [When to use plan mode](#when-to-use-plan-mode)

## Planning methodology

### Step 1: Understand the target

Start by understanding WHAT the emitter should produce, not HOW it produces it. The target output drives every design decision.

Ask the user to describe the desired output as if they were explaining to another developer: "Given this TypeSpec, I want files that look like _this_."

### Step 2: Write example output by hand

Take a representative TypeSpec spec:

```tsp
@service({ title: "Widget Service" })
namespace WidgetService;

model Widget {
  id: string;
  name: string;
  weight: float32;
  tags?: string[];
}

model WidgetList {
  items: Widget[];
  nextLink?: url;
}

@route("/widgets")
interface Widgets {
  @get list(): WidgetList;
  @get read(@path id: string): Widget;
  @post create(@body widget: Widget): Widget;
}
```

Write the EXACT desired output. Every file, every line. This eliminates ambiguity.

### Step 3: Identify patterns

From the hand-written output, identify:

- How each TypeSpec type maps to the target language
- What boilerplate/framework code surrounds the generated types
- What imports or dependencies are needed
- What naming transformations are applied
- What file organization is used

### Step 4: Document decisions in a design doc

Formalize everything into a design doc (see template below).

## Questions by emitter type

### Server stubs emitter

- What web framework? (Express, FastAPI, ASP.NET, etc.)
- Request/response model style? (classes, interfaces, DTOs)
- Validation approach? (decorators, schemas, runtime checks)
- How should routes be organized? (by interface? by resource?)
- Error handling pattern? (exceptions, result types, error codes)
- Should middleware be generated? (auth, logging, validation)

### Client SDK emitter

- What HTTP client library? (fetch, axios, httpx, HttpClient)
- Sync or async API? (or both?)
- Authentication patterns? (API key, OAuth, custom headers)
- Error handling? (exceptions, result types)
- Should request/response types be separate from models?
- Serialization approach? (JSON, custom encoders)

### Data models only emitter

- What class/type style? (interfaces, classes, dataclasses, structs)
- Serialization support? (JSON, protobuf, custom)
- Validation annotations? (Zod, Pydantic, DataAnnotations)
- Inheritance or composition? (extends, has-a)
- Nullability handling? (optional vs. nullable vs. both)

### Configuration/schema emitter

- What format? (JSON Schema, YAML, TOML, HCL)
- How should nesting be represented?
- What metadata should be preserved? (descriptions, constraints, defaults)

## Type mapping table template

Create a mapping table for each relevant TypeSpec type:

| TypeSpec construct | Target output | Notes |
|-------------------|---------------|-------|
| `model` | (class/interface/struct) | |
| `model` property | (field/attribute/member) | |
| `enum` | (enum/const/literal union) | |
| `union` | (union type/variant) | |
| `operation` | (function/method) | |
| `interface` | (class/module/service) | |
| `scalar extends string` | (string alias/newtype) | |
| `string` | (string type) | |
| `int32` | (int/number/i32) | |
| `float32` | (float/number/f32) | |
| `boolean` | (bool/boolean) | |
| `utcDateTime` | (DateTime/datetime/Date) | |
| `bytes` | (Buffer/bytes/[]byte) | |
| `url` | (string/URL/Uri) | |
| `T[]` (array) | (Array/List/Vec) | |
| `Record<T>` | (Map/Dict/HashMap) | |
| `T \| null` | (Optional/nullable) | |

## Output file structure planning

### Common patterns

**One file per type:**
```
output/
├── models/
│   ├── widget.ts
│   ├── widget-list.ts
│   └── index.ts (barrel)
├── operations/
│   └── widgets.ts
└── index.ts
```

**Grouped by namespace:**
```
output/
├── widget-service/
│   ├── models.py
│   ├── operations.py
│   └── __init__.py
└── __init__.py
```

**Single file:**
```
output/
└── types.ts
```

### Decision factors

- **Target language conventions** — Python prefers fewer files with many classes; Go prefers one type per file.
- **Import ergonomics** — How will consumers import the generated code?
- **Build tooling** — Does the target framework expect a specific layout?

## Design doc template

```markdown
# Emitter Design: [Name]

## Target
- **Language:** [e.g., Python 3.11+]
- **Framework:** [e.g., FastAPI with Pydantic v2]
- **Purpose:** [e.g., Generate server stubs for REST APIs]
- **Runtime deps:** [e.g., fastapi, pydantic, uvicorn]

## Type mapping

| TypeSpec | Output | Example |
|----------|--------|---------|
| model | Pydantic BaseModel | `class Widget(BaseModel):` |
| ... | ... | ... |

## File layout
[Directory tree with explanation]

## Mutation strategy
- [List simplifications needed, or "None — component logic is sufficient"]
- e.g., "Flatten spread types before emission"
- e.g., "Normalize nullable unions to Optional[T]"

## Component architecture
- `Output` wrapper with Python name policy and external modules
- `Models` — iterates models, emits one SourceFile per model
- `Operations` — iterates interfaces/operations, emits route handlers
- [Custom components as needed]

## Open questions
- [Any unresolved design decisions]
```

## When to use plan mode

Enter plan mode when:

- Building a new emitter from scratch (always)
- Adding a major new feature to an existing emitter
- The target framework has complex conventions
- The user is unsure about their desired output

Skip plan mode when:

- Making small fixes to an existing emitter
- The user has provided a complete design doc
- Adding a simple component to a well-established emitter
