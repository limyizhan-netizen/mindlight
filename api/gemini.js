export default async function handler(req, res) {
    // 仅允许 POST 请求
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

    // 模型优先级列表（按顺序尝试）
    const modelList = [
        'gemini-2.5-pro',      // 最强大，优先尝试
        'gemini-2.5-flash',    // 性价比高
        'gemini-2.0-flash'     // 快速备选
    ];

    // 公共 prompt
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

    // 遍历模型尝试
    for (let i = 0; i < modelList.length; i++) {
        const model = modelList[i];
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        try {
            console.log(`[Attempt ${i+1}] Trying model: ${model}`);

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { responseMimeType: "application/json" }
                })
            });

            const rawText = await response.text();
            console.log(`[${model}] HTTP status: ${response.status}`);

            // 如果状态码不是 2xx，记录错误并继续下一个模型
            if (!response.ok) {
                console.warn(`[${model}] failed with status ${response.status}: ${rawText.substring(0, 200)}`);
                continue; // 尝试下一个模型
            }

            // 解析 JSON
            let data;
            try {
                data = JSON.parse(rawText);
            } catch (e) {
                console.error(`[${model}] JSON parse error:`, rawText.substring(0, 200));
                continue;
            }

            // 检查 Gemini 返回结构
            if (!data.candidates || !data.candidates[0]) {
                console.error(`[${model}] No candidates in response:`, JSON.stringify(data).substring(0, 200));
                continue;
            }

            const textContent = data.candidates[0].content.parts[0].text;
            let parsed;
            try {
                parsed = JSON.parse(textContent);
            } catch (e) {
                console.error(`[${model}] AI response not valid JSON:`, textContent.substring(0, 200));
                continue;
            }

            // 成功：返回结果
            console.log(`[${model}] Success!`);
            return res.status(200).json(parsed);
        } catch (error) {
            console.error(`[${model}] Request error:`, error.message);
            continue; // 网络错误等，继续尝试下一个模型
        }
    }

    // 所有模型都失败
    console.error('All models exhausted. Returning 503.');
    return res.status(503).json({ 
        error: 'AI service temporarily unavailable. Please try again later.',
        details: 'All attempted models failed.'
    });
}
