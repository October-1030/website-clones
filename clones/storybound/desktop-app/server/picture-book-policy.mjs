const environmentOnlyPattern = /(?:纯环境|空镜|无角色|不出现角色|不出现人物|环境全景|风景空镜|物件空镜|只有环境|只有物件)/u;
const childCharacterPattern = /(?:主角|角色|孩子|儿童|宝宝|男孩|女孩|小朋友|小兔|兔子|小熊|狐狸|恐龙|小猫|小狗|小鸟|小鹿|小象|小猴|松鼠|小鸭|小鹅|小猪|小羊|狮子|老虎|大灰狼|企鹅|刺猬|青蛙|蜜蜂|蝴蝶|蚂蚁|小鱼|小龙)/u;
const characterActionPattern = /(?:推开|走过|跳过|跑向|看着|说话|大笑|哭泣|拿起|抱住|坐下|站起|躲在|寻找|询问|递给|吃着|喝着|睡着|醒来|唱歌|飞过|爬上|游过|挥手|敲门)/u;
const pureScenePattern = /(?:森林|草地|花田|河流|小溪|夜空|月亮|星星|彩虹|天空|小屋|树洞|蘑菇屋|海边|沙滩|云朵|风景|环境|物件|道具)/u;

function value(value) {
  return String(value || "").trim();
}

function shotPrompt(shots, prompts, shot, index) {
  return prompts.find((item) => Number(item?.shotId || item?.id) === Number(shot?.id)) || prompts[index] || {};
}

export function isPictureBookTrack(track) {
  return track?.id === "picture-book" || track?.name === "绘本故事";
}

export function pictureBookShotUsesReference(shot, provided = {}) {
  if (typeof provided.useReference === "boolean") return provided.useReference;
  if (typeof provided.use_reference === "boolean") return provided.use_reference;
  const combined = [shot?.text, shot?.visual, provided.prompt, provided.desc_prompt]
    .map(value)
    .filter(Boolean)
    .join(" ");
  if (environmentOnlyPattern.test(combined)) return false;
  if (childCharacterPattern.test(combined)) return true;
  if (characterActionPattern.test(combined)) return true;
  if (pureScenePattern.test(combined)) return false;
  // Picture-book prompts commonly use a short invented name (豆豆、跳跳等)
  // without repeating “主角”. Non-environment shots therefore keep the
  // character reference by default instead of being converted to an empty set.
  return true;
}

export function buildPictureBookReferencePlan(shots = [], prompts = []) {
  const plan = new Map();
  shots.forEach((shot, index) => {
    plan.set(shot.id, pictureBookShotUsesReference(shot, shotPrompt(shots, prompts, shot, index)));
  });
  return plan;
}

export function pictureBookComposition(index, useReference) {
  if (!useReference) {
    return "按字幕设计清晰可辨的童话环境或关键物件；只有字幕确实不出现角色时才使用空镜，禁止改成历史纪实场景";
  }
  const slot = index % 6;
  if (slot === 0) return "中景，完整展示固定角色的外形、动作与童话环境，角色占画面约45%至60%";
  if (slot === 1 || slot === 4) return "全景或远景，展示角色在梦幻场景中的行动，环境占画面60%以上";
  if (slot === 2) return "近景但保留身体动作和环境线索，突出夸张而友好的表情，不做写实儿童肖像";
  return "中景或俯拍，角色与道具发生明确互动，相邻镜头不得连续使用同一景别";
}

export function compactPictureBookProviderPrompt({
  item,
  shotId,
  task,
  aspectRatio,
  useReference,
}) {
  const shot = task?.artifacts?.storyboard?.shots?.find((candidate) => Number(candidate.id) === Number(shotId));
  const sourcePrompt = value(item?.prompt || item?.desc_prompt);
  if (Number(shotId) >= 9000) return sourcePrompt;
  const fallback = [shot?.visual, shot?.text]
    .map(value)
    .filter(Boolean)
    .join("，") || "可爱绘本角色在明亮、梦幻且清晰可辨的童话场景中行动";
  const scenePrompt = sourcePrompt || `儿童绘本画面，${aspectRatio} 构图，${fallback}`;
  if (!useReference) {
    return `${scenePrompt}。严格保留本镜的儿童绘本题材与当前所选画风；不得偏离为成人写实题材或真实儿童照片`;
  }
  return [
    scenePrompt,
    "所附图片是本任务固定绘本主角的唯一视觉参考；严格保持角色的种类、颜色、体型、服饰和标志性特征",
    "参考图只约束角色身份，不复制参考图背景；动作、场景、光影和景别必须服从本镜提示词",
    "禁止改成其他角色或真实儿童肖像，不得偏离当前绘本画风",
  ].join("。");
}
