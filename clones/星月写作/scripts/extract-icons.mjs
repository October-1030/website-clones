import { readFile, writeFile } from 'node:fs/promises';
const icons = JSON.parse(await readFile(new URL('../docs/research/icons.json', import.meta.url), 'utf8'));
const names = ['Cart','Wallet','Receipt','Bell','Mail','History','Palette','Books','Idea','Workflow','Script','Chart','Prompt','Knowledge','Course','User','Forum','Info','Collapse','Close','Alert','Library','Archive','Trash','Folder','Grid','Compact','List','Search','Checklist','PlusCircle','SmallPlus','Import','Chevron','MoreChevron','Gift','Arrow','Pin','SecondPin','Down'];
let code = 'import type { SVGProps } from "react";\n\n';
icons.forEach((icon, i) => {
  const content = icon.html.replace(/\s(?:on\w+|style|class)="[^"]*"/g, '').replace(/([a-z]+)-([a-z])/g, (_, a, b) => a + b.toUpperCase());
  if (/<(?:script|foreignObject|image|use)\b/i.test(content)) throw new Error('Unexpected SVG content');
  code += `export function ${names[i] || 'Source'+i}Icon(props: SVGProps<SVGSVGElement>) {\n  return <svg viewBox="${icon.viewBox}" width="1em" height="1em" aria-hidden="true" {...props}>${content}</svg>;\n}\n\n`;
});
await writeFile(new URL('../src/components/icons.tsx', import.meta.url), code);
console.log(`Extracted ${icons.length} SVG icons`);
