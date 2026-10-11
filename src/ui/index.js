// ProActive Fashion — design system barrel.
//
// Every entry point below is a plain module: this file deliberately does NOT
// import CSS. Styles are loaded once, in the right order, from main.jsx:
//   tokens.css -> index.css (base) -> styles/components.css
// If this file imported them too, a page that only renders one component would
// drag in the whole stylesheet in an unpredictable order.

export * from "./format";
export * from "./icons";
export * from "./primitives";
export * from "./forms";
export * from "./overlays";
export * from "./states";
export * from "./commerce";
export * from "./chrome";
export * from "./admin";
