import {
  DeprecationNotice,
  NamedTypeRefDoc,
  RefDocEntity,
  TypeSpecLibraryRefDoc,
  TypeSpecRefDoc,
  TypeSpecRefDocBase,
} from "../types.js";
import {
  MarkdownDoc,
  MarkdownSection,
  codeblock,
  inlinecode,
  renderMarkdowDoc,
  section,
} from "../utils/markdown.js";
import { MarkdownRenderer, groupByNamespace } from "./markdown.js";

/**
 * Render doc to a markdown using docusaurus addons.
 */
export function renderToAstroStarlightMarkdown(refDoc: TypeSpecRefDoc): Record<string, string> {
  const renderer = new StarlightRenderer(refDoc);
  const files: Record<string, string> = {
    "index.mdx": renderIndexFile(renderer, refDoc),
  };

  const decoratorFile = renderDecoratorFile(renderer, refDoc);
  if (decoratorFile) {
    files["decorators.md"] = decoratorFile;
  }

  const interfaceFile = renderInterfacesFile(renderer, refDoc);
  if (interfaceFile) {
    files["interfaces.md"] = interfaceFile;
  }

  const dataTypes = renderDataTypes(renderer, refDoc);
  if (dataTypes) {
    files["data-types.md"] = dataTypes;
  }

  const emitter = renderEmitter(renderer, refDoc);
  if (emitter) {
    files["emitter.md"] = emitter;
  }
  const linter = renderLinter(renderer, refDoc);
  if (linter) {
    files["linter.md"] = linter;
  }

  return files;
}

function renderIndexFile(renderer: StarlightRenderer, refDoc: TypeSpecLibraryRefDoc): string {
  const content: MarkdownDoc = [
    "---",
    `title: Overview`,
    `sidebar_position: 0`,
    "toc_min_heading_level: 2",
    "toc_max_heading_level: 3",
    "---",
    "import { Tabs, TabItem } from '@astrojs/starlight/components';",
    "",

    refDoc.description ?? [],
    renderer.install(refDoc),
    refDoc.emitter?.options ? section("Emitter usage", `[See documentation](./emitter.md)`) : [],

    groupByNamespace(refDoc.namespaces, (namespace) => {
      const content = [];

      if (namespace.decorators.length > 0) {
        content.push(section("Decorators", renderer.toc(namespace.decorators)));
      }

      if (namespace.interfaces.length > 0) {
        content.push(section("Interfaces", renderer.toc(namespace.interfaces)));
      }

      if (namespace.operations.length > 0) {
        content.push(section("Operations", renderer.toc(namespace.operations)));
      }

      if (namespace.models.length > 0) {
        content.push(section("Models", renderer.toc(namespace.models)));
      }
      return content;
    }),
  ];

  return renderMarkdowDoc(content, 2);
}

export type DecoratorRenderOptions = {
  title?: string;
};

export function renderDecoratorFile(
  renderer: StarlightRenderer,
  refDoc: TypeSpecRefDocBase,
  options?: DecoratorRenderOptions,
): string | undefined {
  if (!refDoc.namespaces.some((x) => x.decorators.length > 0)) {
    return undefined;
  }
  const title = options?.title ?? "Decorators";
  const content: MarkdownDoc = [
    "---",
    `title: "${title}"`,
    "toc_min_heading_level: 2",
    "toc_max_heading_level: 3",
    "---",
  ];

  content.push(renderer.decoratorsSection(refDoc));
  return renderMarkdowDoc(content, 2);
}

function renderInterfacesFile(
  renderer: StarlightRenderer,
  refDoc: TypeSpecRefDoc,
): string | undefined {
  if (!refDoc.namespaces.some((x) => x.operations.length > 0 || x.interfaces.length > 0)) {
    return undefined;
  }
  const content: MarkdownDoc = ["---", `title: "Interfaces and Operations"`, "---"];

  content.push(
    groupByNamespace(refDoc.namespaces, (namespace) => {
      if (namespace.operations.length === 0 && namespace.interfaces.length === 0) {
        return undefined;
      }

      const content: MarkdownDoc = [];
      for (const iface of namespace.interfaces) {
        content.push(renderer.interface(iface), "");
      }

      for (const operation of namespace.operations) {
        content.push(renderer.operation(operation), "");
      }
      return content;
    }),
  );

  return renderMarkdowDoc(content, 2);
}

