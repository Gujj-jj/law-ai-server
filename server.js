const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.DEEPSEEK_API_KEY;
const PORT = process.env.PORT || 3000;

// 测试接口
app.get('/', (req, res) => {
  res.send('AI法律助手服务运行中');
});

// 聊天接口
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
      timeout: 30000 // 30秒超时
    });
    
    const reply = response.data.choices[0].message.content;
    res.json({ reply: reply });
    
  } catch (error) {
    console.error('API调用错误:', error.response?.data || error.message);
    
    // 返回详细的错误信息
    res.status(500).json({ 
      error: 'AI服务暂时不可用',
      details: error.response?.data?.error?.message || error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ 服务器运行在 http://localhost:${PORT}`);
  console.log(`📝 测试地址: http://localhost:${PORT}/`);
  console.log(`🤖 API地址: http://localhost:${PORT}/api/chat`);
});