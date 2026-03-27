const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

// CORS - 允许所有来源
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

const API_KEY = process.env.DEEPSEEK_API_KEY;
const PORT = process.env.PORT || 3000;

// 根路径
app.get('/', (req, res) => {
  res.send('✅ AI法律助手服务运行中');
});

// 普通聊天接口
app.post('/api/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.status(400).json({ error: '消息不能为空' });
    }

    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是一位专业的中国法律顾问，擅长解答各类法律问题。请用中文回答，回答要专业、准确、易懂，适当引用相关法律条文。回答控制在500字以内。'
        },
        {
          role: 'user',
          content: userMessage
        }
      ],
      temperature: 0.7,
      max_tokens: 1000
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const rawReply = response.data.choices[0].message.content;

    // 简单清理Markdown
    const cleanReply = rawReply
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .trim();

    res.json({ reply: cleanReply });

  } catch (error) {
    console.error('API错误:', error.response?.data || error.message);
    res.status(500).json({
      error: 'AI服务暂时不可用',
      details: error.response?.data?.error?.message || error.message
    });
  }
});

// POST 流式接口（解决中文乱码）
app.post('/api/chat/stream', async (req, res) => {
  const message = req.body.message;

  if (!message) {
    return res.status(400).json({ error: '消息不能为空' });
  }

  // SSE 头部，明确指定 UTF-8
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是一位专业的中国法律顾问，擅长解答各类法律问题。请用中文回答，回答要专业、准确、易懂。'
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
      stream: true
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      responseType: 'stream',
      timeout: 60000
    });

    let buffer = '';

    response.data.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.trim() === '' || line.trim() === 'data: [DONE]') continue;

        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            const content = data.choices?.[0]?.delta?.content;

            if (content) {
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    });

    response.data.on('end', () => {
      res.write('data: [DONE]\n\n');
      res.end();
    });

    response.data.on('error', (err) => {
      console.error('Stream error:', err);
      res.write(`data: ${JSON.stringify({ error: '流式传输错误' })}\n\n`);
      res.end();
    });

  } catch (error) {
    console.error('API error:', error.message);
    res.write(`data: ${JSON.stringify({ error: '服务暂时不可用' })}\n\n`);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`✅ 服务器运行在端口 ${PORT}`);
  console.log(`📝 普通接口: POST /api/chat`);
  console.log(`🔄 流式接口: POST /api/chat/stream`);
});