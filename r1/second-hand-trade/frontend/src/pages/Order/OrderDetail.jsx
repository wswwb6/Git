import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Card, 
  Button, 
  Descriptions, 
  Table, 
  Tag, 
  message, 
  Space,
  Divider,
  Statistic,
  Popconfirm
} from 'antd';
import { 
  ArrowLeftOutlined,
  CheckCircleOutlined,
  UndoOutlined,
  ShoppingCartOutlined,
  DollarOutlined,
  StarOutlined,
  MessageOutlined
} from '@ant-design/icons';
import api from '../../api';
import dayjs from 'dayjs';

const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState('');
  const [sellerReviewRating, setSellerReviewRating] = useState(5);
  const [sellerReviewContent, setSellerReviewContent] = useState('');

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      const response = await api.get(`/orders/${id}`);
      setOrder(response.data);
    } catch (error) {
      message.error('获取订单详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReceipt = async () => {
    setSubmitting(true);
    try {
      await api.patch(`/orders/${id}/complete`);
      message.success('确认收货成功');
      fetchOrder();
    } catch (error) {
      message.error('确认收货失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReview = async () => {
    setSubmitting(true);
    try {
      await api.post(`/orders/${id}/review`, {
        rating: reviewRating,
        content: reviewContent
      });
      message.success('评价提交成功');
      fetchOrder();
    } catch (error) {
      message.error('评价提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitSellerReview = async () => {
    setSubmitting(true);
    try {
      await api.post(`/orders/${id}/seller-review`, {
        rating: sellerReviewRating,
        content: sellerReviewContent
      });
      message.success('卖家评价提交成功');
      fetchOrder();
    } catch (error) {
      message.error('卖家评价提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnRequest = async () => {
    setSubmitting(true);
    try {
      await api.post(`/orders/${id}/return`);
      message.success('退货申请已提交');
      fetchOrder();
    } catch (error) {
      message.error('申请退货失败');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusTag = (status) => {
    const statusMap = {
      pending: { color: 'orange', text: '待支付' },
      paid: { color: 'blue', text: '已支付' },
      shipped: { color: 'purple', text: '已发货' },
      completed: { color: 'green', text: '已完成' },
      returned: { color: 'red', text: '已退货' },
      returning: { color: 'volcano', text: '退货中' }
    };
    return <Tag color={statusMap[status]?.color}>{statusMap[status]?.text}</Tag>;
  };

  const columns = [
    {
      title: '商品',
      dataIndex: 'product',
      key: 'product',
      render: (product) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img 
            src={product.image} 
            alt={product.name} 
            style={{ width: 60, height: 60, objectFit: 'cover', marginRight: 16 }}
          />
          <div>
            <div>{product.name}</div>
            <div style={{ color: '#999' }}>{product.category}</div>
          </div>
        </div>
      )
    },
    {
      title: '单价',
      dataIndex: 'price',
      key: 'price',
      render: (price) => `¥${price}`
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity'
    },
    {
      title: '小计',
      key: 'subtotal',
      render: (_, record) => `¥${(record.price * record.quantity).toFixed(2)}`
    }
  ];

  if (loading) return <div>加载中...</div>;
  if (!order) return <div>订单不存在</div>;

  const canConfirmReceipt = order.status === 'shipped';
  const canReturn = order.status === 'completed' && 
    dayjs().isBefore(dayjs(order.completed_at).add(24, 'hour'));

  return (
    <div className="order-detail">
      <Button 
        type="text" 
        icon={<ArrowLeftOutlined />} 
        onClick={() => navigate(-1)}
      >
        返回
      </Button>

      <Card title={`订单详情 - ${order.id}`} style={{ marginTop: 16 }}>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="订单状态">
            {getStatusTag(order.status)}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(order.created_at).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="卖家">
            {order.seller_name || '平台自营'}
          </Descriptions.Item>
          <Descriptions.Item label="收货地址">
            {order.shipping_address}
          </Descriptions.Item>
          <Descriptions.Item label="交易方式">
            {order.delivery_method === 'express' ? '快递' : '线下交易'}
          </Descriptions.Item>
          <Descriptions.Item label="运费">
            ¥{order.shipping_fee}
          </Descriptions.Item>
        </Descriptions>

        <Divider orientation="left">商品清单</Divider>
        <Table
          columns={columns}
          dataSource={order.items}
          rowKey="id"
          pagination={false}
        />

        <div style={{ textAlign: 'right', marginTop: 24 }}>
          <Space size="large">
            <Statistic title="商品总价" value={`¥${order.subtotal}`} />
            <Statistic title="运费" value={`¥${order.shipping_fee}`} />
            {order.points_discount > 0 && (
              <Statistic 
                title="积分抵扣" 
                value={`-¥${order.points_discount}`} 
                valueStyle={{ color: '#f5222d' }}
              />
            )}
            <Statistic 
              title="实付金额" 
              value={`¥${order.total_amount}`} 
              valueStyle={{ fontSize: 20, fontWeight: 'bold' }}
            />
          </Space>
        </div>

        {order.status === 'completed' && !order.buyer_review && (
          <Divider orientation="left">评价商品</Divider>
        )}
        {order.status === 'completed' && !order.buyer_review && (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ marginRight: 8 }}>商品评分:</span>
              {[1, 2, 3, 4, 5].map(star => (
                <StarOutlined 
                  key={star}
                  style={{ 
                    color: star <= reviewRating ? '#fadb14' : '#d9d9d9',
                    fontSize: 24,
                    cursor: 'pointer',
                    marginRight: 8
                  }}
                  onClick={() => setReviewRating(star)}
                />
              ))}
            </div>
            <Input.TextArea
              rows={4}
              placeholder="请写下您的评价..."
              value={reviewContent}
              onChange={(e) => setReviewContent(e.target.value)}
              style={{ marginBottom: 16 }}
            />
            <Button 
              type="primary" 
              icon={<MessageOutlined />}
              onClick={handleSubmitReview}
              loading={submitting}
            >
              提交评价
            </Button>
          </Card>
        )}

        {order.status === 'completed' && order.buyer_review && (
          <Divider orientation="left">我的评价</Divider>
        )}
        {order.status === 'completed' && order.buyer_review && (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <StarOutlined 
                  key={i}
                  style={{ 
                    color: i < order.buyer_review.rating ? '#fadb14' : '#d9d9d9',
                    fontSize: 16
                  }}
                />
              ))}
            </div>
            <div>{order.buyer_review.content}</div>
            <div style={{ color: '#999', marginTop: 8 }}>
              {dayjs(order.buyer_review.created_at).format('YYYY-MM-DD HH:mm')}
            </div>
          </Card>
        )}

        {order.status === 'completed' && !order.seller_review && order.seller_id && (
          <Divider orientation="left">评价买家</Divider>
        )}
        {order.status === 'completed' && !order.seller_review && order.seller_id && (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <span style={{ marginRight: 8 }}>买家评分:</span>
              {[1, 2, 3, 4, 5].map(star => (
                <StarOutlined 
                  key={star}
                  style={{ 
                    color: star <= sellerReviewRating ? '#fadb14' : '#d9d9d9',
                    fontSize: 24,
                    cursor: 'pointer',
                    marginRight: 8
                  }}
                  onClick={() => setSellerReviewRating(star)}
                />
              ))}
            </div>
            <Input.TextArea
              rows={4}
              placeholder="请写下对买家的评价..."
              value={sellerReviewContent}
              onChange={(e) => setSellerReviewContent(e.target.value)}
              style={{ marginBottom: 16 }}
            />
            <Button 
              type="primary" 
              icon={<MessageOutlined />}
              onClick={handleSubmitSellerReview}
              loading={submitting}
            >
              提交评价
            </Button>
          </Card>
        )}

        {order.status === 'completed' && order.seller_review && (
          <Divider orientation="left">卖家对我的评价</Divider>
        )}
        {order.status === 'completed' && order.seller_review && (
          <Card style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <StarOutlined 
                  key={i}
                  style={{ 
                    color: i < order.seller_review.rating ? '#fadb14' : '#d9d9d9',
                    fontSize: 16
                  }}
                />
              ))}
            </div>
            <div>{order.seller_review.content}</div>
            <div style={{ color: '#999', marginTop: 8 }}>
              {dayjs(order.seller_review.created_at).format('YYYY-MM-DD HH:mm')}
            </div>
          </Card>
        )}

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Space>
            {canConfirmReceipt && (
              <Popconfirm
                title="确认收到商品？"
                onConfirm={handleConfirmReceipt}
                okText="确认"
                cancelText="取消"
              >
                <Button 
                  type="primary" 
                  icon={<CheckCircleOutlined />}
                  loading={submitting}
                >
                  确认收货
                </Button>
              </Popconfirm>
            )}
            {canReturn && (
              <Popconfirm
                title="确定要申请退货吗？"
                onConfirm={handleReturnRequest}
                okText="确定"
                cancelText="取消"
              >
                <Button 
                  danger 
                  icon={<UndoOutlined />}
                  loading={submitting}
                >
                  申请退货
                </Button>
              </Popconfirm>
            )}
            <Button 
              icon={<ShoppingCartOutlined />}
              onClick={() => navigate('/')}
            >
              继续购物
            </Button>
            {order.status === 'pending' && (
              <Button 
                type="primary" 
                icon={<DollarOutlined />}
                onClick={() => navigate(`/payment/${order.id}`)}
              >
                去支付
              </Button>
            )}
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default OrderDetail;
