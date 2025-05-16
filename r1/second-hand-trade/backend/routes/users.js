const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// 配置multer处理文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../../uploads/avatars');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'), false);
    }
  }
});

module.exports = (pool) => {
  // 获取用户信息
  router.get('/me', async (req, res) => {
    try {
      const [user] = await pool.query(
        'SELECT id, username, email, phone, avatar, bio, address, points, balance FROM users WHERE id = ?',
        [req.user.id]
      );
      
      if (user.length === 0) {
        return res.status(404).json({ message: '用户不存在' });
      }

      res.json(user[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '获取用户信息失败' });
    }
  });

  // 更新用户信息
  router.put('/me', async (req, res) => {
    try {
      const { username, bio, address } = req.body;
      
      await pool.query(
        'UPDATE users SET username = ?, bio = ?, address = ? WHERE id = ?',
        [username, bio, address, req.user.id]
      );

      res.json({ message: '用户信息更新成功' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '更新用户信息失败' });
    }
  });

  // 更新用户头像
  router.post('/me/avatar', upload.single('avatar'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: '请上传头像文件' });
      }

      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      
      await pool.query(
        'UPDATE users SET avatar = ? WHERE id = ?',
        [avatarUrl, req.user.id]
      );

      res.json({ avatar: avatarUrl });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '上传头像失败' });
    }
  });

  // 修改密码
  router.put('/me/password', async (req, res) => {
    try {
      const { oldPassword, newPassword } = req.body;
      
      // 验证旧密码
      const [users] = await pool.query(
        'SELECT password FROM users WHERE id = ?',
        [req.user.id]
      );
      
      const isMatch = await bcrypt.compare(oldPassword, users[0].password);
      if (!isMatch) {
        return res.status(400).json({ message: '旧密码不正确' });
      }

      // 更新密码
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await pool.query(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, req.user.id]
      );

      res.json({ message: '密码修改成功' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '修改密码失败' });
    }
  });

  // 获取购物车
  router.get('/cart', async (req, res) => {
    try {
      const [cartItems] = await pool.query(
        `SELECT c.id, p.id as product_id, p.name, p.price, p.image, c.quantity 
         FROM cart c 
         JOIN products p ON c.product_id = p.id 
         WHERE c.user_id = ?`,
        [req.user.id]
      );

      res.json(cartItems);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '获取购物车失败' });
    }
  });

  // 添加商品到购物车
  router.post('/cart', async (req, res) => {
    try {
      const { product_id, quantity } = req.body;
      
      // 检查商品是否存在
      const [product] = await pool.query(
        'SELECT id FROM products WHERE id = ?',
        [product_id]
      );
      
      if (product.length === 0) {
        return res.status(404).json({ message: '商品不存在' });
      }

      // 检查是否已在购物车
      const [existingItem] = await pool.query(
        'SELECT id FROM cart WHERE user_id = ? AND product_id = ?',
        [req.user.id, product_id]
      );

      if (existingItem.length > 0) {
        // 更新数量
        await pool.query(
          'UPDATE cart SET quantity = quantity + ? WHERE id = ?',
          [quantity, existingItem[0].id]
        );
      } else {
        // 新增
        await pool.query(
          'INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)',
          [req.user.id, product_id, quantity]
        );
      }

      res.status(201).json({ message: '商品已添加到购物车' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '添加购物车失败' });
    }
  });

  // 从购物车移除商品
  router.delete('/cart/:id', async (req, res) => {
    try {
      await pool.query(
        'DELETE FROM cart WHERE id = ? AND user_id = ?',
        [req.params.id, req.user.id]
      );

      res.json({ message: '商品已从购物车移除' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '移除购物车商品失败' });
    }
  });

  // 获取用户订单
  router.get('/orders', async (req, res) => {
    try {
      const [orders] = await pool.query(
        `SELECT o.id, o.order_number, o.total_amount, o.status, o.created_at, 
                p.id as product_id, p.name, p.image, oi.quantity, oi.price
         FROM orders o
         JOIN order_items oi ON o.id = oi.order_id
         JOIN products p ON oi.product_id = p.id
         WHERE o.user_id = ?
         ORDER BY o.created_at DESC`,
        [req.user.id]
      );

      // 将订单按order_id分组
      const groupedOrders = {};
      orders.forEach(item => {
        if (!groupedOrders[item.id]) {
          groupedOrders[item.id] = {
            id: item.id,
            order_number: item.order_number,
            total_amount: item.total_amount,
            status: item.status,
            created_at: item.created_at,
            items: []
          };
        }
        groupedOrders[item.id].items.push({
          product_id: item.product_id,
          name: item.name,
          image: item.image,
          quantity: item.quantity,
          price: item.price
        });
      });

      res.json(Object.values(groupedOrders));
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '获取订单失败' });
    }
  });

  // 获取用户钱包信息
  router.get('/wallet', async (req, res) => {
    try {
      const [wallet] = await pool.query(
        'SELECT balance, points FROM users WHERE id = ?',
        [req.user.id]
      );

      const [transactions] = await pool.query(
        'SELECT id, amount, type, description, created_at FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC',
        [req.user.id]
      );

      res.json({
        balance: wallet[0].balance,
        points: wallet[0].points,
        transactions
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '获取钱包信息失败' });
    }
  });

  // 获取用户评价
  router.get('/reviews', async (req, res) => {
    try {
      const [reviews] = await pool.query(
        `SELECT r.id, r.rating, r.comment, r.created_at, 
                p.id as product_id, p.name, p.image,
                s.username as seller_name
         FROM reviews r
         JOIN products p ON r.product_id = p.id
         JOIN users s ON p.seller_id = s.id
         WHERE r.user_id = ?
         ORDER BY r.created_at DESC`,
        [req.user.id]
      );

      res.json(reviews);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '获取评价失败' });
    }
  });

  return router;
};
