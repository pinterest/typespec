import type { SymbolCreator } from "@alloy-js/core";
import { createModule } from "@alloy-js/python";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type dummy = SymbolCreator;

export const datetimeModule = createModule({
  name: "datetime",
  descriptor: {
    ".": ["datetime", "date", "time", "timedelta", "timezone"],
  },
});

export const dataclassesModule = createModule({
  name: "dataclasses",
  descriptor: {
    ".": ["dataclass", "field"],
  },
});

export const decimalModule = createModule({
  name: "decimal",
  descriptor: {
    ".": ["Decimal"],
  },
});

export const typingModule = createModule({
  name: "typing",
  descriptor: {
    ".": ["Any", "Literal", "NoReturn", "Tuple"],
  },
});

export const typingExtensionsModule = createModule({
  name: "typing_extensions",
  descriptor: {
    ".": ["TypedDict"],
  },
});
