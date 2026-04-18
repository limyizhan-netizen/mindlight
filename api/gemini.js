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

    const prompt = `你是心光AI心理认知教练。当前用户的认知类型是：${userType.name}型（${userType.trait}）。
用户问题：${question}

回复要求：
1. 结合用户的认知类型给出个性化建议，可以在回复中偶尔温和地提及类型名称（如“作为自主型，你可能会…”），但不要过度使用。
2. 共情、归因、建议，语气温暖。
3. 严禁玄学词汇，不加结束问句。
4. 返回JSON格式：{
  "answer": "回答内容（约80字）",
  "questions": [
    "我...（第一人称的卡顿感问题1）",
    "我...（第一人称的卡顿感问题2）",
    "我...（第一人称的卡顿感问题3）"
  ]
}
注意：questions 中的三个问题必须是第一人称问句，描述用户可能遇到的内心困扰或卡顿点，不要给出建议。示例：“我该如何拒绝不合理的请求？”、“为什么我总在关系中感到疲惫？”`;

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
