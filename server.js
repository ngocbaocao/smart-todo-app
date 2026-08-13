const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware đọc dữ liệu JSON và phục vụ file tĩnh trong thư mục public
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Kết nối Cơ sở dữ liệu MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/habit-tracker';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Đã kết nối MongoDB thành công!'))
  .catch(err => console.error('❌ Lỗi kết nối MongoDB:', err));

// Cấu trúc dữ liệu Công việc (Schema) - Bổ sung priority
const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: String, required: true },
  isCompleted: { type: Boolean, default: false },
  priority: { type: String, default: 'normal' }
}, { timestamps: true });

const Task = mongoose.model('Task', taskSchema);

// --- API ROUTES ---

// 1. Lấy danh sách công việc theo ngày
app.get('/api/tasks', async (req, res) => {
  try {
    const { date } = req.query;
    const filter = date ? { date } : {};
    const tasks = await Task.find(filter).sort({ createdAt: 1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Thêm công việc mới
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, date, priority } = req.body;
    const newTask = new Task({
      title,
      date,
      priority: priority || 'normal'
    });
    await newTask.save();
    res.status(201).json(newTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. ✏️ Cập nhật Tên & Độ ưu tiên (Nút 3 chấm - PUT)
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { title, priority, date } = req.body;
    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { title, priority, date },
      { new: true }
    );
    if (!updatedTask) {
      return res.status(404).json({ error: 'Không tìm thấy công việc!' });
    }
    res.json(updatedTask);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Bật/Tắt trạng thái hoàn thành
app.patch('/api/tasks/:id/toggle', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Không tìm thấy công việc!' });
    }
    task.isCompleted = !task.isCompleted;
    await task.save();
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Xóa công việc
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const deletedTask = await Task.findByIdAndDelete(req.params.id);
    if (!deletedTask) {
      return res.status(404).json({ error: 'Không tìm thấy công việc!' });
    }
    res.json({ message: 'Đã xóa công việc thành công!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback route cho giao diện Frontend (Tương thích chuẩn Express 5+)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Khởi chạy Server
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại port ${PORT}`);
});
