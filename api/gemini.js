export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { lifeNum, question } = req.body || {};
    if (!question) {
        return res.status(400). json({ error: 'Missing question' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Missing API key' });
    }

    // 模型优先级（按顺序尝试）
    const modelList = [
        'gemini-2.5-flash',   // 稳定版，推荐
        'gemini-2.5-pro',     // 更强大，备用
        'gemini-2.0-flash'    // 旧版稳定，兜底
    ];

    const prompt = `你是心光AI心理认知教练。用户类型编号：${lifeNum}。
用户问题/难题：${question}。

回复准则：
1. 共情：先认可用户的情绪。
2. 归因：结合其认知偏好解释为何这个问题会让他困扰。
3. 建议：提供一个低门槛的心理调适建议。
4. 语气：严谨、温暖，使用“或许可以尝试”、“另一种视角是”等非绝对化用语。
5. 禁令：严禁使用玄学词汇；严禁给出确定的决策指令；不加结束问句。

返回JSON格式：
{
  "answer": "回答内容（约80字）",
  "questions": [
    "用户可能遇到的卡顿感问题1（第一人称问句）",
    "用户可能遇到的卡顿感问题2（第一人称问句）",
    "用户可能遇到的卡顿感问题3（第一人称问句）"
  ]
}`;

    // 带重试的请求函数
    async function callModel(model, retry = true) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: "application/json" }
                })
            });
            const rawText = await response.text();
            if (!response.ok) {
                // 如果是 503 且允许重试，等待 1 秒后重试一次
                if (response.status === 503 && retry) {
                    console.log(`Model ${model} 503, retrying in 1s...`);
                    await new Promise(r => setTimeout(r, 1000));
                    return callModel(model, false);
                }
                throw new Error(`HTTP ${response.status}: ${rawText}`);
            }
            const data = JSON.parse(rawText);
            if (!data.candidates?.[0]) throw new Error('No candidates');
            const textContent = data.candidates[0].content.parts[0].text;
            return JSON.parse(textContent);
        } catch (err) {
            console.error(`Model ${model} failed:`, err.message);
            throw err;
        }
    }

    // 遍历模型
    for (const model of modelList) {
        try {
            const result = await callModel(model);
            return res.status(200).json(result);
        } catch (err) {
            // 继续下一个模型
        }
    }

    // 全部失败
    return res.status(503).json({ error: 'All models unavailable. Please try later.' });
}
