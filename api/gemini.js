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
        console.error('GEMINI_API_KEY is not set');
        return res.status(500).json({ error: 'Server configuration error: missing API key' });
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

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        // 获取原始响应文本（无论是否成功）
        const rawText = await response.text();
        console.log('Gemini response status:', response.status);
        console.log('Gemini response body:', rawText);

        if (!response.ok) {
            // 返回具体的 Gemini 错误信息
            return res.status(response.status).json({ 
                error: 'Gemini API error', 
                details: rawText 
            });
        }

        // 尝试解析 JSON
        let data;
        try {
            data = JSON.parse(rawText);
        } catch (e) {
            console.error('Failed to parse Gemini response as JSON:', rawText);
            return res.status(500).json({ error: 'Invalid JSON from Gemini', raw: rawText });
        }

        if (!data.candidates || !data.candidates[0]) {
            console.error('Gemini response missing candidates:', data);
            return res.status(500).json({ error: 'Gemini returned no candidates', fullResponse: data });
        }

        const textContent = data.candidates[0].content.parts[0].text;
        // 尝试解析 AI 返回的 JSON 内容
        let parsed;
        try {
            parsed = JSON.parse(textContent);
        } catch (e) {
            console.error('AI response is not valid JSON:', textContent);
            return res.status(500).json({ error: 'AI response format error', raw: textContent });
        }

        res.status(200).json(parsed);
    } catch (error) {
        console.error('Handler error:', error);
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
}
