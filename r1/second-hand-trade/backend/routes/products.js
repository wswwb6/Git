const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// 配置multer处理商品图片上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../../uploads/products');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uuidv4() + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件'), false);
    }
  }
});

module.exports = (pool) => {
  // 获取轮播图商品
  router.get('/featured', async (req, res) => {
    try {
      const [products] = await pool.query(
        `SELECT p.id, p.name, p.price, p.image, 
                AVG(r.rating) as avg_rating, 
                COUNT(r.id) as review_count,
                COUNT(DISTINCT oi.id) as sold_count
         FROM products p
         LEFT JOIN reviews r ON p.id = r.product_id
         LEFT JOIN order_items oi ON p.id = oi.product_id
         WHERE p.status = 'published' AND p.featured = 1
         GROUP BY p.id
         ORDER BY sold_count DESC
         LIMIT 5`
      );

      res.json(products);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '获取推荐商品失败' });
    }
  });

  // 获取所有商品(分页)
  router.get('/', async (req, res) => {
    try {
      const { page = 1, limit = 10, search, sort, order = 'desc' } = req.query;
      const offset = (page - 1) * limit;

      let query = `SELECT p.id, p.name, p.price, p.image, p.status, 
                          AVG(r.rating) as avg_rating, 
                          COUNT(r.id) as review_count,
                          COUNT(DISTINCT oi.id) as sold_count,
                          u.username as seller_name
                   FROM products p
                   LEFT JOIN reviews r ON p.id = r.product_id
                   LEFT JOIN order_items oi ON p.id = oi.product_id
                   LEFT JOIN users u ON p.seller_id = u.id
                   WHERE p.status = 'published'`;

      const params = [];
      
      // 搜索条件
      if (search) {
        query += ' AND p.name LIKE ?';
        params.push(`%${search}%`);
      }

      query += ' GROUP BY p.id';

      // 排序
      if (sort) {
        let sortField;
        switch (sort) {
          case 'price':
            sortField = 'p.price';
            break;
          case 'rating':
            sortField = 'avg_rating';
            break;
          case 'sold':
            sortField = 'sold_count';
            break;
          default:
            sortField = 'p.created_at';
        }
        query += ` ORDER BY ${sortField} ${order.toUpperCase()}`;
      } else {
        query += ' ORDER BY p.created_at DESC';
      }

      // 分页
      query += ' LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const [products] = await pool.query(query, params);

      // 获取总数
      let countQuery = 'SELECT COUNT(*) as total FROM products WHERE status = "published"';
      if (search) {
        countQuery += ' AND name LIKE ?';
      }
      const [total] = await pool.query(countQuery, search ? [`%${search}%`] : []);

      res.json({
        products,
        total: total[0].total,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '获取商品列表失败' });
    }
  });

  // 获取商品详情
  router.get('/:id', async (req, res) => {
    try {
      const [product] = await pool.query(
        `SELECT p.*, 
                AVG(r.rating) as avg_rating, 
                COUNT(r.id) as review_count,
                COUNT(DISTINCT oi.id) as sold_count,
                u.username as seller_name
         FROM products p
         LEFT JOIN reviews r ON p.id = r.product_id
         LEFT JOIN order_items oi ON p.id = oi.product_id
         LEFT JOIN users u ON p.seller_id = u.id
         WHERE p.id = ? AND p.status = 'published'
         GROUP BY p.id`,
        [req.params.id]
      );

      if (product.length === 0) {
        return res.status(404).json({ message: '商品不存在或已下架' });
      }

      // 获取商品评价
      const [reviews] = await pool.query(
        `SELECT r.id, r.rating, r.comment, r.created_at, 
                u.username as reviewer_name, u.avatar as reviewer_avatar
         FROM reviews r
         JOIN users u ON r.user_id = u.id
         WHERE r.product_id = ?
         ORDER BY r.created_at DESC
         LIMIT 5`,
        [req.params.id]
      );

      res.json({
        ...product[0],
        reviews
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '获取商品详情失败' });
    }
  });

  // 商家发布商品
  router.post('/', upload.array('images', 5), async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'seller') {
        return res.status(403).json({ message: '只有商家可以发布商品' });
      }

      const { name, description, price, stock, category, delivery_methods } = req.body;
      
      // 处理上传的图片
      const images = req.files.map(file => `/uploads/products/${file.filename}`);

      // 插入商品
      const [result] = await pool.query(
        `INSERT INTO products 
         (seller_id, name, description, price, stock, category, delivery_methods, images, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [req.user.id, name, description, price, stock, category, delivery_methods, JSON.stringify(images)]
      );

      res.status(201).json({ 
        id: result.insertId,
        message: '商品已提交审核'
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '发布商品失败' });
    }
  });

  // 商家获取自己的商品列表
  router.get('/seller/me', async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'seller') {
        return res.status(403).json({ message: '只有商家可以查看自己的商品' });
      }

      const [products] = await pool.query(
        `SELECT p.id, p.name, p.price, p.stock, p.status, p.created_at,
                AVG(r.rating) as avg_rating, 
                COUNT(r.id) as review_count,
                COUNT(DISTINCT oi.id) as sold_count
         FROM products p
         LEFT JOIN reviews r ON p.id = r.product_id
         LEFT JOIN order_items oi ON p.id = oi.product_id
         WHERE p.seller_id = ?
         GROUP BY p.id
         ORDER BY p.created_at DESC`,
        [req.user.id]
      );

      res.json(products);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '获取商品列表失败' });
    }
  });

  // 商家更新商品
  router.put('/seller/:id', upload.array('images', 5), async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'seller') {
        return res.status(403).json({ message: '只有商家可以更新商品' });
      }

      const { name, description, price, stock, category, delivery_methods } = req.body;
      
      // 检查商品是否属于当前商家
      const [product] = await pool.query(
        'SELECT seller_id FROM products WHERE id = ?',
        [req.params.id]
      );
      
      if (product.length === 0) {
        return res.status(404).json({ message: '商品不存在' });
      }

      if (product[0].seller_id !== req.user.id) {
        return res.status(403).json({ message: '无权更新此商品' });
      }

      // 处理上传的图片
      let images = [];
      if (req.files && req.files.length > 0) {
        images = req.files.map(file => `/uploads/products/${file.filename}`);
      }

      // 更新商品
      await pool.query(
        `UPDATE products 
         SET name = ?, description = ?, price = ?, stock = ?, category = ?, delivery_methods = ?,
             ${images.length > 0 ? 'images = ?,' : ''} status = 'pending'
         WHERE id = ?`,
        [
          name, description, price, stock, category, delivery_methods,
          ...(images.length > 0 ? [JSON.stringify(images)] : []),
          req.params.id
        ]
      );

      res.json({ message: '商品已更新并重新提交审核' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '更新商品失败' });
    }
  });

  // 商家下架商品
  router.put('/seller/:id/unpublish', async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'seller') {
        return res.status(403).json({ message: '只有商家可以下架商品' });
      }

      // 检查商品是否属于当前商家
      const [product] = await pool.query(
        'SELECT seller_id FROM products WHERE id = ?',
        [req.params.id]
      );
      
      if (product.length === 0) {
        return res.status(404).json({ message: '商品不存在' });
      }

      if (product[0].seller_id !== req.user.id) {
        return res.status(403).json({ message: '无权下架此商品' });
      }

      // 下架商品
      await pool.query(
        'UPDATE products SET status = "unpublished" WHERE id = ?',
        [req.params.id]
      );

      res.json({ message: '商品已下架' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '下架商品失败' });
    }
  });

  // 商家发货
  router.post('/seller/orders/:id/ship', async (req, res) => {
    try {
      if (!req.user || req.user.role !== 'seller') {
        return res.status(403).json({ message: '只有商家可以发货' });
      }

      const { tracking_number, shipping_company } = req.body;

      // 检查订单是否属于当前商家
      const [order] = await pool.query(
        `SELECT o.id 
         FROM orders o
         JOIN order_items oi ON o.id = oi.order_id
         JOIN products p ON oi.product_id = p.id
         WHERE o.id = ? AND p.seller_id = ? AND o.status = 'paid'`,
        [req.params.id, req.user.id]
      );
      
      if (order.length === 0) {
        return res.status(404).json({ message: '订单不存在或无权操作' });
      }

      // 更新订单状态
      await pool.query(
        `UPDATE orders 
         SET status = 'shipped', 
             tracking_number = ?,
             shipping_company = ?,
             shipped_at = NOW()
         WHERE id = ?`,
        [tracking_number, shipping_company, req.params.id]
      );

      res.json({ message: '订单已发货' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '发货失败' });
    }
  });

  // 添加商品评价
  router.post('/:id/reviews', async (req, res) => {
    try {
      const { rating, comment } = req.body;

      // 检查用户是否购买过此商品
      const [purchase] = await pool.query(
        `SELECT oi.id 
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE oi.product_id = ? AND o.user_id = ? AND o.status = 'completed'`,
        [req.params.id, req.user.id]
      );
      
      if (purchase.length === 0) {
        return res.status(403).json({ message: '只有购买过此商品的用户才能评价' });
      }

      // 检查是否已评价
      const [existingReview] = await pool.query(
        'SELECT id FROM reviews WHERE product_id = ? AND user_id = ?',
        [req.params.id, req.user.id]
      );

      if (existingReview.length > 0) {
        return res.status(400).json({ message: '您已经评价过此商品' });
      }

      // 添加评价
      await pool.query(
        'INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)',
        [req.params.id, req.user.id, rating, comment]
      );

      res.status(201).json({ message: '评价已提交' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: '提交评价失败' });
    }
  });

  return router;
};
