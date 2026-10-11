// Allowlist for document paths in the GitHub-backed store.
//
// The bytes of a generated bill live in a GitHub repository at a path this
// app chose: <module>/<referenceType>/<referenceId>/<timestamp>-<fileName>.
// The download and delete endpoints accept a path from the caller, so a path
// that does not match this exact shape is a request to read or remove a file
// this app never wrote - a traversal attempt, not a document. Everything
// outside the four-segment shape is refused here, before any GitHub call.

const MODULE = "[a-z_-]{1,50}";
const REF_TYPE = "[a-z_-]{1,50}";
const REF_ID = "[a-zA-Z0-9_-]{1,128}"; // order numbers are PA-XXXXXX
const STAMP = "[0-9]{1,20}";
const NAME = "[a-zA-Z0-9._-]{1,200}";

const SAFE_DOC_PATH_REGEX = new RegExp(`^${MODULE}/${REF_TYPE}/${REF_ID}/${STAMP}-${NAME}$`);

const MAX_PATH_LENGTH = 500;
const NAME_LIMIT = 200;

export function isValidDocumentPath(path) {
  const value = String(path ?? "");
  return (
    value.length > 0 &&
    value.length <= MAX_PATH_LENGTH &&
    !value.includes("..") &&
    !value.startsWith("/") &&
    SAFE_DOC_PATH_REGEX.test(value)
  );
}

// Returns the four segments, or null when the path is not one this app wrote.
export function parseDocumentPath(path) {
  if (!isValidDocumentPath(path)) return null;
  const [module, referenceType, referenceId, rest] = String(path).split("/");
  const stamp = rest.slice(0, rest.indexOf("-"));
  const fileName = rest.slice(rest.indexOf("-") + 1);
  return { module, referenceType, referenceId, stamp, fileName };
}

// Same character policy for the parts a caller may still influence: a file
// name can carry anything the OS allows, so it is reduced to the safe set
// instead of trusted. Dot-runs collapse and a name never starts with a dot,
// so a crafted name cannot smuggle ".." into the path (the path allowlist
// rejects it anyway - this is the second layer).
export function safeFileName(fileName) {
  const cleaned = String(fileName ?? "file")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/\.{2,}/g, "_")
    .replace(/^[._-]+/, "_");
  return cleaned.slice(0, NAME_LIMIT) || "file";
}

export function buildRepositoryPath({ module, referenceType, referenceId, fileName, now = Date.now() }) {
  return [
    module,
    referenceType,
    referenceId,
    `${now}-${safeFileName(fileName)}`
  ].join("/");
}
