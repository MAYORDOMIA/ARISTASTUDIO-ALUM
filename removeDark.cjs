const fs = require("fs");
const _path = require("path");

function removeDarkClasses(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = _path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== "node_modules" && file !== ".git" && file !== "dist") {
        removeDarkClasses(fullPath);
      }
    } else if (
      fullPath.endsWith(".tsx") ||
      fullPath.endsWith(".ts") ||
      fullPath.endsWith(".html")
    ) {
      let content = fs.readFileSync(fullPath, "utf8");
      // Regex to remove dark:something
      // e.g. dark:bg-slate-800 dark:hover:text-red-500  dark:bg-[#1c1c1c]
      // We want to replace `dark:[a-zA-Z0-9_/[#\-%]+` with empty string
      const updated = content.replace(
        /dark:[A-Za-z0-9_/[#\-%]+:?[A-Za-z0-9_/[#\-%]*/g,
        "",
      );
      if (content !== updated) {
        // Ensure no double spaces
        const clean = updated.replace(/\s{2,}/g, " ");
        fs.writeFileSync(fullPath, clean, "utf8");
        console.log("Cleaned", fullPath);
      }
    }
  }
}

removeDarkClasses(__dirname);
