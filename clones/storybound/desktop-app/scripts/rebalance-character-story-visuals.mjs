const baseUrl = "http://127.0.0.1:5173";
const [taskId] = process.argv.slice(2);

if (!taskId) {
  throw new Error("Usage: node scripts/rebalance-character-story-visuals.mjs <task-id>");
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${await response.text()}`);
  return response.json();
}

// Keep a reference only where the protagonist performs a visible, story-critical
// action.  All other shots are intentionally routed to environment/object prompts
// so a reference portrait cannot dominate the edit.
const yuYourenActionShots = new Set([6, 7, 11, 13, 14, 16, 19, 20, 23, 24, 27, 28, 30, 40, 42]);
const yuYourenReferenceShots = new Set([6, 7, 11, 13, 14, 16, 19, 20, 23, 24, 27, 28, 30, 40, 42]);
const environmentScenes = {
  1: "a rain-darkened 1964 Taipei side street with flower wreaths, an empty wooden chair, closed shop shutters, and no signs",
  2: "a wide empty old Taipei street after rain, rows of vacant wooden chairs, flower wreaths, overhead wires, and no signs",
  3: "a shadowed empty apartment interior with a wooden cabinet, a single lamp, and an unoccupied stool",
  4: "an empty iron safe open in a plain old room, a worn wooden cabinet, and a table lamp",
  5: "worn cloth shoes, mended socks, sealed envelopes turned face-down, and an ink bottle on an old wooden table",
  8: "an inkstone, worn brushes, rolled blank rice paper, a wooden brush rack, and a quiet study window",
  9: "a calligrapher's study with inkstone, brushes, a blank scroll rolled shut, a low table, and shelves",
  10: "a closed plain notebook beside a small oil lamp and an inkstone in a dark quiet room",
  12: "an empty old temple courtyard in Shaanxi, tiled eaves, wet stone steps, bare branches, and windblown leaves",
  15: "an empty Republican-era Shanghai street at night, wet tram tracks, closed storefronts with no signs, and a distant streetlamp",
  17: "an empty historic printing room with hand-operated presses, blank paper rolls, iron type cases, and window light",
  18: "an empty newspaper workshop after closure, an idle hand press, stacked blank paper rolls, a locked door, and dust in window light",
  21: "an empty rural schoolroom in Shaanxi, wooden desks, a small stove, open windows, and afternoon light",
  22: "an empty rural school courtyard with a wooden gate, stone path, bare trees, and a modest classroom beyond",
  25: "a quiet Republican-era office corridor with a row of empty benches, coat hooks, a wooden doorway, and soft light",
  26: "a winter entryway with child-size cloth shoes, a folded blanket, a wooden bench, and a dim window",
  29: "an empty Chongqing thatched cottage by the river, a wooden desk, inkstone, donation box, and mountain mist",
  31: "a rough wooden table with a small dish of peanuts, a clay teapot, two empty stools, and a thatched wall",
  32: "a windswept thatched cottage interior with a clay teapot, a simple map turned face-down, and two empty stools",
  33: "bundled coin pouches, an inkstone, worn brush handles, and a plain wooden donation box on a table",
  34: "a pile of worn brush handles, an inkstone, a cloth brush roll, and blank paper rolls on a wooden desk",
  35: "a military satchel, a folded winter coat, a canteen, and tightly rolled blank paper on rough ground",
  36: "an empty folded military coat with a closed plain booklet tucked into its inner pocket, mud, and a field lantern",
  37: "an empty battlefield coat on muddy ground, a sealed cloth packet in its pocket, a canteen, and rain",
  38: "two battered travel cases, folded clothing, a tied cloth packet, and a bare wooden floor beside a window",
  39: "a modest Taiwan room with rolled stone rubbings tied shut, a wooden table, a walking stick, and window light",
  41: "an empty window facing a river and distant mountains, a walking stick leaning beside a wooden chair",
  43: "an empty high mountain stone path, windblown grass, distant ridges, and a simple unmarked stone plinth",
  44: "an empty mountain overlook facing northwest, stone steps, windblown conifers, and distant ridges",
  45: "mountain clouds beyond an old wooden desk, an inkstone, a brush holder, and an unrolled blank cloth",
  46: "an old inkstone, a brush holder, a sealed plain paper packet, and a dim oil lamp on a simple table",
  47: "a brush, an inkstone, a blank rolled scroll tied shut, and a worn cloth sleeve on an old desk",
  48: "a stack of folded donated winter coats, tied schoolbooks with their covers hidden, and a plain wooden bench",
  49: "a simple funeral table with brushes, an inkstone, a folded white cloth, and a single unlit lamp",
};

function identityReferenceBoard(taskId) {
  const taskDirectory = `${process.cwd()}/.storybound-data/tasks/${taskId}`;
  return {
    fileName: "yu-youren-primary-identity-reference.jpg",
    path: `${taskDirectory}/uploads/yu-youren-primary-identity-reference.jpg`,
    url: `/api/tasks/${encodeURIComponent(taskId)}/files/uploads/yu-youren-primary-identity-reference.jpg`,
    bytes: 71000,
    // This is the one approved face card sent to MiniMax.  Do not mix in a
    // contact sheet or lower-quality period photos: image-01 accepts a single
    // reference and the most recognisable late-life portrait is the stable anchor.
    sourceUrl: null,
  };
}

async function main() {
  const task = (await requestJson(`/api/tasks/${encodeURIComponent(taskId)}`)).task;
  const current = task.artifacts?.prompts?.prompts;
  const shots = task.artifacts?.storyboard?.shots || [];
  if (!Array.isArray(current) || current.length !== shots.length) {
    throw new Error("任务分镜与提示词数量不一致，停止调整以避免错误覆盖。");
  }

  const prompts = current.map((prompt) => ({
    ...prompt,
    useReference: yuYourenReferenceShots.has(Number(prompt.shotId)),
    characterAction: yuYourenActionShots.has(Number(prompt.shotId)),
    environmentScene: environmentScenes[Number(prompt.shotId)] || undefined,
  }));
  const referenceCount = prompts.filter((prompt) => prompt.useReference).length;
  const identityBoard = identityReferenceBoard(task.id);
  const stepStatuses = [...task.stepStatuses];
  stepStatuses[4] = "pending";
  stepStatuses[6] = "pending";

  await requestJson(`/api/tasks/${encodeURIComponent(task.id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      artifacts: {
        ...task.artifacts,
        prompts: { ...task.artifacts.prompts, prompts },
      },
      options: {
        ...task.options,
        referenceImage: identityBoard,
        referenceGuidance: "人物必须是于右任本人，严格依据所附三张真实历史肖像组成的身份参考板。不可退化为泛化老人。辨识点必须保持：宽而高的额头、浓直而略下压的眉、下垂眼睑、消瘦的长脸、较长鼻梁、两颊和下颌相连的极长银白美髯；晚年胡须须达到胸前并有自然分束。始终是东亚中国男性、民国文人，不得生成为西方人、欧洲人、白人、混血脸、短圆胡子或不同人物。青年镜头只允许年龄回推，骨相、眉眼和长脸必须仍可辨识。",
        referenceGuidance: "The attached image is the single approved, authentic late-life portrait of Yu Youren. It is the sole face card for this task. Treat it as a strict identity reference, not a generic old-man example. Preserve his broad high bald forehead, very heavy straight eyebrows, hooded eyes, long narrow East Asian Chinese face, long bridge nose, sparse cheek beard, and exceptionally long thin central white beard. For young and middle-aged scenes, age and beard length may change, but the high forehead, strong brows, long facial structure, and East Asian Chinese identity must remain recognisable. Never generate a Western, European, white, mixed-race, or generic elderly face; never use a round short beard, a different person, or a portrait pose unless the scene requires it.",
        characterReferenceImages: [identityBoard],
      },
      draft: null,
      stepStatuses,
    }),
  });

  process.stdout.write(`Rebalanced ${task.title}: ${referenceCount} identity-reference action shots, ${prompts.length - yuYourenActionShots.size} environment shots.\n`);
  process.stdout.write(`Reference shots: ${[...yuYourenReferenceShots].join(", ")}\n`);
}

await main();
