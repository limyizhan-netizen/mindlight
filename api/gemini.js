// api/gemini.js
export default async function handler(req, res) {
    // 只允许 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { lifeNum, question } = req.body;

    if (!question) {
        return res.status(400).json({ error: 'Missing question' });
    }

    // 从环境变量读取 Gemini API Key（在 Vercel 后台配置）
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const prompt = `你是心光AI心理认知教练。用户类型编号：${lifeNum}。
用户问题/难题：${question}。

回复准则：
1. 共情：先认可用户的情绪。
2. 归因：结合其认知偏好解释为何这个问题会让他困扰。
3. 建议：提供一个低门槛的心理调适建议。
4. 语气：严谨、温暖，使用“或许可以尝试”、“另一种视角是”等非绝对化用语。
5. 禁令：严禁使用玄学词汇；严禁给出确定的决策指令；不加结束问句。

返回JSON格式：{ "answer": "回答内容", "suggestions": ["建议1", "建议2", "建议3"] }`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        const data = await response.json();
        if (!data.candidates || !data.candidates[0]) {
            throw new Error('Invalid response from Gemini');
        }

        const text = data.candidates[0].content.parts[0].text;
        const parsed = JSON.parse(text);
        res.status(200).json(parsed);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'AI service temporarily unavailable' });
    }
}