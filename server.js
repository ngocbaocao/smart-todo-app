const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Kết nối MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Kết nối MongoDB thành công!'))
  .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// Schema Task có bổ sung trường date (Định dạng: YYYY-MM-DD)
const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  isCompleted: { type: Boolean, default: false },
  date: { type: String, required: true }, // VD: "2026-08-17"
  createdAt: { type: Date, default: Date.now }
});

const Task = mongoose.model('Task', taskSchema);

// Hàm gửi tin nhắn Telegram
async function sendTelegramMessage(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await axios.post(url, { chat_id: chatId, text: text, parse_mode: 'HTML' });
  } catch (err) {
    console.error('❌ Lỗi gửi Telegram:', err.message);
  }
}

// API 1: Lấy danh sách công việc THEO NGÀY
app.get('/api/tasks', async (req, res) => {
  try {
    const targetDate = req.query.date; // Nhận ngày từ Query URL
    const query = targetDate ? { date: targetDate } : {};
    const tasks = await Task.find(query).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi server' });
  }
});

// API 2: Thêm công việc mới VÀO NGÀY ĐƯỢC CHỌN
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, date } = req.body;
    const newTask = new Task({ title, date });
    await newTask.save();
    res.status(201).json(newTask);
  } catch (err) {
    res.status(400).json({ error: 'Lỗi thêm công việc' });
  }
});

// API 3: Tick hoàn thành / Hủy hoàn thành
app.patch('/api/tasks/:id/toggle', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Không tìm thấy công việc' });

    task.isCompleted = !task.isCompleted;
    await task.save();

    if (task.isCompleted) {
      await sendTelegramMessage(`🎉 <b>Chúc mừng! Bạn vừa hoàn thành:</b>\n👉 "${task.title}" (Ngày: ${task.date})`);
    }

    res.json(task);
  } catch (err) {
    res.status(400).json({ error: 'Lỗi cập nhật' });
  }
});

// API 4: Xóa công việc
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: 'Đã xóa công việc' });
  } catch (err) {
    res.status(400).json({ error: 'Lỗi xóa công việc' });
  }
});

// Cron Job: Nhắc nhở danh sách việc chưa làm lúc 21:00 hàng ngày
cron.schedule('0 21 * * *', async () => {
  const todayStr = new Date().toISOString().split('T')[0];
  const pendingTasks = await Task.find({ date: todayStr, isCompleted: false });
  if (pendingTasks.length > 0) {
    let msg = `⏰ <b>NHẮC NHỞ TỐI (${todayStr}): Bạn còn ${pendingTasks.length} việc chưa làm!</b>\n\n`;
    pendingTasks.forEach((t, i) => { msg += `${i + 1}. ${t.title}\n`; });
    await sendTelegramMessage(msg);
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend đang chạy tại port ${PORT}`);
});
