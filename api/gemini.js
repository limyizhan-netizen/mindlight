export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    const { lifeNum, question } = req.body || {};
    if (!question) {
        return res.status(400).json({ error: 'Missing question' });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Missing API key' });
    }
    
    // 简单的类型映射（仅用于提示，不影响核心逻辑）
    const typeNames = ['', '自主型', '协作型', '表达型', '稳定型', '探索型', '责任型', '分析型', '掌控型', '包容型'];
    const typeName = typeNames[lifeNum] || '探索型';
    
    const prompt = `你是心光AI心理认知教练。用户类型编号：${lifeNum}（${typeName}）。
用户问题：${question}

回复准则：
1. 共情：先认可用户的情绪。
2. 归因：结合其认知偏好解释为何这个问题会让他困扰。
3. 建议：提供一个低门槛的心理调适建议。
4. 语气：严谨、温暖，使用“或许可以尝试”、“另一种视角是”等非绝对化用语。
5. 禁令：严禁使用玄学词汇；严禁给出确定的决策指令；不加结束问句。
6. 返回JSON格式：{ "answer": "回答内容（约80字）", "questions": ["我...（第一人称卡顿感问题1）", "我...（问题2）", "我...（问题3）"] }`;

    const modelList = ['gemini-2.0-flash-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'];
    for (const model of modelList) {
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
                console.warn(`Model ${model} failed: ${response.status}`);
                continue;
            }
            const data = JSON.parse(rawText);
            if (!data.candidates?.[0]) continue;
            const textContent = data.candidates[0].content.parts[0].text;
            const parsed = JSON.parse(textContent);
            return res.status(200).json(parsed);
        } catch (err) {
            console.error(`Model ${model} error:`, err);
            continue;
        }
    }
    return res.status(503).json({ error: 'All models unavailable. Please try later.' });
}
