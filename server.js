const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');
require('dotenv').config();
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Kết nối Database
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ Đã kết nối thành công MongoDB Atlas!'))
  .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// Schema dữ liệu Công việc
const taskSchema = new mongoose.Schema({
  title: String,
  isCompleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const Task = mongoose.model('Task', taskSchema);

// Hàm gửi tin nhắn qua Telegram
async function sendTelegramMsg(text) {
  try {
    const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    await axios.post(url, {
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: 'HTML'
    });
  } catch (err) {
    console.error('Lỗi gửi tin nhắn Telegram:', err.message);
  }
}

// --- CÁC ĐƯỜNG DẪN API ---
// 1. Lấy danh sách công việc
app.get('/api/tasks', async (req, res) => {
  const tasks = await Task.find().sort({ createdAt: -1 });
  res.json(tasks);
});

// 2. Thêm công việc mới
app.post('/api/tasks', async (req, res) => {
  const task = new Task({ title: req.body.title });
  await task.save();
  res.json(task);
});

// 3. Tick hoàn thành công việc (Báo tức thì qua Telegram)
app.patch('/api/tasks/:id/toggle', async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).send('Not Found');

  task.isCompleted = !task.isCompleted;
  await task.save();

  if (task.isCompleted) {
    sendTelegramMsg(`🎉 <b>Chúc mừng! Bạn vừa hoàn thành:</b>\n👉 "${task.title}"`);
  }
  res.json(task);
});

// 4. Xóa công việc
app.delete('/api/tasks/:id', async (req, res) => {
  await Task.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// --- HỆ THỐNG CRON JOB (TỰ ĐỘNG THÔNG BÁO) ---
// Nhắc nhở định kỳ mỗi 2 tiếng (vào phút 00)
cron.schedule('0 */2 * * *', async () => {
  const pendingTasks = await Task.find({ isCompleted: false });
  if (pendingTasks.length > 0) {
    let msg = `⏰ <b>NHẮC NHỞ: Bạn còn ${pendingTasks.length} công việc chưa làm:</b>\n`;
    pendingTasks.forEach(t => msg += `- ${t.title}\n`);
    sendTelegramMsg(msg);
  }
});

// Báo cáo tổng kết lúc 23:00 tối hằng ngày
cron.schedule('0 21 * * *', async () => {
  const allTasks = await Task.find();
  const completed = allTasks.filter(t => t.isCompleted);
  const pending = allTasks.filter(t => !t.isCompleted);

  let msg = `📊 <b>BÁO CÁO CUỐI NGÀY (23:00)</b>\n\n`;
  msg += `✅ <b>Đã hoàn thành (${completed.length}):</b>\n`;
  completed.forEach(t => msg += `- ${t.title}\n`);
  msg += `\n⏳ <b>Chưa hoàn thành (${pending.length}):</b>\n`;
  pending.forEach(t => msg += `- ${t.title}\n`);

  sendTelegramMsg(msg);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend đang chạy tại port ${PORT}`));