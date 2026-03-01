import { messagingApi } from '@line/bot-sdk';
import OpenAI from 'openai';

// 1. 初始化 OpenAI 客戶端 (採用 2026 最新寫法)
// 使用 .trim() 強制清除您不小心複製到的隱形空白與換行，永久消滅 500 錯誤！
const openai = new OpenAI({
  apiKey: (process.env.OPENAI_API_KEY || '').trim(),
});

// 2. 初始化 LINE 客戶端
const client = new messagingApi.MessagingApiClient({
  channelAccessToken: (process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim()
});

// 3. Vercel 原生 Serverless 處理函式
export default async function handler(req, res) {
  // 防呆機制：確保只接收 LINE 傳來的 POST 請求
  if (req.method !== 'POST') {
    return res.status(200).send('LINE Bot Webhook 正常運作中，請使用 LINE 傳送訊息。');
  }

  try {
    const events = req.body.events;
    if (!events || events.length === 0) {
      return res.status(200).send('OK');
    }

    // 4. 處理收到的每一個事件
    await Promise.all(events.map(async (event) => {
      // 忽略非文字訊息 (如貼圖、照片)
      if (event.type !== 'message' || event.message.type !== 'text') {
        return;
      }

      const userMessage = event.message.text;

      // 5. 呼叫 OpenAI API
      // 指定使用 gpt-4o-mini，生成速度極快，完美避開 Vercel 10秒超時限制
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          // 加入這行系統提示詞，強力約束 AI 的行為與語言
          { role: "system", content: "你是一個專業的 AI 助理，請務必嚴格使用繁體中文（台灣）來回答使用者的所有問題。" },
          { role: "user", content: userMessage }
        ],
        max_tokens: 800, // 控制最高字數以維持極速回應
      });

      const aiReply = completion.choices[0].message.content;

      // 6. 將 AI 的回答傳回給 LINE
      await client.replyMessage({
        replyToken: event.replyToken,
        messages: [{ type: 'text', text: aiReply }],
      });
    }));

    // 處理完畢，告訴 LINE 伺服器「我收到了」
    return res.status(200).send('OK');

  } catch (error) {
    // 錯誤攔截：即使發生錯誤，也要回傳 200 給 LINE，避免 LINE 瘋狂重試導致機器人崩潰
    console.error('Webhook 處理過程發生錯誤:', error);
    return res.status(200).send('Error Occurred');
  }
}
