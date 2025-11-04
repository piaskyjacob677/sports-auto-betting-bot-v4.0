const path = require("path");
exports.resolveApp = relativePath=> path.resolve(process.cwd(), relativePath);