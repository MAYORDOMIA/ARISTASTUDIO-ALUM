const fs = require("fs");
const path = require("path");

function walk(dir, filelist = []) {
  const files = fs.readdirSync(dir);
  files.forEach(function (file) {
    const filepath = path.join(dir, file);
    const stat = fs.statSync(filepath);
    if (stat.isDirectory()) {
      walk(filepath, filelist);
    } else if (filepath.endsWith(".tsx")) {
      filelist.push(filepath);
    }
  });
  return filelist;
}

const files = walk(".");

files.forEach((file) => {
  let content = fs.readFileSync(file, "utf8");
  // Regex: matches {' '} or {" "} or { " " } and removes it
  const newContent = content.replace(/\{\s*["']\s*["']\s*\}/g, "");
  if (content !== newContent) {
    fs.writeFileSync(file, newContent);
    console.log(`Fixed: ${file}`);
  }
});
