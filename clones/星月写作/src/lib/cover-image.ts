export async function composeCover(source: string, title: string, author = "", preserveAspect = false): Promise<string> {
  const image = new Image();
  image.src = source;
  await image.decode();
  const canvas = document.createElement("canvas");
  const fit = Math.min(1, 1248 / Math.max(image.width, image.height));
  canvas.width = preserveAspect ? Math.max(1, Math.round(image.width * fit)) : 832;
  canvas.height = preserveAspect ? Math.max(1, Math.round(image.height * fit)) : 1248;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("当前浏览器不支持封面排版。");
  const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
  ctx.drawImage(image, (canvas.width - image.width * scale) / 2, (canvas.height - image.height * scale) / 2, image.width * scale, image.height * scale);
  if (title.trim()) {
    const shade = ctx.createLinearGradient(0, 0, 0, 550);
    shade.addColorStop(0, "rgba(0,0,0,.75)"); shade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = shade; ctx.fillRect(0, 0, canvas.width, 550);
    ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = "white";
    ctx.font = 'bold 68px "Microsoft YaHei", sans-serif';
    const lines: string[] = []; let line = "";
    for (const char of title.trim()) { if (ctx.measureText(line + char).width > 720 && line) { lines.push(line); line = ""; } line += char; }
    if (line) lines.push(line);
    lines.forEach((value, i) => ctx.fillText(value, 416, 90 + i * 88));
    if (author.trim()) { ctx.font = '30px "Microsoft YaHei", sans-serif'; ctx.fillText(`${author.trim()} 著`, 416, 1150); }
  }
  return canvas.toDataURL("image/jpeg", .88);
}
