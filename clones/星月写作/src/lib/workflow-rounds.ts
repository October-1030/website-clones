export function buildWorkflowRoundPrompt(base: string, previous: string, round: number, count: number): string {
  if (!Number.isInteger(count) || count < 1 || count > 10 || !Number.isInteger(round) || round < 1 || round > count) throw new Error("循环次数必须为1至10次。");
  const prompt = count === 1 ? base : `${base}\n\n这是连续工作流第${round}/${count}轮。每轮只输出一个新章节或任务结果。${previous ? `保持以下上一轮结果中的人物、规则和因果连续，继续推进，不要重写上一轮内容：\n<previous-result>\n${previous}\n</previous-result>` : "按初始输入开始第一轮。"}`;
  if (prompt.length > 30000) throw new Error("初始要求与上一轮内容合计超过30000字符，已停止后续轮次。请缩短输入或单轮输出后重试。");
  return prompt;
}