export type DataTypeRenderOptions = {
  title?: string;
};

export function renderDataTypes(
  renderer: StarlightRenderer,
  refDoc: TypeSpecRefDoc,
  options?: DataTypeRenderOptions,
): string | undefined {
  if (!refDoc.namespaces.some((x) => x.models.length > 0)) {
    return undefined;
  }
  const title = options?.title ?? "Data types";
  const content: MarkdownDoc = ["---", `title: "${title}"`, "---"];

  content.push(
    groupByNamespace(refDoc.namespaces, (namespace) => {
      const modelCount =
        namespace.models.length +
        namespace.enums.length +
        namespace.unions.length +
        namespace.scalars.length;
      if (modelCount === 0) {
        return undefined;
      }
      const content: MarkdownDoc = [];
      for (const model of namespace.models) {
        content.push(renderer.model(model), "");
      }
      for (const e of namespace.enums) {
        content.push(renderer.enum(e), "");
      }
      for (const union of namespace.unions) {
        content.push(renderer.union(union), "");
      }
      for (const scalar of namespace.scalars) {
        content.push(renderer.scalar(scalar), "");
      }
      return content;
    }),
  );

  return renderMarkdowDoc(content, 2);
}

function renderEmitter(
  renderer: StarlightRenderer,
  refDoc: TypeSpecLibraryRefDoc,
): string | undefined {
  if (refDoc.emitter?.options === undefined) {
    return undefined;
  }
  const content: MarkdownDoc = [
    "---",
    `title: "Emitter usage"`,
    "---",
    renderer.emitterUsage(refDoc),
  ];

  return renderMarkdowDoc(content, 2);
}
function renderLinter(
  renderer: StarlightRenderer,
  refDoc: TypeSpecLibraryRefDoc,
): string | undefined {
  if (refDoc.linter === undefined) {
    return undefined;
  }
  const content: MarkdownDoc = [
    "---",
    `title: "Linter usage"`,
    "---",
    renderer.linterUsage(refDoc),
  ];

  return renderMarkdowDoc(content, 2);
}

export class StarlightRenderer extends MarkdownRenderer {
  headingTitle(item: NamedTypeRefDoc): string {
    // Set an explicit anchor id.
    return `${inlinecode(item.name)} {#${item.id}}`;
  }
  anchorId(item: NamedTypeRefDoc): string {
    // Set an explicit anchor id.
    return item.id;
  }

  install(refDoc: TypeSpecLibraryRefDoc): MarkdownSection {
    return section(
      "Install",
      tabs([
        {
          label: "In a spec",
          content: codeblock(`npm install ${refDoc.name}`, "bash"),
        },
        {
          label: "In a library",
          content: codeblock(`npm install --save-peer ${refDoc.name}`, "bash"),
        },
      ]),
    );
  }

  filename(type: RefDocEntity): string {
    switch (type.kind) {
      case "decorator":
        return "./decorators.md";
      case "operation":
      case "interface":
        return "./interfaces.md";
      case "model":
      case "enum":
      case "union":
        return "./data-types.md";
      default:
        return "";
    }
  }

  linterRuleLink(url: string) {
    const homepage = (this.refDoc.packageJson as any).docusaurusWebsite;
    if (homepage && url.includes(homepage)) {
      const fromRoot = url.replace(homepage, "");
      return `${fromRoot}.md`;
    } else {
      return url;
    }
  }

  deprecationNotice(notice: DeprecationNotice): MarkdownDoc {
    return [":::caution", `**Deprecated**: ${notice.message}`, ":::"];
  }
}

type Tab = {
  label: string;
  content: string;
};

function tabs(tabs: Tab[]) {
  const result = ["<Tabs>"];
  for (const tab of tabs) {
    result.push(`<TabItem  label="${tab.label}" default>`, "", tab.content, "", "</TabItem>");
  }
  result.push("</Tabs>", "");
  return result.join("\n");
}
