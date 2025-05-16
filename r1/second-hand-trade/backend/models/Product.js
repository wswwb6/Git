const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, '请输入商品名称'],
    trim: true,
    maxlength: [100, '商品名称不能超过100个字符']
  },
  description: {
    type: String,
    required: [true, '请输入商品描述']
  },
  price: {
    type: Number,
    required: [true, '请输入商品价格'],
    min: [0, '价格不能低于0']
  },
  category: {
    type: String,
    required: [true, '请选择商品类别'],
    enum: ['电子产品', '服装', '书籍', '家居', '其他']
  },
  size: String,
  color: String,
  condition: {
    type: String,
    enum: ['全新', '几乎全新', '轻微使用痕迹', '明显使用痕迹'],
    default: '轻微使用痕迹'
  },
  images: [{
    url: String,
    publicId: String
  }],
  stock: {
    type: Number,
    required: [true, '请输入库存数量'],
    min: [0, '库存不能小于0']
  },
  sold: {
    type: Number,
    default: 0
  },
  ratingsAverage: {
    type: Number,
    default: 0,
    min: [0, '评分不能低于0'],
    max: [5, '评分不能高于5']
  },
  ratingsQuantity: {
    type: Number,
    default: 0
  },
  deliveryMethod: {
    type: [String],
    enum: ['快递', '同城自提', '线下交易'],
    required: [true, '请选择至少一种交易方式']
  },
  seller: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, '商品必须属于某个商家']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected'],
    default: 'draft'
  },
  rejectionReason: String,
  platformFee: {
    type: Number,
    default: 0.05 // 默认5%平台费
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 虚拟填充评价
productSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'product',
  localField: '_id'
});

// 计算平均评分
productSchema.statics.calcAverageRatings = async function(productId) {
  const stats = await this.aggregate([
    {
      $match: { _id: productId }
    },
    {
      $lookup: {
        from: 'reviews',
        localField: '_id',
        foreignField: 'product',
        as: 'reviews'
      }
    },
    {
      $unwind: '$reviews'
    },
    {
      $group: {
        _id: '$_id',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$reviews.rating' }
      }
    }
  ]);

  if (stats.length > 0) {
    await this.findByIdAndUpdate(productId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating
    });
  } else {
    await this.findByIdAndUpdate(productId, {
      ratingsQuantity: 0,
      ratingsAverage: 0
    });
  }
};

productSchema.post('save', function() {
  this.constructor.calcAverageRatings(this._id);
});

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
