function sourcePrompt(item) {
  return String(item?.prompt || item?.desc_prompt || item?.visual_prompt || item?.scene || "").trim();
}

export function isCharacterStoryTrack(track) {
  return track?.id === "character-story";
}

export function isProductReferenceTrack(track) {
  return track?.referenceKind === "product";
}

export function referencePlanMode(track) {
  if (track?.id === "picture-book") return "picture-book";
  if (isCharacterStoryTrack(track)) return "biography-balanced";
  if (track?.needsCharacterCard || isProductReferenceTrack(track)) return "per-shot";
  return "none";
}

export function compactTrackProviderPrompt({ item, shotId, task, track, useReference }) {
  const prompt = sourcePrompt(item);
  if (Number(shotId) >= 9000 || !useReference) return prompt;

  const guidance = String(task?.options?.referenceGuidance || "").trim();
  if (isProductReferenceTrack(track)) {
    return [
      `严格${track?.name || "产品"}参考：所附图片只用于锁定核心产品或器物的真实外形。`,
      guidance,
      prompt,
      "保持参考物的轮廓、比例、材质、颜色、结构和可辨识细节一致；只改变本镜要求的环境、角度、光线和使用场景，不得把参考图背景照搬进来。",
      "参考物不是人物身份参考；不得把产品或器物变成人脸、老人或其他历史人物。画面不得生成乱码、水印或未在参考图中存在的品牌文字。",
    ].filter(Boolean).join(" ");
  }

  return [
    "严格主角参考：所附图片是当前任务主角的唯一视觉身份参考，不得继承其他任务的人脸、年龄、胡须、服装或时代特征。",
    guidance,
    prompt,
    "保持参考图的脸型、五官比例、发型、族裔和标志特征；同时执行本镜要求的年龄、服装、地点、动作、景别与风格，参考图背景不得复制。",
  ].filter(Boolean).join(" ");
}

export function referenceDisciplineForTrack(track) {
  if (track?.id === "picture-book") {
    return `\n绘本主角参考纪律（与原客户端 character + force 契约一致）：\n- 每条 prompt 必须返回 useReference 布尔值。\n- 固定主角或固定配角实际出现时为 true；纯环境、关键物件和没有角色的空镜为 false。\n- 角色出现时必须保持种类、颜色、体型、服饰和标志特征一致；不得替换为真实儿童或历史人物。\n- 不得为了凑空镜比例移除字幕中实际出现的角色；景别按特写/中景/全景交替。`;
  }
  if (isCharacterStoryTrack(track)) {
    return `\n人物参考图纪律（与原客户端 use_reference 契约一致）：\n- 每条 prompt 必须返回 useReference 布尔值。\n- 只有主角本人实际出现在画面中时才为 true；纯环境、建筑、街景、道具、文件、唱片、胶片、空镜和配角独立镜头必须为 false。\n- 人物故事应同时包含 true 和 false，禁止整批全为 true。\n- 不得连续 3 镜使用面部近景或大头特写；整体尽量按近景/中景/全景约 3:4:3 分布。\n- 没有人物的句子优先设计可讲故事的时代场景或关键物件，不要为了使用参考图强塞主角。`;
  }
  if (track?.id === "folk-tale") {
    return `\n民间故事角色参考纪律：\n- 每条 prompt 必须返回 useReference 布尔值。\n- 角色档案中的固定主角实际出现时为 true；纯环境、关键物件、配角独立镜头为 false。\n- 必须服从故事中的朝代、地域、年龄和身份，不得套用民国传记人物、现代服装或西方老人形象。\n- 不设置传记片的固定空镜比例；是否出现主角只按当前字幕语义判断。`;
  }
  if (isProductReferenceTrack(track)) {
    return `\n产品 / 器物参考纪律（与原客户端 referenceKind=product 契约一致）：\n- 每条 prompt 必须返回 useReference 布尔值。\n- 用户上传的核心书籍、食材、器具、文化器物或商品实际出现时为 true；不出现该物的镜头为 false。\n- 参考图只锁定产品或器物外观，不得当作人物脸部参考。\n- 同一产品跨分镜的轮廓、材质、颜色和结构必须一致。`;
  }
  return "\n每条 prompt 必须返回 useReference: false。";
}
