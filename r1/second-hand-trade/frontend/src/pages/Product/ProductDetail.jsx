import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Carousel, Card, Button, Rate, Tabs, Comment, List, Input, message } from 'antd';
import { ShoppingCartOutlined, HeartOutlined } from '@ant-design/icons';
import axios from 'axios';
import './ProductDetail.css';

const { TabPane } = Tabs;
const { TextArea } = Input;

const ProductDetail = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [reviewText, setReviewText] = useState('');
  const [rating, setRating] = useState(5);

  useEffect(() => {
    fetchProduct();
    fetchReviews();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const res = await axios.get(`/api/products/${id}`);
      setProduct(res.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchReviews = async () => {
    try {
      const res = await axios.get(`/api/products/${id}/reviews`);
      setReviews(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddToCart = () => {
    // 添加到购物车逻辑
    message.success('已添加到购物车');
  };

  const handleBuyNow = () => {
    // 立即购买逻辑
    window.location.href = `/checkout?product=${id}&quantity=${quantity}`;
  };

  const handleSubmitReview = async () => {
    try {
      await axios.post(`/api/products/${id}/reviews`, {
        rating,
        comment: reviewText
      });
      message.success('评价提交成功');
      setReviewText('');
      fetchReviews();
    } catch (err) {
      message.error('评价提交失败');
    }
  };

  if (loading) return <div>加载中...</div>;

  return (
    <div className="product-detail-container">
      <div className="product-images">
        <Carousel>
          {product.images.map((img, index) => (
            <div key={index}>
              <img src={img} alt={`商品图片 ${index + 1}`} />
            </div>
          ))}
        </Carousel>
      </div>

      <div className="product-info">
        <h1>{product.name}</h1>
        <div className="price-section">
          <span className="current-price">¥{product.price}</span>
          {product.originalPrice && (
            <span className="original-price">¥{product.originalPrice}</span>
          )}
        </div>

        <div className="rating-section">
          <Rate disabled value={product.rating} />
          <span className="rating-text">{product.rating} ({product.reviewCount}条评价)</span>
        </div>

        <div className="stock-section">
          <span>库存: {product.stock}件</span>
          <span>销量: {product.sales}件</span>
        </div>

        <div className="quantity-section">
          <span>数量:</span>
          <Button.Group>
            <Button onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</Button>
            <Button>{quantity}</Button>
            <Button onClick={() => setQuantity(quantity + 1)}>+</Button>
          </Button.Group>
        </div>

        <div className="action-buttons">
          <Button
            type="primary"
            icon={<ShoppingCartOutlined />}
            onClick={handleAddToCart}
          >
            加入购物车
          </Button>
          <Button
            type="danger"
            onClick={handleBuyNow}
          >
            立即购买
          </Button>
          <Button icon={<HeartOutlined />} />
        </div>
      </div>

      <div className="product-tabs">
        <Tabs defaultActiveKey="1">
          <TabPane tab="商品详情" key="1">
            <div dangerouslySetInnerHTML={{ __html: product.description }} />
          </TabPane>
          <TabPane tab="商品评价" key="2">
            <div className="review-section">
              <h3>发表评价</h3>
              <Rate value={rating} onChange={setRating} />
              <TextArea
                rows={4}
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="分享你的使用体验"
              />
              <Button
                type="primary"
                onClick={handleSubmitReview}
                style={{ marginTop: 16 }}
              >
                提交评价
              </Button>
            </div>

            <List
              className="review-list"
              itemLayout="horizontal"
              dataSource={reviews}
              renderItem={(item) => (
                <li>
                  <Comment
                    author={item.user.name}
                    avatar={item.user.avatar}
                    content={item.comment}
                    datetime={new Date(item.createdAt).toLocaleString()}
                  />
                </li>
              )}
            />
          </TabPane>
        </Tabs>
      </div>
    </div>
  );
};

export default ProductDetail;
