const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');

const userSchema = new mongoose.Schema({
  // 基本信息
  name: {
    type: String,
    required: [true, '请输入姓名']
  },
  phone: {
    type: String,
    unique: true,
    validate: {
      validator: function(v) {
        return /^1[3-9]\d{9}$/.test(v);
      },
      message: '请输入有效的手机号'
    }
  },
  email: {
    type: String,
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, '请输入有效的邮箱']
  },
  city: String,
  gender: {
    type: String,
    enum: ['male', 'female', 'other']
  },
  bankAccount: {
    type: String,
    validate: {
      validator: function(v) {
        return /^\d{16}$/.test(v);
      },
      message: '银行账号必须是16位数字'
    }
  },

  // 登录凭证
  password: {
    type: String,
    required: [true, '请输入密码'],
    minlength: 6,
    select: false
  },
  passwordChangedAt: Date,
  
  // 用户角色
  role: {
    type: String,
    enum: ['user', 'seller', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // 钱包信息
  balance: {
    type: Number,
    default: 0
  },
  points: {
    type: Number,
    default: 0
  },
  
  // 收货地址
  addresses: [{
    receiver: String,
    phone: String,
    address: String,
    isDefault: {
      type: Boolean,
      default: false
    }
  }],
  
  // 评价信息
  ratings: [{
    product: {
      type: mongoose.Schema.ObjectId,
      ref: 'Product'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // 商家特有字段
  shopName: String,
  shopDescription: String,
  shopRating: {
    type: Number,
    default: 5
  },
  isShopBanned: {
    type: Boolean,
    default: false
  },
  banExpires: Date
}, {
  timestamps: true
});

// 密码加密
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// 密码验证
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// 密码修改后
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
